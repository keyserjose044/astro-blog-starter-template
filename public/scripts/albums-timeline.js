const RELEASE_CUTOFF_YEAR = 1920;
let mode = 'release';
let installed = false;
let lastApi = null;

const fmt = (value) => Number(value || 0).toLocaleString('en-US');
const esc = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}[character]));
const num = (value) => value === '' || value == null
  ? null
  : (Number.isFinite(Number(value)) ? Number(value) : null);

const metric = (label, value, note = '') => `
  <div class="albums-metric">
    <span class="albums-metric-label">${label}</span>
    <strong class="albums-metric-value">${value}</strong>
    ${note ? `<small class="albums-metric-note">${note}</small>` : ''}
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

const hasUsableReleaseDate = (card) => {
  const precision = card.dataset.releasePrecision;
  const sortYear = num(card.dataset.releaseSort);
  return (precision === 'year' || precision === 'decade')
    && sortYear !== null
    && sortYear >= RELEASE_CUTOFF_YEAR;
};

function releaseGroups(cards) {
  const groups = new Map();

  cards.forEach((card) => {
    const key = card.dataset.releasePeriod;
    const label = card.dataset.releasePeriodLabel;
    const order = Number(card.dataset.releasePeriodOrder || 100000);
    if (!key || !label) return;

    if (!groups.has(key)) groups.set(key, { key, label, order, cards: [], sub: new Map() });
    const group = groups.get(key);
    group.cards.push(card);

    const year = num(card.dataset.releaseYear);
    if (year !== null) group.sub.set(year, (group.sub.get(year) || 0) + 1);
  });

  return [...groups.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

function listeningGroups(cards) {
  const groups = new Map();

  cards.forEach((card) => {
    const date = parseDate(card.dataset.dateListened);
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

  if (mode === 'listening') {
    values = Array.from({ length: 12 }, (_, index) => group.sub.get(index) || 0);
  } else {
    values = [...group.sub.values()];
    while (values.length < 6) values.push(0);
  }

  const maximum = Math.max(1, ...values);
  return values.map((value) => `
    <i data-peak="${value === maximum && value > 0}" style="height:${Math.max(8, value / maximum * 100)}%"></i>
  `).join('');
}

function caption(group) {
  if (mode === 'listening') {
    const months = [...group.sub].sort((a, b) => b[1] - a[1]);
    if (!months.length) return 'No dated entries';

    const name = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2020, months[0][0], 1)));
    return `Busiest month: ${name} (${fmt(months[0][1])})`;
  }

  const years = group.cards
    .map((card) => num(card.dataset.releaseYear))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);

  if (!years.length) return group.label;
  return years[0] === years.at(-1) ? `Released ${years[0]}` : `${years[0]}–${years.at(-1)}`;
}

function syncModeButtons() {
  document.querySelectorAll('[data-timeline-mode]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.timelineMode === mode));
  });
}

function install(api) {
  if (installed) return;
  installed = true;
  lastApi = api;
  syncModeButtons();

  document.querySelectorAll('[data-timeline-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      mode = button.dataset.timelineMode === 'listening' ? 'listening' : 'release';
      syncModeButtons();
      renderAlbumTimeline(lastApi);
    });
  });
}

export function renderAlbumTimeline(api) {
  lastApi = api;
  install(api);

  const visibleCards = api.getVisibleCards();
  const cards = mode === 'listening'
    ? visibleCards.filter((card) => parseDate(card.dataset.dateListened))
    : visibleCards.filter(hasUsableReleaseDate);
  const groups = mode === 'listening' ? listeningGroups(cards) : releaseGroups(cards);
  const busiest = [...groups].sort((a, b) => b.cards.length - a.cards.length)[0];

  const releases = cards
    .map((card) => num(card.dataset.releaseSort))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  const dates = cards
    .map((card) => parseDate(card.dataset.dateListened))
    .filter(Boolean)
    .sort((a, b) => a - b);

  const first = mode === 'listening'
    ? (dates[0]?.getUTCFullYear() || '—')
    : (releases[0] || '—');
  const last = mode === 'listening'
    ? (dates.at(-1)?.getUTCFullYear() || '—')
    : (releases.at(-1) || '—');

  api.controls.timelineMetrics.innerHTML = [
    metric(
      mode === 'listening' ? 'Albums with dated listens' : 'Albums with usable release dates',
      fmt(cards.length),
      mode === 'listening' ? 'After active filters' : `Exact years or decades from ${RELEASE_CUTOFF_YEAR} onward`,
    ),
    metric(
      mode === 'listening' ? 'First tracked year' : 'Earliest included release',
      first,
      mode === 'listening' ? 'When it entered the log' : `Nothing before ${RELEASE_CUTOFF_YEAR}`,
    ),
    metric(
      mode === 'listening' ? 'Latest tracked year' : 'Newest included release',
      last,
      mode === 'listening' ? 'Current end of the journey' : 'Based on current metadata',
    ),
    metric('Busiest period', busiest?.label || '—', busiest ? `${fmt(busiest.cards.length)} albums` : 'No dated albums'),
  ].join('');

  api.controls.timelineHelp.textContent = mode === 'listening'
    ? 'Each stop is a listening year. Select one to reveal those albums below and apply the Year listened filter.'
    : `Select a release period to reveal those albums below. Only exact years and decades from ${RELEASE_CUTOFF_YEAR} onward are shown.`;

  if (!groups.length) {
    api.controls.timelineContent.innerHTML = `<div class="albums-timeline-empty">${
      mode === 'listening'
        ? 'No dated listening entries match the current filters.'
        : `No usable release dates from ${RELEASE_CUTOFF_YEAR} onward match the current filters.`
    }</div>`;
    return;
  }

  api.controls.timelineContent.innerHTML = `
    <div class="albums-timeline-viewport">
      <div class="albums-timeline-track">
        ${groups.map((group) => `
          <article class="albums-timeline-stop">
            <button type="button" data-timeline-key="${esc(group.key)}">
              <span class="albums-timeline-period">${esc(group.label)}</span>
              <span class="albums-timeline-count">${fmt(group.cards.length)} ${group.cards.length === 1 ? 'album' : 'albums'}</span>
              <span class="albums-timeline-covers">
                ${group.cards.slice(0, 3).map((card) => `<img src="${esc(card.querySelector('.album-cover')?.src)}" alt="" loading="lazy">`).join('')}
              </span>
              <span class="albums-timeline-bars">${bars(group)}</span>
              <span class="albums-timeline-caption">${esc(caption(group))}</span>
            </button>
          </article>
        `).join('')}
      </div>
    </div>
  `;

  api.controls.timelineContent.querySelectorAll('[data-timeline-key]').forEach((button) => {
    button.addEventListener('click', () => {
      api.setFilter(mode === 'listening' ? 'year' : 'release', button.dataset.timelineKey);
    });
  });
}
