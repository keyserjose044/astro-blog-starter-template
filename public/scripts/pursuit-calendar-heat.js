(() => {
  const root = document.querySelector('[data-pursuit-calendar]');
  if (!root || root.dataset.heatReady === 'true') return;
  root.dataset.heatReady = 'true';

  const grid = root.querySelector('[data-calendar-grid]');
  const filterActions = root.querySelector('.filter-actions');
  const breakdown = root.querySelector('[data-calendar-breakdown]');
  const weekdays = root.querySelector('.weekdays');
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
    }
    [data-pursuit-calendar] .calendar-grid[data-view="year"] .year-month h4 {
      margin:0 0 8px !important;
      font-size:.86rem !important;
      letter-spacing:-.01em;
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