import { getDailyMeta, getYears } from '../utils/dailyData';
import type { DailyRecord } from '../utils/dailyData';

type MilestoneMetric = {
  key: string;
  icon: string;
  label: string;
  unit: string;
  digits: number;
  start: string;
  thresholds: number[];
  value: (record: DailyRecord) => number | null;
};

type MilestoneEvent = {
  date: string;
  metric: MilestoneMetric;
  threshold: number;
};

const METRICS: MilestoneMetric[] = [
  {
    key: 'guitar', icon: '🎸', label: 'Guitar', unit: 'hours', digits: 0, start: '2023-09-27',
    thresholds: [50, 100, 250, 500, 750, 1000, 1500, 2000],
    value: (record) => record.hobbies.guitarMinutes === null ? null : record.hobbies.guitarMinutes / 60,
  },
  {
    key: 'audiobooks', icon: '📚', label: 'Audiobooks', unit: 'hours', digits: 0, start: '2023-02-10',
    thresholds: [100, 250, 500, 750, 1000, 1500, 2000, 2500, 3000],
    value: (record) => record.audiobook.minutes === null ? null : record.audiobook.minutes / 60,
  },
  {
    key: 'running', icon: '🏃', label: 'Running', unit: 'miles', digits: 0, start: '2023-09-26',
    thresholds: [50, 100, 250, 500, 750, 1000, 1500, 2000],
    value: (record) => record.hobbies.runningMiles,
  },
  {
    key: 'dance', icon: '💃', label: 'Dance', unit: 'hours', digits: 0, start: '2026-06-02',
    thresholds: [10, 25, 50, 100, 250, 500, 750, 1000],
    value: (record) => record.hobbies.danceMinutes === null ? null : record.hobbies.danceMinutes / 60,
  },
  {
    key: 'language', icon: '🌍', label: 'Language study', unit: 'hours', digits: 0, start: '2023-02-08',
    thresholds: [50, 100, 250, 500, 750, 1000, 1500, 2000],
    value: (record) => record.hobbies.languageMinutes === null ? null : record.hobbies.languageMinutes / 60,
  },
];

const parseIso = (value: string) => new Date(`${value}T12:00:00`);
const formatDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseIso(value));
const formatNumber = (value: number, digits = 0) => new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));

function valueTotal(records: DailyRecord[], metric: MilestoneMetric) {
  return records.reduce((total, record) => {
    const value = metric.value(record);
    return total + (value !== null && Number.isFinite(value) ? value : 0);
  }, 0);
}

function thresholdsFor(metric: MilestoneMetric, current: number) {
  const output = metric.thresholds.slice();
  const last = output.at(-1) ?? 100;
  const previous = output.at(-2) ?? 0;
  const step = Math.max(1, last - previous);
  let next = last;
  while (next <= current) {
    next += step;
    output.push(next);
  }
  return output;
}

function milestoneEvents(records: DailyRecord[], metric: MilestoneMetric) {
  const sorted = records.filter((record) => record.date >= metric.start).slice().sort((a, b) => a.date.localeCompare(b.date));
  const current = valueTotal(sorted, metric);
  const thresholds = thresholdsFor(metric, current);
  const events: MilestoneEvent[] = [];
  let cumulative = 0;
  let thresholdIndex = 0;

  for (const record of sorted) {
    const value = metric.value(record);
    if (value !== null && Number.isFinite(value)) cumulative += value;
    while (thresholdIndex < thresholds.length && cumulative >= thresholds[thresholdIndex]) {
      events.push({ date: record.date, metric, threshold: thresholds[thresholdIndex] });
      thresholdIndex += 1;
    }
  }

  return { events, current, thresholds };
}

function mountShell() {
  const patterns = document.querySelector<HTMLElement>('#patterns');
  if (!patterns) return null;
  const existing = document.querySelector<HTMLElement>('#milestones');
  if (existing) return existing;

  const section = document.createElement('section');
  section.id = 'milestones';
  section.className = 'dashboard-section stats-milestones';
  section.setAttribute('aria-labelledby', 'milestones-heading');
  section.innerHTML = `
    <div class="section-heading section-heading--split">
      <div>
        <p class="eyebrow">Thresholds crossed over time</p>
        <h2 id="milestones-heading">Milestones</h2>
      </div>
      <p>Instead of another total, this view asks when long-running pursuits crossed meaningful cumulative thresholds—and what comes next.</p>
    </div>
    <div class="stats-milestones__layout">
      <div class="stats-milestones__panel">
        <div class="stats-milestones__panel-head"><div><span>Recent history</span><h3>Latest thresholds crossed</h3></div><small>Calculated from the public daily archive</small></div>
        <div class="stats-milestones__timeline" data-milestone-timeline><p class="stats-milestones__loading">Loading milestone history…</p></div>
      </div>
      <div class="stats-milestones__panel">
        <div class="stats-milestones__panel-head"><div><span>What is next</span><h3>Progress toward the next mark</h3></div><small>Updates with the archive</small></div>
        <div class="stats-milestones__progress-grid" data-milestone-progress></div>
      </div>
    </div>`;
  patterns.insertAdjacentElement('afterend', section);
  return section;
}

function render(section: HTMLElement, records: DailyRecord[]) {
  const timeline = section.querySelector<HTMLElement>('[data-milestone-timeline]');
  const progress = section.querySelector<HTMLElement>('[data-milestone-progress]');
  if (!timeline || !progress) return;

  const analyses = METRICS.map((metric) => ({ metric, ...milestoneEvents(records, metric) }));
  const recent = analyses.flatMap((analysis) => analysis.events).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  timeline.innerHTML = recent.length ? recent.map((event) => `
    <article class="stats-milestone-event">
      <time datetime="${event.date}">${escapeHtml(formatDate(event.date))}</time>
      <span class="stats-milestone-event__icon" aria-hidden="true">${event.metric.icon}</span>
      <div><strong>${escapeHtml(event.metric.label)} reached ${escapeHtml(formatNumber(event.threshold, event.metric.digits))} ${escapeHtml(event.metric.unit)}</strong><p>Cumulative archive milestone</p></div>
    </article>`).join('') : '<p class="stats-milestones__loading">No configured milestone thresholds have been crossed yet.</p>';

  progress.innerHTML = analyses.map(({ metric, current, thresholds }) => {
    const next = thresholds.find((threshold) => threshold > current) ?? thresholds.at(-1) ?? current;
    const prior = [...thresholds].reverse().find((threshold) => threshold <= current) ?? 0;
    const span = Math.max(1, next - prior);
    const progressRatio = Math.max(0, Math.min(1, (current - prior) / span));
    const remaining = Math.max(0, next - current);
    return `
      <article class="stats-milestone-progress" data-metric="${metric.key}">
        <div class="stats-milestone-progress__top"><span aria-hidden="true">${metric.icon}</span><div><strong>${escapeHtml(metric.label)}</strong><small>Next: ${escapeHtml(formatNumber(next, metric.digits))} ${escapeHtml(metric.unit)}</small></div></div>
        <div class="stats-milestone-progress__bar" role="progressbar" aria-valuemin="${prior}" aria-valuemax="${next}" aria-valuenow="${current.toFixed(1)}"><i style="--milestone-progress:${progressRatio}"></i></div>
        <div class="stats-milestone-progress__numbers"><span>${escapeHtml(formatNumber(current, 1))} logged</span><span>${escapeHtml(formatNumber(remaining, 1))} to go</span></div>
      </article>`;
  }).join('');
}

async function waitForPatterns(attempts = 240) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const patterns = document.querySelector<HTMLElement>('#patterns');
    if (patterns) return patterns;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
}

async function init() {
  const patterns = await waitForPatterns();
  if (!patterns) return;
  const section = mountShell();
  if (!section) return;
  try {
    const meta = await getDailyMeta();
    const records = await getYears(meta.availableYears);
    render(section, records);
  } catch (error) {
    const timeline = section.querySelector<HTMLElement>('[data-milestone-timeline]');
    if (timeline) timeline.innerHTML = '<p class="stats-milestones__loading">Milestone history is temporarily unavailable.</p>';
    console.error('Stats milestones failed', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else void init();
