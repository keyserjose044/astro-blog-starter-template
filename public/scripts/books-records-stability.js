/* Give Records one deterministic controller instead of competing with legacy Insights. */
(() => {
  const RETRIES = 140;

  function start(attempt = 0) {
    const grid = document.querySelector('#grid');
    const viewToggle = document.querySelector('#book-view-toggle');
    const explorer = document.querySelector('#books-explorer');
    const calendar = document.querySelector('#books-calendar-view');
    const button = document.querySelector('[data-books-expansion-view="insights"]');
    const view = document.querySelector('#books-insights-view');
    const metrics = view?.querySelector('[data-insights-metrics]');
    const content = view?.querySelector('[data-insights-content]');

    if ((!grid || !viewToggle || !explorer || !calendar || !button || !view || !metrics || !content || !document.body.dataset.booksRecordsReady) && attempt < RETRIES) {
      window.setTimeout(() => start(attempt + 1), 80);
      return;
    }
    if (!grid || !viewToggle || !explorer || !calendar || !button || !view || !metrics || !content || document.body.dataset.booksRecordsControllerReady) return;
    document.body.dataset.booksRecordsControllerReady = 'true';

    const listButton = viewToggle.querySelector('[data-book-view="list"]');
    const mapView = explorer.querySelector('#books-map-view');
    const timelineView = explorer.querySelector('#books-timeline-view');
    const authorsView = explorer.querySelector('#books-authors-view');
    const worldBottom = document.querySelector('[data-bottom-for="world"]');
    const timelineBottom = document.querySelector('[data-bottom-for="timeline"]');

    let recoveryPending = false;

    function requestRecordsRender() {
      content.classList.remove('books-records-dashboard');
      content.append(document.createComment('records-render-request'));
    }

    function showRecords(event) {
      event.preventDefault();
      event.stopImmediatePropagation();

      /* Reset the legacy expansion state without allowing its Insights handler to run. */
      listButton?.click();

      calendar.hidden = true;
      document.body.classList.remove('books-calendar-open');
      explorer.hidden = false;
      grid.hidden = true;
      document.body.classList.add('books-explorer-open');

      if (mapView) mapView.hidden = true;
      if (timelineView) timelineView.hidden = true;
      if (authorsView) authorsView.hidden = true;
      view.hidden = false;
      if (worldBottom) worldBottom.hidden = true;
      if (timelineBottom) timelineBottom.hidden = true;

      viewToggle.querySelectorAll('.view-button').forEach((candidate) => {
        candidate.setAttribute('aria-pressed', candidate === button ? 'true' : 'false');
      });

      metrics.style.removeProperty('visibility');
      content.style.removeProperty('visibility');
      view.removeAttribute('aria-busy');
      requestRecordsRender();
      explorer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /*
     * Capture the click before the older Insights listener sees it. This keeps
     * the legacy renderer's internal state out of Records entirely.
     */
    button.addEventListener('click', showRecords, true);

    /*
     * Defensive recovery for a delayed legacy render already queued before the
     * Records click. Re-render Records directly; never click the view button.
     */
    const observer = new MutationObserver(() => {
      const active = !view.hidden && button.getAttribute('aria-pressed') === 'true';
      const legacyVisible = Boolean(content.querySelector('.books-insight-panel'));
      if (!active || !legacyVisible || recoveryPending) return;

      recoveryPending = true;
      requestRecordsRender();
      window.setTimeout(() => {
        recoveryPending = false;
      }, 120);
    });
    observer.observe(content, { childList: true, subtree: true });

    /* Remove the blanking left behind by the previous guard on a cached page. */
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
