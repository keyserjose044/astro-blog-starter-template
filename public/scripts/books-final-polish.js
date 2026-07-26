const COUNTRY_CANONICAL = new Map([
  ['usa', 'United States'],
  ['u s a', 'United States'],
  ['us', 'United States'],
  ['u s', 'United States'],
  ['america', 'United States'],
  ['united states of america', 'United States'],
  ['britain', 'United Kingdom'],
  ['great britain', 'United Kingdom'],
  ['uk', 'United Kingdom'],
  ['u k', 'United Kingdom'],
  ['england', 'United Kingdom'],
  ['scotland', 'United Kingdom'],
  ['wales', 'United Kingdom'],
  ['northern ireland', 'United Kingdom'],
]);

const normalizeBooksValue = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const canonicalCountry = (value) => {
  const raw = String(value || '').trim();
  return COUNTRY_CANONICAL.get(normalizeBooksValue(raw)) || raw;
};

function updateStructuredNote(card, updates) {
  const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
  if (!parts.length) return;

  Object.entries(updates).forEach(([index, value]) => {
    const position = Number(index);
    while (parts.length <= position) parts.push('');
    parts[position] = value;
  });

  const next = parts.join(' · ');
  card.dataset.noteRaw = next;
  card.dataset.note = next.toLowerCase();

  const bubble = card.querySelector('.note-bubble');
  if (bubble) bubble.textContent = next;
}

function replaceMetadataToken(card, previous, next) {
  const previousKey = normalizeBooksValue(previous);
  card.querySelectorAll('.card-meta span').forEach((span) => {
    const parts = span.textContent.split(' · ').map((part) => part.trim());
    let changed = false;
    const updated = parts.map((part) => {
      if (normalizeBooksValue(part) !== previousKey) return part;
      changed = true;
      return next;
    });
    if (changed) span.textContent = updated.join(' · ');
  });
}

function repairBookMetadata(cards) {
  cards.forEach((card) => {
    const originalCountry = String(card.dataset.country || '').trim();
    const nextCountry = canonicalCountry(originalCountry);

    if (originalCountry && nextCountry !== originalCountry) {
      card.dataset.country = nextCountry;
      replaceMetadataToken(card, originalCountry, nextCountry);
      updateStructuredNote(card, { 8: nextCountry });
    }

    if (String(card.dataset.publicationYear || '').trim() === '0') {
      card.dataset.publicationYear = 'unknown';
      card.dataset.publicationPeriod = 'unknown';
      card.dataset.publicationPeriodLabel = 'Unknown date';
      card.dataset.publicationPeriodOrder = '400';
      replaceMetadataToken(card, '0', 'Publication date unknown');
      updateStructuredNote(card, { 3: 'Unknown date' });
    }
  });
}

function rebuildCountryFilter(cards, select) {
  if (!select) return;
  const previous = canonicalCountry(select.value);
  const countries = [...new Set(cards.map((card) => canonicalCountry(card.dataset.country)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }));

  select.innerHTML = '<option value="">All countries</option>';
  countries.forEach((country) => {
    const option = document.createElement('option');
    option.value = country;
    option.textContent = country;
    select.appendChild(option);
  });

  if (countries.includes(previous)) select.value = previous;
}

function rebuildPeriodFilter(cards, select) {
  if (!select) return;
  const previous = select.value;
  const periods = new Map();

  cards.forEach((card) => {
    const key = card.dataset.publicationPeriod || 'unknown';
    const label = card.dataset.publicationPeriodLabel || 'Unknown date';
    const order = Number(card.dataset.publicationPeriodOrder || 400);
    if (!periods.has(key)) periods.set(key, { key, label, order });
  });

  select.innerHTML = '<option value="">All periods</option>';
  [...periods.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .forEach(({ key, label }) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = label;
      select.appendChild(option);
    });

  if ([...periods.keys()].includes(previous)) select.value = previous;
}

function visibleCards(cards) {
  return cards.filter((card) => card.style.display !== 'none' && !card.classList.contains('atlas-country-hidden'));
}

function randomChoice(values, previous) {
  if (!values.length) return null;
  const alternatives = values.length > 1 ? values.filter((value) => value !== previous) : values;
  return alternatives[Math.floor(Math.random() * alternatives.length)] || values[0];
}

function installSurprise(cards) {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || toolbar.querySelector('[data-books-surprise]')) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'books-surprise';
  wrapper.dataset.booksSurprise = '';
  wrapper.innerHTML = `
    <button type="button" class="books-surprise-trigger" aria-haspopup="menu" aria-expanded="false">
      <span aria-hidden="true">🎲</span><span>Surprise me</span><span class="books-surprise-chevron" aria-hidden="true">▾</span>
    </button>
    <div class="books-surprise-menu" role="menu" hidden>
      <button type="button" role="menuitem" data-surprise-action="book"><span>📖</span><span><strong>Random book</strong><small>Open one from the current filters</small></span></button>
      <button type="button" role="menuitem" data-surprise-action="country"><span>🌍</span><span><strong>Random country</strong><small>Explore an author origin</small></span></button>
      <button type="button" role="menuitem" data-surprise-action="period"><span>⌛</span><span><strong>Random period</strong><small>Open a literary era</small></span></button>
      <button type="button" role="menuitem" data-surprise-action="year"><span>🗓️</span><span><strong>Random reading year</strong><small>Revisit a year in the log</small></span></button>
    </div>
    <div class="books-surprise-toast" role="status" aria-live="polite" hidden></div>
  `;

  const infoButton = toolbar.querySelector('#info-toggle');
  toolbar.insertBefore(wrapper, infoButton || null);

  const trigger = wrapper.querySelector('.books-surprise-trigger');
  const menu = wrapper.querySelector('.books-surprise-menu');
  const toast = wrapper.querySelector('.books-surprise-toast');
  const countrySelect = document.querySelector('#country-filter');
  const periodSelect = document.querySelector('#period-filter');
  const yearSelect = document.querySelector('#year-filter');
  let toastTimer;
  const last = { book: null, country: null, period: null, year: null };

  function closeMenu() {
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = window.setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function candidatesFor(attribute, fallback = true) {
    const current = [...new Set(visibleCards(cards).map((card) => card.dataset[attribute]).filter(Boolean))];
    if (current.length > 1 || !fallback) return current;
    return [...new Set(cards.map((card) => card.dataset[attribute]).filter(Boolean))];
  }

  function openExplorer(view, timelineMode) {
    const button = document.querySelector(`[data-atlas-view="${view}"]`);
    button?.click();
    if (view === 'timeline' && timelineMode) {
      window.setTimeout(() => {
        document.querySelector(`[data-timeline-mode="${timelineMode}"]`)?.click();
      }, 40);
    }
  }

  function run(action) {
    const current = visibleCards(cards);

    if (action === 'book') {
      const choices = current.length ? current : cards;
      const choice = randomChoice(choices, last.book);
      if (!choice) {
        showToast('No books match the current filters.');
        return;
      }
      last.book = choice;
      const title = choice.querySelector('.title')?.textContent?.replace('↗', '').trim() || 'Selected book';
      window.open(choice.getAttribute('href') || '#', '_blank', 'noopener,noreferrer');
      showToast(`Opening: ${title}`);
      return;
    }

    if (action === 'country') {
      const values = candidatesFor('country');
      const choice = randomChoice(values, last.country);
      if (!choice || !countrySelect) return;
      last.country = choice;
      countrySelect.value = choice;
      countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
      showToast(`Exploring books from ${choice}`);
      openExplorer('map');
      return;
    }

    if (action === 'period') {
      const values = candidatesFor('publicationPeriod').filter((value) => value !== 'unknown');
      const choice = randomChoice(values, last.period);
      if (!choice || !periodSelect) return;
      last.period = choice;
      periodSelect.value = choice;
      periodSelect.dispatchEvent(new Event('change', { bubbles: true }));
      const label = periodSelect.selectedOptions[0]?.textContent || choice;
      showToast(`Opening ${label}`);
      openExplorer('timeline', 'publication');
      return;
    }

    if (action === 'year') {
      const values = candidatesFor('finishedYear').filter(Boolean);
      const choice = randomChoice(values, last.year);
      if (!choice || !yearSelect) return;
      last.year = choice;
      yearSelect.value = choice;
      yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
      showToast(`Revisiting ${choice}`);
      openExplorer('timeline', 'reading');
    }
  }

  trigger.addEventListener('click', () => {
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    trigger.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) menu.querySelector('button')?.focus();
  });

  menu.querySelectorAll('[data-surprise-action]').forEach((button) => {
    button.addEventListener('click', () => {
      closeMenu();
      trigger.focus();
      run(button.dataset.surpriseAction);
    });
  });

  document.addEventListener('click', (event) => {
    if (!wrapper.contains(event.target)) closeMenu();
  });

  wrapper.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
      trigger.focus();
    }
  });
}

function bootBooksFinalPolish() {
  const grid = document.querySelector('#grid');
  const toolbar = document.querySelector('.toolbar');
  const atlasButton = document.querySelector('[data-atlas-view="map"]');
  if (!grid || !toolbar || !atlasButton) {
    window.setTimeout(bootBooksFinalPolish, 80);
    return;
  }

  const cards = Array.from(grid.querySelectorAll('.card'));
  repairBookMetadata(cards);
  rebuildCountryFilter(cards, document.querySelector('#country-filter'));
  rebuildPeriodFilter(cards, document.querySelector('#period-filter'));
  installSurprise(cards);

  document.querySelector('#country-filter')?.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#period-filter')?.dispatchEvent(new Event('change', { bubbles: true }));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootBooksFinalPolish, { once: true });
} else {
  bootBooksFinalPolish();
}
