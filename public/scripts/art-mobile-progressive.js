(() => {
  const MOBILE_QUERY = window.matchMedia('(max-width: 900px)');
  const INITIAL_LIMIT = 40;
  const BATCH_SIZE = 28;

  function boot(attempt = 0) {
    const grid = document.querySelector('#art-grid');
    if (!grid) {
      if (attempt < 80) window.setTimeout(() => boot(attempt + 1), 75);
      return;
    }
    if (document.body.dataset.artMobileProgressiveReady === 'true') return;
    document.body.dataset.artMobileProgressiveReady = 'true';

    let limit = INITIAL_LIMIT;
    let frame = 0;

    const controls = document.createElement('div');
    controls.className = 'mobile-progress-controls mobile-progress-controls--art';
    controls.hidden = true;
    controls.innerHTML = `
      <p class="mobile-progress-status" aria-live="polite"></p>
      <button type="button" class="mobile-progress-more">Load more artworks</button>
      <span class="mobile-progress-sentinel" aria-hidden="true"></span>
    `;
    grid.after(controls);

    const status = controls.querySelector('.mobile-progress-status');
    const more = controls.querySelector('.mobile-progress-more');
    const sentinel = controls.querySelector('.mobile-progress-sentinel');

    const allCards = () => Array.from(grid.querySelectorAll('.art-card'));
    const eligibleCards = () => allCards().filter((card) => card.style.display !== 'none');
    const isList = () => grid.dataset.artView === 'list';

    function sync() {
      frame = 0;
      const cards = allCards();

      if (!MOBILE_QUERY.matches || !isList() || grid.hidden) {
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

      const hasMore = mounted < eligible.length;
      controls.hidden = !hasMore;
      if (status) {
        status.textContent = hasMore
          ? `${mounted.toLocaleString('en-US')} of ${eligible.length.toLocaleString('en-US')} matching artworks shown`
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
      if (!MOBILE_QUERY.matches || !isList()) return;
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
      '#art-search',
      '#art-artist-filter',
      '#art-movement-filter',
      '#art-medium-filter',
      '#art-country-filter',
      '#art-viewed-year-filter',
      '#art-period-filter',
      '#art-sort',
    ];

    document.addEventListener('input', (event) => {
      if (event.target?.matches?.(resetSelectors.join(','))) resetLimit();
    });
    document.addEventListener('change', (event) => {
      if (event.target?.matches?.(resetSelectors.join(','))) resetLimit();
    });
    document.addEventListener('click', (event) => {
      if (event.target?.closest?.('#art-clear-filters,[data-art-view]')) {
        window.setTimeout(resetLimit, 0);
      }
    });

    const mutationObserver = new MutationObserver((records) => {
      if (records.some((record) => record.type === 'childList' || record.attributeName === 'style' || record.attributeName === 'hidden' || record.attributeName === 'data-art-view')) {
        scheduleSync();
      }
    });
    mutationObserver.observe(grid, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'hidden', 'data-art-view'],
    });

    const onViewportChange = () => {
      limit = INITIAL_LIMIT;
      sync();
    };
    if (typeof MOBILE_QUERY.addEventListener === 'function') MOBILE_QUERY.addEventListener('change', onViewportChange);
    else MOBILE_QUERY.addListener(onViewportChange);

    window.setTimeout(sync, 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => boot(), { once: true });
  } else {
    boot();
  }
})();
