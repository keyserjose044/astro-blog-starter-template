/* LifeLoggerz Classical Music — v7 focused refinement.
   Improves composer cards, desktop insights, composer shortcuts, and keeps Daily Listening simple. */

const CLASSICAL_FIXES_V7_RETRIES = 240;

const classicalV7Clean = (value) => String(value ?? '').trim();
const classicalV7Norm = (value) => classicalV7Clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function classicalV7Hours(minutes) {
  const hours = Math.max(0, Number(minutes || 0)) / 60;
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hrs`;
}

function classicalV7MonthYear(ms) {
  const date = new Date(Number(ms || 0));
  if (!ms || Number.isNaN(date.getTime())) return 'Not yet';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function bootClassicalFixesV7(attempt = 0) {
  const v5Ready = document.body.dataset.classicalFixesV5Ready === 'true';
  const composerGrid = document.querySelector('#composer-grid');
  const overview = document.querySelector('[data-page-panel="overview"]');
  const calendar = document.querySelector('[data-page-panel="calendar"]');

  if ((!v5Ready || !composerGrid || !overview || !calendar) && attempt < CLASSICAL_FIXES_V7_RETRIES) {
    window.setTimeout(() => bootClassicalFixesV7(attempt + 1), 75);
    return;
  }
  if (!v5Ready || !composerGrid || !overview || !calendar || document.body.dataset.classicalFixesV7Ready) return;
  document.body.dataset.classicalFixesV7Ready = 'true';

  const composerCards = Array.from(composerGrid.querySelectorAll('.composer-card[data-composer-id]'));
  const workItems = Array.from(document.querySelectorAll('[data-work-item]'));
  const composersByName = new Map();

  composerCards.forEach((card) => {
    composersByName.set(classicalV7Norm(card.dataset.name), card);
  });

  /* Mobile composer cards: turn the existing 3-stat strip into a true 2x2 dashboard.
     The fourth cell combines repeat behavior and the latest logged month. */
  composerCards.forEach((card) => {
    const stats = card.querySelector('.composer-stats');
    if (!stats || stats.querySelector('.classical-mobile-return-stat')) return;

    const composerId = card.dataset.composerId || '';
    const repeatedWorks = workItems.filter((item) =>
      item.dataset.composer === composerId && Number(item.dataset.listens || 1) > 1
    ).length;
    const latest = classicalV7MonthYear(card.dataset.lastListened);

    const stat = document.createElement('span');
    stat.className = 'stat classical-mobile-return-stat';
    stat.innerHTML = `<strong>↻ ${repeatedWorks.toLocaleString('en-US')} repeated</strong><span>Latest ${latest}</span>`;
    stats.append(stat);
  });

  /* Desktop Composer Insights: use the available height for more actual composer data.
     The server renders eight rows; add ranks 9–12 on wide screens for all three modes. */
  function appendInsightExtras(panelName, records, makeRow) {
    const list = overview.querySelector(`[data-insight-panel="${panelName}"] .chart-list`);
    if (!list || list.querySelector('.classical-v7-insight-extra')) return;
    records.slice(8, 12).forEach((record) => {
      const row = makeRow(record);
      row.classList.add('classical-v7-insight-extra');
      list.append(row);
    });
  }

  const records = composerCards.map((card) => ({
    name: classicalV7Clean(card.dataset.name),
    minutes: Number(card.dataset.minutes || 0),
    favorites: Number(card.dataset.favorites || 0),
    works: Number(card.dataset.unique || 0),
    rate: Number(card.dataset.rate || 0),
  }));

  const makeBaseRow = (record) => {
    const row = document.createElement('li');
    row.className = 'chart-row';
    const name = document.createElement('span');
    name.className = 'chart-name';
    name.textContent = record.name;
    const track = document.createElement('span');
    track.className = 'bar-track';
    track.setAttribute('aria-hidden', 'true');
    const value = document.createElement('span');
    value.className = 'chart-value';
    row.append(name, track, value);
    return { row, track, value };
  };

  const timeRecords = records.filter((record) => record.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const maxMinutes = Math.max(timeRecords[0]?.minutes || 0, 1);
  appendInsightExtras('time', timeRecords, (record) => {
    const { row, track, value } = makeBaseRow(record);
    const fill = document.createElement('span');
    fill.className = 'bar-fill';
    fill.style.setProperty('--bar-width', `${Math.max(2, (record.minutes / maxMinutes) * 100)}%`);
    track.append(fill);
    value.textContent = classicalV7Hours(record.minutes);
    return row;
  });

  const favoriteRecords = records
    .filter((record) => record.favorites > 0)
    .sort((a, b) => b.favorites - a.favorites || b.works - a.works);
  const maxFavoriteWorks = Math.max(...favoriteRecords.map((record) => record.works), 1);
  appendInsightExtras('favorites', favoriteRecords, (record) => {
    const { row, track, value } = makeBaseRow(record);
    const works = document.createElement('span');
    works.className = 'works-width';
    works.style.setProperty('--bar-width', `${Math.max(2, (record.works / maxFavoriteWorks) * 100)}%`);
    const favorites = document.createElement('span');
    favorites.className = 'favorite-fill';
    favorites.style.setProperty('--favorite-width', `${record.rate}%`);
    works.append(favorites);
    track.append(works);
    value.textContent = `${record.favorites.toLocaleString('en-US')} / ${record.works.toLocaleString('en-US')}`;
    return row;
  });

  const rateRecords = records
    .filter((record) => record.works >= 5 && record.favorites > 0)
    .sort((a, b) => b.rate - a.rate || b.works - a.works);
  appendInsightExtras('rate', rateRecords, (record) => {
    const { row, track, value } = makeBaseRow(record);
    const fill = document.createElement('span');
    fill.className = 'rate-fill';
    fill.style.setProperty('--bar-width', `${record.rate}%`);
    track.append(fill);
    value.textContent = `${record.rate.toFixed(0)}% · ${record.works.toLocaleString('en-US')} works`;
    return row;
  });

  function findComposerCard(name) {
    const normalized = classicalV7Norm(name);
    if (!normalized) return null;
    if (composersByName.has(normalized)) return composersByName.get(normalized);
    return Array.from(composersByName.entries())
      .find(([candidate]) => candidate.includes(normalized) || normalized.includes(candidate))?.[1] || null;
  }

  function openComposerWorks(name) {
    const card = findComposerCard(name);
    const trigger = card?.querySelector('[data-composer-trigger]');
    if (!trigger) return;
    trigger.click();

    const selectWorks = (tries = 0) => {
      const dialog = document.querySelector('#composer-dialog');
      const worksTab = dialog?.querySelector('[data-detail-tab="works"]');
      if (worksTab) {
        worksTab.click();
        return;
      }
      if (tries < 20) window.setTimeout(() => selectWorks(tries + 1), 25);
    };
    window.setTimeout(() => selectWorks(), 0);
  }

  function wireComposerShortcuts() {
    const selectors = [
      '.classical-obsession-grid > article',
      '.classical-favorite-composer-grid > article',
    ];
    document.querySelectorAll(selectors.join(',')).forEach((tile) => {
      if (tile.dataset.classicalComposerShortcutReady) return;
      const name = classicalV7Clean(tile.querySelector('b')?.textContent);
      if (!name || !findComposerCard(name)) return;

      tile.dataset.classicalComposerShortcutReady = 'true';
      tile.classList.add('classical-composer-shortcut');
      tile.tabIndex = 0;
      tile.setAttribute('role', 'button');
      tile.setAttribute('aria-label', `Open ${name} works`);
      tile.title = `Open ${name} works`;

      const activate = () => openComposerWorks(name);
      tile.addEventListener('click', activate);
      tile.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  /* Daily Listening should be a composer + composition list, not a second thumbnail wall. */
  function simplifyAgenda() {
    calendar.querySelectorAll('.classical-calendar-agenda .classical-agenda-thumbnail').forEach((thumbnail) => thumbnail.remove());
    calendar.querySelectorAll('.classical-calendar-agenda .classical-calendar-work.has-agenda-thumbnail').forEach((work) => {
      work.classList.remove('has-agenda-thumbnail');
    });
  }

  wireComposerShortcuts();
  simplifyAgenda();

  let mutationTimer = 0;
  const observer = new MutationObserver(() => {
    window.clearTimeout(mutationTimer);
    mutationTimer = window.setTimeout(() => {
      wireComposerShortcuts();
      simplifyAgenda();
    }, 30);
  });
  observer.observe(document.querySelector('main.wrap') || document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalFixesV7(), { once: true });
} else {
  bootClassicalFixesV7();
}
