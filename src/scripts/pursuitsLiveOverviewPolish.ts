import { getDailyMeta, getYears } from '../utils/dailyData';
import type { DailyMeta, DailyRecord } from '../utils/dailyData';

type PursuitKey = 'guitar' | 'dance' | 'running' | 'languages';

type SparkPoint = {
  year: number;
  month: number;
  value: number;
};

const NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SHORT_UNITS: Record<PursuitKey, string> = {
  guitar: 'h',
  dance: 'h',
  running: 'mi',
  languages: 'h',
};
const COLORS: Record<PursuitKey, string> = {
  guitar: '#c77a30',
  dance: '#c3428f',
  running: '#278a63',
  languages: '#405cf5',
};
const STARTS: Record<PursuitKey, string> = {
  guitar: '2023-09-27',
  dance: '2026-06-02',
  running: '2023-09-26',
  languages: '2023-02-08',
};

const valueFor = (record: DailyRecord, key: PursuitKey) => {
  if (key === 'guitar') return record.hobbies.guitarMinutes === null ? null : record.hobbies.guitarMinutes / 60;
  if (key === 'dance') return record.hobbies.danceMinutes === null ? null : record.hobbies.danceMinutes / 60;
  if (key === 'running') return record.hobbies.runningMiles;
  return record.hobbies.languageMinutes === null ? null : record.hobbies.languageMinutes / 60;
};

const formatArchiveDate = (value: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(`${value}T12:00:00`));

const formatValue = (value: number) => new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 1,
}).format(value);

function addBestMonthUnit(card: HTMLElement) {
  const key = card.dataset.pursuitSummary as PursuitKey | undefined;
  if (!key || !(key in SHORT_UNITS)) return;
  const unit = SHORT_UNITS[key];
  const node = card.querySelector<HTMLElement>('[data-live-best-month]');
  if (!node) return;

  const text = node.textContent?.trim() || '';
  if (!text || text === '—' || /\s(?:h|mi)$/.test(text) || !text.includes('·')) return;
  node.textContent = `${text} ${unit}`;
}

function tooltipElement() {
  let tooltip = document.querySelector<HTMLElement>('.pursuits-live-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'pursuits-live-tooltip';
    tooltip.hidden = true;
    tooltip.setAttribute('role', 'tooltip');
    document.body.append(tooltip);
  }
  return tooltip;
}

function showTooltip(target: SVGElement, text: string, event?: PointerEvent) {
  const tooltip = tooltipElement();
  tooltip.textContent = text;
  tooltip.hidden = false;
  const box = target.getBoundingClientRect();
  let left = event?.clientX ?? box.left + box.width / 2;
  let top = event?.clientY ?? box.top;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  requestAnimationFrame(() => {
    const tip = tooltip.getBoundingClientRect();
    if (tip.right > window.innerWidth - 8) left = Math.max(8, left - tip.width - 18);
    if (tip.top < 8) top = Math.min(window.innerHeight - 8, top + tip.height + 18);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  });
}

function bindSparkTooltip(target: SVGRectElement, text: string) {
  target.classList.add('pursuits-live-mark');
  target.setAttribute('tabindex', '0');
  target.setAttribute('aria-label', text);
  target.addEventListener('pointerenter', (event) => showTooltip(target, text, event));
  target.addEventListener('pointermove', (event) => showTooltip(target, text, event));
  target.addEventListener('pointerleave', () => { tooltipElement().hidden = true; });
  target.addEventListener('focus', () => showTooltip(target, text));
  target.addEventListener('blur', () => { tooltipElement().hidden = true; });
}

function buildSparkPoints(records: DailyRecord[], key: PursuitKey, meta: DailyMeta) {
  const dataThrough = meta.dataThrough || records.at(-1)?.date;
  if (!dataThrough) return [] as SparkPoint[];

  const through = new Date(`${dataThrough}T12:00:00`);
  const endMonth = new Date(through.getFullYear(), through.getMonth(), 1, 12);
  const start = key === 'dance'
    ? new Date(2026, 5, 1, 12)
    : new Date(endMonth.getFullYear(), endMonth.getMonth() - 11, 1, 12);

  const monthTotals = new Map<string, number>();
  records.forEach((record) => {
    if (record.date < STARTS[key] || record.date > dataThrough) return;
    const value = valueFor(record, key);
    if (value === null || !Number.isFinite(value)) return;
    const month = record.date.slice(0, 7);
    monthTotals.set(month, (monthTotals.get(month) || 0) + value);
  });

  const points: SparkPoint[] = [];
  for (let cursor = new Date(start); cursor <= endMonth; cursor.setMonth(cursor.getMonth() + 1)) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    points.push({ year, month, value: monthTotals.get(monthKey) || 0 });
  }

  if (key === 'dance') {
    while (points.length && points.at(-1)?.value === 0) points.pop();
  }
  return points;
}

function drawSpark(card: HTMLElement, records: DailyRecord[], meta: DailyMeta) {
  const key = card.dataset.pursuitSummary as PursuitKey | undefined;
  const host = card.querySelector<HTMLElement>('[data-live-spark]');
  if (!key || !(key in COLORS) || !host) return;

  const points = buildSparkPoints(records, key, meta);
  if (!points.length) {
    host.replaceChildren();
    return;
  }

  const width = 260;
  const height = 56;
  const maximum = Math.max(1, ...points.map((point) => point.value));
  const slot = width / points.length;
  const chart = document.createElementNS(NS, 'svg');
  chart.setAttribute('viewBox', `0 0 ${width} ${height}`);
  chart.setAttribute('role', 'img');
  chart.setAttribute('aria-label', `${key} monthly totals`);
  chart.dataset.polishedSpark = 'true';

  points.forEach((point, index) => {
    const barHeight = Math.max(point.value > 0 ? 2 : 1, point.value / maximum * (height - 8));
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', String(index * slot + slot * .18));
    rect.setAttribute('y', String(height - barHeight));
    rect.setAttribute('width', String(Math.max(2, slot * .64)));
    rect.setAttribute('height', String(barHeight));
    rect.setAttribute('rx', '2');
    rect.setAttribute('fill', point.value > 0 ? COLORS[key] : '#e2e8f0');
    rect.setAttribute('opacity', point.value > 0 ? '.9' : '.7');
    bindSparkTooltip(rect, `${MONTHS[point.month]} ${point.year} · ${formatValue(point.value)} ${SHORT_UNITS[key]}`);
    chart.append(rect);
  });

  host.replaceChildren(chart);
}

function initOverview(root: HTMLElement) {
  if (root.dataset.overviewPolishReady === 'true') return;
  root.dataset.overviewPolishReady = 'true';

  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-pursuit-summary]'));
  const status = root.querySelector<HTMLElement>('[data-pursuits-status]');
  const yearLabels = Array.from(root.querySelectorAll<HTMLElement>('[data-live-year-label]'));

  cards.forEach((card) => {
    addBestMonthUnit(card);
    const bestMonth = card.querySelector<HTMLElement>('[data-live-best-month]');
    if (bestMonth) new MutationObserver(() => addBestMonthUnit(card)).observe(bestMonth, { childList: true, characterData: true, subtree: true });
  });

  let desiredStatus = '';
  const applyStatus = () => {
    if (!status || !desiredStatus || status.textContent === desiredStatus) return;
    status.textContent = desiredStatus;
    status.dataset.state = 'live';
  };

  if (status) new MutationObserver(applyStatus).observe(status, { childList: true, characterData: true, subtree: true });

  Promise.all([getDailyMeta(), getDailyMeta().then((meta) => getYears(meta.availableYears))]).then(([meta, records]) => {
    const archiveYear = meta.dataThrough ? meta.dataThrough.slice(0, 4) : String(new Date().getFullYear());
    yearLabels.forEach((node) => { node.textContent = `${archiveYear} YTD`; });

    desiredStatus = meta.dataThrough
      ? `Archive current through ${formatArchiveDate(meta.dataThrough)}`
      : 'Live public-safe daily Archive connected';
    applyStatus();

    cards.forEach((card) => {
      const spark = card.querySelector<HTMLElement>('[data-live-spark]');
      if (!spark) return;
      const redraw = () => {
        if (spark.querySelector('svg[data-polished-spark="true"]')) return;
        drawSpark(card, records, meta);
      };
      redraw();
      new MutationObserver(redraw).observe(spark, { childList: true });
    });
  }).catch(() => {
    desiredStatus = 'Live public-safe daily Archive connected';
    applyStatus();
  });
}

const initialize = () => {
  document.querySelectorAll<HTMLElement>('[data-pursuits-teleport][data-active="overview"]').forEach(initOverview);
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
