import { getDailyMeta, getYears } from '../utils/dailyData';
import type { DailyRecord } from '../utils/dailyData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RUN_MINUTES_PER_MILE = 10;
const LIFETIME_SUMMARY_URL = 'https://script.google.com/macros/s/AKfycbyPQznk53znPQ8TgGTcK9tuwq-Vw5deN1YRpbmTHb0OOKHwTu9b1XBJqQuGh7PXh6pKHA/exec';

type AggregateMode = 'sum' | 'average';
type PersonalMetric = {
  key: string;
  start: string;
  unit: string;
  digits: number;
  dayLabel: string;
  aggregateMode: AggregateMode;
  value: (record: DailyRecord) => number | null;
  note: (records: DailyRecord[]) => string;
};
type AggregateRecord = { key: string; year: number; month?: number; value: number | null };
type LifetimeSummary = Record<string, unknown>;

const METRICS: PersonalMetric[] = [
  { key: 'running', start: 'September 26, 2023', unit: 'miles', digits: 1, dayLabel: 'Farthest running day', aggregateMode: 'sum', value: (record) => record.hobbies.runningMiles, note: (records) => `Distance logged, with about ${format(sum(validValues(records, (record) => record.hobbies.runningMiles)) * RUN_MINUTES_PER_MILE / 60, 1)} estimated running hours.` },
  { key: 'diary', start: 'March 16, 2022', unit: 'words', digits: 0, dayLabel: 'Most words in one day', aggregateMode: 'sum', value: (record) => record.diary.words, note: () => 'A searchable written record of ordinary days, major moments, and everything between them.' },
  { key: 'guitar', start: 'September 27, 2023', unit: 'hours', digits: 1, dayLabel: 'Longest practice day', aggregateMode: 'sum', value: (record) => record.hobbies.guitarMinutes === null ? null : record.hobbies.guitarMinutes / 60, note: () => 'Practice time ranging from ten-minute minimums to longer focused sessions.' },
  { key: 'audiobooks', start: 'February 10, 2023', unit: 'hours', digits: 1, dayLabel: 'Longest listening day', aggregateMode: 'sum', value: (record) => record.audiobook.minutes === null ? null : record.audiobook.minutes / 60, note: () => 'Commutes, chores, walks, and exercise converted into reading time.' },
  { key: 'sleep', start: 'January 1, 2023', unit: 'hours', digits: 1, dayLabel: 'Longest night', aggregateMode: 'average', value: (record) => record.sleep.hours, note: () => 'Recorded sleep; month and year records use average nightly hours rather than totals.' },
  { key: 'work', start: 'May 10, 2023', unit: 'hours', digits: 1, dayLabel: 'Longest workday', aggregateMode: 'sum', value: (record) => record.work.hours, note: () => 'Logged work hours drawn from the public-safe daily archive.' },
  { key: 'dance', start: 'June 2, 2026', unit: 'hours', digits: 1, dayLabel: 'Longest dance day', aggregateMode: 'sum', value: (record) => record.hobbies.danceMinutes === null ? null : record.hobbies.danceMinutes / 60, note: () => 'Cumbia, bachata, salsa, and other logged dance practice.' },
  { key: 'treadmill', start: 'December 2, 2022', unit: 'miles', digits: 1, dayLabel: 'Farthest walking day', aggregateMode: 'sum', value: (record) => record.hobbies.treadmillMiles, note: (records) => `${format(sum(validValues(records, (record) => record.hobbies.treadmillMinutes)) / 60, 1)} hours of walking time at the tracked 2 mph pace.` },
  { key: 'language', start: 'February 8, 2023', unit: 'hours', digits: 1, dayLabel: 'Longest study day', aggregateMode: 'sum', value: (record) => record.hobbies.languageMinutes === null ? null : record.hobbies.languageMinutes / 60, note: () => 'German and other language-study time accumulated across the archive.' },
  { key: 'movement', start: 'December 2, 2022', unit: 'miles', digits: 1, dayLabel: 'Farthest total day', aggregateMode: 'sum', value: (record) => record.hobbies.totalDistanceMiles, note: () => 'Running and treadmill distance combined while preserving each component separately elsewhere.' },
];

const parseIso = (value: string) => new Date(`${value}T12:00:00`);
const format = (value: number | null, digits: number) => value === null || !Number.isFinite(value) ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseIso(value));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const average = (values: number[]) => values.length ? sum(values) / values.length : null;

function validValues(records: DailyRecord[], value: PersonalMetric['value']) {
  return records.map(value).filter((item): item is number => item !== null && Number.isFinite(item));
}

function aggregateValue(records: DailyRecord[], metric: PersonalMetric) {
  const values = validValues(records, metric.value);
  if (!values.length) return null;
  return metric.aggregateMode === 'average' ? average(values) : sum(values);
}

function bestDay(records: DailyRecord[], metric: PersonalMetric) {
  return records.reduce<DailyRecord | null>((winner, record) => {
    const candidate = metric.value(record);
    if (candidate === null || !Number.isFinite(candidate)) return winner;
    if (!winner) return record;
    const current = metric.value(winner);
    return current === null || candidate > current ? record : winner;
  }, null);
}

function bestGroup(records: DailyRecord[], metric: PersonalMetric, mode: 'month' | 'year') {
  const groups = new Map<string, DailyRecord[]>();
  records.forEach((record) => {
    const key = mode === 'month' ? record.date.slice(0, 7) : record.date.slice(0, 4);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  });
  return Array.from(groups, ([key, list]): AggregateRecord => ({
    key,
    year: Number(key.slice(0, 4)),
    month: mode === 'month' ? Number(key.slice(5, 7)) - 1 : undefined,
    value: aggregateValue(list, metric),
  })).reduce<AggregateRecord | null>((winner, item) => {
    if (item.value === null) return winner;
    return !winner || winner.value === null || item.value > winner.value ? item : winner;
  }, null);
}

function snapshotNumber(value: unknown) {
  if (value === undefined || value === null) return null;
  const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  return Number.isFinite(numeric) ? numeric : null;
}

async function getLifetimeSummary(): Promise<LifetimeSummary | null> {
  try {
    const response = await fetch(LIFETIME_SUMMARY_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = await response.json();
    return data && typeof data === 'object' ? data as LifetimeSummary : null;
  } catch {
    return null;
  }
}

function recordUnit(metric: PersonalMetric) {
  return metric.key === 'sleep' ? 'avg hours/night' : metric.unit;
}

function hydratePersonalRecords(records: DailyRecord[], lifetimeSummary: LifetimeSummary | null) {
  const section = document.querySelector<HTMLElement>('#personal-records');
  if (!section) return;
  const currentYear = new Date().getFullYear();
  const current = records.filter((record) => Number(record.date.slice(0, 4)) === currentYear);
  const diarySummary = snapshotNumber(lifetimeSummary?.diaryWords);

  METRICS.forEach((metric) => {
    const card = section.querySelector<HTMLElement>(`[data-dashboard-metric="${metric.key}"]`);
    if (!card) return;
    const dailyLifetime = sum(validValues(records, metric.value));
    const lifetime = metric.key === 'diary' && diarySummary !== null ? Math.max(dailyLifetime, diarySummary) : dailyLifetime;
    const thisYear = aggregateValue(current, metric);
    const day = bestDay(records, metric);
    const month = bestGroup(records, metric, 'month');
    const year = bestGroup(records, metric, 'year');
    const dayValue = day ? metric.value(day) : null;
    const unit = recordUnit(metric);

    const set = (selector: string, value: string) => { const node = card.querySelector(selector); if (node) node.textContent = value; };
    set('[data-record-lifetime]', format(lifetime, metric.digits));
    set('[data-record-note]', metric.note(records));
    set('[data-record-current]', thisYear === null ? 'No data' : `${format(thisYear, metric.digits)} ${unit}`);
    set('[data-record-day-label]', metric.dayLabel);
    set('[data-record-day]', day && dayValue !== null ? `${dateLabel(day.date)} · ${format(dayValue, metric.digits)} ${metric.unit}` : 'No data');
    set('[data-record-month]', month && month.value !== null && month.month !== undefined ? `${MONTHS[month.month]} ${month.year} · ${format(month.value, metric.digits)} ${unit}` : 'No data');
    set('[data-record-year]', year && year.value !== null ? `${year.year} · ${format(year.value, metric.digits)} ${unit}` : 'No data');
  });

  const note = section.querySelector<HTMLElement>('#snapshot-note');
  if (note) {
    note.textContent = diarySummary !== null
      ? 'Daily, monthly, and yearly records use the public-safe daily archive. Diary lifetime includes the earlier public lifetime summary; treadmill and combined movement still omit the December 2022 period that predates daily API coverage.'
      : 'Daily, monthly, and yearly records use the public-safe daily archive. Diary, treadmill, and combined movement began before daily API coverage, so their earliest history is not included in the displayed lifetime total.';
    note.dataset.state = 'live';
  }
}

async function init() {
  try {
    const meta = await getDailyMeta();
    const [records, lifetimeSummary] = await Promise.all([getYears(meta.availableYears), getLifetimeSummary()]);
    hydratePersonalRecords(records, lifetimeSummary);
  } catch (error) {
    console.error('Personal Records hydration failed', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else void init();
