/* LifeLoggerz Albums: final advanced-view polish — August 1, 2026. */

const ALBUMS_POLISH_RETRIES = 140;

function bootAlbumsPolish(attempt = 0) {
  const grid = document.querySelector('#albums-grid');
  const viewToggle = document.querySelector('#album-view-toggle');
  const explorer = document.querySelector('#albums-explorer');
  const mapView = document.querySelector('#albums-map-view');
  const timelineView = document.querySelector('#albums-timeline-view');
  const countryPanel = document.querySelector('#albums-country-panel');
  const mapMetrics = document.querySelector('#albums-map-metrics');
  const shelf = document.querySelector('#albums-selection-shelf');
  const shelfTitle = document.querySelector('#albums-selection-title');
  const shelfSummary = document.querySelector('#albums-selection-summary');
  const shelfGrid = document.querySelector('#albums-selection-grid');
  const shelfClear = document.querySelector('#albums-selection-clear');
  const expansion = document.querySelector('#albums-expansion-views');
  const preview = document.querySelector('#album-rich-preview');

  const ready = grid && viewToggle && explorer && mapView && timelineView && countryPanel
    && mapMetrics && shelf && shelfTitle && shelfSummary && shelfGrid && shelfClear && expansion && preview;
  if (!ready && attempt < ALBUMS_POLISH_RETRIES) {
    window.setTimeout(() => bootAlbumsPolish(attempt + 1), 80);
    return;
  }
  if (!ready || document.body.dataset.albumsPolishReady) return;
  document.body.dataset.albumsPolishReady = 'true';

  const cards = Array.from(grid.querySelectorAll('.album-card'));
  const desktopPreviewQuery = window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
  let applyingSelection = false;
  let selectionFrame = 0;
  let expansionFrame = 0;
  let previewTimer = 0;
  let activePreviewAnchor = null;

  const clean = (value) => String(value || '').trim();
  const normalize = (value) => clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const split = (value) => clean(value)
    .split(/\s*(?:\/|;|\||\+)\s*|\s*,\s*/)
    .map((item) => item.trim())
    .filter(Boolean);

  function parseDate(value) {
    const raw = clean(value).replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
    if (!raw) return null;
    const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
    if (numeric) {
      const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
      const date = new Date(Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2])));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? null
      : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }

  const formatDate = (date) => date
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
    : '';
  const formatRuntime = (minutes) => {
    const total = Math.max(0, Math.round(Number(minutes || 0)));
    const hours = Math.floor(total / 60);
    const remainder = total % 60;
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
  };

  function cardInfo(card) {
    return {
      card,
      title: card?.dataset.title || 'Untitled album',
      artist: card?.dataset.artist || 'Artist not recorded',
      date: parseDate(card?.dataset.dateListened),
      dateRaw: card?.dataset.dateListened || '',
      length: card?.dataset.length || '',
      minutes: Number(card?.dataset.lengthMinutes || 0) || 0,
      release: card?.dataset.releaseLabel || '',
      style: card?.dataset.style || '',
      subgenre: card?.dataset.subgenre || '',
      mood: card?.dataset.mood || '',
      country: card?.dataset.country || '',
      cover: card?.querySelector('.album-cover')?.getAttribute('src') || '',
      href: card?.dataset.href || '',
      index: Number(card?.dataset.originalIndex || 0),
    };
  }

  function openDetails(card) {
    card?.querySelector('.album-details-hit')?.click();
  }

  function detailRows(info) {
    return [
      ['Length', info.length],
      ['Released', info.release && !/^unknown$/i.test(info.release) ? info.release : ''],
      ['Primary style', info.style],
      ['Subgenre', info.subgenre],
      ['Mood', info.mood],
      ['Country / origin', info.country],
    ].filter(([, value]) => value);
  }

  function positionPreview(anchor) {
    if (!preview || preview.hidden || !anchor?.isConnected) return;
    const anchorRect = anchor.getBoundingClientRect();
    const rect = preview.getBoundingClientRect();
    const margin = 14;
    const gap = 16;
    let left = anchorRect.right + gap;
    let side = 'right';
    if (left + rect.width > window.innerWidth - margin) {
      side = 'left';
      left = anchorRect.left - rect.width - gap;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
    let top = anchorRect.top + (anchorRect.height - rect.height) / 2;
    top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));
    preview.dataset.side = side;
    preview.style.left = `${Math.round(left)}px`;
    preview.style.top = `${Math.round(top)}px`;
  }

  function showPreview(card, anchor) {
    if (!desktopPreviewQuery.matches || !card || !anchor) return;
    const info = cardInfo(card);
    window.clearTimeout(previewTimer);
    activePreviewAnchor = anchor;

    const image = preview.querySelector('[data-album-preview-image]');
    const title = preview.querySelector('[data-album-preview-title]');
    const artist = preview.querySelector('[data-album-preview-artist]');
    const date = preview.querySelector('[data-album-preview-date]');
    const details = preview.querySelector('[data-album-preview-details]');
    const source = preview.querySelector('[data-album-preview-source]');
    if (image) { image.src = info.cover; image.alt = info.title; }
    if (title) title.textContent = info.title;
    if (artist) artist.textContent = info.artist;
    if (date) date.textContent = info.date ? `Listened ${formatDate(info.date)}` : 'Album details';
    if (details) {
      details.replaceChildren();
      detailRows(info).forEach(([labelText, value]) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = labelText;
        dd.textContent = value;
        details.append(dt, dd);
      });
    }
    if (source) {
      source.href = info.href || '#';
      source.hidden = !info.href;
    }

    preview.hidden = false;
    window.requestAnimationFrame(() => {
      positionPreview(anchor);
      preview.classList.add('is-visible');
    });
  }

  function hidePreview(immediate = false) {
    window.clearTimeout(previewTimer);
    const hide = () => {
      preview.classList.remove('is-visible');
      window.setTimeout(() => {
        if (!preview.classList.contains('is-visible')) preview.hidden = true;
      }, 130);
      activePreviewAnchor = null;
    };
    if (immediate) hide();
    else previewTimer = window.setTimeout(hide, 140);
  }

  function bindPreview(element, card) {
    if (!element || !card || element.dataset.albumsPolishPreviewBound) return;
    element.dataset.albumsPolishPreviewBound = 'true';
    element.addEventListener('pointerenter', () => showPreview(card, element));
    element.addEventListener('pointerleave', () => hidePreview(false));
    element.addEventListener('focus', () => showPreview(card, element));
    element.addEventListener('blur', () => hidePreview(false));
  }

  preview.addEventListener('pointerenter', () => window.clearTimeout(previewTimer));
  preview.addEventListener('pointerleave', () => hidePreview(false));
  window.addEventListener('resize', () => { if (activePreviewAnchor) positionPreview(activePreviewAnchor); });
  window.addEventListener('scroll', () => { if (activePreviewAnchor) positionPreview(activePreviewAnchor); }, true);

  function makeQuiltButton(card, className = 'albums-polish-quilt-button', includeDate = false) {
    const info = cardInfo(card);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', `${info.title} — open album details`);

    const image = document.createElement('img');
    image.src = info.cover;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';

    const copy = document.createElement('span');
    copy.className = 'albums-polish-quilt-copy';
    const title = document.createElement('strong');
    const artist = document.createElement('small');
    title.textContent = info.title;
    artist.textContent = info.artist;
    copy.append(title, artist);
    if (includeDate && info.date) {
      const date = document.createElement('em');
      date.textContent = formatDate(info.date);
      copy.append(date);
    }

    button.append(image, copy);
    button.addEventListener('click', () => openDetails(card));
    bindPreview(button, card);
    return button;
  }

  function makeSelectionCard(card) {
    const info = cardInfo(card);
    const item = document.createElement('article');
    item.className = 'albums-selection-card albums-polish-selection-card';
    const button = makeQuiltButton(card, 'albums-selection-main albums-polish-quilt-button');
    item.append(button);

    if (info.href) {
      const source = document.createElement('a');
      source.className = 'albums-selection-source';
      source.href = info.href;
      source.target = '_blank';
      source.rel = 'noopener noreferrer';
      source.textContent = '↗';
      source.setAttribute('aria-label', `Open the original source for ${info.title} in a new tab`);
      item.append(source);
    }
    return item;
  }

  function visibleCards() {
    return cards.filter((card) => card.style.display !== 'none' && !card.hidden);
  }

  function matchesBaseFilters(card) {
    const search = normalize(document.querySelector('#album-search')?.value);
    const words = search.split(/\s+/).filter(Boolean);
    if (words.length) {
      const haystack = normalize([
        card.dataset.title,
        card.dataset.artist,
        card.dataset.country,
        card.dataset.style,
        card.dataset.subgenre,
        card.dataset.mood,
        card.dataset.noteRaw,
      ].join(' '));
      if (!words.every((word) => haystack.includes(word))) return false;
    }

    const exact = [
      ['#album-style-filter', card.dataset.style],
      ['#album-listened-year-filter', card.dataset.listenedYear],
      ['#album-release-filter', card.dataset.releasePeriod],
    ];
    for (const [selector, value] of exact) {
      const selected = clean(document.querySelector(selector)?.value);
      if (selected && normalize(value) !== normalize(selected)) return false;
    }

    const tokenFilters = [
      ['#album-subgenre-filter', card.dataset.subgenre],
      ['#album-mood-filter', card.dataset.mood],
      ['#album-country-filter', card.dataset.country],
    ];
    for (const [selector, value] of tokenFilters) {
      const selected = clean(document.querySelector(selector)?.value);
      if (selected && !split(value).map(normalize).includes(normalize(selected))) return false;
    }
    return true;
  }

  function renameWorld() {
    const button = viewToggle.querySelector('[data-album-view="map"]');
    const label = button?.querySelector('span:last-child');
    if (label && label.textContent !== 'World') label.textContent = 'World';
    document.querySelector('[data-close-explorer][aria-label="Close world map"]')?.setAttribute('aria-label', 'Close world');
  }

  function stripAtlasAlbums() {
    countryPanel.querySelectorAll('.albums-country-albums').forEach((node) => node.remove());
  }

  function refineMapMetric() {
    const metrics = Array.from(mapMetrics.querySelectorAll('.albums-metric'));
    if (metrics.length < 4) return;
    const counts = new Map();
    cards.filter(matchesBaseFilters).forEach((card) => {
      String(card.dataset.albumCountryIds || '').split(' ').filter(Boolean).forEach((id) => {
        counts.set(id, (counts.get(id) || 0) + 1);
      });
    });
    const deepCountries = Array.from(counts.values()).filter((count) => count >= 5).length;
    const target = metrics[3];
    const label = target.querySelector('.albums-metric-label');
    const value = target.querySelector('.albums-metric-value');
    const note = target.querySelector('.albums-metric-note');
    if (label) label.textContent = 'Countries with 5+ albums';
    if (value) value.textContent = deepCountries.toLocaleString('en-US');
    if (note) note.textContent = 'Deeper pockets in this view';
  }

  function ensureShelfEyebrow() {
    const headingCopy = shelf.querySelector('.albums-selection-heading > div');
    if (!headingCopy) return null;
    let eyebrow = headingCopy.querySelector('.albums-selection-eyebrow');
    if (!eyebrow) {
      eyebrow = document.createElement('p');
      eyebrow.className = 'albums-eyebrow albums-selection-eyebrow';
      headingCopy.prepend(eyebrow);
    }
    return eyebrow;
  }

  function selectionMode() {
    if (!mapView.hidden) return 'world';
    if (!timelineView.hidden) return 'timeline';
    return '';
  }

  function renderSelectionPolish() {
    if (applyingSelection) return;
    const mode = selectionMode();
    if (!mode) return;
    applyingSelection = true;
    try {
      const eyebrow = ensureShelfEyebrow();
      shelf.dataset.polishMode = mode;

      if (mode === 'world') {
        shelf.hidden = false;
        if (eyebrow) eyebrow.textContent = 'World selection';
        const selected = Boolean(countryPanel.querySelector('.albums-country-clear'));
        if (!selected) {
          shelfTitle.textContent = 'Select a country to view its albums';
          shelfSummary.textContent = '';
          shelfClear.hidden = true;
          shelfGrid.dataset.polishSignature = 'world-empty';
          shelfGrid.replaceChildren();
          const empty = document.createElement('p');
          empty.className = 'albums-selection-empty';
          empty.textContent = 'Choose a country on the map or ranking.';
          shelfGrid.append(empty);
          return;
        }
        shelfClear.hidden = false;
        const country = clean(countryPanel.querySelector('.albums-country-panel-header h3')?.textContent) || 'Selected country';
        shelfTitle.textContent = `Albums from ${country}`;
      } else {
        if (shelf.hidden) return;
        if (eyebrow) eyebrow.textContent = 'Timeline selection';
        shelfClear.hidden = false;
      }

      const visible = visibleCards();
      const signature = `${mode}:${visible.map((card) => card.dataset.originalIndex).join(',')}`;
      if (shelfGrid.dataset.polishSignature === signature && shelfGrid.querySelector('.albums-polish-selection-card')) return;
      shelfGrid.dataset.polishSignature = signature;
      shelfGrid.replaceChildren();
      visible.forEach((card) => shelfGrid.append(makeSelectionCard(card)));
      const runtime = visible.reduce((sum, card) => sum + (Number(card.dataset.lengthMinutes || 0) || 0), 0);
      shelfSummary.textContent = `${visible.length.toLocaleString('en-US')} ${visible.length === 1 ? 'album' : 'albums'} · ${formatRuntime(runtime)} of album runtime`;
    } finally {
      applyingSelection = false;
    }
  }

  function queueSelectionPolish() {
    window.cancelAnimationFrame(selectionFrame);
    selectionFrame = window.requestAnimationFrame(() => {
      renameWorld();
      stripAtlasAlbums();
      refineMapMetric();
      renderSelectionPolish();
    });
  }

  function cardForExistingTile(tile) {
    const title = clean(tile.querySelector('.albums-quilt-tile-copy strong')?.textContent)
      || clean(tile.querySelector('strong')?.textContent);
    const artist = clean(tile.querySelector('.albums-quilt-tile-copy small')?.textContent)
      || clean(tile.querySelector('small')?.textContent);
    if (!title) return null;
    return cards.find((card) => clean(card.dataset.title) === title && (!artist || clean(card.dataset.artist) === artist))
      || cards.find((card) => clean(card.dataset.title) === title)
      || null;
  }

  function bindCalendarMonthPreviews() {
    expansion.querySelectorAll('.albums-calendar-month-grid .albums-quilt-tile').forEach((tile) => {
      const card = cardForExistingTile(tile);
      if (card) bindPreview(tile, card);
    });
  }

  function repairMilestones() {
    const milestoneGrid = expansion.querySelector('.albums-milestone-grid');
    if (!milestoneGrid) return;
    const dated = visibleCards()
      .map((card) => ({ card, date: parseDate(card.dataset.dateListened), index: Number(card.dataset.originalIndex || 0) }))
      .filter((item) => item.date)
      .sort((a, b) => a.date - b.date || a.index - b.index);
    if (!dated.length) return;

    const numbers = [1];
    for (let number = 50; number <= dated.length; number += 50) numbers.push(number);
    const signature = `${dated.length}:${numbers.join(',')}`;
    if (milestoneGrid.dataset.polishSignature === signature) return;
    milestoneGrid.dataset.polishSignature = signature;
    milestoneGrid.replaceChildren();

    numbers.forEach((number) => {
      const card = dated[number - 1]?.card;
      if (!card) return;
      const item = document.createElement('article');
      item.className = 'albums-milestone-card';
      const badge = document.createElement('span');
      badge.textContent = `#${number}`;
      const button = makeQuiltButton(card, 'albums-quilt-tile albums-milestone-album');
      item.append(badge, button);
      milestoneGrid.append(item);
    });
  }

  function polishExpansionViews() {
    bindCalendarMonthPreviews();
    repairMilestones();
  }

  function queueExpansionPolish() {
    window.cancelAnimationFrame(expansionFrame);
    expansionFrame = window.requestAnimationFrame(polishExpansionViews);
  }

  const selectionObserver = new MutationObserver(queueSelectionPolish);
  selectionObserver.observe(explorer, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-pressed'] });
  selectionObserver.observe(shelf, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
  const expansionObserver = new MutationObserver(queueExpansionPolish);
  expansionObserver.observe(expansion, { childList: true, subtree: true });

  [
    '#album-search', '#album-style-filter', '#album-subgenre-filter', '#album-mood-filter',
    '#album-country-filter', '#album-listened-year-filter', '#album-release-filter', '#albums-clear-filters',
  ].forEach((selector) => {
    const control = document.querySelector(selector);
    if (!control) return;
    control.addEventListener(control.matches('input') ? 'input' : control.tagName === 'SELECT' ? 'change' : 'click', () => {
      window.setTimeout(queueSelectionPolish, 0);
    });
  });

  viewToggle.addEventListener('click', () => window.setTimeout(queueSelectionPolish, 0));
  countryPanel.addEventListener('click', () => window.setTimeout(queueSelectionPolish, 0));

  renameWorld();
  queueSelectionPolish();
  queueExpansionPolish();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsPolish(), { once: true });
} else {
  bootAlbumsPolish();
}
