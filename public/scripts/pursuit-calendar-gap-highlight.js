(() => {
  const root = document.querySelector('[data-pursuit-calendar]');
  if (!root || root.dataset.gapHighlightReady === 'true') return;
  root.dataset.gapHighlightReady = 'true';

  const grid = root.querySelector('[data-calendar-grid]');
  const summary = root.querySelector('.calendar-summary');
  const yearSelect = root.querySelector('[data-calendar-year]');
  if (!grid || !summary) return;

  let highlighted = false;
  let boundCard = null;
  let suppressGridReset = false;

  const currentYear = () => {
    const fromSelect = Number(yearSelect?.value);
    if (Number.isFinite(fromSelect) && fromSelect > 0) return fromSelect;
    const label = root.querySelector('[data-calendar-label]')?.textContent?.trim() || '';
    const match = label.match(/\b(20\d{2})\b/);
    return match ? Number(match[1]) : new Date().getFullYear();
  };

  const dateForCell = (cell) => {
    const month = cell.closest('.year-month');
    const months = Array.from(grid.querySelectorAll('.year-month'));
    const monthIndex = months.indexOf(month);
    const day = Number(cell.querySelector('.year-day-number')?.textContent);
    if (monthIndex < 0 || !Number.isFinite(day) || day < 1 || day > 31) return null;
    return new Date(currentYear(), monthIndex, day, 12);
  };

  const clearHighlightedCells = () => {
    suppressGridReset = true;
    grid.querySelectorAll('.longest-gap-day').forEach((cell) => {
      cell.classList.remove('longest-gap-day');
      cell.style.removeProperty('background');
      cell.style.removeProperty('border-color');
      cell.style.removeProperty('box-shadow');
    });
    requestAnimationFrame(() => { suppressGridReset = false; });
  };

  const setCardState = (card, active) => {
    card.classList.toggle('longest-gap-selected', active);
    card.setAttribute('aria-pressed', String(active));
  };

  const clearHighlight = () => {
    highlighted = false;
    clearHighlightedCells();
    if (boundCard) setCardState(boundCard, false);
  };

  const calculateLongestGap = () => {
    const activeCells = Array.from(grid.querySelectorAll('.year-day'))
      .filter((cell) => cell.querySelector('.year-mark'));

    const activeDates = activeCells
      .map(dateForCell)
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime());

    if (activeDates.length < 2) return null;

    let longest = 0;
    let start = null;
    let end = null;
    for (let index = 1; index < activeDates.length; index += 1) {
      const previous = activeDates[index - 1];
      const current = activeDates[index];
      const inactiveDays = Math.round((current.getTime() - previous.getTime()) / 86400000) - 1;
      if (inactiveDays > longest) {
        longest = inactiveDays;
        start = new Date(previous.getTime() + 86400000);
        end = new Date(current.getTime() - 86400000);
      }
    }

    return longest > 0 && start && end ? { longest, start, end } : null;
  };

  const applyHighlight = (card) => {
    const gap = calculateLongestGap();
    if (!gap) return;

    clearHighlightedCells();
    const startTime = gap.start.getTime();
    const endTime = gap.end.getTime();

    suppressGridReset = true;
    grid.querySelectorAll('.year-day:not(.year-day--blank):not(.year-day--future)').forEach((cell) => {
      const date = dateForCell(cell);
      if (!date) return;
      const time = date.getTime();
      if (time < startTime || time > endTime) return;

      cell.classList.add('longest-gap-day');
      cell.style.setProperty('background', 'rgba(239, 68, 68, 0.16)', 'important');
      cell.style.setProperty('border-color', 'rgba(220, 38, 38, 0.40)', 'important');
      cell.style.setProperty('box-shadow', 'inset 0 0 0 1px rgba(220, 38, 38, 0.05)', 'important');
    });
    requestAnimationFrame(() => { suppressGridReset = false; });

    highlighted = true;
    setCardState(card, true);
  };

  const toggleHighlight = (card) => {
    if (highlighted) {
      clearHighlight();
      return;
    }
    applyHighlight(card);
  };

  const bindCard = () => {
    const card = summary.querySelector('[data-summary-gap]');
    if (!card || card === boundCard) return;

    boundCard = card;
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-pressed', 'false');
    card.setAttribute('aria-label', 'Highlight the longest inactivity gap on the year calendar');

    card.addEventListener('click', () => toggleHighlight(card));
    card.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      toggleHighlight(card);
    });
  };

  const summaryObserver = new MutationObserver(bindCard);
  summaryObserver.observe(summary, { childList: true, subtree: true });

  const gridObserver = new MutationObserver(() => {
    if (suppressGridReset) return;
    if (highlighted) clearHighlight();
  });
  gridObserver.observe(grid, { childList: true, subtree: true });

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-summary-gap]')) return;
    if (target.closest('[data-pursuit-filter], [data-calendar-view-button], [data-calendar-prev], [data-calendar-next], [data-calendar-latest], [data-calendar-year], [data-filter-all], [data-filter-clear]')) {
      if (highlighted) clearHighlight();
    }
  });

  bindCard();
})();