import { getDailyMeta, getDay, getSameDate, getYear, prefetchYear } from '../utils/dailyData';
import type { DailyMeta, DailyRecord } from '../utils/dailyData';

const DAY_MS = 86_400_000;
const RUN_MINUTES_PER_MILE = 10;
const parseIso = (value: string) => new Date(`${value}T12:00:00`);
const toIso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const longDate = (value: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(parseIso(value));
const shortDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parseIso(value));
const format = (value: number | null, digits = 0) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const compact = (value: number | null) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { notation: Math.abs(value) >= 1000 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
const dayOfYear = (date: Date) => Math.floor((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(date.getFullYear(), 0, 0)) / DAY_MS);
const yearDays = (year: number) => new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
const fromDay = (year: number, day: number) => new Date(year, 0, day, 12);
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
const validIso = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseIso(value).getTime());

function initDayExplorer() {
  const root = document.querySelector<HTMLElement>('[data-day-explorer]');
  if (!root || root.dataset.runtimeReady === 'true') return;
  root.dataset.runtimeReady = 'true';

  const input = root.querySelector<HTMLInputElement>('#day-date');
  const yearSelect = root.querySelector<HTMLSelectElement>('[data-day-year]');
  const slider = root.querySelector<HTMLInputElement>('[data-day-scrubber]');
  const previousButton = root.querySelector<HTMLButtonElement>('[data-day-previous]');
  const nextButton = root.querySelector<HTMLButtonElement>('[data-day-next]');
  const latestButton = root.querySelector<HTMLButtonElement>('[data-day-latest]');
  const currentButton = root.querySelector<HTMLButtonElement>('[data-day-current]');
  const randomButton = root.querySelector<HTMLButtonElement>('[data-day-random]');
  const copyButton = root.querySelector<HTMLButtonElement>('[data-day-copy]');
  const status = root.querySelector<HTMLElement>('[data-day-status]');
  const error = root.querySelector<HTMLElement>('[data-day-error]');
  const liveRegion = root.querySelector<HTMLElement>('[data-day-live-region]');
  if (!input || !yearSelect || !slider) return;

  let meta: DailyMeta | null = null;
  let current: DailyRecord | null = null;
  let minDate = '2023-01-01';
  let requestToken = 0;
  let copyResetTimer: number | undefined;
  const yearRequests = new Map<number, Promise<DailyRecord[]>>();

  const setText = (selector: string, value: string) => {
    const node = root.querySelector(selector);
    if (node) node.textContent = value;
  };
  const announce = (value: string) => { if (liveRegion) liveRegion.textContent = value; };
  const setStatus = (value: string, state: 'loading' | 'live' | 'error') => {
    if (!status) return;
    status.dataset.state = state;
    const label = status.querySelector('strong');
    if (label) label.textContent = value;
  };
  const setError = (value = '') => {
    if (!error) return;
    error.hidden = !value;
    error.textContent = value;
  };
  const loadYear = (year: number) => {
    if (!yearRequests.has(year)) yearRequests.set(year, getYear(year));
    return yearRequests.get(year)!;
  };
  const clampDate = (value: string) => {
    if (!meta?.dataThrough) return value < minDate ? minDate : value;
    return value < minDate ? minDate : value > meta.dataThrough ? meta.dataThrough : value;
  };

  type ValueState = 'recorded' | 'zero' | 'missing' | 'partial';
  const valueState = (value: number | null, record: DailyRecord): ValueState => {
    if (value === null) return 'missing';
    if (record.status === 'partial') return 'partial';
    return value === 0 ? 'zero' : 'recorded';
  };

  function renderMetrics(record: DailyRecord) {
    const host = root.querySelector<HTMLElement>('[data-day-metrics]');
    if (!host) return;
    const movementNote = `${format(record.hobbies.runningMiles, 1)} running + ${format(record.hobbies.treadmillMiles, 1)} treadmill miles`;
    const metrics = [
      { icon: '😴', label: 'Sleep', value: record.sleep.hours, unit: 'hours', digits: 1, note: record.sleep.napHours ? `${format(record.sleep.napHours, 1)}-hour nap also logged` : record.sleep.category ? `${record.sleep.category} sleep` : 'Nightly sleep' },
      { icon: '🧠', label: 'Work', value: record.work.hours, unit: 'hours', digits: 1, note: record.work.category ? `${record.work.category} work` : 'Logged work time' },
      { icon: '🎸', label: 'Guitar', value: record.hobbies.guitarMinutes, unit: 'minutes', digits: 0, note: 'Practice time' },
      { icon: '👟', label: 'Movement', value: record.hobbies.totalDistanceMiles, unit: 'miles', digits: 1, note: movementNote },
      { icon: '📚', label: 'Audiobooks', value: record.audiobook.minutes, unit: 'minutes', digits: 0, note: record.audiobook.title || 'Listening time' },
      { icon: '📓', label: 'Diary', value: record.diary.words, unit: 'words', digits: 0, note: 'Words written' },
      { icon: '💃', label: 'Dance', value: record.hobbies.danceMinutes, unit: 'minutes', digits: 0, note: 'Dance practice' },
      { icon: '🌍', label: 'Language', value: record.hobbies.languageMinutes, unit: 'minutes', digits: 0, note: 'Language study' },
    ];
    host.replaceChildren();
    metrics.forEach((metric) => {
      const card = document.createElement('article');
      card.className = 'day-metric-card';
      card.dataset.state = valueState(metric.value, record);
      card.innerHTML = `<div class="day-metric-card__top"><span class="day-metric-card__icon" aria-hidden="true">${metric.icon}</span><h3>${metric.label}</h3></div><p class="day-metric-card__value"><strong>${format(metric.value, metric.digits)}</strong><span>${metric.unit}</span></p><small>${escapeHtml(metric.value === null ? 'Unavailable for this day' : metric.note)}</small>`;
      host.append(card);
    });
  }

  function renderSummary(record: DailyRecord) {
    const host = root.querySelector<HTMLElement>('[data-day-summary]');
    if (!host) return;
    const curated = record.public;
    const details = [
      ['Work note', curated?.workDescription],
      ['Breakfast', curated?.breakfast],
      ['Lunch', curated?.lunch],
      ['Dinner', curated?.dinner],
      ['Sleep window', curated?.sleepTime || curated?.wakeTime ? `${curated?.sleepTime || '—'} to ${curated?.wakeTime || '—'}` : null],
    ].filter((item): item is [string, string] => Boolean(item[1]));
    host.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = curated?.summary ? 'Public summary' : 'No curated summary for this date';
    const paragraph = document.createElement('p');
    paragraph.textContent = curated?.summary || 'The private Summary of the Day and raw diary remain outside the public feed. Only a separately approved summary can appear here.';
    host.append(title, paragraph);
    if (details.length) {
      const list = document.createElement('dl');
      details.forEach(([label, value]) => {
        const row = document.createElement('div');
        const term = document.createElement('dt');
        const description = document.createElement('dd');
        term.textContent = label;
        description.textContent = value;
        row.append(term, description);
        list.append(row);
      });
      host.append(list);
    }
  }

  const mealLabel = (value: string | null) => value ? ({ ordinary: 'Ordinary', restaurant: 'Ate out', provided: 'Provided', skipped: 'Skipped' }[value] || value) : 'Unavailable';
  function renderContext(record: DailyRecord) {
    const host = root.querySelector<HTMLElement>('[data-day-context]');
    if (!host) return;
    const event = record.dayEvent === 'positive'
      ? ['Positive day', 'A triumph or positive-event marker was recorded.']
      : record.dayEvent === 'negative'
        ? ['Negative day', 'A failure, defeat, or negative-event marker was recorded.']
        : ['No day marker', 'No positive or negative marker was assigned.'];
    const weatherFlags = record.weather.flags.length ? record.weather.flags.join(' · ') : 'No weather flags';
    const audiobookNote = record.audiobook.minutes === null
      ? 'Listening unavailable'
      : `${format(record.audiobook.minutes)} minutes${record.audiobook.timestamp ? ` · ${record.audiobook.timestamp}` : ''}`;
    host.innerHTML = `
      <article class="day-context-card"><span>Weather</span><strong>${record.weather.highF === null && record.weather.lowF === null ? 'Unavailable' : `${format(record.weather.lowF)}–${format(record.weather.highF)}°F`}</strong><small>${escapeHtml(weatherFlags)}</small><dl><div><dt>High</dt><dd>${record.weather.highF === null ? '—' : `${format(record.weather.highF)}°F`}</dd></div><div><dt>Low</dt><dd>${record.weather.lowF === null ? '—' : `${format(record.weather.lowF)}°F`}</dd></div></dl></article>
      <article class="day-context-card"><span>Meals</span><strong>Daily pattern</strong><small>Categories only; exact meals stay private.</small><dl><div><dt>Breakfast</dt><dd>${escapeHtml(mealLabel(record.food.breakfastType))}</dd></div><div><dt>Lunch</dt><dd>${escapeHtml(mealLabel(record.food.lunchType))}</dd></div><div><dt>Dinner</dt><dd>${escapeHtml(mealLabel(record.food.dinnerType))}</dd></div></dl></article>
      <article class="day-context-card"><span>Day marker</span><strong>${event[0]}</strong><small>${event[1]}</small></article>
      <article class="day-context-card"><span>Audiobook</span><strong>${escapeHtml(record.audiobook.title || 'No title recorded')}</strong><small>${escapeHtml(audiobookNote)}${record.audiobook.started ? ' · New title started' : ''}</small></article>`;
  }

  function renderDurations(record: DailyRecord) {
    const host = root.querySelector<HTMLElement>('[data-day-durations]');
    if (!host) return;
    const values = [
      { icon: '🧠', label: 'Work', value: record.work.hours === null ? null : record.work.hours * 60, note: 'recorded' },
      { icon: '📚', label: 'Audiobooks', value: record.audiobook.minutes, note: 'recorded' },
      { icon: '🚶', label: 'Treadmill', value: record.hobbies.treadmillMinutes, note: 'recorded' },
      { icon: '🏃', label: 'Running', value: record.hobbies.runningMiles === null ? null : record.hobbies.runningMiles * RUN_MINUTES_PER_MILE, note: 'estimated at 10 min/mile' },
      { icon: '🎸', label: 'Guitar', value: record.hobbies.guitarMinutes, note: 'recorded' },
      { icon: '💃', label: 'Dance', value: record.hobbies.danceMinutes, note: 'recorded' },
      { icon: '🌍', label: 'Language', value: record.hobbies.languageMinutes, note: 'recorded' },
    ];
    const max = Math.max(0, ...values.map((item) => item.value ?? 0));
    host.replaceChildren();
    values.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'day-duration-row';
      const width = item.value === null || max <= 0 ? 0 : Math.max(item.value > 0 ? 2 : 0, item.value / max * 100);
      row.innerHTML = `<div class="day-duration-row__label"><span aria-hidden="true">${item.icon}</span><strong>${item.label}</strong></div><small>${item.value === null ? 'Unavailable' : `${format(item.value)} min · ${item.note}`}</small><div class="day-duration-row__bar"><i style="--duration-width:${width}%"></i></div>`;
      host.append(row);
    });
  }

  function renderActivities(record: DailyRecord) {
    const host = root.querySelector<HTMLElement>('[data-day-activities]');
    if (!host) return;
    const items: Array<{ icon: string; label: string; raw: number | string | null; display: string }> = [
      { icon: '📖', label: 'Bible reading', raw: record.hobbies.bibleChapter, display: record.hobbies.bibleChapter || '—' },
      { icon: '🔤', label: 'Dictionary', raw: record.hobbies.dictionaryPage, display: record.hobbies.dictionaryPage === null ? '—' : `Page ${format(record.hobbies.dictionaryPage)}` },
      { icon: '📓', label: 'Diary', raw: record.diary.words, display: record.diary.words === null ? '—' : `${compact(record.diary.words)} words` },
      { icon: '🌍', label: 'Language study', raw: record.hobbies.languageMinutes, display: record.hobbies.languageMinutes === null ? '—' : `${format(record.hobbies.languageMinutes)} min` },
      { icon: '🏃', label: 'Running', raw: record.hobbies.runningMiles, display: record.hobbies.runningMiles === null ? '—' : `${format(record.hobbies.runningMiles, 1)} miles` },
      { icon: '🚶', label: 'Treadmill', raw: record.hobbies.treadmillMiles, display: record.hobbies.treadmillMiles === null ? '—' : `${format(record.hobbies.treadmillMiles, 1)} miles` },
      { icon: '🎸', label: 'Guitar', raw: record.hobbies.guitarMinutes, display: record.hobbies.guitarMinutes === null ? '—' : `${format(record.hobbies.guitarMinutes)} min` },
      { icon: '💃', label: 'Dance', raw: record.hobbies.danceMinutes, display: record.hobbies.danceMinutes === null ? '—' : `${format(record.hobbies.danceMinutes)} min` },
      { icon: '🎧', label: 'Audiobook', raw: record.audiobook.minutes, display: record.audiobook.minutes === null ? '—' : `${format(record.audiobook.minutes)} min` },
    ];
    host.replaceChildren();
    items.forEach((item) => {
      const state = item.raw === null || item.raw === '' ? 'missing' : typeof item.raw === 'number' && item.raw === 0 ? 'zero' : 'recorded';
      const row = document.createElement('div');
      row.className = 'day-activity-row';
      row.innerHTML = `<span aria-hidden="true">${item.icon}</span><strong>${item.label}</strong><span>${escapeHtml(item.display)}</span><small class="day-state-pill" data-state="${state}">${state === 'recorded' ? 'Logged' : state === 'zero' ? 'None' : 'Unavailable'}</small>`;
      host.append(row);
    });
  }

  const comparisonMetricIcons: Record<string, string> = {
    Sleep: '😴', Work: '🧠', Guitar: '🎸', Movement: '👟', Diary: '📓', Audiobooks: '📚', Dance: '💃', Language: '🌍',
  };

  function comparisonMetrics(record: DailyRecord) {
    return [
      { label: 'Sleep', value: record.sleep.hours, unit: 'hr', digits: 1, values: (list: DailyRecord[]) => list.map((item) => item.sleep.hours) },
      { label: 'Work', value: record.work.hours, unit: 'hr', digits: 1, values: (list: DailyRecord[]) => list.map((item) => item.work.hours) },
      { label: 'Guitar', value: record.hobbies.guitarMinutes, unit: 'min', digits: 0, values: (list: DailyRecord[]) => list.map((item) => item.hobbies.guitarMinutes) },
      { label: 'Movement', value: record.hobbies.totalDistanceMiles, unit: 'miles', digits: 1, values: (list: DailyRecord[]) => list.map((item) => item.hobbies.totalDistanceMiles) },
      { label: 'Diary', value: record.diary.words, unit: 'words', digits: 0, values: (list: DailyRecord[]) => list.map((item) => item.diary.words) },
      { label: 'Audiobooks', value: record.audiobook.minutes, unit: 'min', digits: 0, values: (list: DailyRecord[]) => list.map((item) => item.audiobook.minutes) },
      { label: 'Dance', value: record.hobbies.danceMinutes, unit: 'min', digits: 0, values: (list: DailyRecord[]) => list.map((item) => item.hobbies.danceMinutes) },
      { label: 'Language', value: record.hobbies.languageMinutes, unit: 'min', digits: 0, values: (list: DailyRecord[]) => list.map((item) => item.hobbies.languageMinutes) },
    ];
  }

  async function renderComparison(record: DailyRecord, token: number) {
    const host = root.querySelector<HTMLElement>('[data-day-comparison]');
    const highlightHost = root.querySelector<HTMLElement>('[data-day-highlights]');
    if (!host) return;
    host.textContent = 'Loading selected-year baseline…';
    if (highlightHost) highlightHost.innerHTML = '<p>Loading what stood out…</p>';
    try {
      const year = Number(record.date.slice(0, 4));
      const records = await loadYear(year);
      if (token !== requestToken) return;
      setText('[data-baseline-year]', String(year));

      const comparisons = comparisonMetrics(record).map((metric) => {
        const valid = metric.values(records).filter((value): value is number => value !== null && Number.isFinite(value));
        const baseline = valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : null;
        const difference = metric.value === null || baseline === null ? null : metric.value - baseline;
        const percentile = metric.value === null || !valid.length ? null : valid.filter((value) => value <= metric.value!).length / valid.length * 100;
        return { ...metric, baseline, difference, percentile, sampleSize: valid.length };
      });

      host.replaceChildren();
      comparisons.forEach((metric) => {
        const row = document.createElement('div');
        row.className = 'day-comparison-row';
        const comparison = metric.difference === null
          ? 'No comparison'
          : Math.abs(metric.difference) < .05
            ? 'Near the year average'
            : `${format(Math.abs(metric.difference), metric.digits)} ${metric.unit} ${metric.difference > 0 ? 'above' : 'below'} average`;
        row.innerHTML = `<span>${metric.label}</span><strong>${metric.value === null ? '—' : `${format(metric.value, metric.digits)} ${metric.unit}`}</strong><small>${comparison}${metric.percentile === null ? '' : ` · P${Math.round(metric.percentile)}`}</small><div class="day-percentile" title="${metric.percentile === null ? 'No percentile' : `${Math.round(metric.percentile)}th percentile`}"><i style="--percentile:${metric.percentile ?? 0}%"></i></div>`;
        host.append(row);
      });

      if (highlightHost) {
        const candidates = comparisons
          .filter((metric) => metric.value !== null && metric.percentile !== null && metric.sampleSize >= 5)
          .sort((first, second) => Math.abs(second.percentile! - 50) - Math.abs(first.percentile! - 50))
          .slice(0, 3);
        highlightHost.replaceChildren();
        candidates.forEach((metric) => {
          const percentile = Math.round(metric.percentile!);
          const rank = percentile >= 85
            ? `Top ${Math.max(1, 100 - percentile)}% of ${year} days`
            : percentile <= 15
              ? `Bottom ${Math.max(1, percentile)}% of ${year} days`
              : `${percentile}th percentile in ${year}`;
          const delta = metric.difference === null || Math.abs(metric.difference) < .05
            ? 'Near the yearly average'
            : `${format(Math.abs(metric.difference), metric.digits)} ${metric.unit} ${metric.difference > 0 ? 'above' : 'below'} the yearly average`;
          const card = document.createElement('article');
          card.className = 'day-highlight-card';
          card.innerHTML = `<div class="day-highlight-card__top"><span aria-hidden="true">${comparisonMetricIcons[metric.label] || '•'}</span><strong>${metric.label}</strong></div><p><b>${format(metric.value, metric.digits)}</b><span>${metric.unit}</span></p><em>${rank}</em><small>${delta}</small>`;
          highlightHost.append(card);
        });
        if (!candidates.length) {
          highlightHost.innerHTML = '<p class="day-highlight-empty">Not enough comparable observations are available to call out unusual values for this date.</p>';
        }
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Year comparison unavailable.';
      host.textContent = message;
      if (highlightHost) highlightHost.textContent = message;
    }
  }

  async function renderWeek(record: DailyRecord, token: number) {
    const host = root.querySelector<HTMLElement>('[data-day-week]');
    if (!host || !meta?.dataThrough) return;
    host.textContent = 'Loading nearby days…';
    const center = parseIso(record.date);
    const dates = Array.from({ length: 7 }, (_, index) => toIso(addDays(center, index - 3)))
      .filter((date) => date >= minDate && date <= meta!.dataThrough!);
    try {
      const years = Array.from(new Set(dates.map((date) => Number(date.slice(0, 4)))));
      const groups = await Promise.all(years.map(async (year) => [year, await loadYear(year)] as const));
      if (token !== requestToken) return;
      const records = new Map(groups.flatMap(([, list]) => list).map((item) => [item.date, item]));
      host.replaceChildren();
      dates.forEach((date) => {
        const item = records.get(date);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'day-week-card';
        if (date === record.date) button.setAttribute('aria-current', 'date');
        const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parseIso(date));
        button.innerHTML = `<span>${weekday}</span><strong>${shortDate(date)}</strong><small>${item ? `${item.sleep.hours === null ? '—' : `${format(item.sleep.hours, 1)}h`} sleep<br>${item.hobbies.totalDistanceMiles === null ? '—' : `${format(item.hobbies.totalDistanceMiles, 1)} mi`} movement` : 'No record'}</small>`;
        button.addEventListener('click', () => void setDate(date));
        host.append(button);
      });
    } catch (caught) {
      host.textContent = caught instanceof Error ? caught.message : 'Nearby days unavailable.';
    }
  }

  async function renderSameDate(record: DailyRecord, token: number) {
    const host = root.querySelector<HTMLElement>('[data-same-date-grid]');
    if (!host) return;
    host.textContent = 'Loading same-date records…';
    try {
      const date = parseIso(record.date);
      const records = await getSameDate(date.getMonth() + 1, date.getDate());
      if (token !== requestToken) return;
      host.replaceChildren();
      records.sort((first, second) => first.date.localeCompare(second.date)).forEach((item) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'same-date-card';
        if (item.date === record.date) button.setAttribute('aria-current', 'date');
        button.innerHTML = `<div class="same-date-card__top"><strong>${item.date.slice(0, 4)}</strong><span>${escapeHtml(item.day || 'Day')} · ${escapeHtml(item.status)}</span></div><dl><div><dt>Sleep</dt><dd>${item.sleep.hours === null ? '—' : `${format(item.sleep.hours, 1)} hr`}</dd></div><div><dt>Work</dt><dd>${item.work.hours === null ? '—' : `${format(item.work.hours, 1)} hr`}</dd></div><div><dt>Movement</dt><dd>${item.hobbies.totalDistanceMiles === null ? '—' : `${format(item.hobbies.totalDistanceMiles, 1)} miles`}</dd></div><div><dt>Diary</dt><dd>${compact(item.diary.words)} words</dd></div></dl>`;
        button.addEventListener('click', () => void setDate(item.date));
        host.append(button);
      });
      if (!records.length) host.textContent = 'No same-date records are available.';
    } catch (caught) {
      host.textContent = caught instanceof Error ? caught.message : 'Same-date records unavailable.';
    }
  }

  function renderHeader(record: DailyRecord) {
    const date = parseIso(record.date);
    const formatted = longDate(record.date).split(', ');
    setText('[data-selected-weekday]', formatted[0] || record.day || 'Archive day');
    setText('[data-selected-date]', formatted.slice(1).join(', '));
    setText('[data-day-number]', `Day ${dayOfYear(date)} of ${date.getFullYear()}`);
    setText('[data-record-state]', record.status === 'complete' ? 'Complete public-safe record' : 'Partial public-safe record');

    const coverage = [
      record.sleep.hours, record.sleep.napHours, record.weather.highF, record.weather.lowF,
      record.diary.words, record.work.hours, record.hobbies.languageMinutes, record.hobbies.runningMiles,
      record.hobbies.treadmillMinutes, record.hobbies.guitarMinutes, record.hobbies.danceMinutes,
      record.audiobook.minutes, record.hobbies.bibleChapter, record.hobbies.dictionaryPage,
    ];
    const recorded = coverage.filter((value) => value !== null && value !== '').length;
    const active = [record.hobbies.guitarMinutes, record.hobbies.danceMinutes, record.hobbies.languageMinutes, record.hobbies.runningMiles, record.hobbies.treadmillMinutes, record.audiobook.minutes, record.diary.words]
      .filter((value) => typeof value === 'number' && value > 0).length;
    setText('[data-completeness]', `${recorded} of ${coverage.length} fields recorded`);
    setText('[data-active-count]', `${active} active categories`);
    setText('[data-day-marker]', record.dayEvent === 'positive' ? 'Positive day' : record.dayEvent === 'negative' ? 'Negative day' : 'No day marker');

    input.value = record.date;
    yearSelect.value = record.date.slice(0, 4);
    slider.max = String(yearDays(date.getFullYear()));
    slider.value = String(dayOfYear(date));
    setText('[data-scrub-label]', `${date.getFullYear()} archive`);
    setText('[data-scrub-output]', `${shortDate(record.date)} · day ${dayOfYear(date)}`);
    if (previousButton) previousButton.disabled = record.date <= minDate;
    if (nextButton) nextButton.disabled = !meta?.dataThrough || record.date >= meta.dataThrough;
  }

  async function renderRecord(record: DailyRecord, token: number) {
    current = record;
    renderHeader(record);
    renderMetrics(record);
    renderSummary(record);
    renderContext(record);
    renderDurations(record);
    renderActivities(record);
    void renderComparison(record, token);
    void renderWeek(record, token);
    void renderSameDate(record, token);
    const url = new URL(location.href);
    url.searchParams.set('date', record.date);
    history.replaceState({}, '', url);
    announce(`Loaded ${longDate(record.date)}.`);
  }

  async function setDate(value: string) {
    if (!meta || !validIso(value)) return;
    const date = clampDate(value);
    const token = ++requestToken;
    setError();
    setStatus('Loading selected day…', 'loading');
    root.setAttribute('aria-busy', 'true');
    try {
      const record = await getDay(date);
      if (token !== requestToken) return;
      await renderRecord(record, token);
      setStatus(record.status === 'complete' ? 'Live complete record' : 'Live partial record', 'live');
    } catch (caught) {
      if (token !== requestToken) return;
      const message = caught instanceof Error ? caught.message : 'Daily record unavailable.';
      setError(message);
      setStatus('Daily record unavailable', 'error');
      announce(message);
    } finally {
      if (token === requestToken) root.setAttribute('aria-busy', 'false');
    }
  }

  const moveDay = (amount: number) => {
    if (!current || !meta?.dataThrough) return;
    const next = toIso(addDays(parseIso(current.date), amount));
    if (next >= minDate && next <= meta.dataThrough) void setDate(next);
  };

  const randomDay = async () => {
    if (!meta?.availableYears.length) return;
    const years = [...meta.availableYears];
    const shuffled = years.sort(() => Math.random() - .5);
    if (randomButton) randomButton.disabled = true;
    setError();
    setStatus('Finding an archived day…', 'loading');
    try {
      for (const year of shuffled) {
        const records = (await loadYear(year)).filter((record) => record.date >= minDate && (!meta?.dataThrough || record.date <= meta.dataThrough));
        if (!records.length) continue;
        const record = records[Math.floor(Math.random() * records.length)];
        await setDate(record.date);
        return;
      }
      setError('No archived records were available for a random jump.');
      setStatus('No archived day available', 'error');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not choose a random archived day.';
      setError(message);
      setStatus('Random day unavailable', 'error');
    } finally {
      if (randomButton) randomButton.disabled = false;
    }
  };

  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    if (!copied) throw new Error('Copy unavailable in this browser.');
  };

  const copyCurrentDay = async () => {
    if (!current || !copyButton) return;
    const url = new URL(location.href);
    url.searchParams.set('date', current.date);
    try {
      await copyText(url.toString());
      window.clearTimeout(copyResetTimer);
      copyButton.textContent = 'Copied ✓';
      copyButton.dataset.state = 'copied';
      announce(`Copied link to ${longDate(current.date)}.`);
      copyResetTimer = window.setTimeout(() => {
        copyButton.textContent = 'Copy this day';
        delete copyButton.dataset.state;
      }, 1800);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not copy this day.';
      setError(message);
      announce(message);
    }
  };

  async function start() {
    try {
      meta = await getDailyMeta();
      minDate = meta.availableYears.length ? `${Math.min(...meta.availableYears)}-01-01` : minDate;
      input.min = minDate;
      input.max = meta.dataThrough || '';
      yearSelect.replaceChildren();
      meta.availableYears.forEach((year) => {
        const option = document.createElement('option');
        option.value = String(year);
        option.textContent = String(year);
        yearSelect.append(option);
      });
      const latestYear = Number((meta.latestCompleteDate || meta.dataThrough || minDate).slice(0, 4));
      prefetchYear(latestYear);

      input.addEventListener('change', () => void setDate(input.value));
      previousButton?.addEventListener('click', () => moveDay(-1));
      nextButton?.addEventListener('click', () => moveDay(1));
      latestButton?.addEventListener('click', () => meta?.latestCompleteDate && void setDate(meta.latestCompleteDate));
      currentButton?.addEventListener('click', () => meta?.dataThrough && void setDate(meta.dataThrough));
      randomButton?.addEventListener('click', () => void randomDay());
      copyButton?.addEventListener('click', () => void copyCurrentDay());
      yearSelect.addEventListener('change', () => {
        if (!current) return;
        const currentDate = parseIso(current.date);
        const candidate = new Date(Number(yearSelect.value), currentDate.getMonth(), currentDate.getDate(), 12);
        if (candidate.getMonth() !== currentDate.getMonth()) candidate.setDate(0);
        void setDate(toIso(candidate));
      });
      slider.addEventListener('input', () => {
        const date = fromDay(Number(yearSelect.value), Number(slider.value));
        setText('[data-scrub-output]', `${shortDate(toIso(date))} · day ${slider.value}`);
      });
      slider.addEventListener('change', () => void setDate(toIso(fromDay(Number(yearSelect.value), Number(slider.value)))));
      document.addEventListener('keydown', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.matches('input,select,textarea,button,a,[contenteditable=true]')) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); moveDay(-1); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); moveDay(1); }
        else if (event.key.toLowerCase() === 'l' && meta?.latestCompleteDate) void setDate(meta.latestCompleteDate);
        else if (event.key.toLowerCase() === 'r') void randomDay();
      });

      const requested = new URL(location.href).searchParams.get('date');
      const initial = requested && validIso(requested) ? clampDate(requested) : meta.latestCompleteDate || meta.dataThrough || minDate;
      await setDate(initial);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Daily archive could not be initialized.';
      setError(message);
      setStatus('Daily archive unavailable', 'error');
      root.setAttribute('aria-busy', 'false');
    }
  }

  void start();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDayExplorer, { once: true });
else initDayExplorer();
