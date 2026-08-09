(() => {
  const PLACEHOLDER = '/images_webp/album-placeholder.webp';
  const SELECTOR = [
    '.albums-page img.album-cover',
    '.albums-page .albums-quilt-tile img',
    '.albums-page .albums-artist-covers img',
    '.albums-page .albums-selection-card img',
    '.albums-page [data-album-preview-image]',
    '.albums-page .albums-calendar-day-dialog img',
  ].join(',');

  const isAlbumImage = (image) =>
    image instanceof HTMLImageElement && image.matches(SELECTOR);

  const usePlaceholder = (image) => {
    if (!isAlbumImage(image)) return;
    if (image.dataset.albumFallbackApplied === 'true') return;
    image.dataset.albumFallbackApplied = 'true';
    image.removeAttribute('srcset');
    image.src = PLACEHOLDER;
  };

  document.addEventListener(
    'error',
    (event) => {
      const image = event.target;
      if (!isAlbumImage(image)) return;
      if ((image.currentSrc || image.src || '').includes('album-placeholder.webp')) return;
      usePlaceholder(image);
    },
    true,
  );

  const recoverAlreadyFailed = () => {
    document.querySelectorAll(SELECTOR).forEach((image) => {
      if (!(image instanceof HTMLImageElement)) return;
      if (image.complete && image.naturalWidth === 0) usePlaceholder(image);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', recoverAlreadyFailed, { once: true });
  } else {
    recoverAlreadyFailed();
  }
})();
