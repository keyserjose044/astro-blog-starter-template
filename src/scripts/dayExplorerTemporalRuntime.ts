import { getDailyMeta, getSameDate, getYear } from '../utils/dailyData';
import type { DailyMeta, DailyRecord } from '../utils/dailyData';

const DAY_MS = 86_400_000;
const parseIso = (value: string) => new Date(`${value}T12:00:00`);
const toIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shortDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parseIso(value));
const format = (value: number | null, digits = 0) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const compact = (value: number | null) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { notation: Math.abs(value) >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
const validIso = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseIso(value).getTime());
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const activeCount = (record: DailyRecord) => [
  record.hobbies.guitarMinutes,
  record.hobbies.danceMinutes,
  record.hobbies.languageMinutes,
  record.hobbies.runningMiles,
  record.hobbies.treadmillMinutes,
  record.audiobook.minutes,
  record.diary.words,
].filter((value) => typeof value === 'number' && value > 0).length;

type SameMetricKey = 'sleep' | 'work' | 'movement' | 'diary';

type SameMetric = {
  label: string;
  unit: string;
  digits: number;
  value: (record: DailyRecord) => number | null;
  display: (value: number | null) => string;
};

const sameMetrics: Record<SameMetricKey, SameMetric> = {
  sleep: {
    label: 'Sleep',
    unit: 'hr',
    digits: 1,
    value: (record) => record.sleep.hours,
    display: (value) => value === null ? '—' : `${format(value, 1)} hr`,
  },
  work: {
    label: 'Work',
    unit: 'hr',
    digits: 1,
    value: (record) => record.work.hours,
    display: (value) => value === null ? '—' : `${format(value, 1)} hr`,
  },
  movement: {
    label: 'Movement',
    unit: 'mi',
    digits: 1,
    value: (record) => record.hobbies.totalDistanceMiles,
    display: (value) => value === null ? '—' : `${format(value, 1)} mi`,
  },
  diary: {
    label: 'Diary',
    unit: 'words',
    digits: 0,
    value: (record) => record.diary.words,
    display: (value) => value === null ? '—' : `${compact(value)} words`,
  },
};

function initTemporalExplorer() {
  const root = document.querySelector<HTMLElement>('[data-day-explorer]');
  if (!root || root.dataset.temporalRuntimeReady === 'true') return;
  root.dataset.temporalRuntimeReady = 'true';

  const input = root.querySelector<HTMLInputElement>('#day-date');
  const selectedDate = root.querySelector<HTMLElement>('[data-selected-date]');
  const weekHost = root.querySelector<HTMLElement>('[data-day-week-visual]');
  const sameDateHost = root.querySelector<HTMLElement>('[data-same-date-visual]');
  const coverageHost = root.querySelector<HTMLElement>('[data-year-coverage]');
  const baselineYear = root.querySelector<HTMLElement>('[data-baseline-year]');
  const metricButtons = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-same-date-metric]'));
  if (!input || !selectedDate || !weekHost || !sameDateHost || !coverageHost) return;

  let meta: DailyMeta | null = null;
  let currentDate = '';
  let renderToken = 0;
  let sameMetric: SameMetricKey = 'sleep';
  let sameDateCacheKey = '';
  let sameDateRecords: DailyRecord[] = [];
  let minDate = '2023-01-01';
  const yearRequests = new Map<number, Promise<DailyRecord[]>>();

  const loadYear = (year: number) => {
    if (!yearRequests.has(year)) yearRequests.set(year, getYear(year));
    return yearRequests.get(year)!;
  };

  const navigate = (date: string) => {
    if (!validIso(date)) return;
    input.value = date;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const updateBaselineScope = () => {
    if (!baselineYear || !meta || !currentDate) return;
    const year = Number(currentDate.slice(0, 4));
    const dataYear = Number((meta.dataThrough || '').slice(0, 4));
    const label = year === dataYear ? `${year} YTD` : String(year);
    if (baselineYear.textContent !== label) baselineYear.textContent = label;
    baselineYear.title = year === dataYear
      ? `Compared with recorded ${year} days through ${meta.dataThrough}`
      : `Compared with recorded days in ${year}`;
  };

  const weekSignal = (label: string, value: number | null, max: number, display: string, key: string) => {
    const width = value === null || max <= 0 ? 0 : clampPercent(value / max * 100);
    return `<div class="day-week-signal" data-signal="${key}" title="${escapeHtml(`${label}: ${display}`)}"><span>${label}</span><i><b style="--week-signal:${width}%"></b></i><em>${escapeHtml(display)}</em></div>`;
  };

  async function renderWeek(date: string, token: number) {
    if (!meta?.dataThrough) return;
    weekHost.innerHTML = '<p>Loading nearby days…</p>';
    const center = parseIso(date);
    const dates = Array.from({ length: 7 }, (_, index) => toIso(new Date(center.getFullYear(), center.getMonth(), center.getDate() + index - 3, 12)))
      .filter((candidate) => candidate >= minDate && candidate <= meta!.dataThrough!);

    try {
      const years = Array.from(new Set(dates.map((candidate) => Number(candidate.slice(0, 4)))));
      const groups = await Promise.all(years.map(async (year) => await loadYear(year)));
      if (token !== renderToken) return;
      const records = new Map(groups.flat().map((record) => [record.date, record]));
      weekHost.replaceChildren();

      dates.forEach((candidate) => {
        const record = records.get(candidate);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'day-week-card-v2';
        if (candidate === date) button.setAttribute('aria-current', 'date');

        const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parseIso(candidate));
        if (!record) {
          button.disabled = true;
          button.dataset.state = 'missing';
          button.innerHTML = `<div class="day-week-card-v2__head"><span>${weekday}</span><strong>${shortDate(candidate)}</strong></div><p>No public record</p>`;
          weekHost.append(button);
          return;
        }

        const marker = record.dayEvent === 'positive' ? 'positive' : record.dayEvent === 'negative' ? 'negative' : 'neutral';
        const markerLabel = marker === 'positive' ? 'Positive day marker' : marker === 'negative' ? 'Negative day marker' : 'No day marker';
        const active = activeCount(record);
        button.dataset.marker = marker;
        button.dataset.state = record.status;
        button.innerHTML = `
          <div class="day-week-card-v2__head">
            <span>${weekday}</span>
            <strong>${shortDate(candidate)}</strong>
            <i class="day-week-marker" title="${markerLabel}" aria-label="${markerLabel}"></i>
          </div>
          <div class="day-week-signals">
            ${weekSignal('S', record.sleep.hours, 10, record.sleep.hours === null ? '—' : `${format(record.sleep.hours, 1)}h`, 'sleep')}
            ${weekSignal('W', record.work.hours, 12, record.work.hours === null ? '—' : `${format(record.work.hours, 1)}h`, 'work')}
            ${weekSignal('M', record.hobbies.totalDistanceMiles, 10, record.hobbies.totalDistanceMiles === null ? '—' : `${format(record.hobbies.totalDistanceMiles, 1)}mi`, 'movement')}
            ${weekSignal('A', active, 7, String(active), 'active')}
          </div>
          <small>${record.status === 'partial' ? 'Partial record' : `${active} active categories`}</small>`;
        button.addEventListener('click', () => navigate(candidate));
        weekHost.append(button);
      });
    } catch (caught) {
      weekHost.textContent = caught instanceof Error ? caught.message : 'Nearby days unavailable.';
    }
  }

  function renderSameDateCards(date: string, records: DailyRecord[]) {
    const metric = sameMetrics[sameMetric];
    const values = records.map((record) => metric.value(record)).filter((value): value is number => value !== null && Number.isFinite(value));
    const high = values.length ? Math.max(...values) : null;
    const low = values.length ? Math.min(...values) : null;
    const maxForBar = high !== null && high > 0 ? high : 1;
    const hasRange = values.length > 1 && high !== null && low !== null && high !== low;

    sameDateHost.replaceChildren();
    records
      .slice()
      .sort((first, second) => first.date.localeCompare(second.date))
      .forEach((record) => {
        const value = metric.value(record);
        const ratio = value === null ? 0 : clampPercent(value / maxForBar * 100);
        const isHigh = hasRange && value !== null && value === high;
        const isLow = hasRange && value !== null && value === low;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'same-date-card-v2';
        if (record.date === date) button.setAttribute('aria-current', 'date');
        if (isHigh) button.dataset.rank = 'high';
        if (isLow) button.dataset.rank = 'low';

        const rank = isHigh ? '<em>Highest</em>' : isLow ? '<em>Lowest</em>' : '';
        button.innerHTML = `
          <div class="same-date-card-v2__head">
            <strong>${record.date.slice(0, 4)}</strong>
            <span>${escapeHtml(record.status)}</span>
          </div>
          <div class="same-date-card-v2__value">
            <span>${metric.label}</span>
            <b>${escapeHtml(metric.display(value))}</b>
            ${rank}
          </div>
          <div class="same-date-card-v2__bar" aria-hidden="true"><i style="--same-date-width:${ratio}%"></i></div>
          <small>${record.date === date ? 'Selected day' : 'Open this year'}</small>`;
        button.addEventListener('click', () => navigate(record.date));
        sameDateHost.append(button);
      });

    if (!records.length) sameDateHost.innerHTML = '<p>No same-date records are available.</p>';
  }

  async function renderSameDate(date: string, token: number) {
    const parsed = parseIso(date);
    const cacheKey = `${parsed.getMonth() + 1}-${parsed.getDate()}`;
    sameDateHost.innerHTML = '<p>Loading same-date records…</p>';
    try {
      if (cacheKey !== sameDateCacheKey) {
        sameDateRecords = await getSameDate(parsed.getMonth() + 1, parsed.getDate());
        sameDateCacheKey = cacheKey;
      }
      if (token !== renderToken) return;
      renderSameDateCards(date, sameDateRecords);
    } catch (caught) {
      sameDateHost.textContent = caught instanceof Error ? caught.message : 'Same-date records unavailable.';
    }
  }

  const monthAvailableDays = (year: number, monthIndex: number) => {
    if (!meta?.dataThrough) return 0;
    const monthStart = new Date(year, monthIndex, 1, 12);
    const monthEnd = new Date(year, monthIndex + 1, 0, 12);
    const archiveStart = parseIso(minDate);
    const archiveEnd = parseIso(meta.dataThrough);
    const start = monthStart > archiveStart ? monthStart : archiveStart;
    const end = monthEnd < archiveEnd ? monthEnd : archiveEnd;
    return start <= end ? Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1 : 0;
  };

  async function renderYearCoverage(date: string, token: number) {
    const year = Number(date.slice(0, 4));
    coverageHost.innerHTML = '<span>Loading year coverage…</span>';
    try {
      const records = await loadYear(year);
      if (token !== renderToken) return;
      const selectedMonth = Number(date.slice(5, 7));
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      coverageHost.replaceChildren();

      monthNames.forEach((name, index) => {
        const month = index + 1;
        const monthRecords = records.filter((record) => Number(record.date.slice(5, 7)) === month);
        const possible = monthAvailableDays(year, index);
        const coverage = possible > 0 ? clampPercent(monthRecords.length / possible * 100) : 0;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'day-month-coverage';
        button.disabled = !monthRecords.length;
        if (month === selectedMonth) button.setAttribute('aria-current', 'true');
        button.title = monthRecords.length
          ? `${name} ${year}: ${monthRecords.length} public records${possible ? ` across ${possible} available days` : ''}`
          : `${name} ${year}: no public records`;
        button.innerHTML = `<span>${name}</span><i><b style="--month-coverage:${coverage}%"></b></i><small>${monthRecords.length || '—'}</small>`;
        if (monthRecords.length) button.addEventListener('click', () => navigate(monthRecords[0].date));
        coverageHost.append(button);
      });
    } catch (caught) {
      coverageHost.textContent = caught instanceof Error ? caught.message : 'Year coverage unavailable.';
    }
  }

  async function renderTemporal(date: string) {
    if (!validIso(date) || !meta) return;
    currentDate = date;
    const token = ++renderToken;
    updateBaselineScope();
    await Promise.all([
      renderWeek(date, token),
      renderSameDate(date, token),
      renderYearCoverage(date, token),
    ]);
    if (token === renderToken) updateBaselineScope();
  }

  const syncFromSelectedDay = () => {
    const date = input.value;
    if (!validIso(date) || date === currentDate) {
      updateBaselineScope();
      return;
    }
    void renderTemporal(date);
  };

  metricButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const metric = button.dataset.sameDateMetric as SameMetricKey | undefined;
      if (!metric || !(metric in sameMetrics)) return;
      sameMetric = metric;
      metricButtons.forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
      if (currentDate) renderSameDateCards(currentDate, sameDateRecords);
    });
  });

  const selectedObserver = new MutationObserver(syncFromSelectedDay);
  selectedObserver.observe(selectedDate, { childList: true, subtree: true, characterData: true });

  if (baselineYear) {
    const baselineObserver = new MutationObserver(updateBaselineScope);
    baselineObserver.observe(baselineYear, { childList: true, subtree: true, characterData: true });
  }

  void (async () => {
    try {
      meta = await getDailyMeta();
      minDate = meta.availableYears.length ? `${Math.min(...meta.availableYears)}-01-01` : minDate;
      syncFromSelectedDay();
      window.setTimeout(syncFromSelectedDay, 120);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Temporal archive context unavailable.';
      weekHost.textContent = message;
      sameDateHost.textContent = message;
      coverageHost.textContent = message;
    }
  })();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTemporalExplorer, { once: true });
else initTemporalExplorer();
