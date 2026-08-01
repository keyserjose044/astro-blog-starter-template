/* Desktop Reading Journey drill-down placement — August 1, 2026.
 * Mirrors the existing Year Overview / Month Detail state directly below the
 * Full Reading Log heatmap, matching the mobile information hierarchy.
 */

const BOOKS_TIMELINE_DESKTOP_ZOOM_RETRIES = 180;

function bootBooksTimelineDesktopZoom(attempt = 0) {
  const timelineView = document.querySelector('#books-timeline-view');
  const insightsHost = timelineView?.querySelector('.books-timeline-insights-stable-host');
  const source = timelineView?.querySelector('.books-timeline-controls .books-timeline-zoom');

  if ((!timelineView || !insightsHost || !source) && attempt < BOOKS_TIMELINE_DESKTOP_ZOOM_RETRIES) {
    window.setTimeout(() => bootBooksTimelineDesktopZoom(attempt + 1), 80);
    return;
  }
  if (!timelineView || !insightsHost || !source || document.body.dataset.booksTimelineDesktopZoomReady) return;
  document.body.dataset.booksTimelineDesktopZoomReady = 'true';

  const desktopQuery = window.matchMedia('(min-width: 901px)');
  let proxy = null;

  function readingActive() {
    return timelineView.querySelector('[data-timeline-mode="reading"]')?.getAttribute('aria-pressed') === 'true';
  }

  function syncPressedState() {
    if (!proxy) return;
    proxy.querySelectorAll('[data-desktop-reading-zoom]').forEach((button) => {
      const sourceButton = source.querySelector(`[data-reading-zoom="${button.dataset.desktopReadingZoom}"]`);
      const pressed = sourceButton?.getAttribute('aria-pressed') === 'true' ? 'true' : 'false';
      if (button.getAttribute('aria-pressed') !== pressed) button.setAttribute('aria-pressed', pressed);
    });
  }

  function removeProxy() {
    proxy?.remove();
    proxy = null;
  }

  function ensureProxy() {
    if (!desktopQuery.matches || !readingActive()) {
      removeProxy();
      return;
    }

    const readingInsights = insightsHost.querySelector('[data-books-timeline-insights="reading"]');
    if (!readingInsights) {
      removeProxy();
      return;
    }

    if (!proxy) {
      proxy = document.createElement('div');
      proxy.className = 'books-timeline-zoom books-timeline-desktop-zoom-proxy';
      proxy.setAttribute('role', 'group');
      proxy.setAttribute('aria-label', 'Reading timeline detail');
      proxy.innerHTML = '<button type="button" data-desktop-reading-zoom="year">Year overview</button><button type="button" data-desktop-reading-zoom="month">Month detail</button>';
      proxy.addEventListener('click', (event) => {
        const button = event.target.closest('[data-desktop-reading-zoom]');
        if (!button) return;
        source.querySelector(`[data-reading-zoom="${button.dataset.desktopReadingZoom}"]`)?.click();
        window.setTimeout(syncPressedState, 30);
      });
    }

    if (proxy.previousElementSibling !== insightsHost) {
      insightsHost.insertAdjacentElement('afterend', proxy);
    }
    syncPressedState();
  }

  timelineView.addEventListener('click', (event) => {
    if (event.target.closest('[data-timeline-mode], [data-reading-zoom], [data-reading-year], [data-reading-month]')) {
      window.setTimeout(ensureProxy, 40);
    }
  });

  const observer = new MutationObserver(() => window.setTimeout(ensureProxy, 0));
  observer.observe(insightsHost, { childList: true, subtree: true });
  observer.observe(timelineView, { attributes: true, subtree: true, attributeFilter: ['aria-pressed', 'hidden'] });

  if (typeof desktopQuery.addEventListener === 'function') desktopQuery.addEventListener('change', ensureProxy);
  else desktopQuery.addListener(ensureProxy);

  ensureProxy();
  window.setTimeout(ensureProxy, 180);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksTimelineDesktopZoom(), { once: true });
} else {
  bootBooksTimelineDesktopZoom();
}
