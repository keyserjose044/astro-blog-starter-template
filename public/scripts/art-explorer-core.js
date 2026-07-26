const ASSET_VERSION = '20260726-1620';
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const norm = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
const split = (value) => String(value || '').split(/\s*(?:\/|;|\||\+)\s*|\s*,\s*/).map((item) => item.trim()).filter(Boolean);
const numberOrNull = (value) => value === '' || value == null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);

const parseDateValue = (value) => {
  const cleaned = String(value || '').replace(/(\d)(st|nd|rd|th)\b/gi, '$1').trim();
  const numeric = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const timestamp = Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2]));
    return Number.isNaN(timestamp) ? null : timestamp;
  }
  const timestamp = Date.parse(cleaned);
  return Number.isNaN(timestamp) ? null : timestamp;
};

const compareNullable = (a, b, direction) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === 'asc' ? a - b : b - a;
};

function bootArtExplorer() {
  const grid = $('#art-grid');
  const explorer = $('#art-explorer');
  if (!grid || !explorer) return;

  const cards = $$('.art-card', grid);
  const viewButtons = $$('.art-view-button');
  const controls = {
    search: $('#art-search'), filtersToggle: $('#art-filters-toggle'), filtersPanel: $('#art-filters-panel'), filtersCount: $('#art-filters-count'),
    artist: $('#art-artist-filter'), movement: $('#art-movement-filter'), medium: $('#art-medium-filter'), country: $('#art-country-filter'), year: $('#art-viewed-year-filter'), period: $('#art-period-filter'),
    sort: $('#art-sort'), results: $('#art-results-summary'), clear: $('#art-clear-filters'), empty: $('#art-filter-empty'),
    artistsView: $('#art-artists-view'), timelineView: $('#art-timeline-view'), mapView: $('#art-map-view'),
    artistsMetrics: $('#art-artists-metrics'), artistsContent: $('#art-artists-content'), timelineMetrics: $('#art-timeline-metrics'), timelineContent: $('#art-timeline-content'), timelineHelp: $('#art-timeline-help'),
    mapMetrics: $('#art-map-metrics'), mapStage: $('#art-map-stage'), mapStatus: $('#art-map-status'), mapTooltip: $('#art-map-tooltip'), countryPanel: $('#art-country-panel'), mapNote: $('#art-map-note'),
  };
  const state = {
    activeView: 'gallery', collectionView: 'gallery', selectedMapCountryId: '',
    artistsModule: null, timelineModule: null, mapModule: null, viewerCard: null,
    last: { artwork: null, artist: null, movement: null, country: null, period: null, year: null },
  };
  const filterControls = [controls.artist, controls.movement, controls.medium, controls.country, controls.year, controls.period];
  const haystack = new Map(cards.map((card) => [card, norm([card.dataset.title, card.dataset.artist, card.dataset.country, card.dataset.medium, card.dataset.movement, card.dataset.artworkLabel, card.dataset.noteRaw].join(' '))]));

  cards.forEach((card) => {
    card._countryTokens = split(card.dataset.country).map(norm);
    card._movementTokens = split(card.dataset.movement).map(norm);
    card._mediumTokens = split(card.dataset.medium).map(norm);
  });

  function populate(select, values, sorter = (a, b) => collator.compare(a, b)) {
    if (!select) return;
    const firstLabel = select.options[0]?.textContent || 'All';
    select.innerHTML = '';
    select.add(new Option(firstLabel, ''));
    [...new Set(values.filter(Boolean))].sort(sorter).forEach((value) => select.add(new Option(value, value)));
  }

  populate(controls.artist, cards.map((card) => card.dataset.artist));
  populate(controls.movement, cards.flatMap((card) => split(card.dataset.movement)));
  populate(controls.medium, cards.flatMap((card) => split(card.dataset.medium)));
  populate(controls.country, cards.flatMap((card) => split(card.dataset.country)));
  populate(controls.year, cards.map((card) => card.dataset.viewedYear), (a, b) => Number(b) - Number(a));

  const periods = new Map();
  cards.forEach((card) => {
    const key = card.dataset.artworkPeriod;
    if (key) periods.set(key, { key, label: card.dataset.artworkPeriodLabel || key, order: Number(card.dataset.artworkPeriodOrder || 100000) });
  });
  if (controls.period) {
    controls.period.innerHTML = '<option value="">All periods</option>';
    [...periods.values()].sort((a, b) => a.order - b.order || collator.compare(a.label, b.label)).forEach((period) => controls.period.add(new Option(period.label, period.key)));
  }

  function baseMatch(card) {
    const words = norm(controls.search?.value).split(/\s+/).filter(Boolean);
    if (words.length && !words.every((word) => haystack.get(card).includes(word))) return false;
    if (controls.artist?.value && norm(card.dataset.artist) !== norm(controls.artist.value)) return false;
    if (controls.movement?.value && !card._movementTokens.includes(norm(controls.movement.value))) return false;
    if (controls.medium?.value && !card._mediumTokens.includes(norm(controls.medium.value))) return false;
    if (controls.country?.value && !card._countryTokens.includes(norm(controls.country.value))) return false;
    if (controls.year?.value && card.dataset.viewedYear !== controls.year.value) return false;
    if (controls.period?.value && card.dataset.artworkPeriod !== controls.period.value) return false;
    return true;
  }

  function mapMatch(card) {
    return !state.selectedMapCountryId || String(card.dataset.artCountryIds || '').split(' ').includes(state.selectedMapCountryId);
  }

  const getBaseCards = () => cards.filter(baseMatch);
  const getVisibleCards = () => cards.filter((card) => baseMatch(card) && mapMatch(card));

  function updateResults() {
    const visible = getVisibleCards();
    const visibleSet = new Set(visible);
    cards.forEach((card) => { card.style.display = visibleSet.has(card) ? '' : 'none'; });
    if (controls.results) controls.results.textContent = `Showing ${visible.length.toLocaleString()} of ${cards.length.toLocaleString()} artworks`;
    if (controls.empty) controls.empty.hidden = visible.length !== 0;
    const active = filterControls.filter((control) => control?.value).length + Number(Boolean(state.selectedMapCountryId));
    if (controls.filtersCount) { controls.filtersCount.textContent = String(active); controls.filtersCount.hidden = active === 0; }
    controls.filtersToggle?.classList.toggle('has-active-filters', active > 0);
    if (controls.clear) controls.clear.hidden = !(active || controls.search?.value.trim());
  }

  async function refreshExplorer() {
    if (state.activeView === 'artists' && state.artistsModule) state.artistsModule.renderArtArtists(api);
    if (state.activeView === 'timeline' && state.timelineModule) state.timelineModule.renderArtTimeline(api);
    if (state.activeView === 'map' && state.mapModule) await state.mapModule.renderArtMap(api);
  }

  function applyFilters() { updateResults(); refreshExplorer(); }
  function clearFilters() {
    if (controls.search) controls.search.value = '';
    filterControls.forEach((control) => { if (control) control.value = ''; });
    state.selectedMapCountryId = '';
    applyFilters();
  }

  function sortCards() {
    const mode = controls.sort?.value || 'date-desc';
    [...cards].sort((a, b) => {
      let comparison = 0;
      if (mode.startsWith('date-')) comparison = compareNullable(parseDateValue(a.dataset.dateViewed), parseDateValue(b.dataset.dateViewed), mode.endsWith('asc') ? 'asc' : 'desc');
      else if (mode === 'title-asc') comparison = collator.compare(a.dataset.title || '', b.dataset.title || '');
      else if (mode === 'artist-asc') comparison = collator.compare(a.dataset.artist || '', b.dataset.artist || '');
      else if (mode.startsWith('artwork-')) comparison = compareNullable(numberOrNull(a.dataset.artworkSort), numberOrNull(b.dataset.artworkSort), mode.endsWith('asc') ? 'asc' : 'desc');
      return comparison || Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0);
    }).forEach((card) => grid.append(card));
    refreshExplorer();
  }

  function pressView(view) { viewButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.artView === view))); }
  function setCollectionView(view, persist = true) {
    const next = view === 'list' ? 'list' : 'gallery';
    state.activeView = next; state.collectionView = next;
    explorer.hidden = true; controls.artistsView.hidden = true; controls.timelineView.hidden = true; controls.mapView.hidden = true;
    grid.hidden = false; grid.dataset.artView = next; pressView(next);
    if (persist) {
      try { localStorage.setItem(matchMedia('(max-width:900px)').matches ? 'lifeloggerz-art-mobile-view' : 'lifeloggerz-art-desktop-view', next); } catch (_error) {}
    }
  }

  async function showView(view) {
    if (view === 'gallery' || view === 'list') return setCollectionView(view);
    state.activeView = view; explorer.hidden = false; grid.hidden = true;
    controls.artistsView.hidden = view !== 'artists'; controls.timelineView.hidden = view !== 'timeline'; controls.mapView.hidden = view !== 'map'; pressView(view);
    if (view === 'artists') { state.artistsModule ??= await import(`./art-artists.js?v=${ASSET_VERSION}`); state.artistsModule.renderArtArtists(api); }
    else if (view === 'timeline') { state.timelineModule ??= await import(`./art-timeline.js?v=${ASSET_VERSION}`); state.timelineModule.renderArtTimeline(api); }
    else { state.mapModule ??= await import(`./art-map.js?v=${ASSET_VERSION}`); await state.mapModule.renderArtMap(api); }
    explorer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function restoreView() {
    const mobile = matchMedia('(max-width:900px)').matches;
    let view = mobile ? 'list' : 'gallery';
    try { view = localStorage.getItem(mobile ? 'lifeloggerz-art-mobile-view' : 'lifeloggerz-art-desktop-view') || view; } catch (_error) {}
    setCollectionView(view, false);
  }

  controls.filtersToggle?.addEventListener('click', () => {
    const open = controls.filtersPanel.hidden; controls.filtersPanel.hidden = !open; controls.filtersToggle.setAttribute('aria-expanded', String(open));
  });
  controls.search?.addEventListener('input', applyFilters);
  filterControls.forEach((control) => control?.addEventListener('change', () => { if (control === controls.country) state.selectedMapCountryId = ''; applyFilters(); }));
  controls.sort?.addEventListener('change', sortCards);
  controls.clear?.addEventListener('click', clearFilters);
  viewButtons.forEach((button) => button.addEventListener('click', () => showView(button.dataset.artView)));
  $$('[data-close-explorer]').forEach((button) => button.addEventListener('click', () => setCollectionView(state.collectionView)));

  const infoButton = $('#art-info-toggle');
  const infoPanel = $('#art-info');
  infoButton?.addEventListener('click', () => {
    const open = infoPanel.hidden; infoPanel.hidden = !open; infoButton.setAttribute('aria-expanded', String(open)); infoButton.setAttribute('aria-pressed', String(open));
  });

  const viewer = $('#art-viewer');
  const viewerImage = $('#art-viewer-image');
  const viewerTitle = $('#art-viewer-title');
  const viewerArtist = $('#art-viewer-artist');
  const viewerDetails = $('#art-viewer-details');
  const viewerNote = $('#art-viewer-note');
  const viewerSource = $('#art-viewer-source');
  const viewerCards = () => getVisibleCards().length ? getVisibleCards() : cards;

  function openViewer(card) {
    if (!card || !viewer) return;
    state.viewerCard = card;
    viewerImage.src = card.dataset.cover || card.querySelector('.art-cover')?.src || '';
    viewerImage.alt = card.dataset.title || 'Artwork';
    viewerTitle.textContent = card.dataset.title || 'Untitled';
    viewerArtist.textContent = card.dataset.artist || 'Artist not recorded';
    const details = [['Date', card.dataset.artworkLabel], ['Movement', card.dataset.movement], ['Medium', card.dataset.medium], ['Country / origin', card.dataset.country], ['Viewed', card.dataset.dateViewed], ['Source note', card.dataset.source]].filter(([, value]) => value && value !== 'Unknown');
    viewerDetails.innerHTML = '';
    details.forEach(([label, value]) => {
      const term = document.createElement('dt'); const description = document.createElement('dd');
      term.textContent = label; description.textContent = value; viewerDetails.append(term, description);
    });
    viewerNote.textContent = card.dataset.noteRaw || '';
    viewerSource.href = card.dataset.href || card.href;
    if (!viewer.open) {
      if (typeof viewer.showModal === 'function') viewer.showModal();
      else viewer.setAttribute('open', '');
    }
  }

  function moveViewer(direction) {
    const available = viewerCards();
    const index = Math.max(0, available.indexOf(state.viewerCard));
    openViewer(available[(index + direction + available.length) % available.length]);
  }

  grid.addEventListener('click', (event) => { const card = event.target.closest('.art-card'); if (card) { event.preventDefault(); openViewer(card); } });
  $('#art-viewer-close')?.addEventListener('click', () => viewer.close());
  $('#art-viewer-prev')?.addEventListener('click', () => moveViewer(-1));
  $('#art-viewer-next')?.addEventListener('click', () => moveViewer(1));
  $('#art-viewer-random')?.addEventListener('click', () => {
    const available = viewerCards().filter((card) => card !== state.viewerCard); openViewer(available[Math.floor(Math.random() * available.length)] || state.viewerCard);
  });
  viewer?.addEventListener('click', (event) => { if (event.target === viewer) viewer.close(); });

  const surprise = $('#art-surprise');
  const surpriseTrigger = $('#art-surprise-trigger');
  const surpriseMenu = $('#art-surprise-menu');
  const surpriseToast = $('#art-surprise-toast');
  let toastTimer;
  const randomChoice = (items, previous) => {
    const pool = items.length > 1 ? items.filter((item) => item !== previous) : items;
    return pool[Math.floor(Math.random() * pool.length)] || items[0];
  };
  function say(message) { clearTimeout(toastTimer); surpriseToast.textContent = message; surpriseToast.hidden = false; toastTimer = setTimeout(() => { surpriseToast.hidden = true; }, 3200); }
  function closeSurprise() { surpriseMenu.hidden = true; surpriseTrigger.setAttribute('aria-expanded', 'false'); }

  async function runSurprise(action) {
    const current = getVisibleCards().length ? getVisibleCards() : cards;
    if (action === 'artwork') {
      const choice = randomChoice(current, state.last.artwork);
      if (!choice) return say('No artwork matches the current filters.');
      state.last.artwork = choice; openViewer(choice); return say(`Selected: ${choice.dataset.title}`);
    }
    let values = []; let control;
    if (action === 'artist') { values = [...new Set(current.map((card) => card.dataset.artist).filter(Boolean))]; control = controls.artist; }
    if (action === 'movement') { values = [...new Set(current.flatMap((card) => split(card.dataset.movement)))]; control = controls.movement; }
    if (action === 'country') { values = [...new Set(current.flatMap((card) => split(card.dataset.country)))]; control = controls.country; }
    if (action === 'period') { values = [...new Set(current.map((card) => card.dataset.artworkPeriod).filter((value) => value && value !== 'unknown'))]; control = controls.period; }
    if (action === 'year') { values = [...new Set(current.map((card) => card.dataset.viewedYear).filter(Boolean))]; control = controls.year; }
    const choice = randomChoice(values, state.last[action]);
    if (!choice || !control) return say('Not enough metadata is available for that surprise.');
    state.last[action] = choice; state.selectedMapCountryId = ''; control.value = choice; applyFilters();
    if (action === 'artist') await showView('artists');
    else if (action === 'country') await showView('map');
    else if (action === 'period' || action === 'year') {
      await showView('timeline');
      setTimeout(() => document.querySelector(`[data-timeline-mode="${action === 'year' ? 'viewing' : 'history'}"]`)?.click(), 0);
    } else setCollectionView('gallery');
    say(action === 'year' ? `Revisiting ${choice}` : `Exploring ${control.selectedOptions[0]?.textContent || choice}`);
  }

  surpriseTrigger?.addEventListener('click', () => {
    const open = surpriseMenu.hidden; surpriseMenu.hidden = !open; surpriseTrigger.setAttribute('aria-expanded', String(open)); if (open) $('button', surpriseMenu)?.focus();
  });
  $$('[data-surprise]', surpriseMenu).forEach((button) => button.addEventListener('click', () => { closeSurprise(); surpriseTrigger.focus(); runSurprise(button.dataset.surprise); }));
  document.addEventListener('click', (event) => { if (surprise && !surprise.contains(event.target)) closeSurprise(); });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSurprise();
      if (viewer?.open) return;
      if (['artists', 'timeline', 'map'].includes(state.activeView)) setCollectionView(state.collectionView);
    } else if (event.key === '/' && event.target === document.body) { event.preventDefault(); controls.search?.focus(); }
    else if (viewer?.open && event.key === 'ArrowLeft') moveViewer(-1);
    else if (viewer?.open && event.key === 'ArrowRight') moveViewer(1);
  });

  const api = {
    cards, controls, state, norm, split, getBaseCards, getVisibleCards, applyFilters, updateResults, openViewer,
    setMapCountryId(id) { state.selectedMapCountryId = state.selectedMapCountryId === id ? '' : id; if (id && controls.country) controls.country.value = ''; applyFilters(); },
    setFilter(name, value) { const control = controls[name]; if (control) { state.selectedMapCountryId = ''; control.value = value; applyFilters(); } },
    showView,
  };

  restoreView(); sortCards(); applyFilters();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootArtExplorer, { once: true });
else bootArtExplorer();