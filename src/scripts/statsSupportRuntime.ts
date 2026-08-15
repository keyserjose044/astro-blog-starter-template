import { getDailyMeta, getDay, getYear, getYears, prefetchYear } from '../utils/dailyData';
import type { DailyMeta, DailyRecord } from '../utils/dailyData';

const NS = 'http://www.w3.org/2000/svg';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const RUN_MINUTES_PER_MILE = 10;

const parseIso = (value: string) => new Date(`${value}T12:00:00`);
const longDate = (value: string) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(parseIso(value));
const format = (value: number | null, digits = 0) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const compact = (value: number) => {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return `${format(value / 1_000_000, Number.isInteger(value / 1_000_000) ? 0 : 1)}m`;
  if (absolute >= 1_000) return `${format(value / 1_000, Number.isInteger(value / 1_000) ? 0 : 1)}k`;
  return format(value, Number.isInteger(value) ? 0 : 1);
};
const sum = (values: Array<number | null>) => values.reduce((total, value) => total + (value ?? 0), 0);
const average = (values: Array<number | null>) => {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return valid.length ? sum(valid) / valid.length : null;
};
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] || character));
const svg = (tag: string, attrs: Record<string, string | number> = {}) => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
};
const setText = (root: ParentNode, selector: string, value: string) => {
  const node = root.querySelector(selector);
  if (node) node.textContent = value;
};
const waitFor = async (selector: string, attempts = 160) => {
  for (let index = 0; index < attempts; index += 1) {
    const node = document.querySelector(selector);
    if (node instanceof HTMLElement) return node;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return null;
};

function tooltipElement() {
  let tooltip = document.querySelector<HTMLElement>('.stats-support-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'stats-support-tooltip';
    tooltip.hidden = true;
    tooltip.setAttribute('role', 'tooltip');
    document.body.append(tooltip);
  }
  return tooltip;
}

function positionTooltip(tooltip: HTMLElement, x: number, y: number) {
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
  requestAnimationFrame(() => {
    const box = tooltip.getBoundingClientRect();
    if (box.right > window.innerWidth - 8) tooltip.style.left = `${Math.max(8, x - box.width - 20)}px`;
    if (box.top < 8) tooltip.style.top = `${Math.min(window.innerHeight - 8, y + box.height + 18)}px`;
  });
}

function bindTooltip(target: SVGElement, text: string) {
  target.classList.add('stats-support-point');
  target.setAttribute('aria-label', text);
  target.setAttribute('tabindex', '0');
  const tooltip = tooltipElement();
  const showPointer = (event: Event) => {
    const pointer = event as PointerEvent;
    tooltip.textContent = text;
    tooltip.hidden = false;
    positionTooltip(tooltip, pointer.clientX, pointer.clientY);
  };
  const showFocus = () => {
    const box = target.getBoundingClientRect();
    tooltip.textContent = text;
    tooltip.hidden = false;
    positionTooltip(tooltip, box.left + box.width / 2, box.top);
  };
  const hide = () => { tooltip.hidden = true; };
  target.addEventListener('pointerenter', showPointer);
  target.addEventListener('pointermove', showPointer);
  target.addEventListener('pointerleave', hide);
  target.addEventListener('focus', showFocus);
  target.addEventListener('blur', hide);
}

function niceScale(maximumValue: number) {
  const maximum = Math.max(0, maximumValue);
  const roughStep = Math.max(Number.EPSILON, maximum / 5);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(Number.EPSILON, niceNormalized * magnitude);
  const niceMaximum = Math.max(step, Math.ceil(maximum / step) * step);
  return { maximum: niceMaximum, step, intervals: Math.max(1, Math.round(niceMaximum / step)) };
}

function appendAxes(chart: SVGSVGElement, scale: { maximum: number; step: number; intervals: number }, margin: { left: number; right: number; top: number; bottom: number }, width: number, height: number) {
  const innerHeight = height - margin.top - margin.bottom;
  for (let index = 0; index <= scale.intervals; index += 1) {
    const value = scale.maximum - scale.step * index;
    const y = margin.top + innerHeight * index / scale.intervals;
    chart.append(svg('line', { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: 'stats-support-grid' }));
    const label = svg('text', { x: margin.left - 10, y: y + 4, 'text-anchor': 'end', class: 'stats-support-axis' });
    label.textContent = compact(value);
    chart.append(label);
  }
}

function monotonePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  const count = points.length;
  const widths = new Array<number>(count - 1);
  const slopes = new Array<number>(count - 1);
  const tangents = new Array<number>(count);
  for (let index = 0; index < count - 1; index += 1) {
    widths[index] = points[index + 1].x - points[index].x;
    slopes[index] = widths[index] ? (points[index + 1].y - points[index].y) / widths[index] : 0;
  }
  tangents[0] = slopes[0];
  tangents[count - 1] = slopes[count - 2];
  for (let index = 1; index < count - 1; index += 1) {
    if (slopes[index - 1] === 0 || slopes[index] === 0 || Math.sign(slopes[index - 1]) !== Math.sign(slopes[index])) tangents[index] = 0;
    else {
      const firstWeight = 2 * widths[index] + widths[index - 1];
      const secondWeight = widths[index] + 2 * widths[index - 1];
      tangents[index] = (firstWeight + secondWeight) / (firstWeight / slopes[index - 1] + secondWeight / slopes[index]);
    }
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < count - 1; index += 1) {
    const width = widths[index];
    path += ` C ${points[index].x + width / 3} ${points[index].y + tangents[index] * width / 3}, ${points[index + 1].x - width / 3} ${points[index + 1].y - tangents[index + 1] * width / 3}, ${points[index + 1].x} ${points[index + 1].y}`;
  }
  return path;
}

type MonthValue = { key: string; year: number; month: number; value: number | null };
function monthly(records: DailyRecord[], value: (record: DailyRecord) => number | null, mode: 'sum' | 'average' = 'sum') {
  const groups = new Map<string, DailyRecord[]>();
  records.forEach((record) => {
    const key = record.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  });
  return Array.from(groups, ([key, list]): MonthValue => ({
    key,
    year: Number(key.slice(0, 4)),
    month: Number(key.slice(5, 7)) - 1,
    value: mode === 'average' ? average(list.map(value)) : sum(list.map(value)),
  })).sort((first, second) => first.key.localeCompare(second.key));
}

function mountPreview(dashboard: HTMLElement) {
  const existing = dashboard.querySelector<HTMLElement>('.stats-daily-preview');
  if (existing) return existing;
  const hero = dashboard.querySelector('.stats-hero');
  if (!hero) return null;
  const section = document.createElement('section');
  section.className = 'stats-daily-preview';
  section.setAttribute('aria-labelledby', 'stats-daily-preview-heading');
  section.innerHTML = `
    <div class="stats-daily-preview__heading"><div><p class="stats-daily-preview__eyebrow">Latest daily snapshot</p><h2 id="stats-daily-preview-heading">One day at a glance</h2></div><span class="stats-daily-preview__status"><i aria-hidden="true"></i> Connecting…</span></div>
    <div class="stats-daily-preview__body"><div class="stats-daily-preview__date"><span data-preview-weekday>Archive day</span><strong data-preview-date>Loading date…</strong><p>Loading the latest completed public-safe Archive record.</p></div><div class="stats-daily-preview__metrics" data-preview-metrics></div></div>
    <div class="stats-daily-preview__footer"><p>No placeholder values are presented as real data.</p><a href="/day/">Open the Day Explorer <span aria-hidden="true">→</span></a></div>`;
  hero.insertAdjacentElement('afterend', section);
  return section;
}

function updatePreview(preview: HTMLElement, record: DailyRecord) {
  const dateParts = longDate(record.date).split(', ');
  setText(preview, '[data-preview-weekday]', dateParts[0] || 'Archive day');
  setText(preview, '[data-preview-date]', dateParts.slice(1).join(', '));
  setText(preview, '.stats-daily-preview__status', '● Live daily archive');
  setText(preview, '.stats-daily-preview__date p', 'Latest completed public-safe Archive record. Movement combines running and treadmill distance while preserving the breakdown.');
  const metrics = preview.querySelector('[data-preview-metrics]');
  if (!(metrics instanceof HTMLElement)) return;
  const items = [
    ['Sleep', format(record.sleep.hours, 1), 'hours'],
    ['Guitar', format(record.hobbies.guitarMinutes), 'minutes'],
    ['Movement', format(record.hobbies.totalDistanceMiles, 1), `miles total · ${format(record.hobbies.runningMiles, 1)} running + ${format(record.hobbies.treadmillMiles, 1)} treadmill`],
    ['Diary', format(record.diary.words), 'words'],
    ['Work', format(record.work.hours, 1), 'hours'],
    ['Audiobooks', format(record.audiobook.minutes), 'minutes'],
    ['Dance', format(record.hobbies.danceMinutes), 'minutes'],
    ['Language', format(record.hobbies.languageMinutes), 'minutes'],
  ];
  metrics.replaceChildren();
  items.forEach(([label, value, note]) => {
    const card = document.createElement('article');
    card.innerHTML = `<span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small>`;
    metrics.append(card);
  });
  const link = preview.querySelector('a');
  if (link instanceof HTMLAnchorElement) link.href = `/day/?date=${record.date}`;
}

const HOBBIES = [
  { key: 'guitar', label: 'Guitar', icon: '🎸', color: '#2563eb', value: (record: DailyRecord) => record.hobbies.guitarMinutes === null ? null : record.hobbies.guitarMinutes / 60 },
  { key: 'audiobook', label: 'Audiobooks', icon: '📚', color: '#7c3aed', value: (record: DailyRecord) => record.audiobook.minutes === null ? null : record.audiobook.minutes / 60 },
  { key: 'dance', label: 'Dance', icon: '💃', color: '#e11d48', value: (record: DailyRecord) => record.hobbies.danceMinutes === null ? null : record.hobbies.danceMinutes / 60 },
  { key: 'running', label: 'Running estimate', icon: '🏃', color: '#059669', value: (record: DailyRecord) => record.hobbies.runningMiles === null ? null : record.hobbies.runningMiles * RUN_MINUTES_PER_MILE / 60 },
  { key: 'treadmill', label: 'Treadmill', icon: '🚶', color: '#ea580c', value: (record: DailyRecord) => record.hobbies.treadmillMinutes === null ? null : record.hobbies.treadmillMinutes / 60 },
  { key: 'language', label: 'Language study', icon: '🌍', color: '#a16207', value: (record: DailyRecord) => record.hobbies.languageMinutes === null ? null : record.hobbies.languageMinutes / 60 },
];

function hobbyMonthly(records: DailyRecord[], year: number, value: (record: DailyRecord) => number | null) {
  const yearRecords = records.filter((record) => Number(record.date.slice(0, 4)) === year);
  return MONTHS.map((_, month) => sum(yearRecords.filter((record) => parseIso(record.date).getMonth() === month).map(value)));
}

function drawHobbyBars(host: HTMLElement, series: Array<{ label: string; color: string; values: number[] }>, year: number) {
  const width = 1000, height = 405;
  const margin = { left: 70, right: 24, top: 28, bottom: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const totals = MONTHS.map((_, month) => sum(series.map((item) => item.values[month] || 0)));
  const scale = niceScale(Math.max(0, ...totals));
  const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Stacked hobby hours in ${year}` });
  appendAxes(chart, scale, margin, width, height);
  const slot = innerWidth / 12;
  const barWidth = slot * .62;
  MONTHS.forEach((month, monthIndex) => {
    let accumulated = 0;
    series.forEach((item) => {
      const value = item.values[monthIndex] || 0;
      if (value <= 0) return;
      const heightValue = value / scale.maximum * innerHeight;
      const rect = svg('rect', { x: margin.left + slot * monthIndex + (slot - barWidth) / 2, y: margin.top + innerHeight - accumulated - heightValue, width: barWidth, height: heightValue, fill: item.color, opacity: .9 });
      bindTooltip(rect, `${month} ${year} · ${item.label}: ${format(value, 1)} hours`);
      chart.append(rect);
      accumulated += heightValue;
    });
    const label = svg('text', { x: margin.left + slot * monthIndex + slot / 2, y: height - 27, 'text-anchor': 'middle', class: 'stats-support-axis' });
    label.textContent = month;
    chart.append(label);
  });
  const yTitle = svg('text', { x: -(margin.top + innerHeight / 2), y: 18, transform: 'rotate(-90)', 'text-anchor': 'middle', class: 'stats-support-axis-title' });
  yTitle.textContent = 'Hours';
  chart.append(yTitle);
  host.replaceChildren(chart);
}

function drawHobbyCurves(host: HTMLElement, series: Array<{ label: string; color: string; values: number[] }>, year: number) {
  const width = 1000, height = 405;
  const margin = { left: 70, right: 24, top: 28, bottom: 58 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const scale = niceScale(Math.max(0, ...series.flatMap((item) => item.values)));
  const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `Hobby-hour curves in ${year}` });
  appendAxes(chart, scale, margin, width, height);
  const x = (month: number) => margin.left + innerWidth * month / 11;
  const y = (value: number) => margin.top + innerHeight - value / scale.maximum * innerHeight;
  series.forEach((item) => {
    const points = item.values.map((value, month) => ({ x: x(month), y: y(value) }));
    chart.append(svg('path', { d: monotonePath(points), fill: 'none', stroke: item.color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    item.values.forEach((value, month) => {
      const circle = svg('circle', { cx: x(month), cy: y(value), r: 4, fill: item.color });
      bindTooltip(circle, `${MONTHS[month]} ${year} · ${item.label}: ${format(value, 1)} hours`);
      chart.append(circle);
    });
  });
  MONTHS.forEach((month, index) => {
    const label = svg('text', { x: x(index), y: height - 27, 'text-anchor': 'middle', class: 'stats-support-axis' });
    label.textContent = month;
    chart.append(label);
  });
  const yTitle = svg('text', { x: -(margin.top + innerHeight / 2), y: 18, transform: 'rotate(-90)', 'text-anchor': 'middle', class: 'stats-support-axis-title' });
  yTitle.textContent = 'Hours';
  chart.append(yTitle);
  host.replaceChildren(chart);
}

function mountHobby(records: DailyRecord[], meta: DailyMeta) {
  const section = document.querySelector('#hobby-time');
  if (!(section instanceof HTMLElement) || section.querySelector('.stats-hobby-runtime')) return;
  const description = section.querySelector('.section-heading > p:last-child');
  if (description) description.textContent = 'Compare six activities on one hour scale. Running uses a 10-minute-per-mile estimate; treadmill uses recorded walking time.';
  const shell = document.createElement('div');
  shell.className = 'stats-hobby-runtime';
  shell.innerHTML = `<div class="stats-support-controls"><label>Year<select data-hobby-year>${meta.availableYears.slice().reverse().map((year) => `<option value="${year}">${year}</option>`).join('')}</select></label><div><span class="control-label">Activities shown</span><div class="stats-support-toggles">${HOBBIES.map((item) => `<label class="stats-support-toggle"><input type="checkbox" value="${item.key}" checked><span style="--metric-color:${item.color}">${item.icon} ${item.label}</span></label>`).join('')}</div></div><div><span class="control-label">Chart</span><div class="stats-support-button-row"><button class="stats-support-button is-active" data-hobby-style="bars">Stacked bars</button><button class="stats-support-button" data-hobby-style="curves">Curved lines</button></div></div></div><div class="stats-support-summary"><article><span>Total selected time</span><strong data-hobby-total>—</strong></article><article><span>Largest share</span><strong data-hobby-largest>—</strong></article><article><span>Source</span><strong>Daily archive</strong></article></div><div class="stats-support-chart" data-hobby-chart></div><div class="stats-support-legend" data-hobby-legend></div><div class="stats-support-shares" data-hobby-shares></div>`;
  section.append(shell);
  const yearSelect = shell.querySelector('[data-hobby-year]') as HTMLSelectElement;
  yearSelect.value = String(Number((meta.dataThrough || '').slice(0, 4)) || meta.availableYears.at(-1));
  let style: 'bars' | 'curves' = 'bars';
  const render = () => {
    const year = Number(yearSelect.value);
    const selected = HOBBIES.filter((item) => (shell.querySelector(`input[value="${item.key}"]`) as HTMLInputElement | null)?.checked);
    const series = selected.map((item) => ({ label: item.label, color: item.color, values: hobbyMonthly(records, year, item.value) }));
    const totals = series.map((item) => ({ label: item.label, color: item.color, total: sum(item.values) })).sort((first, second) => second.total - first.total);
    const total = sum(totals.map((item) => item.total));
    setText(shell, '[data-hobby-total]', `${format(total, 1)} hours in ${year}`);
    setText(shell, '[data-hobby-largest]', totals[0] ? `${totals[0].label} · ${format(total ? totals[0].total / total * 100 : 0, 1)}%` : 'No activities');
    const host = shell.querySelector('[data-hobby-chart]');
    if (host instanceof HTMLElement) style === 'curves' ? drawHobbyCurves(host, series, year) : drawHobbyBars(host, series, year);
    const legend = shell.querySelector('[data-hobby-legend]');
    if (legend) legend.innerHTML = totals.map((item) => `<span><i style="--legend-color:${item.color}"></i>${escapeHtml(item.label)}</span>`).join('');
    const shares = shell.querySelector('[data-hobby-shares]');
    if (shares) shares.innerHTML = totals.map((item) => `<article><span>${escapeHtml(item.label)}</span><strong>${format(item.total, 1)} h · ${format(total ? item.total / total * 100 : 0, 1)}%</strong></article>`).join('');
  };
  yearSelect.addEventListener('change', render);
  shell.querySelectorAll('input').forEach((input) => input.addEventListener('change', render));
  shell.querySelectorAll<HTMLElement>('[data-hobby-style]').forEach((button) => button.addEventListener('click', () => {
    style = button.dataset.hobbyStyle === 'curves' ? 'curves' : 'bars';
    shell.querySelectorAll('[data-hobby-style]').forEach((item) => item.classList.toggle('is-active', item === button));
    render();
  }));
  render();
}

type CorrelationMetric = { key: string; dailyLabel: string; monthlyLabel: string; unit: string; monthlyMode: 'sum' | 'average'; value: (record: DailyRecord) => number | null };
const CORRELATIONS: CorrelationMetric[] = [
  { key: 'sleep', dailyLabel: 'Sleep hours', monthlyLabel: 'Average sleep hours', unit: 'hours', monthlyMode: 'average', value: (record) => record.sleep.hours },
  { key: 'work', dailyLabel: 'Work', monthlyLabel: 'Work', unit: 'hours', monthlyMode: 'sum', value: (record) => record.work.hours },
  { key: 'dance', dailyLabel: 'Dance', monthlyLabel: 'Dance', unit: 'hours', monthlyMode: 'sum', value: (record) => record.hobbies.danceMinutes === null ? null : record.hobbies.danceMinutes / 60 },
  { key: 'guitar', dailyLabel: 'Guitar', monthlyLabel: 'Guitar', unit: 'hours', monthlyMode: 'sum', value: (record) => record.hobbies.guitarMinutes === null ? null : record.hobbies.guitarMinutes / 60 },
  { key: 'audiobook', dailyLabel: 'Audiobooks', monthlyLabel: 'Audiobooks', unit: 'hours', monthlyMode: 'sum', value: (record) => record.audiobook.minutes === null ? null : record.audiobook.minutes / 60 },
  { key: 'running', dailyLabel: 'Running', monthlyLabel: 'Running', unit: 'miles', monthlyMode: 'sum', value: (record) => record.hobbies.runningMiles },
  { key: 'treadmill', dailyLabel: 'Treadmill', monthlyLabel: 'Treadmill', unit: 'miles', monthlyMode: 'sum', value: (record) => record.hobbies.treadmillMiles },
  { key: 'language', dailyLabel: 'Language study', monthlyLabel: 'Language study', unit: 'hours', monthlyMode: 'sum', value: (record) => record.hobbies.languageMinutes === null ? null : record.hobbies.languageMinutes / 60 },
  { key: 'diary', dailyLabel: 'Diary word count', monthlyLabel: 'Average diary words per day', unit: 'words', monthlyMode: 'average', value: (record) => record.diary.words },
];

function pearson(pairs: Array<{ x: number; y: number }>) {
  if (pairs.length < 3) return null;
  const xMean = average(pairs.map((pair) => pair.x));
  const yMean = average(pairs.map((pair) => pair.y));
  if (xMean === null || yMean === null) return null;
  let numerator = 0, xSquares = 0, ySquares = 0;
  pairs.forEach((pair) => {
    const xDifference = pair.x - xMean;
    const yDifference = pair.y - yMean;
    numerator += xDifference * yDifference;
    xSquares += xDifference * xDifference;
    ySquares += yDifference * yDifference;
  });
  const denominator = Math.sqrt(xSquares * ySquares);
  return denominator ? numerator / denominator : null;
}

function relationship(value: number | null) {
  if (value === null) return 'Insufficient data';
  const size = Math.abs(value);
  const strength = size < .2 ? 'Negligible' : size < .4 ? 'Weak' : size < .6 ? 'Moderate' : size < .8 ? 'Strong' : 'Very strong';
  return `${strength} ${size < .05 ? '' : value > 0 ? 'positive' : 'negative'} relationship`.replace(/\s+/g, ' ');
}

function drawScatter(host: HTMLElement, pairs: Array<{ x: number; y: number; label: string }>, xMetric: CorrelationMetric, yMetric: CorrelationMetric, granularity: 'daily' | 'monthly') {
  const width = 900, height = 430;
  const margin = { left: 82, right: 28, top: 28, bottom: 72 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const xScale = niceScale(Math.max(0, ...pairs.map((pair) => pair.x)));
  const yScale = niceScale(Math.max(0, ...pairs.map((pair) => pair.y)));
  const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${xMetric.dailyLabel} compared with ${yMetric.dailyLabel}` });
  appendAxes(chart, yScale, margin, width, height);
  for (let index = 0; index <= xScale.intervals; index += 1) {
    const value = xScale.step * index;
    const x = margin.left + innerWidth * value / xScale.maximum;
    const label = svg('text', { x, y: height - 36, 'text-anchor': 'middle', class: 'stats-support-axis' });
    label.textContent = compact(value);
    chart.append(label);
  }
  pairs.forEach((pair) => {
    const circle = svg('circle', { cx: margin.left + pair.x / xScale.maximum * innerWidth, cy: margin.top + innerHeight - pair.y / yScale.maximum * innerHeight, r: granularity === 'daily' ? 3.1 : 5, fill: '#2563eb', opacity: granularity === 'daily' ? .46 : .78 });
    const xLabel = granularity === 'daily' ? xMetric.dailyLabel : xMetric.monthlyLabel;
    const yLabel = granularity === 'daily' ? yMetric.dailyLabel : yMetric.monthlyLabel;
    bindTooltip(circle, `${pair.label} · ${xLabel}: ${format(pair.x, 2)} ${xMetric.unit} · ${yLabel}: ${format(pair.y, 2)} ${yMetric.unit}`);
    chart.append(circle);
  });
  if (pairs.length >= 2) {
    const xMean = average(pairs.map((pair) => pair.x))!;
    const yMean = average(pairs.map((pair) => pair.y))!;
    const denominator = sum(pairs.map((pair) => (pair.x - xMean) ** 2));
    if (denominator > 0) {
      const slope = sum(pairs.map((pair) => (pair.x - xMean) * (pair.y - yMean))) / denominator;
      const intercept = yMean - slope * xMean;
      const y1 = Math.max(0, Math.min(yScale.maximum, intercept));
      const y2 = Math.max(0, Math.min(yScale.maximum, intercept + slope * xScale.maximum));
      chart.append(svg('line', { x1: margin.left, y1: margin.top + innerHeight - y1 / yScale.maximum * innerHeight, x2: width - margin.right, y2: margin.top + innerHeight - y2 / yScale.maximum * innerHeight, stroke: '#d97706', 'stroke-width': 2 }));
    }
  }
  const xTitle = svg('text', { x: margin.left + innerWidth / 2, y: height - 8, 'text-anchor': 'middle', class: 'stats-support-axis-title' });
  xTitle.textContent = `${granularity === 'daily' ? xMetric.dailyLabel : xMetric.monthlyLabel} (${xMetric.unit})`;
  chart.append(xTitle);
  const yTitle = svg('text', { x: -(margin.top + innerHeight / 2), y: 18, transform: 'rotate(-90)', 'text-anchor': 'middle', class: 'stats-support-axis-title' });
  yTitle.textContent = `${granularity === 'daily' ? yMetric.dailyLabel : yMetric.monthlyLabel} (${yMetric.unit})`;
  chart.append(yTitle);
  host.replaceChildren(chart);
}

function mountCorrelation(records: DailyRecord[], meta: DailyMeta) {
  const section = document.querySelector('#correlations');
  if (!(section instanceof HTMLElement) || section.querySelector('.stats-correlation-runtime')) return;
  const description = section.querySelector('.section-heading > p:last-child');
  if (description) description.textContent = 'Use daily dots for day-to-day relationships or monthly dots for broader patterns. Correlation describes association, not causation.';
  const options = CORRELATIONS.map((item) => `<option value="${item.key}">${item.dailyLabel}</option>`).join('');
  const shell = document.createElement('div');
  shell.className = 'stats-correlation-runtime';
  shell.innerHTML = `<div class="stats-support-controls"><label>Horizontal axis<select data-correlation-x>${options}</select></label><label>Vertical axis<select data-correlation-y>${options}</select></label><label>Granularity<select data-correlation-granularity><option value="daily">Daily dots</option><option value="monthly">Monthly dots</option></select></label><label>Period<select data-correlation-year><option value="all">All paired years</option>${meta.availableYears.slice().reverse().map((year) => `<option value="${year}">${year}</option>`).join('')}</select></label></div><div class="stats-support-summary"><article><span>Pearson correlation</span><strong data-correlation-r>—</strong></article><article><span>Paired observations</span><strong data-correlation-pairs>—</strong></article><article><span>Relationship</span><strong data-correlation-label>—</strong></article></div><div class="stats-support-chart" data-correlation-chart></div><p class="stats-correlation-note" data-correlation-note></p>`;
  section.append(shell);
  const xSelect = shell.querySelector('[data-correlation-x]') as HTMLSelectElement;
  const ySelect = shell.querySelector('[data-correlation-y]') as HTMLSelectElement;
  const granularitySelect = shell.querySelector('[data-correlation-granularity]') as HTMLSelectElement;
  const yearSelect = shell.querySelector('[data-correlation-year]') as HTMLSelectElement;
  xSelect.value = 'sleep';
  ySelect.value = 'work';
  const render = () => {
    if (xSelect.value === ySelect.value) ySelect.value = CORRELATIONS.find((item) => item.key !== xSelect.value)?.key || 'work';
    const xMetric = CORRELATIONS.find((item) => item.key === xSelect.value)!;
    const yMetric = CORRELATIONS.find((item) => item.key === ySelect.value)!;
    const granularity = granularitySelect.value === 'monthly' ? 'monthly' : 'daily';
    Array.from(xSelect.options).forEach((option) => {
      const metric = CORRELATIONS.find((item) => item.key === option.value);
      if (metric) option.textContent = granularity === 'daily' ? metric.dailyLabel : metric.monthlyLabel;
    });
    Array.from(ySelect.options).forEach((option) => {
      const metric = CORRELATIONS.find((item) => item.key === option.value);
      if (metric) option.textContent = granularity === 'daily' ? metric.dailyLabel : metric.monthlyLabel;
    });
    const selected = yearSelect.value === 'all' ? records : records.filter((record) => record.date.startsWith(`${yearSelect.value}-`));
    let pairs: Array<{ x: number; y: number; label: string }>;
    if (granularity === 'daily') {
      pairs = selected.map((record) => ({ x: xMetric.value(record), y: yMetric.value(record), label: record.date }))
        .filter((item): item is { x: number; y: number; label: string } => item.x !== null && item.y !== null);
    } else {
      const xMonthly = monthly(selected, xMetric.value, xMetric.monthlyMode);
      const yMap = new Map(monthly(selected, yMetric.value, yMetric.monthlyMode).map((item) => [item.key, item.value]));
      pairs = xMonthly.map((item) => ({ x: item.value, y: yMap.get(item.key) ?? null, label: item.key }))
        .filter((item): item is { x: number; y: number; label: string } => item.x !== null && item.y !== null);
    }
    const r = pearson(pairs);
    setText(shell, '[data-correlation-r]', r === null ? 'Not available' : format(r, 2));
    setText(shell, '[data-correlation-pairs]', `${pairs.length} ${granularity === 'daily' ? 'days' : 'months'}`);
    setText(shell, '[data-correlation-label]', relationship(r));
    setText(shell, '[data-correlation-note]', pairs.length < 3 ? 'At least three paired observations are required.' : `${granularity === 'daily' ? xMetric.dailyLabel : xMetric.monthlyLabel} and ${granularity === 'daily' ? yMetric.dailyLabel : yMetric.monthlyLabel} share ${pairs.length} paired ${granularity === 'daily' ? 'days' : 'months'}. Zeroes remain real observations; missing values are excluded.`);
    const host = shell.querySelector('[data-correlation-chart]');
    if (host instanceof HTMLElement) drawScatter(host, pairs, xMetric, yMetric, granularity);
  };
  [xSelect, ySelect, granularitySelect, yearSelect].forEach((select) => select.addEventListener('change', render));
  render();
}

function bindArchiveLinks(dashboard: HTMLElement) {
  dashboard.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-open-metric]');
    if (!button) return;
    const map: Record<string, string> = { audiobooks: 'audiobook' };
    const key = map[button.dataset.openMetric || ''] || button.dataset.openMetric;
    if (!key) return;
    const target = document.querySelector<HTMLButtonElement>(`[data-sev2-metric="${key}"]`);
    target?.click();
    document.querySelector('#graphs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

async function init() {
  const dashboard = await waitFor('.stats-dashboard');
  if (!dashboard || dashboard.dataset.statsSupportReady === 'true') return;
  dashboard.dataset.statsSupportReady = 'true';
  bindArchiveLinks(dashboard);
  const preview = mountPreview(dashboard);
  try {
    const meta = await getDailyMeta();
    const archiveStatus = document.getElementById('archive-status');
    if (archiveStatus) archiveStatus.textContent = meta.dataThrough ? 'Daily archive connected' : 'Archive connected';
    const latestDate = meta.latestCompleteDate || meta.dataThrough;
    if (latestDate && preview) {
      const year = Number(latestDate.slice(0, 4));
      prefetchYear(year);
      const yearRecords = await getYear(year);
      const latest = yearRecords.find((record) => record.date === latestDate) || await getDay(latestDate);
      if (latest) updatePreview(preview, latest);
    }
    const load = async () => {
      const records = await getYears(meta.availableYears);
      mountHobby(records, meta);
      mountCorrelation(records, meta);
    };
    if ('requestIdleCallback' in window) {
      (window as Window & { requestIdleCallback: (callback: () => void) => number }).requestIdleCallback(() => void load());
    } else setTimeout(() => void load(), 120);
  } catch (error) {
    console.error('Stats support runtime failed', error);
    const archiveStatus = document.getElementById('archive-status');
    if (archiveStatus) archiveStatus.textContent = 'Archive unavailable';
    if (preview) setText(preview, '.stats-daily-preview__status', 'Archive unavailable');
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else void init();
