export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const SERIES_LIMIT = 5;

export const normalize = (value) => String(value || '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

export const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

export const formatNumber = (value) => Number(value || 0).toLocaleString('en-US');

export function parseFinishedDate(value) {
  const raw = String(value || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const date = new Date(Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function visibleCards(cards, includeMapSelection = true) {
  return cards.filter((card) => card.style.display !== 'none'
    && (!includeMapSelection || !card.classList.contains('atlas-country-hidden')));
}

export function cardGenre(card) {
  if (String(card.dataset.genre || '').trim()) return card.dataset.genre.trim();
  return String(card.dataset.noteRaw || '').split('·').map((part) => part.trim())[4] || 'Unknown genre';
}

export function cardLanguage(card) {
  const raw = String(card.dataset.language || '').trim();
  if (!raw) return 'Unknown language';
  const key = normalize(raw);
  if (/\b(english|ingles|en)\b/.test(key)) return 'English';
  if (/\b(spanish|espanol|castilian|castellano|es)\b/.test(key)) return 'Spanish';
  return raw;
}

export const cardCountry = (card) => String(card.dataset.country || '').trim() || 'Unknown country';

export function publicationEra(card) {
  const year = card.dataset.publicationYear === '' ? null : Number(card.dataset.publicationYear);
  if (!Number.isFinite(year)) return { key: 'unknown', label: 'Unknown', order: 100000, year: null };
  if (year < 500) return { key: 'ancient', label: 'Ancient', order: -10000, year };
  if (year <= 1400) return { key: 'medieval', label: 'Medieval', order: 500, year };
  const century = Math.ceil(year / 100);
  const suffix = century % 100 >= 11 && century % 100 <= 13 ? 'th'
    : century % 10 === 1 ? 'st' : century % 10 === 2 ? 'nd' : century % 10 === 3 ? 'rd' : 'th';
  return { key: `century-${century}`, label: `${century}${suffix} c.`, order: century * 100, year };
}

export function categoryFor(card, breakdown) {
  if (breakdown === 'country') return cardCountry(card);
  if (breakdown === 'era') return publicationEra(card).label;
  if (breakdown === 'language') return cardLanguage(card);
  if (breakdown === 'total') return 'Books';
  return cardGenre(card);
}

export function topSeries(cards, breakdown) {
  if (breakdown === 'total') return ['Books'];
  const counts = new Map();
  cards.forEach((card) => {
    const key = categoryFor(card, breakdown);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label]) => label);
  return sorted.length > SERIES_LIMIT ? [...sorted.slice(0, SERIES_LIMIT), 'Other'] : sorted;
}

export const seriesClass = (index) => `books-insight-series-${Math.min(index, 5)}`;

export function legendMarkup(series) {
  return `<div class="books-insight-legend" aria-label="Chart legend">${series.map((label, index) =>
    `<span><i class="${seriesClass(index)}"></i>${escapeHtml(label)}</span>`).join('')}</div>`;
}

export function stackMarkup(cards, series, breakdown) {
  const counts = new Map(series.map((label) => [label, 0]));
  cards.forEach((card) => {
    const raw = categoryFor(card, breakdown);
    const key = series.includes(raw) ? raw : 'Other';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  const total = Math.max(cards.length, 1);
  return series.map((label, index) => {
    const count = counts.get(label) || 0;
    return count ? `<span class="books-insight-stack-segment ${seriesClass(index)}" style="height:${(count / total) * 100}%" title="${escapeHtml(label)}: ${formatNumber(count)}"></span>` : '';
  }).join('');
}

export function groupReadingYears(cards) {
  const groups = new Map();
  cards.forEach((card) => {
    const date = parseFinishedDate(card.dataset.dateFinished);
    if (!date) return;
    const year = date.getUTCFullYear();
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(card);
  });
  return [...groups].sort((a, b) => a[0] - b[0])
    .map(([year, items]) => ({ key: String(year), label: String(year), cards: items }));
}

export function groupPublication(cards) {
  const groups = new Map();
  cards.forEach((card) => {
    const era = publicationEra(card);
    if (!groups.has(era.key)) groups.set(era.key, { ...era, cards: [] });
    groups.get(era.key).cards.push(card);
  });
  return [...groups.values()].sort((a, b) => a.order - b.order);
}

export function chartMarkup(groups, series, breakdown, mode) {
  const maximum = Math.max(1, ...groups.map((group) => group.cards.length));
  return groups.map((group) => `<button type="button" class="books-insight-chart-column" data-insight-${mode}-key="${escapeHtml(group.key)}" aria-label="Filter to ${escapeHtml(group.label)}">
    <span class="books-insight-chart-value">${formatNumber(group.cards.length)}</span>
    <span class="books-insight-chart-bar" style="height:${Math.max(9, (group.cards.length / maximum) * 100)}%">${stackMarkup(group.cards, series, breakdown)}</span>
    <span class="books-insight-chart-label">${escapeHtml(group.label)}</span>
  </button>`).join('');
}

export function toggleSelect(select, value) {
  if (!select) return;
  select.value = select.value === value ? '' : value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

export const distinctCount = (cards, getter) => new Set(cards.map(getter)
  .filter((value) => value && !String(value).startsWith('Unknown'))).size;
