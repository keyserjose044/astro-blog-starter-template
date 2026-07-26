const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const PLACEHOLDER_RATIOS = ['4 / 5', '1 / 1', '3 / 2', '2 / 3', '5 / 4', '3 / 4'];

const getColumnCount = (width) => {
  if (width >= 1540) return 6;
  if (width >= 1260) return 5;
  if (width >= 980) return 4;
  if (width >= 660) return 3;
  return 2;
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

  const preloadObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const image = entry.target;
          image.loading = 'eager';
          image.fetchPriority = 'low';
          observer.unobserve(image);
        });
      }, { rootMargin: '2200px 0px' })
    : null;

  const visibleCards = () => cards.filter((card) => card.style.display !== 'none');

  cards.forEach((card, index) => {
    card.style.setProperty('--art-placeholder-ratio', PLACEHOLDER_RATIOS[index % PLACEHOLDER_RATIOS.length]);
  });

  function settleImage(image) {
    const figure = image.closest('.art-card-figure');
    if (!figure) return;

    if (image.naturalWidth > 0 && image.naturalHeight > 0) {
      const ratio = Math.min(2.4, Math.max(0.42, image.naturalWidth / image.naturalHeight));
      figure.style.setProperty('--art-natural-ratio', String(ratio));
    }

    figure.classList.add('art-image-ready');
  }

  function primeImages(columns) {
    columns.forEach((column) => {
      $$('.art-cover', column).forEach((image, index) => {
        image.decoding = 'async';
        if (!image.dataset.masonryBound) {
          image.dataset.masonryBound = 'true';
          image.addEventListener('load', () => settleImage(image), { once: true });
          image.addEventListener('error', () => settleImage(image), { once: true });
        }
        if (image.complete) settleImage(image);

        if (index < 4) {
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

  function buildColumns() {
    if (grid.dataset.artView !== 'gallery') return;

    const width = grid.getBoundingClientRect().width || window.innerWidth;
    const columnCount = getColumnCount(width);
    currentColumnCount = columnCount;

    const shown = visibleCards();
    const hidden = cards.filter((card) => card.style.display === 'none');
    const columns = Array.from({ length: columnCount }, () => {
      const column = document.createElement('div');
      column.className = 'art-masonry-column';
      column.setAttribute('role', 'presentation');
      return column;
    });

    // CSS multi-column layout created the beautiful sampling effect because
    // the top of each column came from a different point in the archive.
    // Equal contiguous chunks preserve that look without browser rebalancing.
    const chunkSize = Math.max(1, Math.ceil(shown.length / columnCount));
    columns.forEach((column, index) => {
      shown.slice(index * chunkSize, (index + 1) * chunkSize).forEach((card) => column.append(card));
    });

    // Hidden cards remain available to the main filter controller. A later
    // search/filter interaction rebuilds the columns using the new visible set.
    hidden.forEach((card, index) => columns[index % columnCount].append(card));

    grid.replaceChildren(...columns);
    grid.classList.add('art-masonry-ready');
    primeImages(columns);
  }

  function flattenForList() {
    preloadObserver?.disconnect();
    const fragment = document.createDocumentFragment();
    cards.forEach((card) => fragment.append(card));
    grid.replaceChildren(fragment);
    grid.classList.remove('art-masonry-ready');
  }

  function scheduleGalleryBuild(delay = 0) {
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(() => {
      if (grid.dataset.artView === 'gallery') buildColumns();
    }, delay);
  }

  galleryButton?.addEventListener('click', () => scheduleGalleryBuild(0));

  listButton?.addEventListener('click', () => {
    window.setTimeout(() => {
      flattenForList();
      sortControl?.dispatchEvent(new Event('change', { bubbles: true }));
    }, 0);
  });

  filterInputs.forEach((control) => {
    const eventName = control.matches('input[type="search"]') ? 'input' : 'change';
    control.addEventListener(eventName, () => scheduleGalleryBuild(eventName === 'input' ? 90 : 0));
    if (control.id === 'art-clear-filters') {
      control.addEventListener('click', () => scheduleGalleryBuild(0));
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
    galleryButton.title = 'Natural-proportion gallery. Switch to List for chronological or alphabetical sorting.';
  }

  const browsingCopy = Array.from(document.querySelectorAll('#art-info p')).find((paragraph) =>
    paragraph.textContent?.trim().startsWith('Gallery')
  );
  if (browsingCopy) {
    browsingCopy.textContent = 'Gallery preserves each work\'s natural proportions in a fixed masonry wall. List is the sortable archive. Artists groups the collection by creator. Timeline moves between art history and my viewing journey. World Map uses the recorded country or nationality field when it can be matched confidently.';
  }

  if (grid.dataset.artView === 'gallery') buildColumns();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootArtGalleryMasonry, { once: true });
} else {
  bootArtGalleryMasonry();
}
