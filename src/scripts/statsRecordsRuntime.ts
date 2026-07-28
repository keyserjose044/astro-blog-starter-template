import { getDailyMeta, getYears } from '../utils/dailyData';
import type { DailyRecord } from '../utils/dailyData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type AggregateMode = 'sum' | 'average';
type RecordMetric = {
  key: string;
  icon: string;
  label: string;
  unit: string;
  digits: number;
  dayLabel: string;
  aggregateMode: AggregateMode;
  value: (record: DailyRecord) => number | null;
};

type AggregateRecord = {
  key: string;
  year: number;
  month?: number;
  value: number | null;
};

const RECORDS: RecordMetric[] = [
  { key: 'running', icon: '🏃', label: 'Running', unit: 'miles', digits: 1, dayLabel: 'Farthest running day', aggregateMode: 'sum', value: (record) => record.hobbies.runningMiles },
  { key: 'diary', icon: '📓', label: 'Diary', unit: 'words', digits: 0, dayLabel: 'Most words in one day', aggregateMode: 'sum', value: (record) => record.diary.words },
  { key: 'guitar', icon: '🎸', label: 'Guitar', unit: 'hours', digits: 1, dayLabel: 'Longest practice day', aggregateMode: 'sum', value: (record) => record.hobbies.guitarMinutes === null ? null : record.hobbies.guitarMinutes / 60 },
  { key: 'audiobook', icon: '📚', label: 'Audiobooks', unit: 'hours', digits: 1, dayLabel: 'Longest listening day', aggregateMode: 'sum', value: (record) => record.audiobook.minutes === null ? null : record.audiobook.minutes / 60 },
  { key: 'sleep', icon: '😴', label: 'Sleep', unit: 'hours', digits: 1, dayLabel: 'Longest night', aggregateMode: 'average', value: (record) => record.sleep.hours },
  { key: 'work', icon: '🧠', label: 'Work', unit: 'hours', digits: 1, dayLabel: 'Longest workday', aggregateMode: 'sum', value: (record) => record.work.hours },
  { key: 'dance', icon: '💃', label: 'Dance', unit: 'hours', digits: 1, dayLabel: 'Longest dance session', aggregateMode: 'sum', value: (record) => record.hobbies.danceMinutes === null ? null : record.hobbies.danceMinutes / 60 },
  { key: 'treadmill', icon: '🚶', label: 'Treadmill', unit: 'miles', digits: 1, dayLabel: 'Farthest walking day', aggregateMode: 'sum', value: (record) => record.hobbies.treadmillMiles },
  { key: 'language', icon: '🌍', label: 'Language study', unit: 'hours', digits: 1, dayLabel: 'Longest study day', aggregateMode: 'sum', value: (record) => record.hobbies.languageMinutes === null ? null : record.hobbies.languageMinutes / 60 },
  { key: 'movement', icon: '👟', label: 'Combined movement', unit: 'miles', digits: 1, dayLabel: 'Farthest total day', aggregateMode: 'sum', value: (record) => record.hobbies.totalDistanceMiles },
];

const parseIso = (value: string) => new Date(`${value}T12:00:00`);
const format = (value: number | null, digits: number) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseIso(value));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: number[]) => values.length ? sum(values) / values.length : null;

function validValues(records: DailyRecord[], value: RecordMetric['value']) {
  return records.map(value).filter((item): item is number => item !== null && Number.isFinite(item));
}

function aggregateValue(records: DailyRecord[], metric: RecordMetric) {
  const values = validValues(records, metric.value);
  if (!values.length) return null;
  return metric.aggregateMode === 'average' ? average(values) : sum(values);
}

function bestDay(records: DailyRecord[], metric: RecordMetric) {
  return records.reduce<DailyRecord | null>((winner, record) => {
    const candidate = metric.value(record);
    if (candidate === null || !Number.isFinite(candidate)) return winner;
    if (!winner) return record;
    const current = metric.value(winner);
    return current === null || candidate > current ? record : winner;
  }, null);
}

function bestMonth(records: DailyRecord[], metric: RecordMetric) {
  const groups = new Map<string, DailyRecord[]>();
  records.forEach((record) => {
    const key = record.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  });
  return Array.from(groups, ([key, list]): AggregateRecord => ({
    key,
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(5, 7)) - 1,
    value: aggregateValue(list, metric),
  })).reduce<AggregateRecord | null>((winner, item) => {
    if (item.value === null) return winner;
    return !winner || winner.value === null || item.value > winner.value ? item : winner;
  }, null);
}

function bestYear(records: DailyRecord[], metric: RecordMetric) {
  const groups = new Map<number, DailyRecord[]>();
  records.forEach((record) => {
    const year = Number(record.date.slice(0, 4));
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year)!.push(record);
  });
  return Array.from(groups, ([year, list]): AggregateRecord => ({
    key: String(year),
    year,
    value: aggregateValue(list, metric),
  })).reduce<AggregateRecord | null>((winner, item) => {
    if (item.value === null) return winner;
    return !winner || winner.value === null || item.value > winner.value ? item : winner;
  }, null);
}

function reserveRecordsGrid() {
  const grid = document.querySelector<HTMLElement>('#records-grid');
  if (grid) grid.classList.add('records-grid--daily', 'records-grid--unified');
  document.querySelector('#tracking-history')?.remove();
}

function renderRecords(records: DailyRecord[]) {
  const section = document.querySelector<HTMLElement>('#records');
  const grid = section?.querySelector<HTMLElement>('#records-grid');
  if (!section || !grid) return;

  const eyebrow = section.querySelector('.section-heading .eyebrow');
  const heading = section.querySelector('.section-heading h2');
  const description = section.querySelector('.section-heading > p:last-child');
  if (eyebrow) eyebrow.textContent = 'Beyond lifetime totals';
  if (heading) heading.textContent = 'Personal records across the archive';
  if (description) description.textContent = 'Every card follows the same structure: one-day record, best month, and best year. Sleep uses monthly and yearly averages; every other metric uses totals.';

  grid.replaceChildren();
  RECORDS.forEach((metric) => {
    const day = bestDay(records, metric);
    const month = bestMonth(records, metric);
    const year = bestYear(records, metric);
    const dayValue = day ? metric.value(day) : null;
    const card = document.createElement('article');
    card.className = `record-card record-card--unified record-card--${metric.key}`;
    card.innerHTML = `
      <div class="record-card__heading"><span aria-hidden="true">${metric.icon}</span><h3>${metric.label}</h3></div>
      <dl>
        <div><dt>${metric.dayLabel}</dt><dd>${day && dayValue !== null ? `${dateLabel(day.date)} · ${format(dayValue, metric.digits)} ${metric.unit}` : 'No data'}</dd></div>
        <div><dt>Best month</dt><dd>${month && month.value !== null && month.month !== undefined ? `${MONTHS[month.month]} ${month.year} · ${format(month.value, metric.digits)} ${metric.unit}` : 'No data'}</dd></div>
        <div><dt>Best year</dt><dd>${year && year.value !== null ? `${year.year} · ${format(year.value, metric.digits)} ${metric.unit}` : 'No data'}</dd></div>
      </dl>`;
    grid.append(card);
  });
}

async function init() {
  reserveRecordsGrid();
  try {
    const meta = await getDailyMeta();
    const records = await getYears(meta.availableYears);
    renderRecords(records);
  } catch (error) {
    console.error('Unified Stats records failed', error);
    const grid = document.querySelector<HTMLElement>('#records-grid');
    if (grid) grid.innerHTML = '<p class="records-runtime-error">Personal records are temporarily unavailable.</p>';
  }
}

reserveRecordsGrid();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else void init();
