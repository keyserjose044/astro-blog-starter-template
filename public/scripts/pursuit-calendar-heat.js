(() => {
  const root = document.querySelector('[data-pursuit-calendar]');
  if (!root || root.dataset.heatReady === 'true') return;
  root.dataset.heatReady = 'true';

  const grid = root.querySelector('[data-calendar-grid]');
  const filterActions = root.querySelector('.filter-actions');
  const breakdown = root.querySelector('[data-calendar-breakdown]');
  const weekdays = root.querySelector('.weekdays');
  const summary = root.querySelector('.calendar-summary');
  if (!grid || !filterActions) return;

  // The monthly summary belongs with the controls: filters -> summary -> calendar.
  if (breakdown && weekdays && breakdown.nextElementSibling !== weekdays) {
    weekdays.before(breakdown);
  }

  const pursuitColors = {
    guitar: [184, 107, 36],
    dance: [189, 55, 127],
    running: [35, 121, 87],
    languages: [64, 92, 245],
  };
  const pursuitLabels = {
    guitar: 'Guitar',
    dance: 'Dance',
    running: 'Running',
    languages: 'Languages',
  };
  const neutralColor = [64, 92, 245];

  const style = document.createElement('style');
  style.textContent = `
    /* Monthly breakdown now sits above the calendar grid. */
    [data-pursuit-calendar] .calendar-breakdown {
      border-top: 0 !important;
      border-bottom: 1px solid #e7ebf1 !important;
      background: linear-gradient(180deg,#fbfcfe,#f8fafc) !important;
    }

    /* Heat-map control is only relevant in Month view; Year is always a heat map. */
    [data-pursuit-calendar] [data-heat-toggle] {
      min-height:29px;
      padding:4px 8px;
      border:1px solid #dfe4ec;
      border-radius:8px;
      background:#fff;
      color:#656d7b;
      font:inherit;
      font-size:.64rem;
      font-weight:850;
      line-height:1;
      cursor:pointer;
      transition:background .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease;
    }
    [data-pursuit-calendar] [data-heat-toggle][hidden] { display:none !important; }
    [data-pursuit-calendar] [data-heat-toggle]:hover {
      background:#f0f2ff;
      border-color:#cbd2ff;
      color:#303746;
    }
    [data-pursuit-calendar] [data-heat-toggle][aria-pressed="true"] {
      background:#eef1ff;
      border-color:#aeb8ff;
      color:#3447d8;
      box-shadow:inset 0 0 0 1px rgba(64,92,245,.08);
    }

    /* A denser, more deliberate year overview: 12 equal mini-calendars. */
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-months {
      grid-template-columns:repeat(4,minmax(0,1fr)) !important;
      gap:12px !important;
      padding:14px !important;
      align-items:stretch;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month {
      padding:11px 12px 12px !important;
      border-color:#e7eaf0 !important;
      border-radius:14px !important;
      background:rgba(251,252,254,.82) !important;
      box-shadow:0 4px 14px rgba(15,23,42,.025);
      transition:background .15s ease,border-color .15s ease,opacity .15s ease;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month h4 {
      display:flex;
      align-items:center;
      justify-content:space-between;
      gap:8px;
      min-height:20px;
      margin:0 0 8px !important;
      font-size:.86rem !important;
      letter-spacing:-.01em;
    }
    [data-pursuit-calendar] .year-month-status {
      flex:0 0 auto;
      padding:2px 6px;
      border:1px solid #e3e7ee;
      border-radius:999px;
      background:#fff;
      color:#7a8290;
      font-size:.51rem;
      font-weight:850;
      letter-spacing:0;
      line-height:1.25;
      white-space:nowrap;
    }
    [data-pursuit-calendar] .year-month-status[hidden] { display:none !important; }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month.year-month--empty {
      border-color:#e1e5eb !important;
      background:#f6f7f9 !important;
      box-shadow:none;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month.year-month--empty h4 {
      color:#5f6774;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month.year-month--empty .year-month-status {
      border-color:#d9dee6;
      background:#eceff3;
      color:#6f7784;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month.year-month--empty .year-day:not(.year-day--blank) {
      background:rgba(255,255,255,.48) !important;
      border-color:#eceff3 !important;
      color:#8d949f;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-weekdays,
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-days {
      gap:3px !important;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-weekdays {
      margin-bottom:3px !important;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-days {
      grid-template-rows:repeat(6,30px);
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-day {
      aspect-ratio:auto !important;
      height:30px;
      border-color:#edf0f4 !important;
      border-radius:5px !important;
      background:rgba(255,255,255,.72) !important;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-day--active {
      background:#fff !important;
      box-shadow:inset 0 0 0 1px rgba(64,92,245,.035);
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] a.year-day:hover {
      border-color:#aeb8ff !important;
      background:#f7f8ff !important;
      box-shadow:0 0 0 2px rgba(64,92,245,.11) !important;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-day-number {
      top:4px !important;
      left:5px !important;
      font-size:.52rem !important;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-day-marks {
      left:4px !important;
      right:4px !important;
      bottom:4px !important;
      gap:1px !important;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-mark {
      height:2px !important;
      opacity:.95;
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-day--future {
      background:#f6f7f9 !important;
      color:#c0c5ce !important;
    }

    /* Solo Year view gets one extra analytical summary: longest internal inactivity gap. */
    [data-pursuit-calendar].has-gap-stat .calendar-summary {
      grid-template-columns:repeat(4,minmax(90px,1fr));
      min-width:min(100%,480px);
    }
    [data-pursuit-calendar] [data-summary-gap][hidden] { display:none !important; }

    [data-pursuit-calendar].pursuit-heat-enabled .pursuit-heat-cell {
      background-image:
        linear-gradient(var(--pursuit-heat),var(--pursuit-heat)),
        linear-gradient(145deg,#fff,#fafbff) !important;
    }
    [data-pursuit-calendar].pursuit-heat-enabled .year-day.pursuit-heat-cell {
      background-image:
        linear-gradient(var(--pursuit-heat),var(--pursuit-heat)),
        linear-gradient(#fff,#fff) !important;
    }

    html.dark [data-pursuit-calendar] .calendar-breakdown,
    body.dark [data-pursuit-calendar] .calendar-breakdown {
      background:#0f172a !important;
      border-color:rgba(148,163,184,.16) !important;
    }
    html.dark [data-pursuit-calendar] [data-heat-toggle],
    body.dark [data-pursuit-calendar] [data-heat-toggle] {
      background:#111827;
      color:#cbd5e1;
      border-color:rgba(148,163,184,.2);
    }
    html.dark [data-pursuit-calendar] [data-heat-toggle][aria-pressed="true"],
    body.dark [data-pursuit-calendar] [data-heat-toggle][aria-pressed="true"] {
      background:#20284d;
      color:#c7d2fe;
      border-color:rgba(129,140,248,.42);
    }
    html.dark [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month,
    body.dark [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month {
      background:#0f172a !important;
      border-color:rgba(148,163,184,.16) !important;
    }
    html.dark [data-pursuit-calendar] .year-month-status,
    body.dark [data-pursuit-calendar] .year-month-status {
      background:#111827;
      border-color:rgba(148,163,184,.2);
      color:#aeb7c5;
    }
    html.dark [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month.year-month--empty,
    body.dark [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month.year-month--empty {
      background:#0c1423 !important;
      border-color:rgba(148,163,184,.11) !important;
    }
    html.dark [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month.year-month--empty .year-month-status,
    body.dark [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month.year-month--empty .year-month-status {
      background:#151e2e;
      border-color:rgba(148,163,184,.14);
      color:#8290a3;
    }
    html.dark [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-day,
    body.dark [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-day {
      background:#111827 !important;
      border-color:rgba(148,163,184,.12) !important;
    }
    html.dark [data-pursuit-calendar].pursuit-heat-enabled .pursuit-heat-cell,
    body.dark [data-pursuit-calendar].pursuit-heat-enabled .pursuit-heat-cell {
      background-image:
        linear-gradient(var(--pursuit-heat),var(--pursuit-heat)),
        linear-gradient(#111827,#111827) !important;
    }

    @media(max-width:1150px) {
      [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-months {
        grid-template-columns:repeat(3,minmax(0,1fr)) !important;
      }
    }
    @media(max-width:820px) {
      [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-months {
        grid-template-columns:repeat(2,minmax(0,1fr)) !important;
      }
    }
    @media(max-width:620px) {
      [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-months {
        grid-template-columns:1fr !important;
        padding:10px !important;
      }
      [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-days {
        grid-template-rows:repeat(6,34px);
      }
      [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-day { height:34px; }
      [data-pursuit-calendar] [data-heat-toggle] { min-height:29px; }
      [data-pursuit-calendar].has-gap-stat .calendar-summary { grid-template-columns:repeat(2,minmax(0,1fr)); }
      [data-pursuit-calendar] .year-month-status { font-size:.56rem; }
    }
  `;
  document.head.append(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.heatToggle = '';
  button.textContent = 'Heat map';
  button.title = 'Shade days by selected pursuit intensity';
  button.setAttribute('aria-label', 'Toggle pursuit intensity heat map in Month view');

  const params = new URLSearchParams(window.location.search);
  let enabled = params.get('heat') === '1';
  button.setAttribute('aria-pressed', String(enabled));
  filterActions.append(button);

  let gapCard = null;
  let gapValue = null;
  let gapLabel = null;
  if (summary) {
    gapCard = document.createElement('div');
    gapCard.dataset.summaryGap = '';
    gapCard.hidden = true;
    gapValue = document.createElement('strong');
    gapLabel = document.createElement('span');
    gapLabel.textContent = 'longest gap';
    gapCard.append(gapValue, gapLabel);
    summary.append(gapCard);
  }

  const isYearView = () => root.dataset.calendarView === 'year' || grid.dataset.view === 'year';

  const selectedPursuits = () => Array.from(root.querySelectorAll('[data-pursuit-filter]'))
    .filter((item) => item.getAttribute('aria-pressed') === 'true')
    .map((item) => item.dataset.pursuitFilter)
    .filter(Boolean);

  const currentColor = () => {
    const selected = selectedPursuits();
    return selected.length === 1 && pursuitColors[selected[0]] ? pursuitColors[selected[0]] : neutralColor;
  };

  const fillValue = (node) => {
    const raw = node.style.getPropertyValue('--event-fill') || node.style.getPropertyValue('--mark-fill');
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const heatScore = (cell) => {
    const marks = Array.from(cell.querySelectorAll('.event,.year-mark'));
    if (!marks.length) return 0;
    const total = marks.reduce((sum, mark) => sum + fillValue(mark), 0);
    return Math.min(100, total * 0.75);
  };

  const normalizeYearCalendars = () => {
    grid.querySelectorAll('.year-days').forEach((days) => {
      days.querySelectorAll('.year-day--trailing').forEach((node) => node.remove());
      const count = days.children.length;
      for (let index = count; index < 42; index += 1) {
        const blank = document.createElement('span');
        blank.className = 'year-day year-day--blank year-day--trailing';
        blank.setAttribute('aria-hidden', 'true');
        days.append(blank);
      }
    });
  };

  const decorateYearMonths = () => {
    const selected = selectedPursuits();
    const soloPursuit = selected.length === 1 ? selected[0] : null;

    grid.querySelectorAll('.year-month').forEach((month) => {
      const heading = month.querySelector('h4');
      if (!heading) return;

      let badge = heading.querySelector('.year-month-status');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'year-month-status';
        heading.append(badge);
      }

      const realDays = Array.from(month.querySelectorAll('.year-day:not(.year-day--blank)'));
      const pastOrPresentDays = realDays.filter((day) => !day.classList.contains('year-day--future'));
      const hasFuture = realDays.some((day) => day.classList.contains('year-day--future'));
      const activeDays = pastOrPresentDays.filter((day) => day.querySelector('.year-mark')).length;
      const allFuture = realDays.length > 0 && pastOrPresentDays.length === 0;
      const completelyPast = realDays.length > 0 && !hasFuture;
      const emptyPastMonth = completelyPast && activeDays === 0;

      month.classList.toggle('year-month--empty', emptyPastMonth);

      let text = '';
      if (!allFuture) {
        if (activeDays > 0) text = `${activeDays} ${activeDays === 1 ? 'day' : 'days'}`;
        else if (emptyPastMonth && soloPursuit) text = `No ${pursuitLabels[soloPursuit].toLowerCase()}`;
        else if (emptyPastMonth) text = '0 active days';
        else text = '0 days so far';
      }

      badge.hidden = !text;
      if (text && badge.textContent !== text) badge.textContent = text;
    });
  };

  const dateFromYearCell = (cell) => {
    const anchor = cell.closest('a.year-day');
    if (!anchor) return null;
    try {
      const date = new URL(anchor.href, window.location.href).searchParams.get('date');
      if (!date) return null;
      const parsed = new Date(`${date}T12:00:00`);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  };

  const formatShortDate = (date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const updateLongestGap = () => {
    if (!gapCard || !gapValue) return;
    const selected = selectedPursuits();
    const shouldShow = isYearView() && selected.length === 1;
    gapCard.hidden = !shouldShow;
    root.classList.toggle('has-gap-stat', shouldShow);
    if (!shouldShow) return;

    const activeDates = Array.from(grid.querySelectorAll('.year-day'))
      .filter((cell) => cell.querySelector('.year-mark'))
      .map(dateFromYearCell)
      .filter(Boolean)
      .sort((a, b) => a.getTime() - b.getTime());

    let longest = 0;
    let gapStart = null;
    let gapEnd = null;
    for (let index = 1; index < activeDates.length; index += 1) {
      const previousDate = activeDates[index - 1];
      const currentDate = activeDates[index];
      const diffDays = Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000) - 1;
      if (diffDays > longest) {
        longest = diffDays;
        gapStart = new Date(previousDate.getTime() + 86400000);
        gapEnd = new Date(currentDate.getTime() - 86400000);
      }
    }

    const value = activeDates.length >= 2 ? `${longest} d` : '—';
    if (gapValue.textContent !== value) gapValue.textContent = value;

    const pursuit = pursuitLabels[selected[0]];
    if (longest > 0 && gapStart && gapEnd) {
      gapCard.title = `${pursuit}: ${longest} consecutive inactive days, ${formatShortDate(gapStart)}–${formatShortDate(gapEnd)}.`;
    } else if (activeDates.length >= 2) {
      gapCard.title = `${pursuit}: no inactive day between recorded activity dates.`;
    } else {
      gapCard.title = `${pursuit}: not enough active dates in this year to calculate an internal gap.`;
    }
  };

  const applyHeat = () => {
    normalizeYearCalendars();

    const yearView = isYearView();
    const effectiveEnabled = yearView || enabled;

    // Year view is inherently the heat-map overview. Keep the manual toggle for Month only.
    button.hidden = yearView;
    button.setAttribute('aria-pressed', String(enabled));
    root.classList.toggle('pursuit-heat-enabled', effectiveEnabled);

    const [r, g, b] = currentColor();
    const cells = grid.querySelectorAll('.day:not(.day--outside):not(.day--future),.year-day:not(.year-day--blank):not(.year-day--future)');
    cells.forEach((cell) => {
      cell.classList.remove('pursuit-heat-cell');
      cell.style.removeProperty('--pursuit-heat');
      if (!effectiveEnabled) return;

      const score = heatScore(cell);
      if (score <= 0) return;

      // The annual overview needs activity to read instantly; Month heat remains more restrained.
      const alpha = yearView
        ? 0.07 + (score / 100) * 0.19
        : 0.018 + (score / 100) * 0.145;

      cell.classList.add('pursuit-heat-cell');
      cell.style.setProperty('--pursuit-heat', `rgba(${r},${g},${b},${alpha.toFixed(3)})`);
    });

    if (yearView) decorateYearMonths();
    updateLongestGap();
  };

  const syncHeatUrl = () => {
    const url = new URL(window.location.href);
    if (enabled) url.searchParams.set('heat', '1');
    else url.searchParams.delete('heat');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  };

  let frame = 0;
  const scheduleApply = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(applyHeat);
  };

  button.addEventListener('click', () => {
    enabled = !enabled;
    syncHeatUrl();
    applyHeat();
  });

  const gridObserver = new MutationObserver(scheduleApply);
  gridObserver.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-view'] });

  const viewObserver = new MutationObserver(scheduleApply);
  viewObserver.observe(root, { attributes: true, attributeFilter: ['data-calendar-view'] });

  root.querySelectorAll('[data-pursuit-filter]').forEach((filter) => {
    const observer = new MutationObserver(scheduleApply);
    observer.observe(filter, { attributes: true, attributeFilter: ['aria-pressed'] });
  });

  applyHeat();
})();