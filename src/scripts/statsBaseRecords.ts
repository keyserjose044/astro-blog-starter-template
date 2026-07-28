import { getDailyMeta, getYears } from '../utils/dailyData';
import type { DailyRecord } from '../utils/dailyData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const format = (value: number | null, digits = 0) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const sum = (values: Array<number | null>) => values.reduce((total, value) => total + (value ?? 0), 0);

const METRICS = [
  { key: 'guitar', icon: '🎸', label: 'Guitar', unit: 'hours', digits: 1, value: (record: DailyRecord) => record.hobbies.guitarMinutes === null ? null : record.hobbies.guitarMinutes / 60 },
  { key: 'audiobooks', icon: '📚', label: 'Audiobooks', unit: 'hours', digits: 1, value: (record: DailyRecord) => record.audiobook.minutes === null ? null : record.audiobook.minutes / 60 },
  { key: 'running', icon: '🏃‍♂️', label: 'Running', unit: 'miles', digits: 1, value: (record: DailyRecord) => record.hobbies.runningMiles },
  { key: 'diary', icon: '📓', label: 'Diary', unit: 'words', digits: 0, value: (record: DailyRecord) => record.diary.words },
];

function bestGroup(records: DailyRecord[], value: (record: DailyRecord) => number | null, mode: 'month' | 'year') {
  const groups = new Map<string, number[]>();
  records.forEach((record) => {
    const key = mode === 'month' ? record.date.slice(0, 7) : record.date.slice(0, 4);
    if (!groups.has(key)) groups.set(key, []);
    const next = value(record);
    if (next !== null && Number.isFinite(next)) groups.get(key)!.push(next);
  });
  return Array.from(groups, ([key, values]) => ({ key, value: sum(values) }))
    .sort((first, second) => second.value - first.value)[0] || null;
}

async function init() {
  const grid = document.querySelector('#records-grid');
  if (!(grid instanceof HTMLElement) || grid.dataset.baseRecordsReady === 'true') return;
  grid.dataset.baseRecordsReady = 'true';
  try {
    const meta = await getDailyMeta();
    const records = await getYears(meta.availableYears);
    grid.replaceChildren();
    METRICS.forEach((metric) => {
      const month = bestGroup(records, metric.value, 'month');
      const year = bestGroup(records, metric.value, 'year');
      const card = document.createElement('article');
      card.className = 'record-card';
      card.dataset.recordMetric = metric.key;
      const monthLabel = month
        ? `${MONTHS[Number(month.key.slice(5, 7)) - 1]} ${month.key.slice(0, 4)} · ${format(month.value, metric.digits)} ${metric.unit}`
        : 'No data';
      const yearLabel = year ? `${year.key} · ${format(year.value, metric.digits)} ${metric.unit}` : 'No data';
      card.innerHTML = `<div class="record-card__heading"><span aria-hidden="true">${metric.icon}</span><h3>${metric.label}</h3></div><dl><div><dt>Best month</dt><dd>${monthLabel}</dd></div><div><dt>Best year</dt><dd>${yearLabel}</dd></div></dl>`;
      grid.append(card);
    });
  } catch (error) {
    console.error('Base Stats records failed', error);
    grid.textContent = 'Record summaries are temporarily unavailable.';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else void init();
