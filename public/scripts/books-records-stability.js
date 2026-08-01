/* Detach Records from the obsolete Insights tab handler. */
(() => {
  const RETRIES = 140;

  function start(attempt = 0) {
    const grid = document.querySelector('#grid');
    const viewToggle = document.querySelector('#book-view-toggle');
    const explorer = document.querySelector('#books-explorer');
    const calendar = document.querySelector('#books-calendar-view');
    const legacyButton = document.querySelector('[data-books-expansion-view="insights"]');
    const view = document.querySelector('#books-insights-view');
    const metrics = view?.querySelector('[data-insights-metrics]');
    const content = view?.querySelector('[data-insights-content]');

    if ((!grid || !viewToggle || !explorer || !calendar || !legacyButton || !view || !metrics || !content || !document.body.dataset.booksRecordsReady) && attempt < RETRIES) {
      window.setTimeout(() => start(attempt + 1), 80);
      return;
    }
    if (!grid || !viewToggle || !explorer || !calendar || !legacyButton || !view || !metrics || !content || document.body.dataset.booksRecordsControllerReady) return;
    document.body.dataset.booksRecordsControllerReady = 'true';

    const mapView = explorer.querySelector('#books-map-view');
    const timelineView = explorer.querySelector('#books-timeline-view');
    const authorsView = explorer.querySelector('#books-authors-view');
    const worldBottom = document.querySelector('[data-bottom-for="world"]');
    const timelineBottom = document.querySelector('[data-bottom-for="timeline"]');

    /*
     * Clone the button after all older scripts have initialized. The replacement
     * keeps its appearance and attributes but none of the obsolete Insights
     * click listeners. The Records renderer retains the detached original as
     * its private state signal.
     */
    const recordsButton = legacyButton.cloneNode(true);
    recordsButton.dataset.booksExpansionView = 'records';
    recordsButton.setAttribute('aria-label', 'Reading records');
    legacyButton.replaceWith(recordsButton);

    let recoveryPending = false;

    function requestRecordsRender(message = 'Loading reading records…') {
      content.className = 'books-records-loading';
      content.innerHTML = `<p>${message}</p>`;
      /* books-records-redesign.js observes this container and renders directly. */
      content.append(document.createComment('records-render-request'));
    }

    function showRecords(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();

      calendar.hidden = true;
      document.body.classList.remove('books-calendar-open');
      explorer.hidden = false;
      grid.hidden = true;
      document.body.classList.add('books-explorer-open');

      explorer.querySelectorAll('.books-explorer-view').forEach((candidate) => {
        candidate.hidden = candidate !== view;
      });
      if (mapView) mapView.hidden = true;
      if (timelineView) timelineView.hidden = true;
      if (authorsView) authorsView.hidden = true;
      view.hidden = false;
      if (worldBottom) worldBottom.hidden = true;
      if (timelineBottom) timelineBottom.hidden = true;

      viewToggle.querySelectorAll('.view-button').forEach((candidate) => {
        candidate.setAttribute('aria-pressed', candidate === recordsButton ? 'true' : 'false');
      });

      /* The Records renderer still references the original detached button. */
      legacyButton.setAttribute('aria-pressed', 'true');
      metrics.style.removeProperty('visibility');
      content.style.removeProperty('visibility');
      view.removeAttribute('aria-busy');
      requestRecordsRender();
      explorer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    recordsButton.addEventListener('click', showRecords);

    /* Keep the detached renderer signal in sync when another view is selected. */
    viewToggle.addEventListener('click', (event) => {
      const selected = event.target.closest('.view-button');
      if (!selected || selected === recordsButton) return;
      legacyButton.setAttribute('aria-pressed', 'false');
      recordsButton.setAttribute('aria-pressed', 'false');
    }, true);

    /*
     * A render queued before the old button was detached may still write the
     * former Insights dashboard once. Replace it by requesting Records directly;
     * never click either tab as a recovery mechanism.
     */
    const observer = new MutationObserver(() => {
      const active = !view.hidden && recordsButton.getAttribute('aria-pressed') === 'true';
      const legacyVisible = Boolean(content.querySelector('.books-insight-panel'));
      if (!active || !legacyVisible || recoveryPending) return;

      recoveryPending = true;
      requestRecordsRender('Refreshing reading records…');
      window.setTimeout(() => {
        recoveryPending = false;
      }, 150);
    });
    observer.observe(content, { childList: true, subtree: true });

    metrics.style.removeProperty('visibility');
    content.style.removeProperty('visibility');
    view.removeAttribute('aria-busy');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => start(), { once: true });
  } else {
    start();
  }
})();
