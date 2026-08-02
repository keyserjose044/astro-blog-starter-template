let mode = 'history';
let zoom = 'coarse';
let installed = false;
let lastApi = null;
let selection = null;

const fmt = (value) => Number(value || 0).toLocaleString('en-US');
const esc = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));
const num = (value) => value === '' || value == null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const formatYear = (year) => year < 0 ? `${Math.abs(year)} BCE` : String(year);
const ordinal = (value) => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
};

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

function centuryInfo(year) {
  if (year < 0) {
    const century = Math.max(1, Math.ceil(Math.abs(year) / 100));
    return { key: `bce-${century}`, label: `${ordinal(century)} century BCE`, order: -century * 100 };
  }
  const adjusted = Math.max(1, year);
  const century = Math.floor((adjusted - 1) / 100) + 1;
  return { key: `ce-${century}`, label: `${ordinal(century)} century`, order: (century - 1) * 100 };
}

function historyGroups(cards) {
  const groups = new Map();
  cards.forEach((card) => {
    const sortYear = num(card.dataset.artworkSort);
    if (sortYear === null) return;
    const base = zoom === 'fine'
      ? centuryInfo(sortYear)
      : {
        key: card.dataset.artworkPeriod,
        label: card.dataset.artworkPeriodLabel || card.dataset.artworkPeriod,
        order: Number(card.dataset.artworkPeriodOrder || 100000),
      };
    if (!base.key || base.key === 'unknown') return;
    if (!groups.has(base.key)) groups.set(base.key, { ...base, cards: [], sub: new Map() });
    const group = groups.get(base.key);
    group.cards.push(card);
    const bucket = zoom === 'fine'
      ? Math.floor(sortYear / 10) * 10
      : (sortYear < 1900 ? Math.floor(sortYear / 100) * 100 : Math.floor(sortYear / 10) * 10);
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
    const month = date.getUTCMonth();
    const base = zoom === 'fine'
      ? {
        key: `${year}-${String(month + 1).padStart(2, '0')}`,
        label: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date),
        order: Date.UTC(year, month, 1),
      }
      : { key: String(year), label: String(year), order: year };
    if (!groups.has(base.key)) groups.set(base.key, { ...base, cards: [], sub: new Map() });
    const group = groups.get(base.key);
    group.cards.push(card);
    const bucket = zoom === 'fine' ? Math.ceil(date.getUTCDate() / 7) : month;
    group.sub.set(bucket, (group.sub.get(bucket) || 0) + 1);
  });
  return [...groups.values()].sort((a, b) => a.order - b.order);
}

function bars(group) {
  let values;
  if (mode === 'viewing' && zoom === 'coarse') {
    values = Array.from({ length: 12 }, (_, index) => group.sub.get(index) || 0);
  } else if (mode === 'viewing') {
    values = Array.from({ length: 5 }, (_, index) => group.sub.get(index + 1) || 0);
  } else {
    values = [...group.sub.entries()].sort((a, b) => a[0] - b[0]).map((entry) => entry[1]);
    while (values.length < 6) values.push(0);
  }
  const maximum = Math.max(1, ...values);
  return values.map((value) => `<i data-peak="${value === maximum && value > 0}" style="height:${Math.max(8, value / maximum * 100)}%"></i>`).join('');
}

function caption(group) {
  if (mode === 'viewing' && zoom === 'coarse') {
    const months = [...group.sub.entries()].sort((a, b) => b[1] - a[1]);
    if (!months.length) return 'No dated entries';
    const month = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2020, months[0][0], 1)));
    return `Busiest month: ${month} (${fmt(months[0][1])})`;
  }
  if (mode === 'viewing') {
    const activeDays = new Set(group.cards.map((card) => parseDate(card.dataset.dateViewed)?.getUTCDate()).filter(Boolean));
    return `${fmt(activeDays.size)} active ${activeDays.size === 1 ? 'day' : 'days'}`;
  }
  const years = group.cards.map((card) => num(card.dataset.artworkSort)).filter((value) => value !== null).sort((a, b) => a - b);
  if (!years.length) return group.label;
  return years[0] === years.at(-1) ? `Approx. ${formatYear(years[0])}` : `${formatYear(years[0])}–${formatYear(years.at(-1))}`;
}

function resetSelection() {
  selection = null;
  const host = lastApi?.controls.timelineSelection;
  if (host) {
    host.hidden = true;
    host.replaceChildren();
  }
}

function renderZoomControls(api) {
  const host = api.controls.timelineZoom;
  if (!host) return;
  const labels = mode === 'viewing'
    ? [['coarse', 'Years'], ['fine', 'Months']]
    : [['coarse', 'Periods'], ['fine', 'Centuries']];
  host.innerHTML = labels.map(([key, label]) => `<button type="button" data-timeline-zoom="${key}" aria-pressed="${zoom === key}">${label}</button>`).join('');
  host.querySelectorAll('[data-timeline-zoom]').forEach((button) => button.addEventListener('click', () => {
    const next = button.dataset.timelineZoom;
    if (next === zoom) return;
    zoom = next;
    resetSelection();
    renderArtTimeline(api);
  }));
}

function install(api) {
  if (installed) return;
  installed = true;
  lastApi = api;
  document.querySelectorAll('[data-timeline-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.dataset.timelineMode;
      if (next !== mode) {
        mode = next;
        zoom = 'coarse';
        resetSelection();
      }
      document.querySelectorAll('[data-timeline-mode]').forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
      renderArtTimeline(lastApi);
    });
  });
}

function renderSelection(api, groups) {
  const host = api.controls.timelineSelection;
  if (!host) return;
  const group = selection && selection.mode === mode && selection.zoom === zoom
    ? groups.find((candidate) => candidate.key === selection.key)
    : null;
  if (!group) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }
  api.renderSelectionShelf(host, group.cards, {
    eyebrow: mode === 'viewing' ? 'Selected viewing window' : 'Selected art-history window',
    title: group.label,
    subtitle: `${fmt(group.cards.length)} ${group.cards.length === 1 ? 'artwork' : 'artworks'} · click any work to open the artwork viewer`,
    clearLabel: 'Clear selection',
    onClear: () => {
      selection = null;
      renderArtTimeline(api);
    },
  });
}

export function renderArtTimeline(api) {
  lastApi = api;
  install(api);
  renderZoomControls(api);

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
    metric(zoom === 'fine' ? (mode === 'viewing' ? 'Busiest month' : 'Busiest century') : 'Busiest period', busiest?.label || '—', busiest ? `${fmt(busiest.cards.length)} works` : 'No dated works'),
  ].join('');

  api.controls.timelineHelp.textContent = mode === 'viewing'
    ? (zoom === 'fine' ? 'Zoomed to months. Select a month to reveal its artwork collection below.' : 'Each stop is a viewing year. Select a year to reveal its collection, or zoom to months.')
    : (zoom === 'fine' ? 'Zoomed to centuries. Select a century to reveal its works below.' : 'Each stop is an art-historical period. Select one for its collection, or zoom to centuries.');

  if (!groups.length) {
    api.controls.timelineContent.innerHTML = '<div class="art-timeline-empty">No dated artworks match the current filters.</div>';
    renderSelection(api, groups);
    return;
  }

  api.controls.timelineContent.innerHTML = `
    <div class="art-timeline-viewport">
      <div class="art-timeline-track">
        ${groups.map((group) => `
          <article class="art-timeline-stop">
            <button type="button" data-timeline-key="${esc(group.key)}" aria-pressed="${selection?.mode === mode && selection?.zoom === zoom && selection?.key === group.key}">
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
    button.addEventListener('click', () => {
      const next = { mode, zoom, key: button.dataset.timelineKey };
      selection = selection?.mode === next.mode && selection?.zoom === next.zoom && selection?.key === next.key ? null : next;
      renderArtTimeline(api);
    });
  });
  renderSelection(api, groups);
}
