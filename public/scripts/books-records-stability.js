/* Keep Records stable when the legacy Insights renderer responds to filters. */
(() => {
  const RETRIES = 140;
  const RESTORE_DELAY = 80;
  const SETTLE_DELAY = 90;

  function start(attempt = 0) {
    const view = document.querySelector('#books-insights-view');
    const button = document.querySelector('[data-books-expansion-view="insights"]');
    const metrics = view?.querySelector('[data-insights-metrics]');
    const content = view?.querySelector('[data-insights-content]');

    if ((!view || !button || !metrics || !content || !document.body.dataset.booksRecordsReady) && attempt < RETRIES) {
      window.setTimeout(() => start(attempt + 1), 80);
      return;
    }
    if (!view || !button || !metrics || !content || document.body.dataset.booksRecordsStabilityReady) return;
    document.body.dataset.booksRecordsStabilityReady = 'true';

    let restoreTimer = 0;
    let restoring = false;

    const hasLegacyInsights = () => Boolean(content.querySelector('.books-insight-panel'));

    const setTransitionState = (active) => {
      [metrics, content].forEach((element) => {
        if (active) element.style.visibility = 'hidden';
        else element.style.removeProperty('visibility');
      });
      if (active) view.setAttribute('aria-busy', 'true');
      else view.removeAttribute('aria-busy');
    };

    const observer = new MutationObserver(() => {
      window.clearTimeout(restoreTimer);

      if (view.hidden || button.getAttribute('aria-pressed') !== 'true') {
        setTransitionState(false);
        return;
      }

      if (!hasLegacyInsights()) {
        setTransitionState(false);
        return;
      }

      /* Hide the obsolete dashboard before the browser paints it. */
      setTransitionState(true);

      restoreTimer = window.setTimeout(() => {
        if (restoring || view.hidden || button.getAttribute('aria-pressed') !== 'true' || !hasLegacyInsights()) {
          if (!hasLegacyInsights()) setTransitionState(false);
          return;
        }

        restoring = true;
        observer.disconnect();

        /*
         * The existing view button first invokes the old renderer and then the
         * Records renderer. Disconnecting here prevents that intentional
         * one-time handoff from recursively triggering another click.
         */
        button.click();
        setTransitionState(true);

        window.setTimeout(() => {
          restoring = false;
          observer.observe(content, { childList: true, subtree: true });
          setTransitionState(hasLegacyInsights());

          /* A slow device may need one final guarded pass. */
          if (hasLegacyInsights()) {
            content.append(document.createComment('records-render-retry'));
          }
        }, SETTLE_DELAY);
      }, RESTORE_DELAY);
    });

    observer.observe(content, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => start(), { once: true });
  } else {
    start();
  }
})();
