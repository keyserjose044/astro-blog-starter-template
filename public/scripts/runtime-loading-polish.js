(() => {
  const INITIAL_LOADING = /^(?:—|loading\b|connecting\b|preparing\b)/i;

  function bindInitialTextSkeleton(node) {
    if (!node || node.dataset.runtimeSkeletonBound === 'true') return;
    const initial = String(node.textContent || '').trim();
    if (!INITIAL_LOADING.test(initial)) return;

    node.dataset.runtimeSkeletonBound = 'true';
    node.classList.add('ll-runtime-skeleton-text');

    const observer = new MutationObserver(() => {
      node.classList.remove('ll-runtime-skeleton-text');
      observer.disconnect();
    });
    observer.observe(node, { childList: true, characterData: true, subtree: true });
  }

  function bindDayExplorer() {
    const root = document.querySelector('[data-day-explorer]');
    if (!root || root.dataset.runtimeLoadingPolishBound === 'true') return;
    root.dataset.runtimeLoadingPolishBound = 'true';

    const sync = () => root.classList.toggle('ll-runtime-loading', root.getAttribute('aria-busy') === 'true');
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ['aria-busy'] });
  }

  function bindKnownRuntimeValues(root = document) {
    root.querySelectorAll?.([
      '[data-card-year]',
      '[data-card-peak]',
      '[data-live-lifetime]',
      '[data-live-year]',
      '[data-live-active]',
      '[data-live-best-month]',
      '[data-live-last]',
      '[data-detail-lifetime]',
      '[data-detail-year]',
      '[data-detail-active]',
      '[data-detail-best-day]',
      '[data-detail-best-month]',
      '[data-detail-streak]',
      '[data-detail-recent]',
      '[data-detail-current-streak]',
      '[data-detail-best-year]',
    ].join(',')).forEach(bindInitialTextSkeleton);
  }

  function boot() {
    bindDayExplorer();
    bindKnownRuntimeValues();

    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          bindKnownRuntimeValues(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
