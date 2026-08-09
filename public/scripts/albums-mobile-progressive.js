(() => {
  const MOBILE_QUERY = window.matchMedia('(max-width: 900px)');
  const INITIAL_LIMIT = 42;
  const BATCH_SIZE = 30;

  function boot(attempt = 0) {
    const grid = document.querySelector('#albums-grid');
    if (!grid) {
      if (attempt < 80) window.setTimeout(() => boot(attempt + 1), 75);
      return;
    }
    if (document.body.dataset.albumsMobileProgressiveReady === 'true') return;
    document.body.dataset.albumsMobileProgressiveReady = 'true';

    let limit = INITIAL_LIMIT;
    let frame = 0;

    const controls = document.createElement('div');
    controls.className = 'mobile-progress-controls mobile-progress-controls--albums';
    controls.hidden = true;
    controls.innerHTML = `
      <p class="mobile-progress-status" aria-live="polite"></p>
      <button type="button" class="mobile-progress-more">Load more albums</button>
      <span class="mobile-progress-sentinel" aria-hidden="true"></span>
    `;
    grid.after(controls);

    const status = controls.querySelector('.mobile-progress-status');
    const more = controls.querySelector('.mobile-progress-more');
    const sentinel = controls.querySelector('.mobile-progress-sentinel');

    const allCards = () => Array.from(grid.querySelectorAll('.album-card'));
    const eligibleCards = () => allCards().filter((card) => card.style.display !== 'none');

    function sync() {
      frame = 0;
      const cards = allCards();

      if (!MOBILE_QUERY.matches) {
        cards.forEach((card) => card.classList.remove('mobile-progress-hidden'));
        controls.hidden = true;
        delete grid.dataset.mobileMounted;
        delete grid.dataset.mobileEligible;
        return;
      }

      const eligible = eligibleCards();
      const mounted = Math.min(limit, eligible.length);
      const mountedSet = new Set(eligible.slice(0, mounted));

      cards.forEach((card) => {
        if (card.style.display === 'none') {
          card.classList.remove('mobile-progress-hidden');
          return;
        }
        card.classList.toggle('mobile-progress-hidden', !mountedSet.has(card));
      });

      grid.dataset.mobileMounted = String(mounted);
      grid.dataset.mobileEligible = String(eligible.length);

      const gridUnavailable = grid.hidden || grid.getAttribute('aria-hidden') === 'true';
      const hasMore = mounted < eligible.length;
      controls.hidden = gridUnavailable || !hasMore;
      if (status) {
        status.textContent = hasMore
          ? `${mounted.toLocaleString('en-US')} of ${eligible.length.toLocaleString('en-US')} matching albums shown`
          : '';
      }
      if (more) more.hidden = !hasMore;
    }

    function scheduleSync() {
      if (frame) return;
      frame = window.requestAnimationFrame(sync);
    }

    function resetLimit() {
      limit = INITIAL_LIMIT;
      scheduleSync();
    }

    function loadMore() {
      if (!MOBILE_QUERY.matches) return;
      limit += BATCH_SIZE;
      sync();
    }

    more?.addEventListener('click', loadMore);

    const observer = 'IntersectionObserver' in window && sentinel
      ? new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting) && !controls.hidden) loadMore();
        }, { rootMargin: '1200px 0px' })
      : null;
    if (observer && sentinel) observer.observe(sentinel);

    const resetSelectors = [
      '#album-search',
      '#album-style-filter',
      '#album-subgenre-filter',
      '#album-mood-filter',
      '#album-country-filter',
      '#album-listened-year-filter',
      '#album-release-filter',
      '#album-sort',
    ];

    document.addEventListener('input', (event) => {
      if (event.target?.matches?.(resetSelectors.join(','))) resetLimit();
    });
    document.addEventListener('change', (event) => {
      if (event.target?.matches?.(resetSelectors.join(','))) resetLimit();
    });
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('#albums-clear-filters,[data-album-view],.albums-expansion-view-button')) {
        window.setTimeout(resetLimit, 0);
      }
    });

    const mutationObserver = new MutationObserver((records) => {
      if (records.some((record) => record.type === 'childList' || record.attributeName === 'style' || record.attributeName === 'hidden' || record.attributeName === 'data-album-view')) {
        scheduleSync();
      }
    });
    mutationObserver.observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'hidden', 'data-album-view'],
    });

    const onViewportChange = () => {
      limit = INITIAL_LIMIT;
      sync();
    };
    if (typeof MOBILE_QUERY.addEventListener === 'function') MOBILE_QUERY.addEventListener('change', onViewportChange);
    else MOBILE_QUERY.addListener(onViewportChange);

    sync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
  } else {
    boot();
  }
})();
