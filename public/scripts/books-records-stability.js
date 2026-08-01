/* Keep the Records replacement on top of the legacy Insights renderer after live filter updates. */
(() => {
  const RETRIES = 140;

  function start(attempt = 0) {
    const view = document.querySelector('#books-insights-view');
    const button = document.querySelector('[data-books-expansion-view="insights"]');
    const content = view?.querySelector('[data-insights-content]');

    if ((!view || !button || !content || !document.body.dataset.booksRecordsReady) && attempt < RETRIES) {
      window.setTimeout(() => start(attempt + 1), 80);
      return;
    }
    if (!view || !button || !content || document.body.dataset.booksRecordsStabilityReady) return;
    document.body.dataset.booksRecordsStabilityReady = 'true';

    let timer = 0;
    const restoreRecords = () => {
      if (view.hidden || button.getAttribute('aria-pressed') !== 'true') return;
      if (!content.querySelector('.books-insight-panel') && content.classList.contains('books-records-dashboard')) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => button.click(), 0);
    };

    const observer = new MutationObserver(restoreRecords);
    observer.observe(content, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => start(), { once: true });
  } else {
    start();
  }
})();
