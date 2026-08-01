/* LifeLoggerz Books shareable URL state — August 1, 2026.
 * Keeps the normal no-query experience untouched, but makes an actively chosen
 * view/filter/month/timeline state copyable and restorable from the URL.
 */

const BOOKS_URL_STATE_RETRIES = 180;

function bootBooksUrlState(attempt = 0) {
  const viewToggle = document.querySelector('#book-view-toggle');
  const grid = document.querySelector('#grid');
  if ((!viewToggle || !grid) && attempt < BOOKS_URL_STATE_RETRIES) {
    window.setTimeout(() => bootBooksUrlState(attempt + 1), 70);
    return;
  }
  if (!viewToggle || !grid || document.body.dataset.booksUrlStateReady) return;

  const requestedView = new URL(window.location.href).searchParams.get('view');
  const requestedSelector = viewSelector(requestedView);
  if (requestedView && requestedSelector && !document.querySelector(requestedSelector) && attempt < BOOKS_URL_STATE_RETRIES) {
    window.setTimeout(() => bootBooksUrlState(attempt + 1), 70);
    return;
  }

  document.body.dataset.booksUrlStateReady = 'true';

  const controls = {
    q: document.querySelector('#q'),
    genre: document.querySelector('#genre-filter'),
    year: document.querySelector('#year-filter'),
    period: document.querySelector('#period-filter'),
    language: document.querySelector('#language-filter'),
    country: document.querySelector('#country-filter'),
    sort: document.querySelector('#sort-books'),
    month: document.querySelector('[data-calendar-month]'),
  };

  let applying = false;
  let urlTimer = 0;
  let searchTimer = 0;

  function viewSelector(view) {
    const selectors = {
      list: '[data-book-view="list"]',
      quilt: '[data-book-view="quilt"]',
      world: '[data-atlas-view="map"]',
      timeline: '[data-atlas-view="timeline"]',
      calendar: '[data-calendar-view="completion"]',
      authors: '[data-books-expansion-view="authors"]',
      records: '[data-books-expansion-view="records"]',
    };
    return selectors[String(view || '').toLowerCase()] || '';
  }

  function buttonView(button) {
    if (!button) return '';
    if (button.dataset.bookView === 'list' || button.dataset.bookView === 'quilt') return button.dataset.bookView;
    if (button.dataset.atlasView === 'map') return 'world';
    if (button.dataset.atlasView === 'timeline') return 'timeline';
    if (button.dataset.calendarView) return 'calendar';
    if (button.dataset.booksExpansionView === 'authors') return 'authors';
    if (button.dataset.booksExpansionView === 'records') return 'records';
    return '';
  }

  function activeView() {
    const active = viewToggle.querySelector('.view-button[aria-pressed="true"]');
    return buttonView(active) || (grid.dataset.bookView === 'quilt' ? 'quilt' : 'list');
  }

  function chooseOption(control, requested) {
    if (!control || requested === null) return false;
    const wanted = String(requested);
    const exact = Array.from(control.options || []).find((option) => option.value === wanted);
    const insensitive = exact || Array.from(control.options || []).find((option) => option.value.toLowerCase() === wanted.toLowerCase());
    if (!insensitive) return false;
    control.value = insensitive.value;
    return true;
  }

  function dispatch(control, type = 'change') {
    if (!control) return;
    control.dispatchEvent(new Event(type, { bubbles: true }));
  }

  function setOrDelete(params, key, value, defaultValue = '') {
    const normalized = String(value ?? '').trim();
    if (!normalized || normalized === defaultValue) params.delete(key);
    else params.set(key, normalized);
  }

  function writeUrlNow() {
    if (applying) return;
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const view = activeView();

    setOrDelete(params, 'view', view);
    setOrDelete(params, 'q', controls.q?.value);
    setOrDelete(params, 'genre', controls.genre?.value);
    setOrDelete(params, 'year', controls.year?.value);
    setOrDelete(params, 'period', controls.period?.value);
    setOrDelete(params, 'language', controls.language?.value);
    setOrDelete(params, 'country', controls.country?.value);
    setOrDelete(params, 'sort', controls.sort?.value, 'date-desc');

    if (view === 'calendar') setOrDelete(params, 'month', controls.month?.value);
    else params.delete('month');

    if (view === 'timeline') {
      const timelineMode = document.querySelector('[data-timeline-mode][aria-pressed="true"]')?.dataset.timelineMode || '';
      setOrDelete(params, 'timeline', timelineMode, 'publication');
    } else {
      params.delete('timeline');
    }

    window.history.replaceState(null, '', `${url.pathname}${params.toString() ? `?${params}` : ''}${url.hash}`);
  }

  function scheduleUrlWrite(delay = 80) {
    if (applying) return;
    window.clearTimeout(urlTimer);
    urlTimer = window.setTimeout(writeUrlNow, delay);
  }

  function applyUrlState() {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    const hasBooksState = ['view', 'q', 'genre', 'year', 'period', 'language', 'country', 'sort', 'month', 'timeline']
      .some((key) => params.has(key));
    if (!hasBooksState) return;

    applying = true;

    if (params.has('q') && controls.q) {
      controls.q.value = params.get('q') || '';
      dispatch(controls.q, 'input');
    }

    ['genre', 'year', 'period', 'language', 'country', 'sort'].forEach((key) => {
      const control = controls[key];
      if (chooseOption(control, params.get(key))) dispatch(control, 'change');
    });

    const view = String(params.get('view') || '').toLowerCase();
    const selector = viewSelector(view);
    const viewButton = selector ? document.querySelector(selector) : null;
    if (viewButton) viewButton.click();

    if (view === 'calendar' && params.has('month') && chooseOption(controls.month, params.get('month'))) {
      dispatch(controls.month, 'change');
    }

    if (view === 'timeline') {
      const mode = params.get('timeline');
      if (mode === 'reading' || mode === 'publication') {
        document.querySelector(`[data-timeline-mode="${mode}"]`)?.click();
      }
    }

    window.setTimeout(() => {
      applying = false;
      writeUrlNow();
    }, 180);
  }

  /* Capture view clicks before individual controllers (Records intentionally
     stops propagation), then read the final pressed state after they finish. */
  document.addEventListener('click', (event) => {
    const viewButton = event.target.closest('#book-view-toggle .view-button');
    if (viewButton) scheduleUrlWrite(120);

    if (event.target.closest('#clear-filters')) scheduleUrlWrite(140);
  }, true);

  document.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches('#genre-filter, #year-filter, #period-filter, #language-filter, #country-filter, #sort-books, [data-calendar-month]')) {
      scheduleUrlWrite(90);
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-timeline-mode]')) scheduleUrlWrite(100);
  });

  controls.q?.addEventListener('input', () => {
    if (applying) return;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => scheduleUrlWrite(0), 220);
  });

  window.addEventListener('popstate', applyUrlState);
  applyUrlState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksUrlState(), { once: true });
} else {
  bootBooksUrlState();
}
