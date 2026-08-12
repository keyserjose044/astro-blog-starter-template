(() => {
  const root = document.querySelector('[data-pursuit-calendar]');
  if (!root || root.dataset.heatReady === 'true') return;
  root.dataset.heatReady = 'true';

  const grid = root.querySelector('[data-calendar-grid]');
  const filterActions = root.querySelector('.filter-actions');
  if (!grid || !filterActions) return;

  const pursuitColors = {
    guitar: [184, 107, 36],
    dance: [189, 55, 127],
    running: [35, 121, 87],
    languages: [64, 92, 245],
  };
  const neutralColor = [64, 92, 245];

  const style = document.createElement('style');
  style.textContent = `
    [data-pursuit-calendar] [data-heat-toggle][aria-pressed="true"] {
      background:#eef1ff;
      border-color:#aeb8ff;
      color:#3447d8;
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
    html.dark [data-pursuit-calendar].pursuit-heat-enabled .pursuit-heat-cell,
    body.dark [data-pursuit-calendar].pursuit-heat-enabled .pursuit-heat-cell {
      background-image:
        linear-gradient(var(--pursuit-heat),var(--pursuit-heat)),
        linear-gradient(#111827,#111827) !important;
    }
  `;
  document.head.append(style);

  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.heatToggle = '';
  button.textContent = 'Heat';
  button.title = 'Shade days by selected pursuit intensity';
  button.setAttribute('aria-label', 'Toggle pursuit intensity heat shading');

  const params = new URLSearchParams(window.location.search);
  let enabled = params.get('heat') === '1';
  button.setAttribute('aria-pressed', String(enabled));
  filterActions.append(button);

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

  const applyHeat = () => {
    root.classList.toggle('pursuit-heat-enabled', enabled);
    button.setAttribute('aria-pressed', String(enabled));

    const [r, g, b] = currentColor();
    const cells = grid.querySelectorAll('.day:not(.day--outside):not(.day--future),.year-day:not(.year-day--blank):not(.year-day--future)');
    cells.forEach((cell) => {
      cell.classList.remove('pursuit-heat-cell');
      cell.style.removeProperty('--pursuit-heat');
      if (!enabled) return;

      const score = heatScore(cell);
      if (score <= 0) return;
      const alpha = 0.018 + (score / 100) * 0.145;
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
  gridObserver.observe(grid, { childList: true, subtree: true });

  root.querySelectorAll('[data-pursuit-filter]').forEach((filter) => {
    const observer = new MutationObserver(scheduleApply);
    observer.observe(filter, { attributes: true, attributeFilter: ['aria-pressed'] });
  });

  applyHeat();
})();