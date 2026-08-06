/* LifeLoggerz Classical Music — small presentation adapter for the consolidated runtime.
   Keeps responsive controls and composer-card return context separate from the core data/view controller. */

const CLASSICAL_RUNTIME_UI_RETRIES = 240;

function runtimeUiMonthYear(ms) {
  const date = new Date(Number(ms || 0));
  if (!ms || Number.isNaN(date.getTime())) return 'Not yet';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function bootClassicalRuntimeUi(attempt = 0) {
  const runtimeReady = Boolean(document.body.dataset.classicalRuntimeReady);
  const composerGrid = document.querySelector('#composer-grid');
  const toolbar = document.querySelector('.works-toolbar');
  const repeatShell = toolbar?.querySelector('.classical-repeat-select');

  if ((!runtimeReady || !composerGrid || !toolbar || !repeatShell) && attempt < CLASSICAL_RUNTIME_UI_RETRIES) {
    window.setTimeout(() => bootClassicalRuntimeUi(attempt + 1), 50);
    return;
  }
  if (!runtimeReady || !composerGrid || !toolbar || !repeatShell || document.body.dataset.classicalRuntimeUiReady) return;
  document.body.dataset.classicalRuntimeUiReady = 'true';

  const workItems = Array.from(document.querySelectorAll('[data-work-item]'));

  /* Desktop composer cards keep the compact return-behavior line. Mobile already has
     the fourth 2×2 dashboard cell, and existing CSS hides this quickline there. */
  composerGrid.querySelectorAll('.composer-card[data-composer-id]').forEach((card) => {
    if (Number(card.dataset.entries || 0) <= 0) return;
    const body = card.querySelector('.card-body');
    if (!body || body.querySelector('.classical-card-quickline')) return;

    const composerId = card.dataset.composerId || '';
    const composerWorks = workItems.filter((item) => item.dataset.composer === composerId);
    const repeatedWorks = composerWorks.filter((item) => Number(item.dataset.listens || 1) > 1);
    const repeatListens = repeatedWorks.reduce(
      (sum, item) => sum + Math.max(0, Number(item.dataset.listens || 1) - 1),
      0,
    );
    const latest = runtimeUiMonthYear(card.dataset.lastListened);

    const quickline = document.createElement('span');
    quickline.className = 'classical-card-quickline';
    quickline.innerHTML = `
      <span>↻ <b>${repeatedWorks.length.toLocaleString('en-US')}</b> repeated</span>
      ${repeatListens ? `<span><b>${repeatListens.toLocaleString('en-US')}</b> return listens</span>` : ''}
      <span>Latest <b>${latest}</b></span>
    `;
    body.append(quickline);
  });

  /* On phones, keep Works readable as Search + Filters + Sort. Dense filters live in
     one expandable panel; desktop retains the complete toolbar in one row. */
  if (!toolbar.querySelector('.classical-mobile-filters-toggle')) {
    const search = document.querySelector('#works-search');
    const sort = document.querySelector('#works-sort');
    const composer = document.querySelector('#works-composer-filter');
    const period = document.querySelector('#works-period-filter');
    const form = document.querySelector('#works-form-filter');
    const rating = document.querySelector('#works-rating-filter');
    const nativeRepeat = document.querySelector('#works-repeat-filter');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'classical-mobile-filters-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span>Filters</span><b data-mobile-filter-count>0</b>';

    const panel = document.createElement('div');
    panel.className = 'classical-mobile-filters-panel';
    [composer, period, form, rating, repeatShell].filter(Boolean).forEach((control) => panel.append(control));

    if (search) search.insertAdjacentElement('afterend', toggle);
    else toolbar.prepend(toggle);
    if (sort) toggle.insertAdjacentElement('afterend', sort);
    toolbar.append(panel);

    const mobileQuery = window.matchMedia('(max-width: 700px)');
    let mobileOpen = false;

    function countActive() {
      const count = [composer?.value, period?.value, form?.value, rating?.value, nativeRepeat?.value]
        .filter(Boolean).length;
      const badge = toggle.querySelector('[data-mobile-filter-count]');
      if (badge) badge.textContent = String(count);
      toggle.classList.toggle('has-active-filters', count > 0);
    }

    function syncViewport() {
      if (mobileQuery.matches) {
        panel.hidden = !mobileOpen;
        toggle.setAttribute('aria-expanded', String(mobileOpen));
      } else {
        panel.hidden = false;
        toggle.setAttribute('aria-expanded', 'true');
      }
    }

    toggle.addEventListener('click', () => {
      mobileOpen = !mobileOpen;
      syncViewport();
    });
    [composer, period, form, rating, nativeRepeat].forEach((control) => control?.addEventListener('change', countActive));
    document.querySelector('#clear-work-filters')?.addEventListener('click', () => window.setTimeout(countActive, 0));
    mobileQuery.addEventListener?.('change', () => {
      if (mobileQuery.matches) mobileOpen = false;
      syncViewport();
    });

    countActive();
    syncViewport();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalRuntimeUi(), { once: true });
} else {
  bootClassicalRuntimeUi();
}
