/* LifeLoggerz Classical Music — v9 cleanup.
   Removes the failed extra insight rows and keeps exactly one Daily Listening agenda. */

const CLASSICAL_FIXES_V9_RETRIES = 240;

function bootClassicalFixesV9(attempt = 0) {
  const v7Ready = document.body.dataset.classicalFixesV7Ready === 'true';
  const overview = document.querySelector('[data-page-panel="overview"]');
  const calendar = document.querySelector('[data-page-panel="calendar"]');

  if ((!v7Ready || !overview || !calendar) && attempt < CLASSICAL_FIXES_V9_RETRIES) {
    window.setTimeout(() => bootClassicalFixesV9(attempt + 1), 75);
    return;
  }
  if (!v7Ready || !overview || !calendar || document.body.dataset.classicalFixesV9Ready) return;
  document.body.dataset.classicalFixesV9Ready = 'true';

  function cleanComposerInsights() {
    /* v7 experimented with four extra JS-created rows. They did not inherit Astro's
       scoped chart styling, and the better desktop solution is simply to let the
       Composer Insights card size to its own content instead of stretching to match
       Recently Heard. */
    overview.querySelectorAll('.classical-v7-insight-extra').forEach((row) => row.remove());
  }

  function dedupeDailyListening() {
    const shell = calendar.querySelector('.classical-calendar-shell');
    const grid = shell?.querySelector('.classical-calendar-grid');
    if (!shell || !grid) return;

    const agendas = Array.from(shell.querySelectorAll('.classical-calendar-agenda'));
    if (!agendas.length) return;

    let heading = shell.querySelector('.classical-agenda-heading');
    let keep = heading?.nextElementSibling?.matches('.classical-calendar-agenda')
      ? heading.nextElementSibling
      : agendas.at(-1);

    agendas.forEach((agenda) => {
      if (agenda !== keep) agenda.remove();
    });

    if (!heading) {
      heading = document.createElement('div');
      heading.className = 'classical-agenda-heading';
      heading.innerHTML = '<h3>Daily Listening</h3><p>The same month as an expanded day-by-day list.</p>';
    }

    /* One canonical order only: Calendar grid -> heading -> agenda. */
    grid.insertAdjacentElement('afterend', heading);
    heading.insertAdjacentElement('afterend', keep);
    keep.classList.add('classical-calendar-agenda--mainstay');
    keep.removeAttribute('hidden');

    /* Defensive cleanup for any orphaned agenda-day rows left behind by an older
       agenda implementation. The only valid agenda-day rows live inside `keep`. */
    Array.from(shell.children).forEach((child) => {
      if (child === keep || child === heading || child === grid) return;
      if (child.classList?.contains('classical-calendar-agenda-day')) child.remove();
    });
  }

  cleanComposerInsights();
  dedupeDailyListening();

  let timer = 0;
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      cleanComposerInsights();
      dedupeDailyListening();
    }, 35);
  });
  observer.observe(overview, { childList: true, subtree: true });
  observer.observe(calendar, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalFixesV9(), { once: true });
} else {
  bootClassicalFixesV9();
}
