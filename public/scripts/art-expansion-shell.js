const EXPANSION_VERSION = '20260801-2302';

const esc = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

function installStyles() {
  if (document.querySelector('link[data-art-expansion-styles]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.artExpansionStyles = 'true';
  link.href = new URL(`../styles/art-expansion.css?v=${EXPANSION_VERSION}`, import.meta.url).href;
  document.head.append(link);
}

function makeViewButton(view, icon, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'art-view-button';
  button.dataset.artView = view;
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`;
  return button;
}

function installButtons() {
  const toggle = document.querySelector('#art-view-toggle');
  if (!toggle || toggle.querySelector('[data-art-view="calendar"]')) return;
  const mapButton = toggle.querySelector('[data-art-view="map"]');
  const calendar = makeViewButton('calendar', '▣', 'Calendar');
  const movements = makeViewButton('movements', '◈', 'Movements');
  if (mapButton) {
    toggle.insertBefore(calendar, mapButton);
    toggle.insertBefore(movements, mapButton);
  } else {
    toggle.append(calendar, movements);
  }
}

function installCalendarView(explorer) {
  if (document.querySelector('#art-calendar-view')) return;
  const view = document.createElement('div');
  view.id = 'art-calendar-view';
  view.className = 'art-explorer-view art-calendar-view';
  view.hidden = true;
  view.innerHTML = `
    <div class="art-explorer-heading">
      <div>
        <p class="art-eyebrow">DailyArt rhythm</p>
        <h2>Art calendar</h2>
        <p>Each date shows the artwork recorded that day. Empty dates remain visible, so the habit reads as a visual calendar rather than another chart.</p>
      </div>
      <button type="button" class="art-explorer-close" data-close-explorer aria-label="Close calendar view">×</button>
    </div>
    <div id="art-calendar-metrics" class="art-metrics"></div>
    <div class="art-calendar-controls">
      <button type="button" data-art-calendar-prev aria-label="Previous month">←</button>
      <label class="art-calendar-picker"><span class="sr-only">Choose month</span><select data-art-calendar-month aria-label="Choose calendar month"></select></label>
      <button type="button" data-art-calendar-next aria-label="Next month">→</button>
      <button type="button" data-art-calendar-latest>Latest</button>
    </div>
    <div class="art-calendar-desktop">
      <div class="art-calendar-weekdays" aria-hidden="true"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div>
      <div id="art-calendar-content" class="art-calendar-grid" role="grid" aria-label="Monthly art viewing calendar"></div>
    </div>
    <div id="art-calendar-agenda" class="art-calendar-agenda"></div>
    <p id="art-calendar-empty" class="art-calendar-empty" hidden>No artworks match the current filters in this month.</p>
  `;
  explorer.append(view);
}

function installMovementsView(explorer) {
  if (document.querySelector('#art-movements-view')) return;
  const view = document.createElement('div');
  view.id = 'art-movements-view';
  view.className = 'art-explorer-view art-movements-view';
  view.hidden = true;
  view.innerHTML = `
    <div class="art-explorer-heading">
      <div>
        <p class="art-eyebrow">Mini-exhibitions</p>
        <h2>Movements in the collection</h2>
        <p>Movements become browsable exhibits: representative works, artists, historical range, places, media, and the complete filtered collection behind each card.</p>
      </div>
      <button type="button" class="art-explorer-close" data-close-explorer aria-label="Close movements view">×</button>
    </div>
    <div id="art-movements-metrics" class="art-metrics"></div>
    <div id="art-movements-content"></div>
  `;
  explorer.append(view);
}

function installTimelineEnhancements() {
  const controls = document.querySelector('.art-timeline-controls');
  const content = document.querySelector('#art-timeline-content');
  if (controls && !document.querySelector('#art-timeline-zoom')) {
    const zoom = document.createElement('div');
    zoom.id = 'art-timeline-zoom';
    zoom.setAttribute('role', 'group');
    zoom.setAttribute('aria-label', 'Timeline zoom');
    const help = document.querySelector('#art-timeline-help');
    controls.insertBefore(zoom, help || null);
  }
  if (content && !document.querySelector('#art-timeline-selection')) {
    const selection = document.createElement('div');
    selection.id = 'art-timeline-selection';
    selection.className = 'art-selection-shelf';
    selection.hidden = true;
    content.insertAdjacentElement('afterend', selection);
  }
}

function installMapSelection() {
  const layout = document.querySelector('.art-map-layout');
  if (!layout || document.querySelector('#art-map-selection')) return;
  const selection = document.createElement('div');
  selection.id = 'art-map-selection';
  selection.className = 'art-selection-shelf';
  selection.hidden = true;
  layout.insertAdjacentElement('afterend', selection);
}

export function installArtExpansionShell() {
  installStyles();
  installButtons();
  const explorer = document.querySelector('#art-explorer');
  if (!explorer) return;
  installCalendarView(explorer);
  installMovementsView(explorer);
  installTimelineEnhancements();
  installMapSelection();
}

export function renderArtSelectionShelf(host, cards, options, api) {
  if (!host) return;
  const collection = Array.from(cards || []);
  if (!collection.length) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }

  const title = options?.title || 'Selected collection';
  const eyebrow = options?.eyebrow || 'Selected collection';
  const subtitle = options?.subtitle || `${collection.length.toLocaleString('en-US')} ${collection.length === 1 ? 'work' : 'works'}`;

  host.hidden = false;
  host.innerHTML = `
    <div class="art-selection-heading">
      <div><p class="art-eyebrow">${esc(eyebrow)}</p><h3>${esc(title)}</h3><p>${esc(subtitle)}</p></div>
      ${options?.clearLabel ? `<button type="button" class="art-selection-clear">${esc(options.clearLabel)}</button>` : ''}
    </div>
    <div class="art-selection-grid">
      ${collection.map((card) => `
        <button type="button" class="art-selection-work" data-art-card-index="${esc(card.dataset.originalIndex)}" title="Open ${esc(card.dataset.title || 'artwork')}">
          <span class="art-selection-image"><img src="${esc(card.dataset.cover || '')}" alt="" loading="lazy" decoding="async"></span>
          <span class="art-selection-copy"><strong>${esc(card.dataset.title || 'Untitled')}</strong><small>${esc(card.dataset.artist || 'Artist not recorded')}</small></span>
        </button>
      `).join('')}
    </div>
  `;

  host.querySelectorAll('[data-art-card-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = api.cards.find((candidate) => candidate.dataset.originalIndex === button.dataset.artCardIndex);
      if (card) api.openViewer(card);
    });
  });
  host.querySelector('.art-selection-clear')?.addEventListener('click', () => options?.onClear?.());
}

export function renderArtMapSelection(api) {
  const host = api.controls.mapSelection;
  if (!host) return;
  if (!api.state.selectedMapCountryId) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }
  const cards = api.getVisibleCards();
  const labels = [...new Set(cards.flatMap((card) => api.split(card.dataset.country)).filter(Boolean))];
  renderArtSelectionShelf(host, cards, {
    eyebrow: 'Selected origin',
    title: labels.length === 1 ? labels[0] : 'Selected country collection',
    subtitle: `${cards.length.toLocaleString('en-US')} ${cards.length === 1 ? 'artwork' : 'artworks'} from the current map selection`,
    clearLabel: 'Clear selection',
    onClear: () => api.setMapCountryId(api.state.selectedMapCountryId),
  }, api);
}
