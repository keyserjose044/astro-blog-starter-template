/* Keep Timeline Selection visible before a release/listening period is chosen. */

import('./albums-listening-log.js?v=20260801-2058')
  .then(() => import('./albums-listening-log-identity.js?v=20260802-0945'))
  .then(() => import('./albums-listening-log-titles-identity.js?v=20260802-0945'))
  .then(() => import('./albums-repeated-thumbnails.js?v=20260802-1115'))
  .catch((error) => {
    console.warn('[Albums] Listening Log modules could not be loaded:', error);
  });

const ALBUMS_TIMELINE_SELECTION_RETRIES = 160;

function bootAlbumsTimelineSelectionEmpty(attempt = 0) {
  const explorer = document.querySelector('#albums-explorer');
  const timelineView = document.querySelector('#albums-timeline-view');
  const sharedShelf = document.querySelector('#albums-selection-shelf');
  const viewToggle = document.querySelector('#album-view-toggle');
  const yearFilter = document.querySelector('#album-listened-year-filter');
  const releaseFilter = document.querySelector('#album-release-filter');
  const clearFilters = document.querySelector('#albums-clear-filters');
  const selectionClear = document.querySelector('#albums-selection-clear');

  const ready = explorer && timelineView && sharedShelf && viewToggle && yearFilter && releaseFilter;
  if (!ready && attempt < ALBUMS_TIMELINE_SELECTION_RETRIES) {
    window.setTimeout(() => bootAlbumsTimelineSelectionEmpty(attempt + 1), 75);
    return;
  }
  if (!ready || document.body.dataset.albumsTimelineSelectionEmptyReady) return;
  document.body.dataset.albumsTimelineSelectionEmptyReady = 'true';

  let emptyShelf = document.querySelector('#albums-timeline-empty-selection');
  if (!emptyShelf) {
    emptyShelf = document.createElement('section');
    emptyShelf.id = 'albums-timeline-empty-selection';
    emptyShelf.className = 'albums-selection-shelf';
    emptyShelf.setAttribute('aria-live', 'polite');
    emptyShelf.innerHTML = `
      <div class="albums-selection-heading">
        <div>
          <p class="albums-eyebrow albums-selection-eyebrow">Timeline selection</p>
          <h3>Select a period to view its albums</h3>
          <p></p>
        </div>
      </div>
      <div class="albums-selection-grid">
        <p class="albums-selection-empty">Select a release period or listening period above.</p>
      </div>
    `;
    sharedShelf.before(emptyShelf);
  }

  let syncFrame = 0;

  function timelineMode() {
    return timelineView.querySelector('[data-timeline-mode][aria-pressed="true"]')?.dataset.timelineMode || 'release';
  }

  function hasTimelineSelection() {
    const mode = timelineMode();
    if (mode === 'listening') return Boolean(yearFilter.value);
    return Boolean(releaseFilter.value);
  }

  function sync() {
    const timelineActive = !explorer.hidden && !timelineView.hidden;
    emptyShelf.hidden = !(timelineActive && !hasTimelineSelection());
  }

  function queueSync() {
    window.cancelAnimationFrame(syncFrame);
    syncFrame = window.requestAnimationFrame(sync);
    window.setTimeout(sync, 40);
  }

  timelineView.addEventListener('click', queueSync);
  yearFilter.addEventListener('change', queueSync);
  releaseFilter.addEventListener('change', queueSync);
  viewToggle.addEventListener('click', queueSync);
  clearFilters?.addEventListener('click', queueSync);
  selectionClear?.addEventListener('click', queueSync);

  const visibilityObserver = new MutationObserver(queueSync);
  visibilityObserver.observe(explorer, { attributes: true, attributeFilter: ['hidden'] });
  visibilityObserver.observe(timelineView, { attributes: true, attributeFilter: ['hidden'] });
  timelineView.querySelectorAll('[data-timeline-mode]').forEach((button) => {
    visibilityObserver.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] });
  });

  sync();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsTimelineSelectionEmpty(), { once: true });
} else {
  bootAlbumsTimelineSelectionEmpty();
}
