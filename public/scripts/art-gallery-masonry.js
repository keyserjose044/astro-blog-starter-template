const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const PLACEHOLDER_RATIOS = ['4 / 5', '1 / 1', '3 / 2', '2 / 3', '5 / 4', '3 / 4'];
const PLACEHOLDER_RATIO_VALUES = [0.8, 1, 1.5, 2 / 3, 1.25, 0.75];
const RECENCY_BAND_SIZE = 36;
const DESKTOP_INITIAL_RENDER = 120;
const DESKTOP_RENDER_BATCH = 96;
const MOBILE_INITIAL_RENDER = 72;
const MOBILE_RENDER_BATCH = 48;

const getColumnCount = (width) => {
  if (width >= 1540) return 6;
  if (width >= 1260) return 5;
  if (width >= 980) return 4;
  if (width >= 660) return 3;
  return 2;
};

const getRenderSizing = () => window.matchMedia('(max-width: 659px)').matches
  ? { initial: MOBILE_INITIAL_RENDER, batch: MOBILE_RENDER_BATCH }
  : { initial: DESKTOP_INITIAL_RENDER, batch: DESKTOP_RENDER_BATCH };

const parseViewedDate = (value) => {
  const raw = String(value || '').trim();
  const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const timestamp = Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2]));
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const stableHash = (value) => {
  let hash = 2166136261;
  const input = String(value || '');
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const isKnownPlaceholder = (card) => {
  if (!card) return false;
  const cover = String(card.dataset.cover || card.querySelector('.art-cover')?.getAttribute('src') || '').toLowerCase();
  return cover.includes('art-placeholder.webp');
};

function bootArtGalleryMasonry() {
  const grid = $('#art-grid');
  if (!grid) return;

  const cards = $$('.art-card', grid).sort(
    (a, b) => Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0)
  );
  if (!cards.length) return;

  const galleryButton = $('[data-art-view="gallery"]');
  const listButton = $('[data-art-view="list"]');
  const sortControl = $('#art-sort');
  const filterInputs = [
    $('#art-search'),
    $('#art-artist-filter'),
    $('#art-movement-filter'),
    $('#art-medium-filter'),
    $('#art-country-filter'),
    $('#art-viewed-year-filter'),
    $('#art-period-filter'),
    $('#art-clear-filters'),
  ].filter(Boolean);

  let currentColumnCount = 0;
  let resizeTimer = 0;
  let filterTimer = 0;
  let renderLimit = getRenderSizing().initial;
  let currentVisibleCount = cards.length;

  const progress = document.createElement('div');
  progress.className = 'art-progressive-render';
  progress.hidden = true;
  progress.innerHTML = `
    <p class="art-progressive-status" aria-live="polite"></p>
    <button type="button" class="art-progressive-more">Load more artworks</button>
  `;
  grid.after(progress);
  const progressStatus = progress.querySelector('.art-progressive-status');
  const progressButton = progress.querySelector('.art-progressive-more');

  const preloadObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const image = entry.target;
          image.loading = 'eager';
          image.fetchPriority = 'low';
          observer.unobserve(image);
        });
      }, { rootMargin: '1800px 0px' })
    : null;

  const visibleCards = () => cards.filter((card) => card.style.display !== 'none');

  function markImageMissing(image) {
    if (!image) return;
    const card = image.closest('.art-card');
    const figure = image.closest('.art-card-figure');
    if (!card || !figure) return;
    card.dataset.galleryCoverStatus = 'missing';
    figure.classList.add('art-image-ready', 'art-image-missing');
  }

  function settleImage(image) {
    if (!image) return;
    if (isKnownPlaceholder(image.closest('.art-card'))) {
      markImageMissing(image);
      return;
    }

    const card = image.closest('.art-card');
    const figure = image.closest('.art-card-figure');
    if (!card || !figure) return;

    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      const ratio = Math.min(2.4, Math.max(0.42, image.naturalWidth / image.naturalHeight));
      card.dataset.galleryCoverStatus = 'ready';
      card.dataset.galleryRatio = String(ratio);
      figure.style.setProperty('--art-natural-ratio', String(ratio));
      figure.classList.remove('art-image-missing');
      figure.classList.add('art-image-ready');
      return;
    }

    markImageMissing(image);
  }

  cards.forEach((card, index) => {
    card.style.setProperty('--art-placeholder-ratio', PLACEHOLDER_RATIOS[index % PLACEHOLDER_RATIOS.length]);
    card.dataset.galleryFallbackRatio = String(PLACEHOLDER_RATIO_VALUES[index % PLACEHOLDER_RATIO_VALUES.length]);
    if (isKnownPlaceholder(card)) markImageMissing(card.querySelector('.art-cover'));
  });

  const mixRecencyBands = (items) => {
    const sorted = [...items].sort((a, b) => {
      const dateDifference = parseViewedDate(b.dataset.dateViewed) - parseViewedDate(a.dataset.dateViewed);
      return dateDifference || Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0);
    });

    const mixed = [];
    for (let start = 0; start < sorted.length; start += RECENCY_BAND_SIZE) {
      const band = sorted.slice(start, start + RECENCY_BAND_SIZE);
      band.sort((a, b) => {
        const aKey = stableHash(`${a.dataset.title}|${a.dataset.artist}|${a.dataset.originalIndex}`);
        const bKey = stableHash(`${b.dataset.title}|${b.dataset.artist}|${b.dataset.originalIndex}`);
        return aKey - bKey;
      });
      mixed.push(...band);
    }
    return mixed;
  };

  const rankGalleryCards = (shown) => {
    const imageReady = [];
    const unresolved = [];
    shown.forEach((card) => {
      if (card.dataset.galleryCoverStatus === 'missing' || isKnownPlaceholder(card)) unresolved.push(card);
      else imageReady.push(card);
    });
    return [...mixRecencyBands(imageReady), ...mixRecencyBands(unresolved)];
  };

  const estimatedHeight = (card) => {
    const ratio = Number(card.dataset.galleryRatio || card.dataset.galleryFallbackRatio || 0.8);
    return 1 / Math.max(0.42, Math.min(2.4, ratio));
  };

  function primeImages(columns) {
    columns.forEach((column) => {
      $$('.art-cover', column).forEach((image, index) => {
        image.decoding = 'async';
        if (!image.dataset.masonryBound) {
          image.dataset.masonryBound = 'true';
          image.addEventListener('load', () => settleImage(image), { once: true });
          image.addEventListener('error', () => markImageMissing(image), { once: true });
        }
        if (image.complete) settleImage(image);

        if (index < 3) {
          image.loading = 'eager';
          image.fetchPriority = index === 0 ? 'high' : 'auto';
        } else {
          image.loading = 'lazy';
          image.fetchPriority = 'low';
          preloadObserver?.observe(image);
        }
      });
    });
  }

  function syncProgress(rendered, total) {
    currentVisibleCount = total;
    const isGallery = grid.dataset.artView === 'gallery' && !grid.hidden;
    const hasMore = rendered < total;
    progress.hidden = !isGallery || !hasMore;
    if (progressStatus) {
      progressStatus.textContent = hasMore
        ? `${rendered.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} gallery cards mounted`
        : '';
    }
    if (progressButton) progressButton.hidden = !hasMore;
  }

  function buildColumns() {
    if (grid.dataset.artView !== 'gallery') return;

    const width = grid.getBoundingClientRect().width || window.innerWidth;
    const columnCount = getColumnCount(width);
    currentColumnCount = columnCount;

    const shown = rankGalleryCards(visibleCards());
    const mounted = shown.slice(0, Math.min(renderLimit, shown.length));
    const columns = Array.from({ length: columnCount }, () => {
      const column = document.createElement('div');
      column.className = 'art-masonry-column';
      column.setAttribute('role', 'presentation');
      return column;
    });
    const columnHeights = Array(columnCount).fill(0);

    mounted.forEach((card, index) => {
      const targetColumn = index < columnCount
        ? index
        : columnHeights.indexOf(Math.min(...columnHeights));
      columns[targetColumn].append(card);
      columnHeights[targetColumn] += estimatedHeight(card) + 0.07;
    });

    grid.replaceChildren(...columns);
    grid.classList.add('art-masonry-ready');
    grid.dataset.galleryMounted = String(mounted.length);
    primeImages(columns);
    syncProgress(mounted.length, shown.length);
  }

  function flattenForList() {
    preloadObserver?.disconnect();
    const fragment = document.createDocumentFragment();
    cards.forEach((card) => fragment.append(card));
    grid.replaceChildren(fragment);
    grid.classList.remove('art-masonry-ready');
    progress.hidden = true;
  }

  function resetProgressLimit() {
    renderLimit = getRenderSizing().initial;
  }

  function loadMore() {
    if (grid.dataset.artView !== 'gallery') return;
    const { batch } = getRenderSizing();
    renderLimit = Math.min(currentVisibleCount, renderLimit + batch);
    buildColumns();
  }

  const progressiveObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      }, { rootMargin: '1400px 0px' })
    : null;
  if (progressButton) progressiveObserver?.observe(progressButton);
  progressButton?.addEventListener('click', loadMore);

  function scheduleGalleryBuild(delay = 0, reset = false) {
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(() => {
      if (reset) resetProgressLimit();
      if (grid.dataset.artView === 'gallery') buildColumns();
    }, delay);
  }

  galleryButton?.addEventListener('click', () => scheduleGalleryBuild(0, true));

  listButton?.addEventListener('click', () => {
    window.setTimeout(() => {
      flattenForList();
      sortControl?.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
  });

  filterInputs.forEach((control) => {
    const eventName = control.matches('input[type="search"]') ? 'input' : 'change';
    control.addEventListener(eventName, () => scheduleGalleryBuild(eventName === 'input' ? 90 : 0, true));
    if (control.id === 'art-clear-filters') {
      control.addEventListener('click', () => scheduleGalleryBuild(0, true));
    }
  });

  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (grid.dataset.artView !== 'gallery') return;
      const nextCount = getColumnCount(grid.getBoundingClientRect().width || window.innerWidth);
      if (nextCount !== currentColumnCount) buildColumns();
    }, 220);
  }, { passive: true });

  if (galleryButton) {
    galleryButton.title = 'Progressively rendered natural-proportion gallery. Switch to List for the complete sortable archive at once.';
  }

  const browsingCopy = Array.from(document.querySelectorAll('#art-info p')).find((paragraph) =>
    paragraph.textContent?.trim().startsWith('Gallery')
  );
  if (browsingCopy) {
    browsingCopy.textContent = 'Gallery preserves each work\'s natural proportions and mounts the collection progressively as you browse, avoiding an enormous initial page. Its order is intentionally mixed for discovery rather than strictly chronological. List remains the complete sortable archive. Artists groups the collection by creator. Timeline moves between art history and my viewing journey. World Map uses the recorded country or nationality field when it can be matched confidently.';
  }

  if (grid.dataset.artView === 'gallery') buildColumns();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootArtGalleryMasonry, { once: true });
} else {
  bootArtGalleryMasonry();
}
