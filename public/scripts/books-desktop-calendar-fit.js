/* Books desktop Calendar measured cover fitting — August 1, 2026.
 * Size covers from the calendar cells that actually exist on screen rather than
 * from viewport guesses. This keeps full-screen covers generous while ensuring
 * resized desktop windows never crop a cover against the next calendar row.
 */

const BOOKS_DESKTOP_CALENDAR_FIT_RETRIES = 160;

function bootBooksDesktopCalendarFit(attempt = 0) {
  const calendar = document.querySelector('#books-calendar-view');
  const grid = calendar?.querySelector('[data-calendar-grid]');

  if ((!calendar || !grid) && attempt < BOOKS_DESKTOP_CALENDAR_FIT_RETRIES) {
    window.setTimeout(() => bootBooksDesktopCalendarFit(attempt + 1), 80);
    return;
  }
  if (!calendar || !grid || document.body.dataset.booksDesktopCalendarFitReady) return;
  document.body.dataset.booksDesktopCalendarFitReady = 'true';

  const desktopQuery = window.matchMedia('(min-width: 601px) and (hover: hover) and (pointer: fine)');
  let fitFrame = 0;

  function clearFit(cell) {
    cell.style.removeProperty('--calendar-single-cover-width');
    cell.style.removeProperty('--calendar-single-cover-height');
    cell.style.removeProperty('--calendar-stack-cover-width');
    cell.style.removeProperty('--calendar-stack-cover-height');
  }

  function fitCell(cell) {
    if (!desktopQuery.matches) {
      clearFit(cell);
      return;
    }

    const rect = cell.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    /* Cover box = cell minus the 36px date/header zone and 8px bottom inset.
       Dimensions stay 2:3, so the artwork is always completely visible. */
    const availableWidth = Math.max(24, rect.width - 16);
    const availableHeight = Math.max(36, rect.height - 44);

    const singleHeight = Math.floor(Math.min(
      148,
      availableHeight,
      availableWidth * 1.5 * 0.86,
    ));
    const singleWidth = Math.floor(singleHeight * (2 / 3));

    /* A stacked cover is intentionally narrower so the existing fan-out stays
       inside the same cell instead of turning into a full-size overlapping card. */
    const stackHeight = Math.floor(Math.min(
      99,
      availableHeight,
      availableWidth * 1.5 * 0.46,
    ));
    const stackWidth = Math.floor(stackHeight * (2 / 3));

    cell.style.setProperty('--calendar-single-cover-width', `${Math.max(24, singleWidth)}px`);
    cell.style.setProperty('--calendar-single-cover-height', `${Math.max(36, singleHeight)}px`);
    cell.style.setProperty('--calendar-stack-cover-width', `${Math.max(22, stackWidth)}px`);
    cell.style.setProperty('--calendar-stack-cover-height', `${Math.max(33, stackHeight)}px`);
  }

  function fitCalendar() {
    cancelAnimationFrame(fitFrame);
    fitFrame = requestAnimationFrame(() => {
      grid.querySelectorAll('.books-calendar-day').forEach(fitCell);
    });
  }

  const resizeObserver = new ResizeObserver(() => fitCalendar());
  resizeObserver.observe(grid);

  const mutationObserver = new MutationObserver(() => {
    requestAnimationFrame(() => {
      grid.querySelectorAll('.books-calendar-day').forEach((cell) => resizeObserver.observe(cell));
      fitCalendar();
    });
  });
  mutationObserver.observe(grid, { childList: true, subtree: false });

  grid.querySelectorAll('.books-calendar-day').forEach((cell) => resizeObserver.observe(cell));

  if (typeof desktopQuery.addEventListener === 'function') desktopQuery.addEventListener('change', fitCalendar);
  else desktopQuery.addListener(fitCalendar);

  window.addEventListener('resize', fitCalendar, { passive: true });
  fitCalendar();
  window.setTimeout(fitCalendar, 120);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksDesktopCalendarFit(), { once: true });
} else {
  bootBooksDesktopCalendarFit();
}
