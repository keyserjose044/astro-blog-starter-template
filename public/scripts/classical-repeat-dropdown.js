/* LifeLoggerz Classical Music: custom repeat-count dropdown.
   Replaces the native repeat select UI so browser/OS dark form styling cannot leak into the light interface. */

const CLASSICAL_REPEAT_DROPDOWN_RETRIES = 160;

function bootClassicalRepeatDropdown(attempt = 0) {
  const nativeSelect = document.querySelector('#works-repeat-filter');
  const toolbar = document.querySelector('.works-toolbar');

  if ((!nativeSelect || !toolbar) && attempt < CLASSICAL_REPEAT_DROPDOWN_RETRIES) {
    window.setTimeout(() => bootClassicalRepeatDropdown(attempt + 1), 75);
    return;
  }
  if (!nativeSelect || !toolbar || nativeSelect.dataset.customRepeatReady) return;

  nativeSelect.dataset.customRepeatReady = 'true';
  nativeSelect.hidden = true;
  nativeSelect.tabIndex = -1;
  nativeSelect.setAttribute('aria-hidden', 'true');

  const shell = document.createElement('div');
  shell.className = 'classical-repeat-select';
  shell.dataset.repeatSelect = 'true';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'classical-repeat-select__trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-label', 'Filter works by repeat count');

  const label = document.createElement('span');
  label.className = 'classical-repeat-select__label';

  const chevron = document.createElement('span');
  chevron.className = 'classical-repeat-select__chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '⌄';

  trigger.append(label, chevron);

  const menu = document.createElement('div');
  menu.className = 'classical-repeat-select__menu';
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', 'Repeat-count options');
  menu.hidden = true;

  Array.from(nativeSelect.options).forEach((option) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'classical-repeat-select__option';
    item.dataset.value = option.value;
    item.setAttribute('role', 'option');
    item.textContent = option.textContent || '';
    item.addEventListener('click', () => {
      nativeSelect.value = option.value;
      nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      sync();
      closeMenu();
      trigger.focus();
    });
    menu.append(item);
  });

  shell.append(trigger, menu);
  nativeSelect.insertAdjacentElement('beforebegin', shell);

  function currentOption() {
    return nativeSelect.options[nativeSelect.selectedIndex] || nativeSelect.options[0];
  }

  function sync() {
    const selected = currentOption();
    label.textContent = selected?.textContent || 'All listens';
    menu.querySelectorAll('.classical-repeat-select__option').forEach((item) => {
      const active = item.dataset.value === nativeSelect.value;
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function openMenu() {
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    const selected = menu.querySelector('[aria-selected="true"]');
    requestAnimationFrame(() => selected?.focus());
  }

  function closeMenu() {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  trigger.addEventListener('click', () => {
    if (menu.hidden) openMenu();
    else closeMenu();
  });

  trigger.addEventListener('keydown', (event) => {
    if ((event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') && menu.hidden) {
      event.preventDefault();
      openMenu();
    }
  });

  menu.addEventListener('keydown', (event) => {
    const options = Array.from(menu.querySelectorAll('.classical-repeat-select__option'));
    const index = options.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      trigger.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      options[(index + 1 + options.length) % options.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      options[(index - 1 + options.length) % options.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      options[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      options.at(-1)?.focus();
    }
  });

  nativeSelect.addEventListener('change', sync);

  document.addEventListener('click', (event) => {
    if (!shell.contains(event.target)) closeMenu();
  });

  document.querySelector('#clear-work-filters')?.addEventListener('click', () => {
    window.setTimeout(sync, 0);
  });

  sync();
}

bootClassicalRepeatDropdown();
