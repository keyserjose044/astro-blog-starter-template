const QUILT_PATTERN = [
  'hero', 'tall', 'wide', 'portrait', 'square', 'wide',
  'tall', 'square', 'hero', 'portrait', 'wide', 'square',
  'tall', 'wide', 'portrait', 'square', 'hero', 'wide',
];

function bootArtGalleryQuilt() {
  const grid = document.querySelector('#art-grid');
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll('.art-card'));
  cards.forEach((card, fallbackIndex) => {
    const parsedIndex = Number(card.dataset.originalIndex);
    const originalIndex = Number.isFinite(parsedIndex) ? parsedIndex : fallbackIndex;

    card.style.setProperty('--gallery-order', String(originalIndex));
    card.dataset.gallerySize = QUILT_PATTERN[originalIndex % QUILT_PATTERN.length];
  });

  const galleryButton = document.querySelector('[data-art-view="gallery"]');
  if (galleryButton) {
    galleryButton.title = 'Visual quilt. Switch to List for chronological or alphabetical sorting.';
  }

  const browsingCopy = Array.from(document.querySelectorAll('#art-info p')).find((paragraph) =>
    paragraph.textContent?.trim().startsWith('Gallery provides')
  );

  if (browsingCopy) {
    browsingCopy.textContent = 'Gallery is arranged as a visual quilt for discovery. List is the sortable archive. Artists groups the collection by creator. Timeline moves between art history and my viewing journey. World Map uses the recorded country or nationality field when it can be matched confidently.';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootArtGalleryQuilt, { once: true });
} else {
  bootArtGalleryQuilt();
}
