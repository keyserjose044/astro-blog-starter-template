let installed = false;
let currentMonthKey = '';
let lastApi = null;

const esc = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

const parseDate = (value) => {
  const raw = String(value || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const date = new Date(Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
};

const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
const dateKey = (date) => `${monthKey(date)}-${String(date.getUTCDate()).padStart(2, '0')}`;
const monthDate = (key) => {
  const match = String(key || '').match(/^(\d{4})-(\d{2})$/);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : null;
};
const formatMonth = (key) => {
  const date = monthDate(key);
  return date ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date) : '';
};
const formatDay = (date) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
const formatFullDate = (date) => new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);

function allMonthKeys(api) {
  const dates = api.cards.map((card) => parseDate(card.dataset.dateViewed)).filter(Boolean).sort((a, b) => a - b);
  if (!dates.length) return [];
  const cursor = new Date(Date.UTC(dates[0].getUTCFullYear(), dates[0].getUTCMonth(), 1));
  const end = new Date(Date.UTC(dates.at(-1).getUTCFullYear(), dates.at(-1).getUTCMonth(), 1));
  const keys = [];
  while (cursor <= end) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}

function cardTooltip(card) {
  const details = [
    card.dataset.artist,
    card.dataset.movement,
    card.dataset.medium,
    card.dataset.dateViewed ? `Viewed ${card.dataset.dateViewed}` : '',
    card.dataset.country,
  ].filter(Boolean);
  return details.join(' · ');
}

function install(api) {
  if (installed) return;
  installed = true;
  lastApi = api;
  const view = document.querySelector('#art-calendar-view');
  if (!view) return;
  view.querySelector('[data-art-calendar-prev]')?.addEventListener('click', () => moveMonth(-1));
  view.querySelector('[data-art-calendar-next]')?.addEventListener('click', () => moveMonth(1));
  view.querySelector('[data-art-calendar-latest]')?.addEventListener('click', () => {
    const keys = allMonthKeys(lastApi);
    const latestVisible = lastApi.getVisibleCards().map((card) => parseDate(card.dataset.dateViewed)).filter(Boolean).sort((a, b) => b - a)[0];
    currentMonthKey = latestVisible ? monthKey(latestVisible) : keys.at(-1) || '';
    renderArtCalendar(lastApi);
  });
  view.querySelector('[data-art-calendar-month]')?.addEventListener('change', (event) => {
    currentMonthKey = event.target.value;
    renderArtCalendar(lastApi);
  });
}

function moveMonth(direction) {
  const keys = allMonthKeys(lastApi);
  if (!keys.length) return;
  const index = Math.max(0, keys.indexOf(currentMonthKey));
  currentMonthKey = keys[Math.max(0, Math.min(keys.length - 1, index + direction))];
  renderArtCalendar(lastApi);
}

function renderMetrics(api, monthCards, daysInMonth) {
  const metrics = api.controls.calendarMetrics;
  if (!metrics) return;
  const occupied = new Set(monthCards.map((card) => {
    const date = parseDate(card.dataset.dateViewed);
    return date ? dateKey(date) : '';
  }).filter(Boolean));
  const artists = new Set(monthCards.map((card) => api.norm(card.dataset.artist)).filter(Boolean));
  metrics.innerHTML = `
    <div class="art-metric"><span class="art-metric-label">Works this month</span><strong class="art-metric-value">${monthCards.length.toLocaleString('en-US')}</strong><small class="art-metric-note">After active filters</small></div>
    <div class="art-metric"><span class="art-metric-label">Art days</span><strong class="art-metric-value">${occupied.size.toLocaleString('en-US')}</strong><small class="art-metric-note">${Math.max(0, daysInMonth - occupied.size).toLocaleString('en-US')} empty calendar days</small></div>
    <div class="art-metric"><span class="art-metric-label">Artists represented</span><strong class="art-metric-value">${artists.size.toLocaleString('en-US')}</strong><small class="art-metric-note">Unique recorded artists</small></div>
    <div class="art-metric"><span class="art-metric-label">Multiple-work days</span><strong class="art-metric-value">${[...occupied].filter((key) => monthCards.filter((card) => { const date = parseDate(card.dataset.dateViewed); return date && dateKey(date) === key; }).length > 1).length.toLocaleString('en-US')}</strong><small class="art-metric-note">Days with more than one work</small></div>
  `;
}

function workButton(card) {
  return `
    <button type="button" class="art-calendar-work" data-art-card-index="${esc(card.dataset.originalIndex)}" aria-label="Open ${esc(card.dataset.title || 'artwork')}">
      <img src="${esc(card.dataset.cover || '')}" alt="" loading="lazy" decoding="async">
      <span class="art-calendar-hover"><strong>${esc(card.dataset.title || 'Untitled')}</strong><span>${esc(cardTooltip(card))}</span></span>
    </button>
  `;
}

function attachOpenHandlers(root, api) {
  root.querySelectorAll('[data-art-card-index]').forEach((button) => button.addEventListener('click', () => {
    const card = api.cards.find((candidate) => candidate.dataset.originalIndex === button.dataset.artCardIndex);
    if (card) api.openViewer(card);
  }));
}

function renderDesktop(api, month, cardsByDay) {
  const grid = api.controls.calendarContent;
  if (!grid) return;
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const leading = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const cells = [];
  for (let index = 0; index < leading; index += 1) cells.push('<div class="art-calendar-day" data-outside="true" aria-hidden="true"></div>');
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    const dayCards = cardsByDay.get(dateKey(date)) || [];
    const visibleCards = dayCards.slice(0, 4);
    cells.push(`
      <div class="art-calendar-day" data-empty="${dayCards.length === 0}" role="gridcell" aria-label="${esc(formatFullDate(date))}: ${dayCards.length} ${dayCards.length === 1 ? 'artwork' : 'artworks'}">
        <span class="art-calendar-day-number">${day}</span>
        ${dayCards.length ? `<div class="art-calendar-stack" data-count="${Math.min(visibleCards.length, 4)}">${visibleCards.map(workButton).join('')}</div>${dayCards.length > 4 ? `<span class="art-calendar-more">+${dayCards.length - 4}</span>` : ''}` : ''}
      </div>
    `);
  }
  grid.innerHTML = cells.join('');
  attachOpenHandlers(grid, api);
}

function renderAgenda(api, month, cardsByDay) {
  const agenda = api.controls.calendarAgenda;
  if (!agenda) return;
  const year = month.getUTCFullYear();
  const monthIndex = month.getUTCMonth();
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const rows = [];
  for (let day = 1; day <= days; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day));
    const dayCards = cardsByDay.get(dateKey(date)) || [];
    rows.push(`
      <div class="art-calendar-agenda-day">
        <div class="art-calendar-agenda-date">${esc(formatDay(date))}<br>${new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(date)}</div>
        ${dayCards.length ? `<div class="art-calendar-agenda-works">${dayCards.map((card) => `
          <button type="button" class="art-calendar-agenda-work" data-art-card-index="${esc(card.dataset.originalIndex)}">
            <img src="${esc(card.dataset.cover || '')}" alt="" loading="lazy" decoding="async"><strong>${esc(card.dataset.title || 'Untitled')}</strong>
          </button>`).join('')}</div>` : '<div class="art-calendar-agenda-empty">No artwork recorded</div>'}
      </div>
    `);
  }
  agenda.innerHTML = rows.join('');
  attachOpenHandlers(agenda, api);
}

export function renderArtCalendar(api) {
  lastApi = api;
  install(api);
  const keys = allMonthKeys(api);
  const select = api.controls.calendarMonth;
  if (!keys.length || !select) {
    if (api.controls.calendarEmpty) api.controls.calendarEmpty.hidden = false;
    return;
  }

  const latestVisible = api.getVisibleCards().map((card) => parseDate(card.dataset.dateViewed)).filter(Boolean).sort((a, b) => b - a)[0];
  if (!keys.includes(currentMonthKey)) currentMonthKey = latestVisible ? monthKey(latestVisible) : keys.at(-1);

  const previousValue = select.value;
  select.innerHTML = keys.map((key) => `<option value="${key}">${esc(formatMonth(key))}</option>`).join('');
  select.value = keys.includes(currentMonthKey) ? currentMonthKey : previousValue;
  currentMonthKey = select.value || keys.at(-1);

  const month = monthDate(currentMonthKey);
  const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const monthCards = api.getVisibleCards().filter((card) => {
    const date = parseDate(card.dataset.dateViewed);
    return date && monthKey(date) === currentMonthKey;
  });
  const cardsByDay = new Map();
  monthCards.forEach((card) => {
    const date = parseDate(card.dataset.dateViewed);
    const key = dateKey(date);
    if (!cardsByDay.has(key)) cardsByDay.set(key, []);
    cardsByDay.get(key).push(card);
  });

  renderMetrics(api, monthCards, daysInMonth);
  renderDesktop(api, month, cardsByDay);
  renderAgenda(api, month, cardsByDay);
  if (api.controls.calendarEmpty) api.controls.calendarEmpty.hidden = monthCards.length !== 0;

  const index = keys.indexOf(currentMonthKey);
  const prev = document.querySelector('[data-art-calendar-prev]');
  const next = document.querySelector('[data-art-calendar-next]');
  if (prev) prev.disabled = index <= 0;
  if (next) next.disabled = index >= keys.length - 1;
}
