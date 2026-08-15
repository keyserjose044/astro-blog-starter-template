import { getDailyMeta, getYears } from '../utils/dailyData';
import { METRICS, calendarBounds, iso, seriesFor } from './statsExplorerV2Core';
import type { MetricKey, RangeKey, ViewKey } from './statsExplorerV2Core';

const validView = (value: string | null): ViewKey => ['daily', 'weekly', 'monthly', 'cumulative'].includes(value || '') ? value as ViewKey : 'monthly';
const validRange = (value: string | null): RangeKey => ['year', 'ytd', '30', '90', 'lifetime', 'custom'].includes(value || '') ? value as RangeKey : 'year';
const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function explorerMetric(params: URLSearchParams) {
  const key = (params.get('metric') || 'guitar') as MetricKey;
  return METRICS[key] ? key : 'guitar';
}

function copyFallback(value: string) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  return copied;
}

async function copyView(button: HTMLButtonElement) {
  const url = new URL(location.href);
  url.hash = 'graphs';
  let copied = false;
  try {
    await navigator.clipboard.writeText(url.toString());
    copied = true;
  } catch {
    copied = copyFallback(url.toString());
  }
  const original = button.textContent || 'Copy view';
  button.textContent = copied ? '✓ Copied' : 'Copy failed';
  setTimeout(() => { button.textContent = original; }, 1800);
}

async function exportCsv(button: HTMLButtonElement) {
  const original = button.textContent || 'Download CSV';
  button.disabled = true;
  button.textContent = 'Preparing…';
  try {
    const meta = await getDailyMeta();
    const records = await getYears(meta.availableYears);
    const params = new URL(location.href).searchParams;
    const metricKey = explorerMetric(params);
    const metric = METRICS[metricKey];
    const view = validView(params.get('view'));
    const range = validRange(params.get('range'));
    const latestYear = Number((meta.latestCompleteDate || meta.dataThrough || '').slice(0, 4)) || meta.availableYears.at(-1)!;
    const requestedYear = Number(params.get('year'));
    const year = meta.availableYears.includes(requestedYear) ? requestedYear : latestYear;
    const first = `${Math.min(...meta.availableYears)}-01-01`;
    const last = meta.dataThrough || iso(new Date());
    const customStart = params.get('start') || first;
    const customEnd = params.get('end') || last;
    const bounds = calendarBounds(year, range, metric, meta, customStart, customEnd);
    if (bounds.start > bounds.end) [bounds.start, bounds.end] = [bounds.end, bounds.start];

    const compare = params.get('compare') || '';
    let years = [year];
    if (['year', 'ytd'].includes(range)) {
      if (compare === 'all') years = meta.availableYears.slice().sort((a, b) => a - b);
      else if (compare === 'prior' && meta.availableYears.includes(year - 1)) years = [year, year - 1];
      else if (Number(compare) && meta.availableYears.includes(Number(compare)) && Number(compare) !== year) years = [year, Number(compare)];
    }
    const comparison = years.length > 1;

    const rows: string[][] = [[
      'metric', 'metric_label', 'unit', 'aggregation', 'view', 'range', 'series_year',
      'period_key', 'period_label', 'date', 'value', 'state', 'records_in_period',
    ]];

    years.forEach((itemYear) => {
      const itemBounds = comparison
        ? calendarBounds(itemYear, range === 'ytd' ? 'ytd' : 'year', metric, meta, customStart, customEnd)
        : bounds;
      const points = seriesFor(records, metric, view, itemBounds, meta);
      points.forEach((point) => {
        rows.push([
          metric.key,
          metric.label,
          metric.unit,
          metric.aggregate,
          view,
          range,
          String(itemYear),
          point.key,
          point.label,
          point.date || '',
          point.value === null ? '' : String(point.value),
          point.state,
          String(point.records.length),
        ]);
      });
    });

    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    const scope = range === 'year' || range === 'ytd' ? String(year) : range;
    link.download = `lifeloggerz-${metric.key}-${view}-${scope}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(href);
    button.textContent = '✓ Downloaded';
  } catch (error) {
    console.error('Stats CSV export failed', error);
    button.textContent = 'Export failed';
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = original;
    }, 1800);
  }
}

async function waitForExplorer(attempts = 240) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const shell = document.querySelector<HTMLElement>('.stats-explorer-v2');
    if (shell) return shell;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

async function init() {
  const shell = await waitForExplorer();
  if (!shell || shell.querySelector('[data-sev2-sharing]')) return;
  const actions = shell.querySelector<HTMLElement>('.sev2-actions');
  if (!actions) return;

  const group = document.createElement('div');
  group.className = 'sev2-share-group';
  group.setAttribute('data-sev2-sharing', '');
  group.innerHTML = `
    <button class="sev2-button" type="button" data-copy-explorer-view>🔗 Copy view</button>
    <button class="sev2-button" type="button" data-download-explorer-csv>↓ Download CSV</button>`;
  actions.append(group);

  const copyButton = group.querySelector<HTMLButtonElement>('[data-copy-explorer-view]');
  const csvButton = group.querySelector<HTMLButtonElement>('[data-download-explorer-csv]');
  copyButton?.addEventListener('click', () => void copyView(copyButton));
  csvButton?.addEventListener('click', () => void exportCsv(csvButton));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else void init();
