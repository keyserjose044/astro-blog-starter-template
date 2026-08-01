const RELEASE_CUTOFF_YEAR = 1920;
const ASSET_VERSION = '20260801-1721';

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
    preview: $('#album-rich-preview'),
    dialog: $('#album-details-dialog'),
    selectionShelf: $('#albums-selection-shelf'),
    selectionTitle: $('#albums-selection-title'),
    selectionSummary: $('#albums-selection-summary'),
    selectionGrid: $('#albums-selection-grid'),
    selectionClear: $('#albums-selection-clear'),
  };
  const state = {
    activeView: 'list',
    selectedMapCountryId: '',
    mapModule: null,
    timelineModule: null,
    previewTimer: 0,
    previewAnchor: null,
    dialogTrigger: null,
    last: { album: null, country: null, style: null, release: null, year: null },
  };
  const desktopPreviewQuery = matchMedia('(min-width:761px) and (hover:hover) and (pointer:fine)');

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
    card.href = card.dataset.href || '';
    card._countryTokens = split(card.dataset.country).map(norm);
    card._subgenreTokens = split(card.dataset.subgenre).map(norm);
    card._moodTokens = split(card.dataset.mood).map(norm);
  });

  function cardInfo(card) {
    if (!card) return null;
    return {
      card,
      title: card.dataset.title || 'Untitled album',
      artist: card.dataset.artist || 'Artist not recorded',
      country: card.dataset.country || '',
      style: card.dataset.style || '',
      subgenre: card.dataset.subgenre || '',
      mood: card.dataset.mood || '',
      dateListened: card.dataset.dateListened || '',
      release: card.dataset.releaseLabel || '',
      length: card.dataset.length || '',
      lengthMinutes: num(card.dataset.lengthMinutes) || 0,
      cover: $('.album-cover', card)?.getAttribute('src') || '',
      href: card.dataset.href || card.href || '',
      index: card.dataset.originalIndex || '',
    };
  }

  const formatListenedDate = (value) => {
    const timestamp = dateValue(value);
    if (timestamp == null) return value || '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(timestamp));
  };

  const formatRuntime = (minutes) => {
    const total = Math.round(Number(minutes || 0));
    const hours = Math.floor(total / 60);
    const remainder = total % 60;
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
  };

  function detailRows(album) {
    return [
      ['Length', album.length],
      ['Released', album.release && !/^unknown$/i.test(album.release) ? album.release : ''],
      ['Primary style', album.style],
      ['Subgenre', album.subgenre],
      ['Mood', album.mood],
      ['Country / origin', album.country],
    ].filter(([, value]) => value);
  }

  function fillAlbumPanel(root, prefix, album) {
    if (!root || !album) return;
    const image = root.querySelector(`[data-${prefix}-image]`);
    const title = root.querySelector(`[data-${prefix}-title]`);
    const artist = root.querySelector(`[data-${prefix}-artist]`);
    const date = root.querySelector(`[data-${prefix}-date]`);
    const details = root.querySelector(`[data-${prefix}-details]`);
    const source = root.querySelector(`[data-${prefix}-source]`);

    if (image) { image.src = album.cover; image.alt = album.title; }
    if (title) title.textContent = album.title;
    if (artist) artist.textContent = album.artist;
    if (date) date.textContent = album.dateListened
      ? `Listened ${formatListenedDate(album.dateListened)}`
      : 'Album details';
    if (details) {
      details.replaceChildren();
      detailRows(album).forEach(([label, value]) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        details.append(dt, dd);
      });
    }
    if (source) {
      source.href = album.href || '#';
      source.hidden = !album.href;
      source.setAttribute('aria-label', `Open the original source for ${album.title} in a new tab`);
    }
  }

  function positionPreview(anchor) {
    const preview = controls.preview;
    if (!preview || preview.hidden || !anchor?.isConnected) return;
    const anchorRect = anchor.getBoundingClientRect();
    const rect = preview.getBoundingClientRect();
    const margin = 14;
    const gap = 16;
    let side = 'right';
    let left = anchorRect.right + gap;
    if (left + rect.width > innerWidth - margin) {
      side = 'left';
      left = anchorRect.left - rect.width - gap;
    }
    left = Math.max(margin, Math.min(left, innerWidth - rect.width - margin));
    let top = anchorRect.top + (anchorRect.height - rect.height) / 2;
    top = Math.max(margin, Math.min(top, innerHeight - rect.height - margin));
    preview.dataset.side = side;
    preview.style.left = `${Math.round(left)}px`;
    preview.style.top = `${Math.round(top)}px`;
  }

  function showPreview(card, anchor = card) {
    const anchorInGrid = Boolean(anchor?.closest?.('#albums-grid'));
    if (!desktopPreviewQuery.matches || !card || (anchorInGrid && grid.dataset.albumView !== 'quilt')) return;
    clearTimeout(state.previewTimer);
    state.previewAnchor = anchor;
    fillAlbumPanel(controls.preview, 'album-preview', cardInfo(card));
    controls.preview.hidden = false;
    requestAnimationFrame(() => {
      positionPreview(anchor);
      controls.preview.classList.add('is-visible');
    });
  }

  function hidePreview(immediate = false) {
    if (!controls.preview) return;
    clearTimeout(state.previewTimer);
    const hide = () => {
      controls.preview.classList.remove('is-visible');
      setTimeout(() => {
        if (!controls.preview.classList.contains('is-visible')) controls.preview.hidden = true;
      }, 130);
      state.previewAnchor = null;
    };
    if (immediate) hide();
    else state.previewTimer = setTimeout(hide, 150);
  }

  function openDetails(card, trigger = card) {
    if (!card || !controls.dialog) return;
    hidePreview(true);
    state.dialogTrigger = trigger;
    fillAlbumPanel(controls.dialog, 'album-dialog', cardInfo(card));
    if (typeof controls.dialog.showModal === 'function' && !controls.dialog.open) controls.dialog.showModal();
    else controls.dialog.setAttribute('open', '');
  }

  function closeDetails() {
    if (!controls.dialog) return;
    if (typeof controls.dialog.close === 'function' && controls.dialog.open) controls.dialog.close();
    else controls.dialog.removeAttribute('open');
  }

  function cardByHref(href) {
    const target = String(href || '').replace(/\/$/, '');
    return cards.find((card) => String(card.dataset.href || card.href || '').replace(/\/$/, '') === target) || null;
  }

  function bindDetailTrigger(element, card) {
    if (!element || !card || element.dataset.albumDetailsBound) return;
    element.dataset.albumDetailsBound = 'true';
    element.addEventListener('pointerenter', () => showPreview(card, element));
    element.addEventListener('pointerleave', () => hidePreview(false));
    element.addEventListener('focus', () => showPreview(card, element));
    element.addEventListener('blur', () => hidePreview(false));
    element.addEventListener('click', (event) => {
      event.preventDefault();
      openDetails(card, element);
    });
  }

  function enhanceCountryAlbumLinks() {
    $$('.albums-country-album', controls.countryPanel).forEach((link) => {
      if (link.dataset.albumDetailsBound || link.closest('.albums-country-album-wrap')) return;
      const card = cardByHref(link.getAttribute('href'));
      if (!card) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'albums-country-album-wrap';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'albums-country-album';
      while (link.firstChild) button.append(link.firstChild);
      const source = document.createElement('a');
      source.className = 'albums-country-source';
      source.href = card.dataset.href || card.href || '#';
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = '↗';
      source.setAttribute('aria-label', `Open the original source for ${card.dataset.title} in a new tab`);
      wrapper.append(button, source);
      link.replaceWith(wrapper);
      bindDetailTrigger(button, card);
    });
  }

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

  const orderedCards = () => $$('.album-card', grid);
  const getBaseCards = () => orderedCards().filter(baseMatch);
  const getVisibleCards = () => orderedCards().filter((card) => baseMatch(card) && mapMatch(card));
  const activeCount = () => [
    controls.style,
    controls.subgenre,
    controls.mood,
    controls.country,
    controls.year,
    controls.release,
  ].filter((control) => control?.value).length + Number(Boolean(state.selectedMapCountryId));

  function selectionContext() {
    if (state.activeView === 'map' && state.selectedMapCountryId) {
      const heading = $('.albums-country-panel h3', controls.countryPanel)?.textContent?.trim() || 'Selected country';
      return { title: `Albums from ${heading}`, kind: 'map' };
    }
    if (state.activeView === 'timeline') {
      const mode = $('[data-timeline-mode][aria-pressed="true"]')?.dataset.timelineMode || 'release';
      if (mode === 'listening' && controls.year?.value) {
        return { title: `Albums listened to in ${controls.year.value}`, kind: 'year' };
      }
      if (mode === 'release' && controls.release?.value) {
        return {
          title: `Albums released in ${controls.release.selectedOptions[0]?.textContent || controls.release.value}`,
          kind: 'release',
        };
      }
    }
    return null;
  }

  function renderSelectionShelf() {
    const shelf = controls.selectionShelf;
    const context = selectionContext();
    if (!shelf || !controls.selectionGrid || !context) {
      if (shelf) shelf.hidden = true;
      return;
    }

    const visible = getVisibleCards();
    const minutes = visible.reduce((sum, card) => sum + (num(card.dataset.lengthMinutes) || 0), 0);
    controls.selectionTitle.textContent = context.title;
    controls.selectionSummary.textContent = `${visible.length.toLocaleString('en-US')} ${visible.length === 1 ? 'album' : 'albums'} · ${formatRuntime(minutes)} of album runtime`;
    controls.selectionGrid.replaceChildren();

    visible.slice(0, 16).forEach((card) => {
      const album = cardInfo(card);
      const item = document.createElement('article');
      item.className = 'albums-selection-card';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'albums-selection-main';
      const image = document.createElement('img');
      image.src = album.cover;
      image.alt = '';
      image.loading = 'lazy';
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      const artist = document.createElement('small');
      title.textContent = album.title;
      artist.textContent = album.artist;
      copy.append(title, artist);
      button.append(image, copy);
      const source = document.createElement('a');
      source.className = 'albums-selection-source';
      source.href = album.href || '#';
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = '↗';
      source.setAttribute('aria-label', `Open the original source for ${album.title} in a new tab`);
      item.append(button, source);
      controls.selectionGrid.append(item);
      bindDetailTrigger(button, card);
    });

    if (visible.length > 16) {
      const more = document.createElement('p');
      more.className = 'albums-selection-more';
      more.textContent = `+ ${visible.length - 16} more albums match this selection`;
      controls.selectionGrid.append(more);
    }
    controls.selectionClear.dataset.selectionKind = context.kind;
    shelf.hidden = false;
  }

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
    renderSelectionShelf();
  }

  async function refreshExplorer() {
    if (state.activeView === 'map' && state.mapModule) {
      await state.mapModule.renderAlbumMap(api);
      enhanceCountryAlbumLinks();
    }
    if (state.activeView === 'timeline' && state.timelineModule) state.timelineModule.renderAlbumTimeline(api);
    renderSelectionShelf();
  }

  function applyFilters() {
    updateResults();
    void refreshExplorer();
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
    controls.selectionShelf.hidden = true;
    grid.hidden = false;
    grid.dataset.albumView = view;
    press(view);
    hidePreview(true);

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
    hidePreview(true);
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
      enhanceCountryAlbumLinks();
    } else {
      state.timelineModule ??= await import(`./albums-timeline.js?v=${ASSET_VERSION}`);
      state.timelineModule.renderAlbumTimeline(api);
    }
    renderSelectionShelf();
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
  explorer.addEventListener('click', (event) => {
    if (event.target.closest('[data-timeline-mode]')) setTimeout(renderSelectionShelf, 0);
  });
  controls.selectionClear?.addEventListener('click', () => {
    const kind = controls.selectionClear.dataset.selectionKind;
    if (kind === 'map') state.selectedMapCountryId = '';
    else if (kind === 'year' && controls.year) controls.year.value = '';
    else if (kind === 'release' && controls.release) controls.release.value = '';
    applyFilters();
  });
  buttons.forEach((button) => button.addEventListener('click', () => showView(button.dataset.albumView)));
  $$('[data-close-explorer]').forEach((button) => button.addEventListener('click', () => {
    setCollectionView(grid.dataset.albumView === 'list' ? 'list' : 'quilt');
  }));

  grid.addEventListener('pointerover', (event) => {
    if (grid.dataset.albumView !== 'quilt') return;
    const card = event.target.closest('.album-card');
    if (!card || event.target.closest('.album-source-link') || card.contains(event.relatedTarget)) return;
    showPreview(card, card);
  });
  grid.addEventListener('pointerout', (event) => {
    if (grid.dataset.albumView !== 'quilt') return;
    const card = event.target.closest('.album-card');
    if (card && !card.contains(event.relatedTarget)) hidePreview(false);
  });
  grid.addEventListener('focusin', (event) => {
    const card = event.target.closest('.album-card');
    if (grid.dataset.albumView === 'quilt' && card && !event.target.closest('.album-source-link')) showPreview(card, card);
  });
  grid.addEventListener('focusout', (event) => {
    if (grid.dataset.albumView === 'quilt' && event.target.closest('.album-card')) hidePreview(false);
  });
  grid.addEventListener('click', (event) => {
    if (event.target.closest('.album-source-link')) return;
    const card = event.target.closest('.album-card');
    if (!card) return;
    openDetails(card, card);
  });
  controls.preview?.addEventListener('pointerenter', () => clearTimeout(state.previewTimer));
  controls.preview?.addEventListener('pointerleave', () => hidePreview(false));
  $('[data-album-dialog-close]', controls.dialog)?.addEventListener('click', closeDetails);
  controls.dialog?.addEventListener('click', (event) => {
    if (event.target === controls.dialog) closeDetails();
  });
  controls.dialog?.addEventListener('close', () => {
    state.dialogTrigger?.focus?.({ preventScroll: true });
    state.dialogTrigger = null;
  });
  addEventListener('resize', () => { if (state.previewAnchor) positionPreview(state.previewAnchor); });
  addEventListener('scroll', () => { if (state.previewAnchor) positionPreview(state.previewAnchor); }, true);

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
    if (!menu || !trigger) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  };

  async function surpriseRun(action) {
    const current = getVisibleCards().length ? getVisibleCards() : cards;

    if (action === 'album') {
      const card = random(current, state.last.album);
      if (!card) return say('No albums match the current filters.');
      state.last.album = card;
      openDetails(card, trigger);
      return say(`Album details: ${card.dataset.title}`);
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
    void surpriseRun(button.dataset.surprise);
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

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      if (controls.filtersPanel && !controls.filtersPanel.hidden) {
        controls.filtersPanel.hidden = true;
        controls.filtersToggle?.setAttribute('aria-expanded', 'false');
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
    openDetails,
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
