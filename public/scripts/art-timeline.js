let mode = 'history';
let installed = false;
let lastApi = null;

const fmt = (value) => Number(value || 0).toLocaleString('en-US');
const esc = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));
const num = (value) => value === '' || value == null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const formatYear = (year) => year < 0 ? `${Math.abs(year)} BCE` : String(year);

const metric = (label, value, note = '') => `
  <div class="art-metric">
    <span class="art-metric-label">${esc(label)}</span>
    <strong class="art-metric-value">${esc(value)}</strong>
    ${note ? `<small class="art-metric-note">${esc(note)}</small>` : ''}
  </div>
`;

const parseDate = (value) => {
  const cleaned = String(value || '').replace(/(\d)(st|nd|rd|th)\b/gi, '$1').trim();
  const numeric = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const date = new Date(Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? null : date;
};

function historyGroups(cards) {
  const groups = new Map();
  cards.forEach((card) => {
    const key = card.dataset.artworkPeriod;
    const sortYear = num(card.dataset.artworkSort);
    if (!key || key === 'unknown' || sortYear === null) return;
    if (!groups.has(key)) groups.set(key, {
      key,
      label: card.dataset.artworkPeriodLabel || key,
      order: Number(card.dataset.artworkPeriodOrder || 100000),
      cards: [],
      sub: new Map(),
    });
    const group = groups.get(key);
    group.cards.push(card);
    const bucket = sortYear < 1900 ? Math.floor(sortYear / 100) * 100 : Math.floor(sortYear / 10) * 10;
    group.sub.set(bucket, (group.sub.get(bucket) || 0) + 1);
  });
  return [...groups.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

function viewingGroups(cards) {
  const groups = new Map();
  cards.forEach((card) => {
    const date = parseDate(card.dataset.dateViewed);
    if (!date) return;
    const year = date.getUTCFullYear();
    if (!groups.has(year)) groups.set(year, { key: String(year), label: String(year), order: year, cards: [], sub: new Map() });
    const group = groups.get(year);
    group.cards.push(card);
    group.sub.set(date.getUTCMonth(), (group.sub.get(date.getUTCMonth()) || 0) + 1);
  });
  return [...groups.values()].sort((a, b) => a.order - b.order);
}

function bars(group) {
  let values;
  if (mode === 'viewing') values = Array.from({ length: 12 }, (_, index) => group.sub.get(index) || 0);
  else {
    values = [...group.sub.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
    while (values.length < 6) values.push(0);
  }
  const maximum = Math.max(1, ...values);
  return values.map((value) => `<i data-peak="${value === maximum && value > 0}" style="height:${Math.max(8, value / maximum * 100)}%"></i>`).join('');
}

function caption(group) {
  if (mode === 'viewing') {
    const months = [...group.sub.entries()].sort((a, b) => b[1] - a[1]);
    if (!months.length) return 'No dated entries';
    const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2020, months[0][0], 1)));
    return `Busiest month: ${month} (${fmt(months[0][1])})`;
  }
  const years = group.cards.map((card) => num(card.dataset.artworkSort)).filter((value) => value !== null).sort((a, b) => a - b);
  if (!years.length) return group.label;
  return years[0] === years.at(-1) ? `Approx. ${formatYear(years[0])}` : `${formatYear(years[0])}–${formatYear(years.at(-1))}`;
}

function install(api) {
  if (installed) return;
  installed = true;
  lastApi = api;
  document.querySelectorAll('[data-timeline-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.timelineMode;
      document.querySelectorAll('[data-timeline-mode]').forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
      renderArtTimeline(lastApi);
    });
  });
}

export function renderArtTimeline(api) {
  lastApi = api;
  install(api);
  const allCards = api.getVisibleCards();
  const groups = mode === 'viewing' ? viewingGroups(allCards) : historyGroups(allCards);
  const eligibleCards = mode === 'viewing'
    ? allCards.filter((card) => parseDate(card.dataset.dateViewed))
    : allCards.filter((card) => card.dataset.artworkPeriod !== 'unknown' && num(card.dataset.artworkSort) !== null);
  const busiest = [...groups].sort((a, b) => b.cards.length - a.cards.length)[0];
  const historyYears = eligibleCards.map((card) => num(card.dataset.artworkSort)).filter((value) => value !== null).sort((a, b) => a - b);
  const viewingDates = eligibleCards.map((card) => parseDate(card.dataset.dateViewed)).filter(Boolean).sort((a, b) => a - b);
  const first = mode === 'viewing' ? (viewingDates[0]?.getUTCFullYear() || '—') : (historyYears.length ? formatYear(historyYears[0]) : '—');
  const last = mode === 'viewing' ? (viewingDates.at(-1)?.getUTCFullYear() || '—') : (historyYears.length ? formatYear(historyYears.at(-1)) : '—');
  const omitted = Math.max(0, allCards.length - eligibleCards.length);

  api.controls.timelineMetrics.innerHTML = [
    metric('Works in timeline', fmt(eligibleCards.length), mode === 'history' && omitted ? `${fmt(omitted)} undated works omitted` : 'After active filters'),
    metric(mode === 'viewing' ? 'First tracked year' : 'Earliest work', first, mode === 'viewing' ? 'When it entered the diary' : 'Approximate when needed'),
    metric(mode === 'viewing' ? 'Latest tracked year' : 'Newest work', last, mode === 'viewing' ? 'Current end of the journey' : 'Approximate when needed'),
    metric('Busiest period', busiest?.label || '—', busiest ? `${fmt(busiest.cards.length)} works` : 'No dated works'),
  ].join('');

  api.controls.timelineHelp.textContent = mode === 'viewing'
    ? 'Each stop is a viewing year. Select one to apply the Year viewed filter.'
    : 'Each stop is an art-historical period. Century labels, ranges, and circa dates are positioned approximately.';

  if (!groups.length) {
    api.controls.timelineContent.innerHTML = '<div class="art-timeline-empty">No dated artworks match the current filters.</div>';
    return;
  }

  api.controls.timelineContent.innerHTML = `
    <div class="art-timeline-viewport">
      <div class="art-timeline-track">
        ${groups.map((group) => `
          <article class="art-timeline-stop">
            <button type="button" data-timeline-key="${esc(group.key)}">
              <span class="art-timeline-period">${esc(group.label)}</span>
              <span class="art-timeline-count">${fmt(group.cards.length)} ${group.cards.length === 1 ? 'work' : 'works'}</span>
              <span class="art-timeline-covers">${group.cards.slice(0, 3).map((card) => `<img src="${esc(card.dataset.cover || '')}" alt="" loading="lazy">`).join('')}</span>
              <span class="art-timeline-bars">${bars(group)}</span>
              <span class="art-timeline-caption">${esc(caption(group))}</span>
            </button>
          </article>
        `).join('')}
      </div>
    </div>
  `;

  api.controls.timelineContent.querySelectorAll('[data-timeline-key]').forEach((button) => {
    button.addEventListener('click', () => api.setFilter(mode === 'viewing' ? 'year' : 'period', button.dataset.timelineKey));
  });
}