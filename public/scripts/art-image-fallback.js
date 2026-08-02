(() => {
  const IMAGE_SELECTOR = 'img.art-cover[data-cover-fallbacks], img.art-derived-cover[data-cover-fallbacks]';
  const PLACEHOLDER_TOKEN = 'art-placeholder.webp';

  function parseFallbacks(image) {
    try {
      const parsed = JSON.parse(image.dataset.coverFallbacks || '[]');
      return Array.isArray(parsed)
        ? parsed.filter((value) => typeof value === 'string' && value.trim())
        : [];
    } catch {
      return [];
    }
  }

  function updateCard(image, cover, fallbacks) {
    const card = image.closest('.art-card');
    if (!(card instanceof HTMLElement)) return;

    card.dataset.cover = cover;
    card.dataset.coverFallbacks = JSON.stringify(fallbacks);
  }

  function prepareAttempt(image) {
    const card = image.closest('.art-card');
    const figure = image.closest('.art-card-figure');

    image.dataset.fallbackInProgress = 'true';
    image.dataset.fallbackExhausted = 'false';
    image.loading = 'eager';
    image.fetchPriority = 'low';

    if (card instanceof HTMLElement) {
      card.dataset.galleryCoverStatus = 'loading';
    }

    if (figure instanceof HTMLElement) {
      figure.classList.remove('art-image-missing');
    }
  }

  function markMissing(image) {
    const card = image.closest('.art-card');
    const figure = image.closest('.art-card-figure');

    image.dataset.fallbackInProgress = 'false';
    image.dataset.fallbackExhausted = 'true';

    if (card instanceof HTMLElement) {
      card.dataset.galleryCoverStatus = 'missing';
    }

    if (figure instanceof HTMLElement) {
      figure.classList.add('art-image-ready', 'art-image-missing');
    }
  }

  function tryNextImage(image) {
    const fallbacks = parseFallbacks(image);
    const nextUrl = fallbacks.shift();

    image.dataset.coverFallbacks = JSON.stringify(fallbacks);

    if (!nextUrl) {
      markMissing(image);
      return;
    }

    prepareAttempt(image);
    updateCard(image, nextUrl, fallbacks);
    image.src = nextUrl;
  }

  document.addEventListener(
    'error',
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches(IMAGE_SELECTOR)) return;

      event.stopImmediatePropagation();
      tryNextImage(image);
    },
    true
  );

  document.addEventListener(
    'load',
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.matches(IMAGE_SELECTOR)) return;

      image.dataset.fallbackInProgress = 'false';

      const currentUrl = image.currentSrc || image.src || '';
      if (currentUrl.toLowerCase().includes(PLACEHOLDER_TOKEN)) {
        markMissing(image);
        return;
      }

      const card = image.closest('.art-card');
      const figure = image.closest('.art-card-figure');

      if (card instanceof HTMLElement) {
        card.dataset.cover = currentUrl;
        card.dataset.galleryCoverStatus = 'ready';
      }

      if (figure instanceof HTMLElement) {
        figure.classList.remove('art-image-missing');
      }
    },
    true
  );

  function recoverAlreadyFailedImages() {
    document.querySelectorAll(IMAGE_SELECTOR).forEach((element) => {
      if (!(element instanceof HTMLImageElement)) return;
      if (element.complete && element.naturalWidth === 0) {
        tryNextImage(element);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', recoverAlreadyFailedImages, { once: true });
  } else {
    recoverAlreadyFailedImages();
  }
})();

(() => {
  if (document.querySelector('script[data-art-view-polish]')) return;
  const current = document.currentScript?.src || window.location.href;
  const script = document.createElement('script');
  script.type = 'module';
  script.dataset.artViewPolish = 'true';
  script.src = new URL('./art-view-polish.js?v=20260801-2342', current).href;
  document.head.append(script);
})();
