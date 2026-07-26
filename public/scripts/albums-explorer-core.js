const RELEASE_CUTOFF_YEAR = 1920;
const ASSET_VERSION = '20260726-1535';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const norm = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');
const split = (value) => String(value || '')
  .split(/\s*(?:\/|;|\||\+)\s*|\s*,\s*/)
  .map((item) => item.trim())
  .filter(Boolean);
const dateValue = (value) => {
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
const num = (value) => value === '' || value == null
  ? null
  : (Number.isFinite(Number(value)) ? Number(value) : null);
const nullable = (a, b, direction) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return direction === 'asc' ? a - b : b - a;
};
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function hasUsableReleaseDate(card) {
  const precision = card.dataset.releasePrecision;
  const order = Number(card.dataset.releasePeriodOrder || 100000);
  return (precision === 'year' || precision === 'decade') && order >= RELEASE_CUTOFF_YEAR;
}

function boot() {
  const grid = $('#albums-grid');
  const explorer = $('#albums-explorer');
  if (!grid || !explorer) return;

  const cards = $$('.album-card', grid);
  const buttons = $$('.albums-view-button');
  const controls = {
    search: $('#album-search'),
    filtersToggle: $('#album-filters-toggle'),
    filtersPanel: $('#album-filters-panel'),
    filtersCount: $('#album-filters-count'),
    style: $('#album-style-filter'),
    subgenre: $('#album-subgenre-filter'),
    mood: $('#album-mood-filter'),
    country: $('#album-country-filter'),
    year: $('#album-listened-year-filter'),
    release: $('#album-release-filter'),
    sort: $('#album-sort'),
    results: $('#albums-results-summary'),
    clear: $('#albums-clear-filters'),
    empty: $('#albums-filter-empty'),
    mapView: $('#albums-map-view'),
    timelineView: $('#albums-timeline-view'),
    mapMetrics: $('#albums-map-metrics'),
    timelineMetrics: $('#albums-timeline-metrics'),
    mapStage: $('#albums-map-stage'),
    mapStatus: $('#albums-map-status'),
    mapTooltip: $('#albums-map-tooltip'),
    countryPanel: $('#albums-country-panel'),
    mapNote: $('#albums-map-note'),
    timelineContent: $('#albums-timeline-content'),
    timelineHelp: $('#albums-timeline-help'),
  };
  const state = {
    activeView: 'list',
    selectedMapCountryId: '',
    mapModule: null,
    timelineModule: null,
    last: { album: null, country: null, style: null, release: null, year: null },
  };

  const haystack = new Map(cards.map((card) => [
    card,
    norm([
      card.dataset.title,
      card.dataset.artist,
      card.dataset.country,
      card.dataset.style,
      card.dataset.subgenre,
      card.dataset.mood,
      card.dataset.noteRaw,
    ].join(' ')),
  ]));

  cards.forEach((card) => {
    card._countryTokens = split(card.dataset.country).map(norm);
    card._subgenreTokens = split(card.dataset.subgenre).map(norm);
    card._moodTokens = split(card.dataset.mood).map(norm);
  });

  function populate(select, values, sorter = (a, b) => collator.compare(a, b)) {
    if (!select) return;
    const first = select.options[0]?.textContent || 'All';
    select.innerHTML = '';
    select.add(new Option(first, ''));
    [...new Set(values.filter(Boolean))]
      .sort(sorter)
      .forEach((value) => select.add(new Option(value, value)));
  }

  populate(controls.style, cards.map((card) => card.dataset.style));
  populate(controls.subgenre, cards.flatMap((card) => split(card.dataset.subgenre)));
  populate(controls.mood, cards.flatMap((card) => split(card.dataset.mood)));
  populate(controls.country, cards.flatMap((card) => split(card.dataset.country)));
  populate(controls.year, cards.map((card) => card.dataset.listenedYear), (a, b) => Number(b) - Number(a));

  const periods = new Map();
  cards.filter(hasUsableReleaseDate).forEach((card) => {
    periods.set(card.dataset.releasePeriod, {
      key: card.dataset.releasePeriod,
      label: card.dataset.releasePeriodLabel,
      order: Number(card.dataset.releasePeriodOrder || 100000),
    });
  });

  if (controls.release) {
    controls.release.innerHTML = '<option value="">All reliable release periods</option>';
    [...periods.values()]
      .filter((period) => period.key)
      .sort((a, b) => a.order - b.order || collator.compare(a.label, b.label))
      .forEach((period) => controls.release.add(new Option(period.label, period.key)));
  }

  function baseMatch(card) {
    const words = norm(controls.search?.value).split(/\s+/).filter(Boolean);
    if (words.length && !words.every((word) => haystack.get(card).includes(word))) return false;
    if (controls.style?.value && norm(card.dataset.style) !== norm(controls.style.value)) return false;
    if (controls.subgenre?.value && !card._subgenreTokens.includes(norm(controls.subgenre.value))) return false;
    if (controls.mood?.value && !card._moodTokens.includes(norm(controls.mood.value))) return false;
    if (controls.country?.value && !card._countryTokens.includes(norm(controls.country.value))) return false;
    if (controls.year?.value && card.dataset.listenedYear !== controls.year.value) return false;
    if (controls.release?.value && card.dataset.releasePeriod !== controls.release.value) return false;
    return true;
  }

  function mapMatch(card) {
    return !state.selectedMapCountryId
      || String(card.dataset.albumCountryIds || '').split(' ').includes(state.selectedMapCountryId);
  }

  const getBaseCards = () => cards.filter(baseMatch);
  const getVisibleCards = () => cards.filter((card) => baseMatch(card) && mapMatch(card));
  const activeCount = () => [
    controls.style,
    controls.subgenre,
    controls.mood,
    controls.country,
    controls.year,
    controls.release,
  ].filter((control) => control?.value).length + Number(Boolean(state.selectedMapCountryId));

  function updateResults() {
    const visible = getVisibleCards();
    cards.forEach((card) => {
      card.style.display = visible.includes(card) ? '' : 'none';
    });

    if (controls.results) {
      controls.results.textContent = `Showing ${visible.length.toLocaleString()} of ${cards.length.toLocaleString()} albums`;
    }
    if (controls.empty) controls.empty.hidden = visible.length !== 0;

    const count = activeCount();
    if (controls.filtersCount) {
      controls.filtersCount.textContent = String(count);
      controls.filtersCount.hidden = count === 0;
    }
    controls.filtersToggle?.classList.toggle('has-active-filters', count > 0);
    if (controls.clear) controls.clear.hidden = !(count || controls.search?.value.trim());
  }

  async function refreshExplorer() {
    if (state.activeView === 'map' && state.mapModule) await state.mapModule.renderAlbumMap(api);
    if (state.activeView === 'timeline' && state.timelineModule) state.timelineModule.renderAlbumTimeline(api);
  }

  function applyFilters() {
    updateResults();
    refreshExplorer();
  }

  function clearFilters() {
    if (controls.search) controls.search.value = '';
    [controls.style, controls.subgenre, controls.mood, controls.country, controls.year, controls.release]
      .forEach((control) => {
        if (control) control.value = '';
      });
    state.selectedMapCountryId = '';
    applyFilters();
  }

  function sortCards() {
    const sortMode = controls.sort?.value || 'date-desc';
    const ordered = [...cards].sort((a, b) => {
      let comparison = 0;

      if (sortMode.startsWith('date-')) {
        comparison = nullable(
          dateValue(a.dataset.dateListened),
          dateValue(b.dataset.dateListened),
          sortMode.endsWith('asc') ? 'asc' : 'desc',
        );
      } else if (sortMode === 'title-asc') {
        comparison = collator.compare(a.dataset.title || '', b.dataset.title || '');
      } else if (sortMode === 'artist-asc') {
        comparison = collator.compare(a.dataset.artist || '', b.dataset.artist || '');
      } else if (sortMode.startsWith('release-')) {
        comparison = nullable(
          num(a.dataset.releaseSort),
          num(b.dataset.releaseSort),
          sortMode.endsWith('asc') ? 'asc' : 'desc',
        );
      } else if (sortMode.startsWith('length-')) {
        comparison = nullable(
          num(a.dataset.lengthMinutes),
          num(b.dataset.lengthMinutes),
          sortMode.endsWith('asc') ? 'asc' : 'desc',
        );
      }

      return comparison || Number(a.dataset.originalIndex) - Number(b.dataset.originalIndex);
    });

    ordered.forEach((card) => grid.append(card));
  }

  function press(view) {
    buttons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.albumView === view));
    });
  }

  function setCollectionView(view, persist = true) {
    state.activeView = view;
    explorer.hidden = true;
    controls.mapView.hidden = true;
    controls.timelineView.hidden = true;
    grid.hidden = false;
    grid.dataset.albumView = view;
    press(view);
    cards.forEach((card) => card.classList.remove('show-note'));

    if (persist) {
      try {
        const key = matchMedia('(max-width:900px)').matches
          ? 'lifeloggerz-albums-mobile-view'
          : 'lifeloggerz-albums-desktop-view';
        localStorage.setItem(key, view);
      } catch (_error) {
        // The view still works for this visit when storage is unavailable.
      }
    }
  }

  async function showView(view) {
    if (view === 'list' || view === 'quilt') {
      setCollectionView(view);
      return;
    }

    state.activeView = view;
    explorer.hidden = false;
    grid.hidden = true;
    controls.mapView.hidden = view !== 'map';
    controls.timelineView.hidden = view !== 'timeline';
    press(view);

    if (view === 'map') {
      state.mapModule ??= await import(`./albums-map.js?v=${ASSET_VERSION}`);
      await state.mapModule.renderAlbumMap(api);
    } else {
      state.timelineModule ??= await import(`./albums-timeline.js?v=${ASSET_VERSION}`);
      state.timelineModule.renderAlbumTimeline(api);
    }

    explorer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function restore() {
    const mobile = matchMedia('(max-width:900px)').matches;
    const key = mobile ? 'lifeloggerz-albums-mobile-view' : 'lifeloggerz-albums-desktop-view';
    let view = mobile ? 'list' : 'quilt';

    try {
      view = localStorage.getItem(key) || view;
    } catch (_error) {
      // Use the responsive default.
    }

    setCollectionView(view, false);
  }

  controls.filtersToggle?.addEventListener('click', () => {
    const open = controls.filtersPanel.hidden;
    controls.filtersPanel.hidden = !open;
    controls.filtersToggle.setAttribute('aria-expanded', String(open));
  });
  controls.search?.addEventListener('input', applyFilters);
  [controls.style, controls.subgenre, controls.mood, controls.country, controls.year, controls.release]
    .forEach((control) => control?.addEventListener('change', () => {
      if (control === controls.country) state.selectedMapCountryId = '';
      applyFilters();
    }));
  controls.sort?.addEventListener('change', sortCards);
  controls.clear?.addEventListener('click', clearFilters);
  buttons.forEach((button) => button.addEventListener('click', () => showView(button.dataset.albumView)));
  $$('[data-close-explorer]').forEach((button) => button.addEventListener('click', () => {
    setCollectionView(grid.dataset.albumView === 'list' ? 'list' : 'quilt');
  }));

  const surprise = $('#albums-surprise');
  const trigger = $('#albums-surprise-trigger');
  const menu = $('#albums-surprise-menu');
  const toast = $('#albums-surprise-toast');
  let toastTimer;

  const random = (items, previous) => {
    const pool = items.length > 1 ? items.filter((item) => item !== previous) : items;
    return pool[Math.floor(Math.random() * pool.length)] || items[0];
  };
  const say = (text) => {
    clearTimeout(toastTimer);
    toast.textContent = text;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3000);
  };
  const closeMenu = () => {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  async function surpriseRun(action) {
    const current = getVisibleCards().length ? getVisibleCards() : cards;

    if (action === 'album') {
      const card = random(current, state.last.album);
      if (!card) return say('No albums match the current filters.');
      state.last.album = card;
      window.open(card.href, '_blank', 'noopener,noreferrer');
      return say(`Opening: ${card.dataset.title}`);
    }

    const field = action === 'country'
      ? 'country'
      : action === 'style'
        ? 'style'
        : action === 'release'
          ? 'release'
          : 'year';
    const control = controls[field];
    let values;

    if (action === 'country') {
      values = [...new Set(current.flatMap((card) => split(card.dataset.country)))];
    } else if (action === 'style') {
      values = [...new Set(current.map((card) => card.dataset.style).filter(Boolean))];
    } else if (action === 'release') {
      values = [...new Set(
        current.filter(hasUsableReleaseDate).map((card) => card.dataset.releasePeriod).filter(Boolean),
      )];
    } else {
      values = [...new Set(current.map((card) => card.dataset.listenedYear).filter(Boolean))];
    }

    const choice = random(values, state.last[action]);
    if (!choice || !control) return say('Not enough reliable metadata is available for that surprise.');

    state.last[action] = choice;
    state.selectedMapCountryId = '';
    control.value = choice;
    applyFilters();

    if (action === 'country') {
      await showView('map');
    } else if (action === 'release' || action === 'year') {
      await showView('timeline');
      setTimeout(() => {
        document.querySelector(`[data-timeline-mode="${action === 'year' ? 'listening' : 'release'}"]`)?.click();
      }, 0);
    }

    say(
      action === 'country' || action === 'style'
        ? `Exploring ${choice}`
        : action === 'year'
          ? `Revisiting ${choice}`
          : `Opening ${control.selectedOptions[0]?.textContent || choice}`,
    );
  }

  trigger?.addEventListener('click', () => {
    const open = menu.hidden;
    menu.hidden = !open;
    trigger.setAttribute('aria-expanded', String(open));
    if (open) $('button', menu)?.focus();
  });
  $$('[data-surprise]', menu).forEach((button) => button.addEventListener('click', () => {
    closeMenu();
    trigger.focus();
    surpriseRun(button.dataset.surprise);
  }));
  document.addEventListener('click', (event) => {
    if (surprise && !surprise.contains(event.target)) closeMenu();
  });

  const infoButton = $('#albums-info-toggle');
  const infoPanel = $('#albums-info');
  infoButton?.addEventListener('click', () => {
    const open = infoPanel.hidden;
    infoPanel.hidden = !open;
    infoPanel.classList.toggle('albums-info-panel--visible', open);
    infoButton.setAttribute('aria-expanded', String(open));
    infoButton.setAttribute('aria-pressed', String(open));
  });

  function adjustBubble(bubble) {
    if (!bubble) return;
    bubble.style.setProperty('--shift', '0px');
    const rect = bubble.getBoundingClientRect();
    const margin = 8;
    let shift = 0;
    if (rect.left < margin) shift = margin - rect.left;
    else if (rect.right > innerWidth - margin) shift = innerWidth - margin - rect.right;
    if (shift) bubble.style.setProperty('--shift', `${shift}px`);
  }

  grid.addEventListener('mouseenter', (event) => {
    requestAnimationFrame(() => adjustBubble(event.target.closest('.album-card')?.querySelector('.album-note-bubble')));
  }, true);
  grid.addEventListener('focusin', (event) => {
    requestAnimationFrame(() => adjustBubble(event.target.closest('.album-card')?.querySelector('.album-note-bubble')));
  });
  document.addEventListener('click', (event) => {
    const card = event.target.closest('.album-card');
    if (!card) {
      cards.forEach((item) => item.classList.remove('show-note'));
      return;
    }
    if (!matchMedia('(max-width:900px)').matches || grid.dataset.albumView !== 'quilt' || card.classList.contains('show-note')) return;
    event.preventDefault();
    cards.forEach((item) => item.classList.remove('show-note'));
    card.classList.add('show-note');
    setTimeout(() => card.classList.remove('show-note'), 2500);
  }, true);

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      clearFilters();
      if (state.activeView === 'map' || state.activeView === 'timeline') {
        setCollectionView(grid.dataset.albumView === 'list' ? 'list' : 'quilt');
      }
    } else if (event.key === '/' && event.target === document.body) {
      event.preventDefault();
      controls.search?.focus();
    }
  });

  const api = {
    cards,
    controls,
    state,
    norm,
    split,
    getBaseCards,
    getVisibleCards,
    applyFilters,
    updateResults,
    setMapCountryId(id) {
      state.selectedMapCountryId = state.selectedMapCountryId === id ? '' : id;
      if (id && controls.country) controls.country.value = '';
      applyFilters();
    },
    setFilter(name, value) {
      const control = controls[name];
      if (control) {
        state.selectedMapCountryId = '';
        control.value = value;
        applyFilters();
      }
    },
    showView,
  };

  restore();
  sortCards();
  applyFilters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
