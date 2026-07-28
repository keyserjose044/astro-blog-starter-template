import { getDailyMeta, getYears } from '../utils/dailyData';
import type { DailyMeta, DailyRecord } from '../utils/dailyData';

type PursuitKey = 'guitar' | 'dance' | 'running' | 'languages';
type ChartStyle = 'bars' | 'curve';
type MonthState = 'recorded' | 'zero' | 'missing' | 'before' | 'future';
type Config = {
  key: PursuitKey;
  label: string;
  unit: string;
  digits: number;
  start: string;
  color: string;
  value: (record: DailyRecord) => number | null;
};
type MonthPoint = {
  key: string;
  year: number;
  month: number;
  value: number | null;
  state: MonthState;
};
type Analysis = {
  lifetime: number;
  currentYear: number;
  activeDays: number;
  bestDay: { date: string; value: number } | null;
  bestMonth: MonthPoint | null;
  bestYear: { year: number; value: number } | null;
  longestStreak: number;
  currentStreak: number;
  lastActive: string | null;
  recent90: number;
};

const NS = 'http://www.w3.org/2000/svg';
const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CONFIGS: Record<PursuitKey, Config> = {
  guitar: {
    key: 'guitar', label: 'Guitar', unit: 'hours', digits: 1, start: '2023-09-27', color: '#c77a30',
    value: (record) => record.hobbies.guitarMinutes === null ? null : record.hobbies.guitarMinutes / 60,
  },
  dance: {
    key: 'dance', label: 'Dance', unit: 'hours', digits: 1, start: '2026-06-02', color: '#c3428f',
    value: (record) => record.hobbies.danceMinutes === null ? null : record.hobbies.danceMinutes / 60,
  },
  running: {
    key: 'running', label: 'Running', unit: 'miles', digits: 1, start: '2023-09-26', color: '#278a63',
    value: (record) => record.hobbies.runningMiles,
  },
  languages: {
    key: 'languages', label: 'Languages', unit: 'hours', digits: 1, start: '2023-02-08', color: '#405cf5',
    value: (record) => record.hobbies.languageMinutes === null ? null : record.hobbies.languageMinutes / 60,
  },
};

const parseIso = (value: string) => new Date(`${value}T12:00:00`);
const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12);
const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;
const format = (value: number | null, digits = 0) => value === null || !Number.isFinite(value)
  ? '—'
  : new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value);
const compact = (value: number) => new Intl.NumberFormat('en-US', {
  notation: Math.abs(value) >= 1000 ? 'compact' : 'standard',
  maximumFractionDigits: 1,
}).format(value);
const shortDate = (value: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseIso(value));
const sum = (values: Array<number | null>) => values.reduce((total, value) => total + (value ?? 0), 0);
const svg = (tag: string, attrs: Record<string, string | number> = {}) => {
  const node = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value)));
  return node;
};
const setText = (root: ParentNode, selector: string, value: string) => {
  const node = root.querySelector(selector);
  if (node) node.textContent = value;
};

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
  const tooltip = tooltipElement();
  target.classList.add('pursuits-live-mark');
  target.setAttribute('tabindex', '0');
  target.setAttribute('aria-label', text);
  const pointer = (event: Event) => {
    const point = event as PointerEvent;
    tooltip.textContent = text;
    tooltip.hidden = false;
    positionTooltip(tooltip, point.clientX, point.clientY);
  };
  const focus = () => {
    const box = target.getBoundingClientRect();
    tooltip.textContent = text;
    tooltip.hidden = false;
    positionTooltip(tooltip, box.left + box.width / 2, box.top);
  };
  const hide = () => { tooltip.hidden = true; };
  target.addEventListener('pointerenter', pointer);
  target.addEventListener('pointermove', pointer);
  target.addEventListener('pointerleave', hide);
  target.addEventListener('focus', focus);
  target.addEventListener('blur', hide);
}

function niceScale(maximumValue: number) {
  const maximum = Math.max(0, maximumValue);
  const rough = Math.max(Number.EPSILON, maximum / 5);
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalized = rough / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  const step = Math.max(1, nice * magnitude);
  const max = Math.max(step, Math.ceil(maximum / step) * step);
  return { maximum: max, step, intervals: Math.max(1, Math.round(max / step)) };
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

function buildMonthPoints(records: DailyRecord[], config: Config, meta: DailyMeta, period: string) {
  const dataThrough = meta.dataThrough || records.at(-1)?.date || iso(new Date());
  const firstAvailable = meta.availableYears.length ? `${Math.min(...meta.availableYears)}-01-01` : config.start;
  let start = period === 'all' ? (config.start > firstAvailable ? config.start : firstAvailable) : `${period}-01-01`;
  let end = period === 'all' ? dataThrough : `${period}-12-31`;
  if (end < start) [start, end] = [end, start];
  const groups = new Map<string, DailyRecord[]>();
  records.forEach((record) => {
    const key = record.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(record);
  });
  const output: MonthPoint[] = [];
  const cursor = new Date(parseIso(start).getFullYear(), parseIso(start).getMonth(), 1, 12);
  const last = new Date(parseIso(end).getFullYear(), parseIso(end).getMonth(), 1, 12);
  while (cursor <= last) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const key = monthKey(year, month);
    const monthStart = `${key}-01`;
    const monthEnd = iso(new Date(year, month + 1, 0, 12));
    const list = groups.get(key) || [];
    const values = list.map(config.value).filter((value): value is number => value !== null && Number.isFinite(value));
    let state: MonthState;
    if (monthEnd < config.start) state = 'before';
    else if (monthStart > dataThrough) state = 'future';
    else if (!values.length) state = 'missing';
    else if (sum(values) === 0) state = 'zero';
    else state = 'recorded';
    output.push({ key, year, month, value: values.length ? sum(values) : null, state });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return output;
}

function analyze(records: DailyRecord[], config: Config, meta: DailyMeta): Analysis {
  const dataThrough = meta.dataThrough || records.at(-1)?.date || iso(new Date());
  const usable = records.filter((record) => record.date >= config.start && record.date <= dataThrough);
  const values = usable.map((record) => ({ date: record.date, value: config.value(record) }))
    .filter((item): item is { date: string; value: number } => item.value !== null && Number.isFinite(item.value));
  const active = values.filter((item) => item.value > 0);
  const currentYearNumber = Number(dataThrough.slice(0, 4));
  const currentYear = sum(values.filter((item) => item.date.startsWith(`${currentYearNumber}-`)).map((item) => item.value));
  const bestDay = active.reduce<{ date: string; value: number } | null>((winner, item) => !winner || item.value > winner.value ? item : winner, null);
  const months = buildMonthPoints(records, config, meta, 'all').filter((item) => item.value !== null);
  const bestMonth = months.reduce<MonthPoint | null>((winner, item) => !winner || (item.value ?? 0) > (winner.value ?? 0) ? item : winner, null);
  const yearMap = new Map<number, number>();
  values.forEach((item) => {
    const year = Number(item.date.slice(0, 4));
    yearMap.set(year, (yearMap.get(year) || 0) + item.value);
  });
  const bestYear = Array.from(yearMap, ([year, value]) => ({ year, value }))
    .reduce<{ year: number; value: number } | null>((winner, item) => !winner || item.value > winner.value ? item : winner, null);
  const recordMap = new Map(usable.map((record) => [record.date, record]));
  const firstAvailable = meta.availableYears.length ? `${Math.min(...meta.availableYears)}-01-01` : config.start;
  const streakStart = config.start > firstAvailable ? config.start : firstAvailable;
  let longestStreak = 0;
  let run = 0;
  for (let date = parseIso(streakStart); date <= parseIso(dataThrough); date = addDays(date, 1)) {
    const record = recordMap.get(iso(date));
    const value = record ? config.value(record) : null;
    if (value !== null && value > 0) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else run = 0;
  }
  let currentStreak = 0;
  for (let date = parseIso(dataThrough); date >= parseIso(streakStart); date = addDays(date, -1)) {
    const record = recordMap.get(iso(date));
    const value = record ? config.value(record) : null;
    if (value !== null && value > 0) currentStreak += 1;
    else break;
  }
  const recentStart = iso(addDays(parseIso(dataThrough), -89));
  const recent90 = sum(values.filter((item) => item.date >= recentStart).map((item) => item.value));
  return {
    lifetime: sum(values.map((item) => item.value)),
    currentYear,
    activeDays: active.length,
    bestDay,
    bestMonth,
    bestYear,
    longestStreak,
    currentStreak,
    lastActive: active.at(-1)?.date || null,
    recent90,
  };
}

function drawSparkline(host: HTMLElement, points: MonthPoint[], color: string) {
  const recent = points.slice(-12);
  const width = 260;
  const height = 56;
  const valid = recent.map((point) => point.value ?? 0);
  const maximum = Math.max(1, ...valid);
  const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-hidden': 'true' });
  const slot = width / Math.max(1, recent.length);
  recent.forEach((point, index) => {
    const value = point.value ?? 0;
    const barHeight = Math.max(value > 0 ? 2 : 1, value / maximum * (height - 8));
    chart.append(svg('rect', {
      x: index * slot + slot * .18,
      y: height - barHeight,
      width: Math.max(2, slot * .64),
      height: barHeight,
      rx: 2,
      fill: point.state === 'recorded' ? color : point.state === 'zero' ? '#94a3b8' : '#e2e8f0',
      opacity: point.state === 'future' ? .28 : .88,
    }));
  });
  host.replaceChildren(chart);
}

function drawChart(host: HTMLElement, points: MonthPoint[], config: Config, style: ChartStyle) {
  const width = Math.max(920, points.length * 46 + 96);
  const height = 390;
  const margin = { left: 70, right: 24, top: 28, bottom: 70 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const values = points.map((point) => point.value).filter((value): value is number => value !== null);
  const scale = niceScale(Math.max(0, ...values));
  const chart = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': `${config.label} monthly totals` }) as SVGSVGElement;
  for (let index = 0; index <= scale.intervals; index += 1) {
    const value = scale.maximum - scale.step * index;
    const y = margin.top + innerHeight * index / scale.intervals;
    chart.append(svg('line', { x1: margin.left, x2: width - margin.right, y1: y, y2: y, class: 'pursuits-live-grid' }));
    const label = svg('text', { x: margin.left - 10, y: y + 4, 'text-anchor': 'end', class: 'pursuits-live-axis' });
    label.textContent = compact(value);
    chart.append(label);
  }
  const slot = innerWidth / Math.max(1, points.length);
  const x = (index: number) => margin.left + slot * index + slot / 2;
  const y = (value: number) => margin.top + innerHeight - value / scale.maximum * innerHeight;

  points.forEach((point, index) => {
    if (point.state === 'before' || point.state === 'future' || point.state === 'missing') {
      chart.append(svg('rect', {
        x: margin.left + slot * index + slot * .12,
        y: margin.top,
        width: Math.max(2, slot * .76),
        height: innerHeight,
        fill: point.state === 'before' ? '#e2e8f0' : point.state === 'future' ? '#f8fafc' : 'url(#pursuit-missing-pattern)',
        opacity: point.state === 'future' ? .55 : .32,
      }));
    }
  });
  const defs = svg('defs');
  const pattern = svg('pattern', { id: 'pursuit-missing-pattern', width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
  pattern.append(svg('rect', { width: 8, height: 8, fill: '#f8fafc' }));
  pattern.append(svg('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: '#cbd5e1', 'stroke-width': 2 }));
  defs.append(pattern);
  chart.prepend(defs);

  if (style === 'bars') {
    points.forEach((point, index) => {
      if (point.value === null) return;
      const value = point.value;
      const barHeight = value === 0 ? 2 : Math.max(2, innerHeight - (y(value) - margin.top));
      const rect = svg('rect', {
        x: margin.left + slot * index + slot * .18,
        y: margin.top + innerHeight - barHeight,
        width: Math.max(3, slot * .64),
        height: barHeight,
        rx: Math.min(5, slot * .12),
        fill: point.state === 'zero' ? '#94a3b8' : config.color,
        opacity: .9,
      });
      bindTooltip(rect, `${MONTHS[point.month]} ${point.year} · ${format(value, config.digits)} ${config.unit}`);
      chart.append(rect);
    });
  } else {
    const segments: Array<Array<{ x: number; y: number; point: MonthPoint }>> = [];
    let current: Array<{ x: number; y: number; point: MonthPoint }> = [];
    points.forEach((point, index) => {
      if (point.value === null) {
        if (current.length) segments.push(current);
        current = [];
        return;
      }
      current.push({ x: x(index), y: y(point.value), point });
    });
    if (current.length) segments.push(current);
    segments.forEach((segment) => {
      chart.append(svg('path', {
        d: monotonePath(segment),
        fill: 'none', stroke: config.color, 'stroke-width': 3, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }));
      segment.forEach(({ x: cx, y: cy, point }) => {
        const circle = svg('circle', { cx, cy, r: 4.5, fill: point.state === 'zero' ? '#94a3b8' : config.color });
        bindTooltip(circle, `${MONTHS[point.month]} ${point.year} · ${format(point.value, config.digits)} ${config.unit}`);
        chart.append(circle);
      });
    });
  }

  points.forEach((point, index) => {
    const showMonth = points.length <= 14 || point.month === 0 || point.month % 3 === 0;
    if (showMonth) {
      const label = svg('text', { x: x(index), y: height - 35, 'text-anchor': 'middle', class: 'pursuits-live-axis' });
      label.textContent = MONTHS[point.month];
      chart.append(label);
    }
    if (point.month === 0 || index === 0) {
      const year = svg('text', { x: x(index), y: height - 15, 'text-anchor': index === 0 ? 'start' : 'middle', class: 'pursuits-live-axis-title' });
      year.textContent = String(point.year);
      chart.append(year);
      if (index > 0) chart.append(svg('line', { x1: margin.left + slot * index, x2: margin.left + slot * index, y1: margin.top, y2: margin.top + innerHeight, stroke: '#cbd5e1', 'stroke-dasharray': '4 5' }));
    }
  });
  const yTitle = svg('text', { x: -(margin.top + innerHeight / 2), y: 17, transform: 'rotate(-90)', 'text-anchor': 'middle', class: 'pursuits-live-axis-title' });
  yTitle.textContent = config.unit[0].toUpperCase() + config.unit.slice(1);
  chart.append(yTitle);
  host.replaceChildren(chart);
}

function fillOverview(root: HTMLElement, records: DailyRecord[], meta: DailyMeta) {
  (Object.keys(CONFIGS) as PursuitKey[]).forEach((key) => {
    const config = CONFIGS[key];
    const card = root.querySelector<HTMLElement>(`[data-pursuit-summary="${key}"]`);
    if (!card) return;
    const result = analyze(records, config, meta);
    setText(card, '[data-live-lifetime]', format(result.lifetime, config.digits));
    setText(card, '[data-live-year]', `${format(result.currentYear, config.digits)} ${config.unit}`);
    setText(card, '[data-live-active]', format(result.activeDays));
    setText(card, '[data-live-best-month]', result.bestMonth?.value !== null && result.bestMonth ? `${MONTHS[result.bestMonth.month]} ${result.bestMonth.year} · ${format(result.bestMonth.value, config.digits)}` : '—');
    setText(card, '[data-live-last]', result.lastActive ? shortDate(result.lastActive) : 'No active day');
    const spark = card.querySelector<HTMLElement>('[data-live-spark]');
    if (spark) drawSparkline(spark, buildMonthPoints(records, config, meta, 'all'), config.color);
  });
  setText(root, '[data-pursuits-status]', meta.updatedAt
    ? `Daily Archive refreshed ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(meta.updatedAt))}. Running time remains an estimate at 10 minutes per mile when pursuits are compared by hours.`
    : 'Live public-safe daily Archive connected.');
}

function fillDetail(root: HTMLElement, key: PursuitKey, records: DailyRecord[], meta: DailyMeta) {
  const config = CONFIGS[key];
  const result = analyze(records, config, meta);
  const status = root.querySelector<HTMLElement>('.pursuits-live-heading__status');
  if (status) status.dataset.state = 'live';
  setText(root, '[data-pursuit-detail-status]', `Live through ${meta.dataThrough ? shortDate(meta.dataThrough) : 'latest record'}`);
  setText(root, '[data-detail-lifetime]', format(result.lifetime, config.digits));
  setText(root, '[data-detail-year]', format(result.currentYear, config.digits));
  setText(root, '[data-detail-active]', format(result.activeDays));
  setText(root, '[data-detail-best-day]', result.bestDay ? `${format(result.bestDay.value, config.digits)} ${config.unit}` : '—');
  setText(root, '[data-detail-best-day-date]', result.bestDay ? shortDate(result.bestDay.date) : 'No active day');
  setText(root, '[data-detail-best-month]', result.bestMonth?.value !== null && result.bestMonth ? `${format(result.bestMonth.value, config.digits)} ${config.unit}` : '—');
  setText(root, '[data-detail-best-month-date]', result.bestMonth ? `${MONTHS[result.bestMonth.month]} ${result.bestMonth.year}` : 'No measured month');
  setText(root, '[data-detail-streak]', `${result.longestStreak} ${result.longestStreak === 1 ? 'day' : 'days'}`);
  setText(root, '[data-detail-recent]', `Last 90 days: ${format(result.recent90, config.digits)} ${config.unit}`);
  setText(root, '[data-detail-current-streak]', `Current streak: ${result.currentStreak} ${result.currentStreak === 1 ? 'day' : 'days'}`);
  setText(root, '[data-detail-best-year]', result.bestYear ? `Best year: ${result.bestYear.year} · ${format(result.bestYear.value, config.digits)} ${config.unit}` : 'Best year: —');
  setText(root, '[data-detail-source]', `Tracking begins ${shortDate(config.start)}. Recorded zeroes remain separate from missing values; future months stay empty.`);

  const period = root.querySelector<HTMLSelectElement>('[data-pursuit-period]');
  const host = root.querySelector<HTMLElement>('[data-pursuit-chart-host]');
  if (!period || !host) return;
  meta.availableYears.slice().sort((a, b) => b - a).forEach((year) => {
    const option = document.createElement('option');
    option.value = String(year);
    option.textContent = String(year);
    period.append(option);
  });
  let style: ChartStyle = 'bars';
  const render = () => {
    const points = buildMonthPoints(records, config, meta, period.value);
    drawChart(host, points, config, style);
    const measured = points.filter((point) => point.value !== null);
    const total = sum(measured.map((point) => point.value));
    const activeMonths = measured.filter((point) => (point.value ?? 0) > 0).length;
    setText(root, '[data-detail-chart-title]', `${config.label} by month · ${period.value === 'all' ? 'all years' : period.value}`);
    setText(root, '[data-detail-chart-note]', `${format(total, config.digits)} ${config.unit} across ${activeMonths} active ${activeMonths === 1 ? 'month' : 'months'} in this view.`);
  };
  period.addEventListener('change', render);
  root.querySelectorAll<HTMLButtonElement>('[data-pursuit-chart]').forEach((button) => {
    button.addEventListener('click', () => {
      style = button.dataset.pursuitChart === 'curve' ? 'curve' : 'bars';
      root.querySelectorAll('[data-pursuit-chart]').forEach((item) => item.classList.toggle('is-active', item === button));
      render();
    });
  });
  render();
}

function updateArchiveCopy(main: HTMLElement, key: PursuitKey) {
  const archive = main.querySelector<HTMLElement>('.archive-section');
  if (!archive) return;
  setText(archive, '.eyebrow', 'Live archive connection');
  setText(archive, 'h2', 'Driven by the public-safe daily Archive');
  setText(archive, 'p:last-of-type', `The ${CONFIGS[key].label.toLowerCase()} totals, active days, streaks, records, and monthly rhythm above now come from the same normalized daily data used throughout LifeLoggerz.`);
}

async function init() {
  const teleport = document.querySelector<HTMLElement>('[data-pursuits-teleport]');
  if (!teleport || teleport.dataset.ready === 'true') return;
  teleport.dataset.ready = 'true';
  const active = teleport.dataset.active || 'overview';
  const main = document.querySelector<HTMLElement>('main.pursuits-page, main.pursuit-page, main.wrap');
  if (!main) return;
  const target = active === 'overview'
    ? main.querySelector('.hero')
    : main.querySelector('.snapshot') || main.querySelector('.hero');
  target?.insertAdjacentElement('afterend', teleport);
  teleport.hidden = false;
  if (active !== 'overview' && active in CONFIGS) updateArchiveCopy(main, active as PursuitKey);
  try {
    const meta = await getDailyMeta();
    const records = await getYears(meta.availableYears);
    if (active === 'overview') fillOverview(teleport, records, meta);
    else if (active in CONFIGS) fillDetail(teleport, active as PursuitKey, records, meta);
  } catch (error) {
    const status = teleport.querySelector<HTMLElement>('.pursuits-live-heading__status');
    if (status) status.dataset.state = 'error';
    setText(teleport, '[data-pursuit-detail-status]', 'Daily Archive unavailable');
    setText(teleport, '[data-pursuits-status]', error instanceof Error ? error.message : 'The daily Archive could not be loaded.');
    const host = teleport.querySelector<HTMLElement>('[data-pursuit-chart-host]');
    if (host) host.innerHTML = '<p>The monthly practice history is temporarily unavailable.</p>';
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else void init();
