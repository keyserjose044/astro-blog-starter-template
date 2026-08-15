import { getDailyMeta, getYears } from '../utils/dailyData';
import type { DailyMeta, DailyRecord } from '../utils/dailyData';

type AggregateMode = 'sum' | 'average';
type DashboardMetric = {
  key: string;
  icon: string;
  label: string;
  unit: string;
  shortUnit: string;
  digits: number;
  mode: AggregateMode;
  value: (record: DailyRecord) => number | null;
};

const DAY_MS = 86_400_000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const METRICS: DashboardMetric[] = [
  { key: 'sleep', icon: '😴', label: 'Sleep', unit: 'hours/night', shortUnit: 'h', digits: 1, mode: 'average', value: (record) => record.sleep.hours },
  { key: 'guitar', icon: '🎸', label: 'Guitar', unit: 'hours', shortUnit: 'h', digits: 1, mode: 'sum', value: (record) => record.hobbies.guitarMinutes === null ? null : record.hobbies.guitarMinutes / 60 },
  { key: 'audiobooks', icon: '📚', label: 'Audiobooks', unit: 'hours', shortUnit: 'h', digits: 1, mode: 'sum', value: (record) => record.audiobook.minutes === null ? null : record.audiobook.minutes / 60 },
  { key: 'running', icon: '🏃', label: 'Running', unit: 'miles', shortUnit: 'mi', digits: 1, mode: 'sum', value: (record) => record.hobbies.runningMiles },
  { key: 'dance', icon: '💃', label: 'Dance', unit: 'hours', shortUnit: 'h', digits: 1, mode: 'sum', value: (record) => record.hobbies.danceMinutes === null ? null : record.hobbies.danceMinutes / 60 },
  { key: 'language', icon: '🌍', label: 'Language study', unit: 'hours', shortUnit: 'h', digits: 1, mode: 'sum', value: (record) => record.hobbies.languageMinutes === null ? null : record.hobbies.languageMinutes / 60 },
  { key: 'work', icon: '🧠', label: 'Work', unit: 'hours', shortUnit: 'h', digits: 1, mode: 'sum', value: (record) => record.work.hours },
  { key: 'diary', icon: '📓', label: 'Diary', unit: 'words', shortUnit: 'words', digits: 0, mode: 'sum', value: (record) => record.diary.words },
];

const parseIso = (value: string) => new Date(`${value}T12:00:00`);
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (value: string, days: number) => iso(new Date(parseIso(value).getTime() + days * DAY_MS));
const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseIso(value));
const formatShortDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parseIso(value));
const formatNumber = (value: number | null, digits: number) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));

function validValues(records: DailyRecord[], metric: DashboardMetric) {
  return records.map(metric.value).filter((value): value is number => value !== null && Number.isFinite(value));
}

function aggregate(records: DailyRecord[], metric: DashboardMetric) {
  const values = validValues(records, metric);
  if (!values.length) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return metric.mode === 'average' ? total / values.length : total;
}

function dailyAverage(records: DailyRecord[], metric: DashboardMetric) {
  const values = validValues(records, metric);
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function recordsBetween(records: DailyRecord[], start: string, end: string) {
  return records.filter((record) => record.date >= start && record.date <= end);
}

function delta(current: number | null, previous: number | null) {
  if (current === null || previous === null) return { value: null, label: 'Not enough data', className: 'is-neutral' };
  if (previous === 0) {
    if (current === 0) return { value: 0, label: 'No change', className: 'is-neutral' };
    return { value: null, label: 'New activity', className: 'is-up' };
  }
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.round(change);
  if (Math.abs(change) < 0.5) return { value: change, label: 'No change', className: 'is-neutral' };
  return {
    value: change,
    label: `${change > 0 ? '↑' : '↓'} ${Math.abs(rounded)}%`,
    className: change > 0 ? 'is-up' : 'is-down',
  };
}

function movePersonalRecordsBelowPatterns() {
  const snapshot = document.querySelector<HTMLElement>('.snapshot-section');
  const correlations = document.querySelector<HTMLElement>('#correlations');
  if (!snapshot || !correlations) return;
  if (correlations.nextElementSibling !== snapshot) correlations.insertAdjacentElement('afterend', snapshot);
}

function mountArchiveMetadata(meta: DailyMeta) {
  const facts = document.querySelector<HTMLElement>('.stats-hero__facts');
  if (!facts || facts.querySelector('[data-archive-through]')) return;

  const fact = document.createElement('article');
  fact.className = 'hero-fact hero-fact--archive-data';
  fact.setAttribute('data-archive-through', '');
  const recordLabel = meta.recordCount === null ? 'public records' : `${new Intl.NumberFormat('en-US').format(meta.recordCount)} public days`;
  fact.innerHTML = `
    <span class="hero-fact__label">Data through</span>
    <strong>${escapeHtml(meta.dataThrough ? formatDate(meta.dataThrough) : 'Current archive')}</strong>
    <small>${escapeHtml(recordLabel)}</small>`;

  if (meta.updatedAt) {
    const updated = new Date(meta.updatedAt);
    if (!Number.isNaN(updated.getTime())) fact.title = `Archive last refreshed ${updated.toLocaleString()}`;
  }
  facts.append(fact);
}

function mountPatternsShell() {
  const correlations = document.querySelector<HTMLElement>('#correlations');
  if (!correlations) return null;
  const existing = document.querySelector<HTMLElement>('#patterns');
  if (existing) return existing;

  const section = document.createElement('section');
  section.id = 'patterns';
  section.className = 'dashboard-section stats-patterns';
  section.setAttribute('aria-labelledby', 'patterns-heading');
  section.innerHTML = `
    <div class="section-heading section-heading--split">
      <div>
        <p class="eyebrow">Change across the archive</p>
        <h2 id="patterns-heading">What is changing?</h2>
      </div>
      <p>Recent windows, year comparisons, and weekday rhythms turn the archive from a collection of totals into a picture of direction.</p>
    </div>
    <div class="stats-patterns__panel">
      <div class="stats-patterns__subhead">
        <div><span>Recent change</span><h3>Last 30 days vs. the 30 before</h3></div>
        <small data-recent-window>Loading archive window…</small>
      </div>
      <div class="stats-patterns__change-grid" data-recent-grid></div>
    </div>
    <div class="stats-patterns__panel stats-patterns__panel--years">
      <div class="stats-patterns__subhead">
        <div><span>Year over year</span><h3>Same-date scorecard</h3></div>
        <small data-yoy-window>Loading comparison window…</small>
      </div>
      <div class="stats-patterns__table-wrap" data-yoy-table></div>
    </div>
    <div class="stats-patterns__panel stats-patterns__panel--weekdays">
      <div class="stats-patterns__subhead">
        <div><span>Weekly rhythm</span><h3>What does each weekday look like?</h3></div>
        <label class="stats-patterns__metric-select">Metric<select data-weekday-metric>${METRICS.map((metric) => `<option value="${metric.key}">${metric.icon} ${escapeHtml(metric.label)}</option>`).join('')}</select></label>
      </div>
      <p class="stats-patterns__weekday-note" data-weekday-note>Loading weekday pattern…</p>
      <div class="stats-patterns__weekday-grid" data-weekday-grid></div>
    </div>`;
  correlations.insertAdjacentElement('afterend', section);
  return section;
}

function renderRecentChanges(section: HTMLElement, records: DailyRecord[], dataThrough: string) {
  const currentStart = addDays(dataThrough, -29);
  const previousEnd = addDays(currentStart, -1);
  const previousStart = addDays(previousEnd, -29);
  const currentRecords = recordsBetween(records, currentStart, dataThrough);
  const previousRecords = recordsBetween(records, previousStart, previousEnd);
  const grid = section.querySelector<HTMLElement>('[data-recent-grid]');
  const windowLabel = section.querySelector<HTMLElement>('[data-recent-window]');
  if (!grid) return;

  if (windowLabel) {
    windowLabel.textContent = `${formatShortDate(currentStart)}–${formatShortDate(dataThrough)} compared with ${formatShortDate(previousStart)}–${formatShortDate(previousEnd)}`;
  }

  grid.innerHTML = METRICS.map((metric) => {
    const current = aggregate(currentRecords, metric);
    const previous = aggregate(previousRecords, metric);
    const change = delta(current, previous);
    return `
      <article class="stats-change-card" data-metric="${metric.key}">
        <div class="stats-change-card__top"><span aria-hidden="true">${metric.icon}</span><strong>${escapeHtml(metric.label)}</strong></div>
        <div class="stats-change-card__value">${escapeHtml(formatNumber(current, metric.digits))}<small>${escapeHtml(metric.shortUnit)}</small></div>
        <div class="stats-change-card__delta ${change.className}">${escapeHtml(change.label)}</div>
        <p>Previous: ${escapeHtml(formatNumber(previous, metric.digits))} ${escapeHtml(metric.shortUnit)}</p>
      </article>`;
  }).join('');
}

function sameDateEnd(year: number, dataThrough: string) {
  const month = Number(dataThrough.slice(5, 7));
  const day = Number(dataThrough.slice(8, 10));
  const candidate = new Date(year, month - 1, day, 12, 0, 0);
  if (candidate.getMonth() === month - 1 && candidate.getDate() === day) return iso(candidate);
  return iso(new Date(year, month, 0, 12, 0, 0));
}

function renderYearScorecard(section: HTMLElement, records: DailyRecord[], meta: DailyMeta) {
  const host = section.querySelector<HTMLElement>('[data-yoy-table]');
  const label = section.querySelector<HTMLElement>('[data-yoy-window]');
  if (!host || !meta.dataThrough) return;

  const currentYear = Number(meta.dataThrough.slice(0, 4));
  const years = meta.availableYears.filter((year) => year <= currentYear).slice(-4);
  if (!years.length) return;
  const cutoff = formatShortDate(meta.dataThrough);
  if (label) label.textContent = `Jan 1–${cutoff} in each year`;

  const headers = years.map((year) => `<th scope="col">${year}${year === currentYear ? ' YTD' : ''}</th>`).join('');
  const rows = METRICS.map((metric) => {
    const cells = years.map((year) => {
      const start = `${year}-01-01`;
      const end = sameDateEnd(year, meta.dataThrough!);
      const value = aggregate(recordsBetween(records, start, end), metric);
      return `<td>${escapeHtml(formatNumber(value, metric.digits))}<small>${escapeHtml(metric.shortUnit)}</small></td>`;
    }).join('');
    return `<tr><th scope="row"><span aria-hidden="true">${metric.icon}</span>${escapeHtml(metric.label)}</th>${cells}</tr>`;
  }).join('');

  host.innerHTML = `
    <table class="stats-yoy-table">
      <caption>Same-date comparison through ${escapeHtml(cutoff)}. Sleep is averaged; activity metrics are totaled.</caption>
      <thead><tr><th scope="col">Metric</th>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function weekdayValues(records: DailyRecord[], metric: DashboardMetric) {
  return WEEKDAYS.map((label, day) => {
    const matching = records.filter((record) => parseIso(record.date).getDay() === day);
    return {
      label,
      value: dailyAverage(matching, metric),
      measured: validValues(matching, metric).length,
    };
  });
}

function renderWeekdays(section: HTMLElement, records: DailyRecord[], metricKey: string) {
  const metric = METRICS.find((item) => item.key === metricKey) ?? METRICS[0];
  const grid = section.querySelector<HTMLElement>('[data-weekday-grid]');
  const note = section.querySelector<HTMLElement>('[data-weekday-note]');
  if (!grid || !metric) return;

  const values = weekdayValues(records, metric);
  const maximum = Math.max(0, ...values.map((item) => item.value ?? 0));
  const best = values.reduce<(typeof values)[number] | null>((winner, item) => {
    if (item.value === null) return winner;
    return !winner || winner.value === null || item.value > winner.value ? item : winner;
  }, null);

  if (note) {
    note.textContent = best
      ? `${best.label} has the highest recorded daily average for ${metric.label.toLowerCase()} at ${formatNumber(best.value, metric.digits)} ${metric.unit}. Activity metrics are shown as average amount per calendar day, including recorded zero days.`
      : `There is not enough measured ${metric.label.toLowerCase()} data for a weekday pattern yet.`;
  }

  grid.innerHTML = values.map((item) => {
    const ratio = maximum > 0 && item.value !== null ? Math.max(0.04, item.value / maximum) : 0.04;
    return `
      <article class="stats-weekday-card${best?.label === item.label ? ' is-best' : ''}">
        <span>${item.label}</span>
        <div class="stats-weekday-card__bar"><i style="--weekday-ratio:${ratio}"></i></div>
        <strong>${escapeHtml(formatNumber(item.value, metric.digits))} <small>${escapeHtml(metric.shortUnit)}</small></strong>
        <em>${item.measured} measured day${item.measured === 1 ? '' : 's'}</em>
      </article>`;
  }).join('');
}

function bindWeekdayControls(section: HTMLElement, records: DailyRecord[]) {
  const select = section.querySelector<HTMLSelectElement>('[data-weekday-metric]');
  if (!select) return;
  const initial = new URL(location.href).searchParams.get('weekdayMetric');
  if (initial && METRICS.some((metric) => metric.key === initial)) select.value = initial;
  const render = () => {
    renderWeekdays(section, records, select.value);
    const url = new URL(location.href);
    url.searchParams.set('weekdayMetric', select.value);
    history.replaceState({}, '', url);
  };
  select.addEventListener('change', render);
  render();
}

async function init() {
  movePersonalRecordsBelowPatterns();
  const patterns = mountPatternsShell();
  if (!patterns) return;

  try {
    const meta = await getDailyMeta();
    mountArchiveMetadata(meta);
    if (!meta.availableYears.length || !meta.dataThrough) throw new Error('Archive metadata is incomplete.');
    const records = await getYears(meta.availableYears);
    renderRecentChanges(patterns, records, meta.dataThrough);
    renderYearScorecard(patterns, records, meta);
    bindWeekdayControls(patterns, records);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'The pattern summary could not load.';
    const recent = patterns.querySelector<HTMLElement>('[data-recent-grid]');
    const years = patterns.querySelector<HTMLElement>('[data-yoy-table]');
    const weekdays = patterns.querySelector<HTMLElement>('[data-weekday-grid]');
    if (recent) recent.innerHTML = `<p class="stats-patterns__error">${escapeHtml(message)}</p>`;
    if (years) years.innerHTML = '<p class="stats-patterns__error">The year comparison is temporarily unavailable.</p>';
    if (weekdays) weekdays.innerHTML = '<p class="stats-patterns__error">The weekday comparison is temporarily unavailable.</p>';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else void init();
