const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const getColumnCount = (width) => {
  if (width >= 1560) return 6;
  if (width >= 1280) return 5;
  if (width >= 1000) return 4;
  if (width >= 720) return 3;
  if (width >= 430) return 2;
  return 1;
};

function simplifySubtitle() {
  const hint = $('.art-hint');
  if (!hint) return;

  hint.childNodes.forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.includes('recorded movements')) return;
    node.textContent = node.textContent.replace(/\s+across\s+[\d,]+\s+recorded movements\./i, '.');
  });
}

function waitForImage(image) {
  if (!image) return Promise.resolve();
  if (image.complete && image.naturalWidth > 0) {
    return typeof image.decode === 'function' ? image.decode().catch(() => undefined) : Promise.resolve();
  }

  return new Promise((resolve) => {
    const finish = () => resolve();
    image.addEventListener('load', finish, { once: true });
    image.addEventListener('error', finish, { once: true });
  });
}

function bootStableGallery() {
  simplifySubtitle();

  const grid = $('#art-grid');
  if (!grid) return;

  const allCards = $$('.art-card', grid);
  if (!allCards.length) {
    grid.classList.add('art-gallery-ready');
    return;
  }

  let orderedCards = [...allCards];
  let currentColumnCount = 0;
  let layoutTimer = 0;
  let resizeTimer = 0;
  let revealToken = 0;

  const observer = new MutationObserver((records) => {
    const viewChanged = records.some((record) => record.type === 'attributes' && record.attributeName === 'data-art-view');
    const cardsChanged = records.some((record) => record.type === 'childList');
    const filtersChanged = records.some((record) => record.type === 'attributes' && record.attributeName === 'style');

    if (grid.dataset.artView !== 'gallery') {
      grid.classList.remove('art-gallery-pending');
      grid.classList.add('art-gallery-ready');

      const directCards = Array.from(grid.children).filter((child) => child.classList?.contains('art-card'));
      if (directCards.length === allCards.length) orderedCards = directCards;
      return;
    }

    if (viewChanged || cardsChanged || filtersChanged) {
      grid.classList.add('art-gallery-pending');
      grid.classList.remove('art-gallery-ready');
      scheduleLayout(cardsChanged ? 35 : 70, false);
    }
  });

  const beginObserving = () => observer.observe(grid, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-art-view', 'style'],
  });

  const reveal = (token) => {
    if (token !== revealToken) return;
    grid.classList.remove('art-gallery-pending');
    grid.classList.add('art-gallery-ready');
    grid.removeAttribute('aria-busy');
  };

  const revealAfterLeadImages = (columns) => {
    const token = ++revealToken;
    const visibleCards = orderedCards.filter((card) => card.style.display !== 'none');
    const leadCards = visibleCards.slice(0, Math.min(visibleCards.length, columns * 3));
    const leadImages = leadCards.map((card) => $('.art-cover', card)).filter(Boolean);

    leadImages.forEach((image, index) => {
      image.loading = 'eager';
      if (index < columns) image.fetchPriority = 'high';
    });

    const timeout = new Promise((resolve) => setTimeout(resolve, 1600));
    Promise.race([
      Promise.allSettled(leadImages.map(waitForImage)),
      timeout,
    ]).then(() => reveal(token));
  };

  const layoutGallery = (waitForImages) => {
    if (grid.dataset.artView !== 'gallery') return;

    observer.disconnect();

    const directCards = Array.from(grid.children).filter((child) => child.classList?.contains('art-card'));
    if (directCards.length === allCards.length) orderedCards = directCards;

    const columns = getColumnCount(grid.getBoundingClientRect().width || window.innerWidth);
    currentColumnCount = columns;

    const visibleCards = orderedCards.filter((card) => card.style.display !== 'none');
    const hiddenCards = orderedCards.filter((card) => card.style.display === 'none');
    const columnElements = Array.from({ length: columns }, () => {
      const column = document.createElement('div');
      column.className = 'art-masonry-column';
      column.setAttribute('role', 'presentation');
      return column;
    });

    grid.replaceChildren(...columnElements);
    visibleCards.forEach((card, index) => columnElements[index % columns].append(card));
    hiddenCards.forEach((card, index) => columnElements[index % columns].append(card));

    grid.classList.add('art-gallery-stable');
    grid.setAttribute('aria-busy', 'true');
    beginObserving();

    if (waitForImages) revealAfterLeadImages(columns);
    else requestAnimationFrame(() => reveal(++revealToken));
  };

  function scheduleLayout(delay = 50, waitForImages = false) {
    window.clearTimeout(layoutTimer);
    layoutTimer = window.setTimeout(() => layoutGallery(waitForImages), delay);
  }

  grid.classList.add('art-gallery-pending');
  grid.classList.remove('art-gallery-ready');
  layoutGallery(true);

  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (grid.dataset.artView !== 'gallery') return;
      const nextCount = getColumnCount(grid.getBoundingClientRect().width || window.innerWidth);
      if (nextCount === currentColumnCount) return;
      grid.classList.add('art-gallery-pending');
      grid.classList.remove('art-gallery-ready');
      layoutGallery(false);
    }, 160);
  }, { passive: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootStableGallery, { once: true });
} else {
  bootStableGallery();
}
