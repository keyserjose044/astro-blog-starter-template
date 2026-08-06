/* LifeLoggerz Classical Music — Aug 5, 2026 repair pass.
   Fixes navigation state, composer defaults, generated-view layout behavior,
   calendar agenda behavior, records logic, and milestone detail. */

const CLASSICAL_FIXES_V3_RETRIES = 240;

const fixClean = (value) => String(value ?? '').trim();
const fixNorm = (value) => fixClean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const fixCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function fixFormatMinutes(value) {
  const minutes = Math.max(0, Number(value || 0));
  if (minutes < 60) return `${Math.round(minutes).toLocaleString('en-US')} min`;
  const hours = minutes / 60;
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hr${Math.abs(hours - 1) < .05 ? '' : 's'}`;
}

function fixFormatDate(ms, short = true) {
  const date = new Date(Number(ms || 0));
  if (!ms || Number.isNaN(date.getTime())) return 'Date not logged';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: short ? 'short' : 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function fixRatingLabel(bucket) {
  if (bucket === 'amazing') return 'Amazing';
  if (bucket === 'gorgeous') return 'Gorgeous';
  return 'Other';
}

function fixWorkKey(composerId, piece) {
  return `${fixClean(composerId)}|${fixNorm(piece)}`;
}

function bootClassicalFixesV3(attempt = 0) {
  const tabs = document.querySelector('.page-tabs');
  const composerGrid = document.querySelector('#composer-grid');
  const expansionReady = document.body.dataset.classicalExpansionReady === 'true';

  if ((!tabs || !composerGrid || !expansionReady) && attempt < CLASSICAL_FIXES_V3_RETRIES) {
    window.setTimeout(() => bootClassicalFixesV3(attempt + 1), 75);
    return;
  }
  if (!tabs || !composerGrid || !expansionReady || document.body.dataset.classicalFixesV3Ready) return;
  document.body.dataset.classicalFixesV3Ready = 'true';

  const composerCards = Array.from(composerGrid.querySelectorAll('.composer-card'));
  const composerMap = new Map();
  composerCards.forEach((card) => {
    const id = fixClean(card.dataset.composerId);
    const name = fixClean(card.dataset.name);
    composerMap.set(id, {
      id,
      name,
      card,
      pending: Boolean(card.querySelector('.profile-badge')),
      portrait: card.querySelector('.portrait')?.getAttribute('src') || '',
      initials: fixClean(card.querySelector('.portrait-fallback')?.textContent),
    });
  });

  function composerVisual(composer, className = 'classical-record-avatar') {
    if (!composer) return null;
    if (composer.portrait) {
      const image = document.createElement('img');
      image.className = className;
      image.src = composer.portrait;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      return image;
    }
    const fallback = document.createElement('span');
    fallback.className = `${className} classical-polish-avatar--fallback`;
    fallback.textContent = composer.initials || composer.name.slice(0, 2);
    fallback.setAttribute('aria-hidden', 'true');
    return fallback;
  }

  function collectListeningEntries() {
    const entries = [];
    composerCards.forEach((card) => {
      const composerId = fixClean(card.dataset.composerId);
      const composer = composerMap.get(composerId)?.name || fixClean(card.dataset.name);
      const template = document.querySelector(`#composer-template-${CSS.escape(composerId)}`);
      template?.content?.querySelectorAll('[data-detail-panel="history"] [data-list-item]').forEach((row) => {
        const date = Number(row.dataset.date || 0);
        if (!date) return;
        const piece = fixClean(row.querySelector('.entry-title')?.textContent);
        entries.push({
          composerId,
          composer,
          piece,
          key: fixWorkKey(composerId, piece),
          date,
          row: Number(row.dataset.row || 0),
          minutes: Number(row.dataset.minutes || 0),
          rating: fixClean(row.dataset.rating) || 'other',
        });
      });
    });
    return entries.sort((a, b) => a.date - b.date || a.row - b.row);
  }

  const chronologicalEntries = collectListeningEntries();

  /* One authoritative page-tab handler prevents the original static-tab handler and
     the expansion handler from fighting over aria-selected / hidden state. */
  function activateView(name, { updateUrl = true, revealTop = false } = {}) {
    const panels = Array.from(document.querySelectorAll('[data-page-panel]'));
    const names = new Set(panels.map((panel) => panel.dataset.pagePanel));
    const valid = names.has(name) ? name : 'composers';

    document.querySelectorAll('[data-page-tab]').forEach((tab) => {
      const active = tab.dataset.pageTab === valid;
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
      tab.tabIndex = active ? 0 : -1;
    });
    panels.forEach((panel) => { panel.hidden = panel.dataset.pagePanel !== valid; });
    document.body.dataset.classicalActiveView = valid;

    if (updateUrl) {
      const url = new URL(window.location.href);
      if (valid === 'composers') url.searchParams.delete('view');
      else url.searchParams.set('view', valid);
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }

    if (revealTop) {
      const panel = document.querySelector(`[data-page-panel="${CSS.escape(valid)}"]`);
      const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
      const tabHeight = tabs.getBoundingClientRect().height || 0;
      if (panel) {
        const top = Math.max(0, panel.getBoundingClientRect().top + window.scrollY - headerHeight - tabHeight - 18);
        window.scrollTo({ top, behavior: 'auto' });
      }
    }
  }

  tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-page-tab]');
    if (!tab || !tabs.contains(tab)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activateView(tab.dataset.pageTab || 'composers', { updateUrl: true, revealTop: true });
  }, true);

  const initialView = new URL(window.location.href).searchParams.get('view')
    || document.querySelector('[data-page-tab][aria-selected="true"]')?.dataset.pageTab
    || 'composers';
  activateView(initialView, { updateUrl: false, revealTop: false });

  /* The top summary is clearer without duplicating total entries beside unique works. */
  function repairTopStats() {
    const statContainer = document.querySelector('.overall-stats');
    if (!statContainer) return;
    const stats = Array.from(statContainer.querySelectorAll('.overall-stat'));
    const entryStat = stats.find((stat) => fixNorm(stat.querySelector('span')?.textContent) === 'listening entries');
    entryStat?.remove();

    const profiledCount = composerCards.filter((card) => !card.querySelector('.profile-badge')).length;
    const composerStat = Array.from(statContainer.querySelectorAll('.overall-stat'))
      .find((stat) => fixNorm(stat.querySelector('span')?.textContent) === 'composers explored');
    if (composerStat) {
      const value = composerStat.querySelector('strong');
      if (value) value.textContent = profiledCount.toLocaleString('en-US');
      composerStat.title = 'Composer profiles added to the Classical Canon journey';
    }
    statContainer.classList.add('classical-stats-five');
  }

  /* Explain what the archive represents, including why some logged composers are not
     yet formal profile cards. */
  function addCanonJourneyHelp() {
    if (document.querySelector('.classical-canon-help-button')) return;
    const updated = document.querySelector('.updated-note');
    if (!updated) return;

    const row = document.createElement('div');
    row.className = 'classical-canon-help-row';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'classical-canon-help-button';
    button.textContent = '?';
    button.setAttribute('aria-label', 'About my Western classical music canon journey');
    row.append(button);
    updated.insertAdjacentElement('afterend', row);

    const dialog = document.createElement('dialog');
    dialog.className = 'classical-canon-dialog';
    dialog.innerHTML = `
      <header class="classical-canon-dialog__header">
        <div><span>About this archive</span><h2>My Western Classical Music Canon Journey</h2></div>
        <button type="button" class="classical-canon-dialog__close">Close</button>
      </header>
      <div class="classical-canon-dialog__body">
        <p>I listened to Western classical music long before I began tracking it. Once I started logging my listening, I turned that existing interest into a deliberate project: <strong>work through the classical canon, composer by composer, and hear the major works associated with each.</strong></p>
        <p>The goal is not completion for its own sake. It is discovery — comparing eras, forms, composers, and performances in a systematic way so I can find the music I most want to return to.</p>
        <p>This public archive tracks that structured journey from Nov. 23, 2024 onward. A composer receives a full portrait profile here when I formally reach and add them to my Raindrop canon. The listening log can encounter other composers earlier, which is why some entries may exist before a profile is added.</p>
      </div>
    `;
    document.body.append(dialog);
    button.addEventListener('click', () => dialog.showModal());
    dialog.querySelector('.classical-canon-dialog__close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  }

  /* Composer defaults: only formal Raindrop profiles, surname order, with an explicit
     switch for revealing listening-log-only / Profile Pending cards. */
  function setupComposerDefaults() {
    const search = document.querySelector('#composer-search');
    const period = document.querySelector('#period-filter');
    const status = document.querySelector('#status-filter');
    const sort = document.querySelector('#composer-sort');
    const results = document.querySelector('#composer-results');
    const resultRow = results?.closest('.results-row');
    const clear = document.querySelector('#clear-composer-filters');
    if (!search || !period || !status || !sort || !results || !resultRow) return;

    const pendingCards = composerCards.filter((card) => card.querySelector('.profile-badge'));
    let showPending = false;

    const defaultOption = Array.from(sort.options).find((option) => option.value === 'name-asc');
    if (defaultOption) defaultOption.textContent = 'Surname A–Z';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'classical-pending-toggle';
    toggle.setAttribute('aria-pressed', 'false');
    resultRow.append(toggle);

    const surnameKey = (name) => {
      const words = fixNorm(name).split(/\s+/).filter(Boolean);
      return words.at(-1) || fixNorm(name);
    };

    function matchesBaseFilters(card) {
      const words = fixNorm(search.value).split(/\s+/).filter(Boolean);
      const searchText = fixClean(card.dataset.search);
      const searchMatches = !words.length || words.every((word) => searchText.includes(word));
      const periodMatches = !period.value || card.dataset.period === period.value;
      const entries = Number(card.dataset.entries || 0);
      const favorites = Number(card.dataset.favorites || 0);
      let statusMatches = true;
      if (status.value === 'heard') statusMatches = entries > 0;
      else if (status.value === 'unheard') statusMatches = entries === 0;
      else if (status.value === 'favorites') statusMatches = favorites > 0;
      return searchMatches && periodMatches && statusMatches;
    }

    function applyComposerDefaults() {
      let visible = 0;
      let matchingPendingHidden = 0;
      composerCards.forEach((card) => {
        const baseMatches = matchesBaseFilters(card);
        const pending = Boolean(card.querySelector('.profile-badge'));
        const show = baseMatches && (showPending || !pending);
        card.hidden = !show;
        if (show) visible += 1;
        else if (baseMatches && pending && !showPending) matchingPendingHidden += 1;
      });

      if (sort.value === 'name-asc') {
        [...composerCards]
          .sort((a, b) => {
            const surnameCompare = fixCollator.compare(surnameKey(a.dataset.name), surnameKey(b.dataset.name));
            return surnameCompare || fixCollator.compare(a.dataset.name || '', b.dataset.name || '');
          })
          .forEach((card) => composerGrid.append(card));
      }

      toggle.textContent = showPending
        ? 'Hide pending profiles'
        : `Show ${pendingCards.length.toLocaleString('en-US')} pending profile${pendingCards.length === 1 ? '' : 's'}`;
      toggle.setAttribute('aria-pressed', showPending ? 'true' : 'false');

      if (showPending) {
        results.textContent = `Showing ${visible.toLocaleString('en-US')} composers · pending profiles included`;
      } else {
        results.textContent = matchingPendingHidden
          ? `Showing ${visible.toLocaleString('en-US')} profiled composers · ${matchingPendingHidden.toLocaleString('en-US')} matching pending hidden`
          : `Showing ${visible.toLocaleString('en-US')} profiled composers`;
      }
    }

    let composerTimer = 0;
    const schedule = () => {
      window.clearTimeout(composerTimer);
      composerTimer = window.setTimeout(applyComposerDefaults, 0);
    };

    search.addEventListener('input', schedule);
    period.addEventListener('change', schedule);
    status.addEventListener('change', schedule);
    sort.addEventListener('change', schedule);
    clear?.addEventListener('click', () => window.setTimeout(applyComposerDefaults, 0));
    toggle.addEventListener('click', () => {
      showPending = !showPending;
      applyComposerDefaults();
    });

    applyComposerDefaults();
  }

  /* The old Month / Agenda switch was fighting the hidden attribute. Keep the month
     calendar and a synchronized daily agenda together instead. */
  function setupCalendarMainstay() {
    const host = document.querySelector('[data-page-panel="calendar"] [data-classical-panel-content]');
    if (!host) return;
    let rebuilding = false;

    function rebuildAgenda() {
      if (rebuilding) return;
      const shell = host.querySelector('.classical-calendar-shell');
      const grid = shell?.querySelector('.classical-calendar-grid');
      const weekdays = shell?.querySelector('.classical-calendar-weekdays');
      if (!shell || !grid) return;

      rebuilding = true;
      shell.querySelector('.classical-calendar-mode-switch')?.remove();
      weekdays?.removeAttribute('hidden');
      grid.removeAttribute('hidden');

      const monthLabel = fixClean(shell.querySelector('.classical-calendar-nav strong')?.textContent);
      const sourceSignature = `${monthLabel}|${Array.from(grid.querySelectorAll('[data-work-open]')).map((button) => button.dataset.workOpen).join('~')}`;
      let agenda = shell.querySelector('.classical-calendar-agenda');
      if (!agenda) {
        agenda = document.createElement('div');
        agenda.className = 'classical-calendar-agenda';
        grid.insertAdjacentElement('afterend', agenda);
      }

      let heading = shell.querySelector('.classical-agenda-heading');
      if (!heading) {
        heading = document.createElement('div');
        heading.className = 'classical-agenda-heading';
        heading.innerHTML = '<h3>Daily Listening</h3><p>The same month as an expanded day-by-day list.</p>';
        agenda.insertAdjacentElement('beforebegin', heading);
      }

      if (agenda.dataset.sourceSignature !== sourceSignature) {
        agenda.replaceChildren();
        grid.querySelectorAll('.classical-calendar-day:not(.classical-calendar-day--outside)').forEach((day) => {
          const buttons = Array.from(day.querySelectorAll('.classical-calendar-work'));
          if (!buttons.length) return;
          const item = document.createElement('section');
          item.className = 'classical-calendar-agenda-day';
          const head = document.createElement('div');
          head.className = 'classical-calendar-agenda-day__head';
          const dayNumber = fixClean(day.querySelector('.classical-calendar-day__head b')?.textContent);
          const duration = fixClean(day.querySelector('.classical-calendar-day__head span')?.textContent);
          head.innerHTML = `<b>${dayNumber}</b><span>${duration}</span>`;
          const works = document.createElement('div');
          works.className = 'classical-calendar-agenda-day__works';
          buttons.forEach((button) => works.append(button.cloneNode(true)));
          const more = day.querySelector('.classical-calendar-more');
          if (more) works.append(more.cloneNode(true));
          item.append(head, works);
          agenda.append(item);
        });
        agenda.dataset.sourceSignature = sourceSignature;
      }
      agenda.classList.add('classical-calendar-agenda--mainstay');
      agenda.removeAttribute('hidden');
      rebuilding = false;
    }

    host.addEventListener('click', (event) => {
      const clonedWork = event.target.closest('.classical-calendar-agenda [data-work-open]');
      if (!clonedWork) return;
      event.preventDefault();
      event.stopPropagation();
      const key = clonedWork.dataset.workOpen;
      const grid = host.querySelector('.classical-calendar-grid');
      const original = Array.from(grid?.querySelectorAll('[data-work-open]') || [])
        .find((button) => button.dataset.workOpen === key);
      original?.click();
    });

    const observer = new MutationObserver(() => window.requestAnimationFrame(rebuildAgenda));
    observer.observe(host, { childList: true, subtree: true });
    rebuildAgenda();
  }

  function getLongestComposerRun(entries) {
    if (!entries.length) return null;
    const runs = [];
    let current = null;
    entries.forEach((entry) => {
      if (!current || current.composerId !== entry.composerId) {
        if (current) runs.push(current);
        current = {
          composerId: entry.composerId,
          composer: entry.composer,
          entries: [],
          minutes: 0,
          firstDate: entry.date,
          lastDate: entry.date,
          pieces: new Set(),
        };
      }
      current.entries.push(entry);
      current.minutes += entry.minutes;
      current.lastDate = entry.date;
      current.pieces.add(fixNorm(entry.piece));
    });
    if (current) runs.push(current);

    const multiEntryRuns = runs.filter((run) => run.entries.length > 1);
    const pool = multiEntryRuns.length ? multiEntryRuns : runs;
    return pool.sort((a, b) =>
      b.entries.length - a.entries.length
      || b.minutes - a.minutes
      || (b.lastDate - b.firstDate) - (a.lastDate - a.firstDate)
    )[0] || null;
  }

  function patchRecords() {
    const recordsPanel = document.querySelector('[data-page-panel="records"]');
    if (!recordsPanel) return;
    const run = getLongestComposerRun(chronologicalEntries);
    if (run) {
      const card = Array.from(recordsPanel.querySelectorAll('.classical-record-card'))
        .find((candidate) => fixNorm(candidate.querySelector('p')?.textContent) === 'longest composer marathon');
      if (card) {
        card.dataset.consecutiveComposerRun = 'true';
        const value = card.querySelector(':scope > strong');
        const detail = card.querySelector('.classical-record-detail, :scope > button');
        const sub = card.querySelector(':scope > em');
        const workCount = run.pieces.size;
        const dateRange = run.firstDate === run.lastDate
          ? fixFormatDate(run.firstDate)
          : `${fixFormatDate(run.firstDate)} → ${fixFormatDate(run.lastDate)}`;
        if (value) value.textContent = `${run.entries.length.toLocaleString('en-US')} consecutive listens`;
        if (detail) detail.textContent = run.composer;
        if (sub) sub.textContent = `${workCount.toLocaleString('en-US')} unique work${workCount === 1 ? '' : 's'} · ${fixFormatMinutes(run.minutes)} · ${dateRange}`;

        card.querySelector('.classical-record-avatar')?.remove();
        const visual = composerVisual(composerMap.get(run.composerId));
        if (visual) card.append(visual);
      }
    }

    const milestoneButtons = Array.from(recordsPanel.querySelectorAll('.classical-milestone-row button[data-work-open]'));
    milestoneButtons.forEach((button) => {
      const target = Number(button.querySelector('b')?.textContent?.replace(/[^0-9]/g, '') || 0);
      const entry = target > 0 ? chronologicalEntries[target - 1] : null;
      if (!entry) return;
      button.classList.add('classical-milestone-rich');
      button.innerHTML = `
        <span class="classical-milestone-number">#${target.toLocaleString('en-US')}</span>
        <span class="classical-milestone-date">${fixFormatDate(entry.date)}</span>
        <strong>${entry.piece}</strong>
        <em>${entry.composer} · ${fixRatingLabel(entry.rating)} · ${fixFormatMinutes(entry.minutes)}</em>
      `;
      button.title = `Entry ${target.toLocaleString('en-US')}: ${entry.composer} — ${entry.piece}`;
    });
  }

  repairTopStats();
  addCanonJourneyHelp();
  setupComposerDefaults();
  setupCalendarMainstay();
  patchRecords();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalFixesV3(), { once: true });
} else {
  bootClassicalFixesV3();
}
