import '../styles/pursuit-calendar-period-polish.css';
import { getPursuitsArchive } from '../utils/pursuitsData';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function monthFromLabel(value: string) {
  const lower = value.toLowerCase();
  return MONTHS.findIndex((month) => lower.startsWith(month.toLowerCase()));
}

function yearFromLabel(value: string) {
  const match = value.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function initPeriodNavigation(root: HTMLElement) {
  if (root.dataset.periodNavReady === 'true') return;

  const toolbarMain = root.querySelector<HTMLElement>('.toolbar-main');
  const controls = root.querySelector<HTMLElement>('.month-controls');
  const period = root.querySelector<HTMLElement>('.calendar-period');
  const label = root.querySelector<HTMLElement>('[data-calendar-label]');
  const yearSelect = root.querySelector<HTMLSelectElement>('[data-calendar-year]');
  const previous = root.querySelector<HTMLButtonElement>('[data-calendar-prev]');
  const next = root.querySelector<HTMLButtonElement>('[data-calendar-next]');
  const latest = root.querySelector<HTMLButtonElement>('[data-calendar-latest]');
  const viewToggle = root.querySelector<HTMLElement>('.view-toggle');

  if (!toolbarMain || !controls || !period || !label || !yearSelect || !previous || !next || !latest || !viewToggle) return;

  root.dataset.periodNavReady = 'true';
  toolbarMain.classList.add('period-toolbar-main');
  controls.classList.add('period-navigation');

  previous.textContent = '‹';
  next.textContent = '›';
  latest.classList.add('period-latest');
  latest.title = 'Jump to latest Archive period';
  latest.setAttribute('aria-label', 'Jump to latest Archive period');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'period-trigger';
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false');

  const triggerText = document.createElement('span');
  triggerText.className = 'period-trigger__text';
  triggerText.textContent = label.textContent?.trim() || 'Choose period';
  const caret = document.createElement('span');
  caret.className = 'period-trigger__caret';
  caret.setAttribute('aria-hidden', 'true');
  caret.textContent = '▼';
  trigger.append(triggerText, caret);

  const picker = document.createElement('div');
  picker.className = 'period-picker';
  picker.hidden = true;
  picker.setAttribute('role', 'dialog');
  picker.setAttribute('aria-label', 'Choose calendar period');

  const pickerHeader = document.createElement('div');
  pickerHeader.className = 'period-picker__header';
  const pickerHeading = document.createElement('p');
  pickerHeading.className = 'period-picker__heading';
  pickerHeading.textContent = 'Choose period';

  const yearLabel = document.createElement('label');
  yearLabel.className = 'period-picker__year';
  const yearCaption = document.createElement('span');
  yearCaption.textContent = 'Year';
  yearLabel.append(yearCaption, yearSelect);
  pickerHeader.append(pickerHeading, yearLabel);

  const monthGrid = document.createElement('div');
  monthGrid.className = 'period-picker__months';
  const monthButtons = MONTHS.map((month, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'period-picker__month';
    button.dataset.periodMonth = String(index);
    button.textContent = month.slice(0, 3);
    button.setAttribute('aria-label', month);
    monthGrid.append(button);
    return button;
  });
  picker.append(pickerHeader, monthGrid);

  // The old period label remains as the calendar runtime's internal update target,
  // but no longer participates in layout.
  label.setAttribute('aria-hidden', 'true');
  period.replaceChildren(label);

  latest.remove();
  toolbarMain.insertBefore(latest, viewToggle);
  controls.insertBefore(trigger, next);
  controls.append(picker);

  let latestYear: number | null = null;
  let latestMonth: number | null = null;

  const closePicker = (restoreFocus = false) => {
    if (picker.hidden) return;
    picker.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restoreFocus) trigger.focus();
  };

  const updateState = () => {
    const labelText = label.textContent?.trim() || '';
    const viewMode = root.dataset.calendarView === 'year' ? 'year' : 'month';
    const selectedYear = Number(yearSelect.value) || yearFromLabel(labelText) || latestYear || new Date().getFullYear();
    const selectedMonth = monthFromLabel(labelText);

    triggerText.textContent = labelText || (viewMode === 'year' ? String(selectedYear) : 'Choose period');
    trigger.setAttribute(
      'aria-label',
      viewMode === 'year'
        ? `Choose year, current ${triggerText.textContent}`
        : `Choose month and year, current ${triggerText.textContent}`,
    );
    pickerHeading.textContent = viewMode === 'year' ? 'Choose year' : 'Choose month';

    monthButtons.forEach((button, index) => {
      const isSelected = viewMode === 'month' && index === selectedMonth;
      button.setAttribute('aria-current', String(isSelected));
      button.disabled = Boolean(latestYear !== null && latestMonth !== null && selectedYear === latestYear && index > latestMonth);
    });

    const atLatest = latestYear !== null && (
      viewMode === 'year'
        ? selectedYear === latestYear
        : selectedYear === latestYear && selectedMonth === latestMonth
    );
    latest.disabled = atLatest;

    previous.title = previous.getAttribute('aria-label') || (viewMode === 'year' ? 'Previous year' : 'Previous month');
    next.title = next.getAttribute('aria-label') || (viewMode === 'year' ? 'Next year' : 'Next month');
  };

  const navigateToMonth = (targetMonth: number) => {
    const labelText = label.textContent?.trim() || '';
    const targetYear = Number(yearSelect.value);
    let currentMonth = monthFromLabel(labelText);
    const displayedYear = yearFromLabel(labelText);

    if (currentMonth < 0) currentMonth = 0;
    if (displayedYear !== targetYear && latestYear === targetYear && latestMonth !== null && currentMonth > latestMonth) {
      currentMonth = latestMonth;
    }

    const delta = targetMonth - currentMonth;
    const control = delta > 0 ? next : previous;
    for (let step = 0; step < Math.abs(delta); step += 1) {
      if (control.disabled) break;
      control.click();
    }
    closePicker();
  };

  trigger.addEventListener('click', () => {
    const willOpen = picker.hidden;
    picker.hidden = !willOpen;
    trigger.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) {
      updateState();
      window.setTimeout(() => yearSelect.focus(), 0);
    }
  });

  monthButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      navigateToMonth(index);
    });
  });

  yearSelect.addEventListener('change', () => {
    window.setTimeout(updateState, 0);
    if (root.dataset.calendarView === 'year') closePicker();
  });

  [previous, next, latest].forEach((button) => button.addEventListener('click', () => window.setTimeout(updateState, 0)));
  root.querySelectorAll<HTMLButtonElement>('[data-calendar-view-button]').forEach((button) => {
    button.addEventListener('click', () => window.setTimeout(updateState, 0));
  });

  new MutationObserver(updateState).observe(label, { childList: true, characterData: true, subtree: true });
  new MutationObserver(updateState).observe(root, { attributes: true, attributeFilter: ['data-calendar-view'] });
  new MutationObserver(updateState).observe(yearSelect, { childList: true });

  document.addEventListener('pointerdown', (event) => {
    const target = event.target as Node | null;
    if (target && !controls.contains(target)) closePicker();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !picker.hidden) closePicker(true);
  });

  getPursuitsArchive().then(({ meta }) => {
    if (meta.dataThrough) {
      const through = new Date(`${meta.dataThrough}T12:00:00`);
      latestYear = through.getFullYear();
      latestMonth = through.getMonth();
    }
    updateState();
  }).catch(() => updateState());

  updateState();
}

function initializePeriodNavigation() {
  document.querySelectorAll<HTMLElement>('[data-pursuit-calendar]').forEach(initPeriodNavigation);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePeriodNavigation, { once: true });
} else {
  initializePeriodNavigation();
}
