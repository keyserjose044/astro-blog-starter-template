/* LifeLoggerz Classical Music — consolidated runtime, Aug. 6, 2026.
   Replaces the layered expansion/polish/fix script cascade with one authoritative
   controller while preserving the server-rendered Astro page as the stable base. */

const CLASSICAL_RUNTIME_VERSION = '20260806-0018';
const CLASSICAL_PAGE_SIZE = 40;
const DAY = 86400000;

const clean = (value) => String(value ?? '').trim();
const norm = (value) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const esc = (value) => clean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value || 0));
  if (minutes < 60) return `${Math.round(minutes).toLocaleString('en-US')} min`;
  const hours = minutes / 60;
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hr${Math.abs(hours - 1) < .05 ? '' : 's'}`;
}

function formatHours(value) {
  const hours = Math.max(0, Number(value || 0)) / 60;
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hrs`;
}

function formatDate(ms, { short = false, monthOnly = false } = {}) {
  const date = new Date(Number(ms || 0));
  if (!ms || Number.isNaN(date.getTime())) return 'Date not logged';
  return new Intl.DateTimeFormat('en-US', monthOnly
    ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
    : { year: 'numeric', month: short ? 'short' : 'long', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function dateKey(ms) {
  const date = new Date(Number(ms || 0));
  if (!ms || Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function monthKey(ms) {
  const date = new Date(Number(ms || 0));
  if (!ms || Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function ratingLabel(bucket) {
  if (bucket === 'amazing') return 'Amazing';
  if (bucket === 'gorgeous') return 'Gorgeous';
  return 'Other';
}

function ratingRank(bucket) {
  if (bucket === 'amazing') return 3;
  if (bucket === 'gorgeous') return 2;
  return 1;
}

function parseCompositionYear(raw) {
  const match = clean(raw).match(/\b(\d{3,4})\b/);
  return match ? Number(match[1]) : 0;
}

function youtubeId(value) {
  const raw = clean(value);
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.href);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    let id = '';
    if (host === 'youtu.be') id = parts[0] || '';
    else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      id = url.searchParams.get('v')
        || (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : '')
        || '';
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : '';
  } catch (_error) {
    return '';
  }
}

function workKey(composerId, piece) {
  /* One centralized identity function. The current archive still keys unique works by
     composer + normalized Piece text; future Composition/Performance separation only
     needs to replace this function and the server-side equivalent. */
  return `${clean(composerId)}|${norm(piece)}`;
}

function lifeFromMeta(meta) {
  return clean(meta).match(/\b(?:c\.?\s*)?\d{3,4}\s*[–—-]\s*(?:c\.?\s*)?(?:\d{3,4}|present)\b/i)?.[0] || '';
}

function nationalityFromMeta(meta, period = '') {
  const life = lifeFromMeta(meta);
  const periodNorm = norm(period);
  return clean(meta)
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .find((part) => part && part !== life && norm(part) !== periodNorm) || '';
}

function bootClassicalRuntime(attempt = 0) {
  const tabs = document.querySelector('.page-tabs');
  const composerGrid = document.querySelector('#composer-grid');
  const worksPanel = document.querySelector('[data-page-panel="works"]');
  const workItems = Array.from(document.querySelectorAll('[data-work-item]'));

  if ((!tabs || !composerGrid || !worksPanel || !workItems.length) && attempt < 240) {
    window.setTimeout(() => bootClassicalRuntime(attempt + 1), 50);
    return;
  }
  if (!tabs || !composerGrid || !worksPanel || !workItems.length || document.body.dataset.classicalRuntimeReady) return;
  document.body.dataset.classicalRuntimeReady = CLASSICAL_RUNTIME_VERSION;

  const composerCards = Array.from(composerGrid.querySelectorAll('.composer-card[data-composer-id]'));
  const composers = new Map();
  const composersByName = new Map();

  composerCards.forEach((card) => {
    const id = clean(card.dataset.composerId);
    const name = clean(card.dataset.name) || id.replace(/-/g, ' ');
    const meta = clean(card.querySelector('.composer-meta')?.textContent);
    const period = clean(card.dataset.period);
    const life = lifeFromMeta(meta);
    const birthYear = Number(life.match(/\d{3,4}/)?.[0] || 0);
    const portrait = card.querySelector('.portrait')?.getAttribute('src') || '';
    const initials = clean(card.querySelector('.portrait-fallback')?.textContent)
      || name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 3);
    const record = {
      id,
      name,
      card,
      meta,
      life,
      birthYear,
      period,
      nationality: nationalityFromMeta(meta, period),
      portrait,
      initials,
      profiled: !card.querySelector('.profile-badge'),
      entriesCount: Number(card.dataset.entries || 0),
      worksCount: Number(card.dataset.unique || 0),
      minutes: Number(card.dataset.minutes || 0),
      favoritesCount: Number(card.dataset.favorites || 0),
      favoriteRate: Number(card.dataset.rate || 0),
      lastListened: Number(card.dataset.lastListened || 0),
    };
    composers.set(id, record);
    composersByName.set(norm(name), record);
  });

  function composerVisual(composer, className) {
    if (!composer) return '';
    if (composer.portrait) return `<img class="${className}" src="${esc(composer.portrait)}" alt="" loading="lazy" decoding="async">`;
    return `<span class="${className} classical-polish-avatar--fallback" aria-hidden="true">${esc(composer.initials || composer.name.slice(0, 2))}</span>`;
  }

  function findComposerByName(value) {
    const normalized = norm(value);
    if (!normalized) return null;
    if (composersByName.has(normalized)) return composersByName.get(normalized);
    return Array.from(composersByName.entries())
      .find(([candidate]) => candidate.includes(normalized) || normalized.includes(candidate))?.[1] || null;
  }

  const works = new Map();
  workItems.forEach((item) => {
    const composerId = clean(item.dataset.composer);
    const piece = clean(item.querySelector('.entry-title')?.textContent);
    const key = workKey(composerId, piece);
    const meta = clean(item.querySelector('.entry-meta')?.textContent);
    const record = {
      key,
      item,
      composerId,
      composer: clean(item.querySelector('.entry-composer')?.textContent) || composers.get(composerId)?.name || composerId,
      piece,
      form: clean(item.dataset.form),
      period: clean(item.dataset.period),
      compositionYear: meta.match(/\b\d{3,4}(?:[-–]\d{1,4})?\b/)?.[0] || '',
      compositionYearNumber: 0,
      rating: clean(item.dataset.rating) || 'other',
      latestDate: Number(item.dataset.date || 0),
      latestMinutes: Number(item.dataset.minutes || 0),
      listenCount: Number(item.dataset.listens || 1),
      firstDate: 0,
      totalMinutes: 0,
      performanceCount: 0,
      performanceUrls: [],
      entries: [],
      favorite: ['amazing', 'gorgeous'].includes(item.dataset.rating || ''),
    };
    record.compositionYearNumber = parseCompositionYear(record.compositionYear);
    works.set(key, record);
  });

  const entries = [];
  composerCards.forEach((card) => {
    const composerId = clean(card.dataset.composerId);
    const composer = composers.get(composerId)?.name || clean(card.dataset.name);
    const template = document.querySelector(`#composer-template-${CSS.escape(composerId)}`);
    template?.content?.querySelectorAll('[data-detail-panel="history"] [data-list-item]').forEach((row) => {
      const piece = clean(row.querySelector('.entry-title')?.textContent);
      const key = workKey(composerId, piece);
      const date = Number(row.dataset.date || 0);
      const entry = {
        key,
        composerId,
        composer,
        piece,
        date,
        minutes: Number(row.dataset.minutes || 0),
        rating: clean(row.dataset.rating) || 'other',
        row: Number(row.dataset.row || 0),
        url: row.querySelector('.play-link[href]')?.getAttribute('href') || '',
      };
      if (date) entries.push(entry);
      if (!works.has(key)) {
        works.set(key, {
          key,
          item: null,
          composerId,
          composer,
          piece,
          form: '',
          period: '',
          compositionYear: '',
          compositionYearNumber: 0,
          rating: entry.rating,
          latestDate: date,
          latestMinutes: entry.minutes,
          listenCount: 1,
          firstDate: date,
          totalMinutes: entry.minutes,
          performanceCount: entry.url ? 1 : 0,
          performanceUrls: entry.url ? [entry.url] : [],
          entries: [entry],
          favorite: ['amazing', 'gorgeous'].includes(entry.rating),
        });
      }
    });
  });
  entries.sort((a, b) => a.date - b.date || a.row - b.row);

  works.forEach((work) => {
    const history = entries.filter((entry) => entry.key === work.key).sort((a, b) => a.date - b.date || a.row - b.row);
    if (history.length) {
      work.entries = history;
      work.listenCount = history.length;
      work.firstDate = history[0].date;
      work.latestDate = history.at(-1).date;
      work.totalMinutes = history.reduce((sum, entry) => sum + entry.minutes, 0);
      work.performanceUrls = [...new Set(history.map((entry) => entry.url).filter(Boolean))];
      work.performanceCount = work.performanceUrls.length;
      const best = [...history].sort((a, b) => ratingRank(b.rating) - ratingRank(a.rating))[0];
      if (best) work.rating = best.rating;
      work.favorite = ['amazing', 'gorgeous'].includes(work.rating);
    } else {
      work.firstDate = work.latestDate;
      work.totalMinutes = work.latestMinutes;
    }
    if (work.item) {
      work.item.dataset.firstDate = String(work.firstDate || 0);
      work.item.dataset.totalMinutes = String(work.totalMinutes || 0);
      work.item.dataset.compositionYearSort = String(work.compositionYearNumber || 0);
      work.item.dataset.performanceCount = String(work.performanceCount || 0);
    }
  });

  const workRecords = Array.from(works.values());
  const favoriteWorks = workRecords.filter((work) => work.favorite);
  const repeatedWorks = workRecords.filter((work) => work.listenCount > 1);
  const latestEntryDate = Math.max(...entries.map((entry) => entry.date), Date.UTC(2024, 10, 23));
  const earliestEntryDate = Math.min(...entries.map((entry) => entry.date).filter(Boolean), latestEntryDate);

  function createPanel(id, heading, description) {
    let panel = document.querySelector(`[data-page-panel="${id}"]`);
    if (!panel) {
      panel = document.createElement('section');
      panel.className = `page-panel classical-expansion-panel${id === 'world' ? ' classical-world-panel' : ''}`;
      panel.dataset.pagePanel = id;
      panel.setAttribute('role', 'tabpanel');
      panel.hidden = true;
      document.querySelector('main.wrap')?.append(panel);
    }
    panel.innerHTML = `<div class="panel-heading"><h2>${esc(heading)}</h2><p>${esc(description)}</p></div><div data-classical-panel-content></div>`;
    return panel;
  }

  const viewDefinitions = [
    ['overview', 'Overview'],
    ['composers', 'Composers'],
    ['works', 'Works'],
    ['calendar', 'Calendar'],
    ['journey', 'Journey'],
    ['world', 'World'],
    ['records', 'Records'],
    ['favorites', 'Favorites'],
  ];

  const calendarPanel = createPanel('calendar', 'Listening Calendar', 'See when classical listening happened, what filled each day, and how intense each session became.');
  const journeyPanel = createPanel('journey', 'Classical Canon Journey', 'Follow the composer-by-composer Canon Trail or retrace the order in which the music entered my own listening life.');
  const worldPanel = createPanel('world', 'Composer World', 'Explore the profiled classical canon geographically, using the country and regional identity stored with each composer profile.');
  const recordsPanel = createPanel('records', 'Listening Records', 'Memorable extremes, milestones, and unusually large moments in the classical archive.');
  const favoritesPanel = createPanel('favorites', 'Favorites', 'The works and composers that rose above the archive rather than merely passing through it.');

  viewDefinitions.forEach(([id, label]) => {
    let tab = tabs.querySelector(`[data-page-tab="${id}"]`);
    if (!tab) {
      tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'page-tab';
      tab.setAttribute('role', 'tab');
      tab.dataset.pageTab = id;
      tab.textContent = label;
    }
    tabs.append(tab);
  });

  function activateView(name, { updateUrl = true, reveal = false } = {}) {
    const valid = viewDefinitions.some(([id]) => id === name) ? name : 'composers';
    tabs.querySelectorAll('[data-page-tab]').forEach((tab) => {
      const active = tab.dataset.pageTab === valid;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    document.querySelectorAll('[data-page-panel]').forEach((panel) => { panel.hidden = panel.dataset.pagePanel !== valid; });
    document.body.dataset.classicalActiveView = valid;
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (valid === 'composers') url.searchParams.delete('view');
      else url.searchParams.set('view', valid);
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
    if (reveal) {
      const panel = document.querySelector(`[data-page-panel="${CSS.escape(valid)}"]`);
      if (panel) {
        const headerHeight = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
        const top = Math.max(0, panel.getBoundingClientRect().top + window.scrollY - headerHeight - tabs.getBoundingClientRect().height - 16);
        window.scrollTo({ top, behavior: 'auto' });
      }
    }
  }

  tabs.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-page-tab]');
    if (!tab || !tabs.contains(tab)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    activateView(tab.dataset.pageTab || 'composers', { reveal: true });
  }, true);

  tabs.addEventListener('keydown', (event) => {
    const current = event.target.closest('[data-page-tab]');
    if (!current) return;
    const controls = Array.from(tabs.querySelectorAll('[data-page-tab]'));
    const index = controls.indexOf(current);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % controls.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + controls.length) % controls.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = controls.length - 1;
    else return;
    event.preventDefault();
    const target = controls[next];
    activateView(target.dataset.pageTab || 'composers');
    target.focus();
  });

  function repairTopStats() {
    const statContainer = document.querySelector('.overall-stats');
    if (!statContainer) return;
    Array.from(statContainer.querySelectorAll('.overall-stat')).forEach((stat) => {
      if (norm(stat.querySelector('span')?.textContent) === 'listening entries') stat.remove();
    });
    const composerStat = Array.from(statContainer.querySelectorAll('.overall-stat'))
      .find((stat) => norm(stat.querySelector('span')?.textContent) === 'composers explored');
    if (composerStat) {
      composerStat.querySelector('strong').textContent = composerCards.filter((card) => !card.querySelector('.profile-badge')).length.toLocaleString('en-US');
      composerStat.title = 'Composer profiles formally reached in the Classical Canon journey';
    }
    let listeningDays = statContainer.querySelector('[data-classical-listening-days]');
    if (!listeningDays) {
      const source = statContainer.querySelector('.overall-stat');
      listeningDays = source ? source.cloneNode(true) : document.createElement('div');
      listeningDays.className = 'overall-stat';
      listeningDays.dataset.classicalListeningDays = 'true';
      let strong = listeningDays.querySelector('strong');
      let span = listeningDays.querySelector('span');
      if (!strong) { strong = document.createElement('strong'); listeningDays.append(strong); }
      if (!span) { span = document.createElement('span'); listeningDays.append(span); }
      strong.textContent = new Set(entries.map((entry) => dateKey(entry.date))).size.toLocaleString('en-US');
      span.textContent = 'listening days';
      listeningDays.title = 'Distinct calendar days with at least one tracked classical listening entry';
      statContainer.append(listeningDays);
    }
    statContainer.classList.remove('classical-stats-five');
    statContainer.classList.add('classical-stats-six');
  }

  function setupCanonHelp() {
    if (document.querySelector('.classical-canon-help-button')) return;
    const randomFavorite = document.querySelector('#random-favorite');
    if (!randomFavorite) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'classical-canon-help-button classical-canon-help-button--toolbar';
    button.textContent = '?';
    button.setAttribute('aria-label', 'About my Western classical music canon journey');
    button.title = 'About my Western classical music canon journey';

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
        <p>This public archive tracks that structured journey from Nov. 23, 2024 onward. A composer receives a full portrait profile here when I formally reach and add them to my canon. The listening log can encounter other composers earlier, which is why some entries may exist before a profile is added.</p>
      </div>`;
    document.body.append(dialog);

    const mobileSlot = document.createElement('div');
    mobileSlot.className = 'classical-canon-help-mobile-slot';
    tabs.insertAdjacentElement('afterend', mobileSlot);
    const mobileQuery = window.matchMedia('(max-width: 700px)');
    const place = () => {
      if (mobileQuery.matches) {
        button.classList.remove('classical-canon-help-button--toolbar');
        button.classList.add('classical-canon-help-button--nav');
        mobileSlot.append(button);
      } else {
        button.classList.remove('classical-canon-help-button--nav');
        button.classList.add('classical-canon-help-button--toolbar');
        randomFavorite.insertAdjacentElement('afterend', button);
      }
    };
    mobileQuery.addEventListener?.('change', place);
    place();
    button.addEventListener('click', () => dialog.showModal());
    dialog.querySelector('.classical-canon-dialog__close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  }

  function setupComposerLibrary() {
    const search = document.querySelector('#composer-search');
    const period = document.querySelector('#period-filter');
    const status = document.querySelector('#status-filter');
    const sort = document.querySelector('#composer-sort');
    const results = document.querySelector('#composer-results');
    const resultRow = results?.closest('.results-row');
    const clearButton = document.querySelector('#clear-composer-filters');
    if (!search || !period || !status || !sort || !results || !resultRow) return;

    const pendingCards = composerCards.filter((card) => card.querySelector('.profile-badge'));
    let showPending = false;
    const option = Array.from(sort.options).find((candidate) => candidate.value === 'name-asc');
    if (option) option.textContent = 'Surname A–Z';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'classical-pending-toggle';
    toggle.setAttribute('aria-pressed', 'false');
    resultRow.append(toggle);

    composerCards.forEach((card) => {
      const stats = card.querySelector('.composer-stats');
      if (!stats || stats.querySelector('.classical-mobile-return-stat') || Number(card.dataset.entries || 0) <= 0) return;
      const composerId = card.dataset.composerId || '';
      const repeated = workRecords.filter((work) => work.composerId === composerId && work.listenCount > 1).length;
      const latest = Number(card.dataset.lastListened || 0) ? formatDate(Number(card.dataset.lastListened), { monthOnly: true }) : 'Not yet';
      const cell = document.createElement('span');
      cell.className = 'stat classical-mobile-return-stat';
      cell.innerHTML = `<strong>↻ ${repeated.toLocaleString('en-US')} repeated</strong><span>Latest ${esc(latest)}</span>`;
      stats.append(cell);
    });

    const surname = (name) => norm(name).split(/\s+/).filter(Boolean).at(-1) || norm(name);
    function matches(card) {
      const words = norm(search.value).split(/\s+/).filter(Boolean);
      const textMatch = !words.length || words.every((word) => clean(card.dataset.search).includes(word));
      const periodMatch = !period.value || card.dataset.period === period.value;
      const entriesCount = Number(card.dataset.entries || 0);
      const favoritesCount = Number(card.dataset.favorites || 0);
      let statusMatch = true;
      if (status.value === 'heard') statusMatch = entriesCount > 0;
      else if (status.value === 'unheard') statusMatch = entriesCount === 0;
      else if (status.value === 'favorites') statusMatch = favoritesCount > 0;
      return textMatch && periodMatch && statusMatch;
    }

    function apply() {
      let visible = 0;
      let hiddenPending = 0;
      composerCards.forEach((card) => {
        const base = matches(card);
        const pending = Boolean(card.querySelector('.profile-badge'));
        const show = base && (showPending || !pending);
        card.hidden = !show;
        if (show) visible += 1;
        else if (base && pending && !showPending) hiddenPending += 1;
      });

      if (sort.value === 'name-asc') {
        [...composerCards].sort((a, b) => collator.compare(surname(a.dataset.name), surname(b.dataset.name)) || collator.compare(a.dataset.name || '', b.dataset.name || ''))
          .forEach((card) => composerGrid.append(card));
      }

      toggle.textContent = showPending ? 'Hide pending profiles' : `Show ${pendingCards.length.toLocaleString('en-US')} pending profiles`;
      toggle.setAttribute('aria-pressed', String(showPending));
      results.textContent = showPending
        ? `Showing ${visible.toLocaleString('en-US')} composers · pending profiles included`
        : hiddenPending
          ? `Showing ${visible.toLocaleString('en-US')} profiled composers · ${hiddenPending.toLocaleString('en-US')} matching pending hidden`
          : `Showing ${visible.toLocaleString('en-US')} profiled composers`;
    }

    const schedule = () => window.setTimeout(apply, 0);
    search.addEventListener('input', schedule);
    period.addEventListener('change', schedule);
    status.addEventListener('change', schedule);
    sort.addEventListener('change', schedule);
    clearButton?.addEventListener('click', schedule);
    toggle.addEventListener('click', () => { showPending = !showPending; apply(); });
    apply();
  }

  function ensureWorkDialog() {
    let dialog = document.querySelector('#classical-work-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'classical-work-dialog';
    dialog.className = 'classical-work-dialog';
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = '<div data-work-dialog-content></div>';
    document.body.append(dialog);
    dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
    return dialog;
  }

  function openWork(key) {
    const work = works.get(key);
    if (!work) return;
    const dialog = ensureWorkDialog();
    const content = dialog.querySelector('[data-work-dialog-content]');
    const composer = composers.get(work.composerId);
    const history = [...work.entries].sort((a, b) => b.date - a.date || b.row - a.row);
    const metadata = [work.form, work.period, work.compositionYear].filter(Boolean).join(' · ') || 'Metadata not logged';
    const first = work.firstDate || work.latestDate;
    const latest = work.latestDate || work.firstDate;
    const performanceCards = work.performanceUrls.slice(0, 8).map((url, index) => {
      const id = youtubeId(url);
      if (!id) return '';
      const matching = history.find((entry) => entry.url === url);
      return `<a class="classical-performance-card" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Open performance ${index + 1}"><img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="classical-polish-play" aria-hidden="true">▶</span><span><b>Performance ${index + 1}</b><em>${esc(matching ? formatDate(matching.date, { short: true }) : 'Linked listen')}</em></span></a>`;
    }).filter(Boolean).join('');

    content.innerHTML = `
      <header class="classical-work-dialog__header">
        ${composerVisual(composer, 'classical-work-dialog__portrait')}
        <div><span class="classical-work-dialog__eyebrow">${esc(work.composer)}</span><h2 id="classical-work-dialog-title">${esc(work.piece)}</h2><p>${esc(metadata)}</p></div>
        <button type="button" class="classical-work-dialog__close" data-close-work-dialog>Close</button>
      </header>
      <div class="classical-work-dialog__body">
        <div class="classical-work-summary">
          <div><strong>${work.listenCount.toLocaleString('en-US')}</strong><span>listens</span></div>
          <div><strong>${esc(formatMinutes(work.totalMinutes))}</strong><span>total time</span></div>
          <div><strong>${first ? esc(formatDate(first, { short: true })) : '—'}</strong><span>first heard</span></div>
          <div><strong>${latest ? esc(formatDate(latest, { short: true })) : '—'}</strong><span>latest heard</span></div>
          <div><strong>${work.performanceCount.toLocaleString('en-US')}</strong><span>linked performances</span></div>
          <div><strong>${esc(ratingLabel(work.rating))}</strong><span>peak logged rating</span></div>
        </div>
        ${performanceCards ? `<section class="classical-performance-strip"><div class="classical-section-heading"><div><h3>Performances</h3><p>Distinct linked interpretations used across the listening history.</p></div></div><div class="classical-performance-strip__row">${performanceCards}</div></section>` : ''}
        <section class="classical-work-history-section">
          <div class="classical-section-heading"><div><h3>Listening History</h3><p>Every dated encounter with this composition.</p></div>${work.performanceCount ? `<span>${work.performanceCount} linked performance${work.performanceCount === 1 ? '' : 's'}</span>` : ''}</div>
          ${history.length ? `<ol class="classical-work-history">${history.map((entry, index) => `<li><div class="classical-work-history__index">${history.length - index}</div><div class="classical-work-history__main"><strong>${esc(formatDate(entry.date))}</strong><span><span class="rating ${esc(entry.rating)}">${esc(ratingLabel(entry.rating))}</span> ${esc(formatMinutes(entry.minutes))}</span></div>${entry.url ? `<a href="${esc(entry.url)}" target="_blank" rel="noopener noreferrer">Performance ↗</a>` : '<span class="classical-work-history__missing">No link</span>'}</li>`).join('')}</ol>` : '<p class="classical-empty">No dated listening history is available for this work.</p>'}
        </section>
      </div>`;
    dialog.setAttribute('aria-labelledby', 'classical-work-dialog-title');
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => dialog.querySelector('[data-close-work-dialog]')?.focus());
  }

  function patchWorksExplorer() {
    workRecords.forEach((work) => {
      const item = work.item;
      if (!item) return;
      const meta = item.querySelector('.entry-meta');
      if (meta && work.listenCount > 1 && !meta.querySelector('.classical-repeat-badge')) {
        const badge = document.createElement('span');
        badge.className = 'classical-repeat-badge';
        badge.textContent = `↻ ${work.listenCount}`;
        badge.title = `${work.listenCount} recorded listens · ${formatMinutes(work.totalMinutes)} total`;
        meta.append(' ', badge);
      }
      if (meta && work.listenCount > 1 && work.performanceCount > 0 && !meta.querySelector('.classical-performance-count')) {
        const badge = document.createElement('span');
        badge.className = 'classical-performance-count';
        badge.textContent = `${work.performanceCount} performance${work.performanceCount === 1 ? '' : 's'}`;
        meta.append(' ', badge);
      }
      const side = item.querySelector('.entry-side');
      if (side && !side.querySelector('[data-work-open]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'classical-work-details-button';
        button.dataset.workOpen = work.key;
        button.textContent = 'Details';
        side.append(button);
      }
      const main = item.querySelector('.entry-main');
      if (main && !main.dataset.classicalDetailsReady) {
        main.dataset.classicalDetailsReady = 'true';
        main.classList.add('classical-work-main-clickable');
        main.tabIndex = 0;
        main.setAttribute('role', 'button');
        main.setAttribute('aria-label', `Open details for ${work.piece}`);
        main.addEventListener('click', () => openWork(work.key));
        main.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openWork(work.key); }
        });
      }
      if (!item.querySelector('.classical-work-thumbnail, .classical-work-composer-avatar')) {
        const play = item.querySelector('.play-link[href]');
        const id = youtubeId(play?.href);
        if (id) {
          const link = document.createElement('a');
          link.className = 'classical-work-thumbnail';
          link.href = play.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.setAttribute('aria-label', `Open YouTube performance for ${work.piece}`);
          link.innerHTML = `<img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="classical-polish-play" aria-hidden="true">▶</span>`;
          item.classList.add('has-work-thumbnail');
          item.append(link);
        } else {
          const composer = composers.get(work.composerId);
          if (composer) {
            const wrapper = document.createElement('span');
            wrapper.innerHTML = composerVisual(composer, 'classical-work-composer-avatar');
            item.classList.add('has-composer-avatar');
            item.append(wrapper.firstElementChild);
          }
        }
      }
    });

    const toolbar = document.querySelector('.works-toolbar');
    const browser = document.querySelector('#works-browser');
    if (!toolbar || !browser) return;
    let repeatFilter = document.querySelector('#works-repeat-filter');
    if (!repeatFilter) {
      repeatFilter = document.createElement('select');
      repeatFilter.id = 'works-repeat-filter';
      repeatFilter.setAttribute('aria-label', 'Filter works by repeat count');
      repeatFilter.innerHTML = '<option value="">All listens</option><option value="once">Heard once</option><option value="repeat">Repeated</option><option value="3">3+ listens</option><option value="5">5+ listens</option><option value="10">10+ listens</option>';
      toolbar.insertBefore(repeatFilter, document.querySelector('#works-sort') || null);
    }
    const sort = document.querySelector('#works-sort');
    [['first-heard','First heard'],['most-time','Most time spent'],['composition-asc','Composition year ↑'],['composition-desc','Composition year ↓']].forEach(([value, label]) => {
      if (!sort?.querySelector(`option[value="${value}"]`)) sort?.append(new Option(label, value));
    });

    const search = document.querySelector('#works-search');
    const composer = document.querySelector('#works-composer-filter');
    const period = document.querySelector('#works-period-filter');
    const form = document.querySelector('#works-form-filter');
    const rating = document.querySelector('#works-rating-filter');
    const results = document.querySelector('#works-results');
    const clearButton = document.querySelector('#clear-work-filters');
    const list = document.querySelector('#work-list');
    const empty = document.querySelector('#works-empty');
    const more = document.querySelector('#works-more');
    let visibleLimit = CLASSICAL_PAGE_SIZE;
    const items = workRecords.map((work) => work.item).filter(Boolean);

    function apply() {
      const words = norm(search?.value).split(/\s+/).filter(Boolean);
      const selectedComposer = composer?.value || '';
      const selectedPeriod = period?.value || '';
      const selectedForm = form?.value || '';
      const selectedRating = rating?.value || '';
      const repeatMode = repeatFilter.value || '';
      const mode = sort?.value || 'latest';
      const filtered = items.filter((item) => {
        const count = Number(item.dataset.listens || 1);
        const repeatMatch = !repeatMode || (repeatMode === 'once' && count === 1) || (repeatMode === 'repeat' && count > 1) || (/^\d+$/.test(repeatMode) && count >= Number(repeatMode));
        return (!words.length || words.every((word) => clean(item.dataset.search).includes(word)))
          && (!selectedComposer || item.dataset.composer === selectedComposer)
          && (!selectedPeriod || item.dataset.period === selectedPeriod)
          && (!selectedForm || item.dataset.form === selectedForm)
          && (!selectedRating || item.dataset.rating === selectedRating)
          && repeatMatch;
      });
      filtered.sort((a, b) => {
        if (mode === 'composer') return collator.compare(a.dataset.composerName || '', b.dataset.composerName || '') || collator.compare(a.dataset.title || '', b.dataset.title || '');
        if (mode === 'title') return collator.compare(a.dataset.title || '', b.dataset.title || '');
        if (mode === 'longest') return Number(b.dataset.minutes || 0) - Number(a.dataset.minutes || 0);
        if (mode === 'most-listened') return Number(b.dataset.listens || 0) - Number(a.dataset.listens || 0);
        if (mode === 'first-heard') return Number(a.dataset.firstDate || 0) - Number(b.dataset.firstDate || 0);
        if (mode === 'most-time') return Number(b.dataset.totalMinutes || 0) - Number(a.dataset.totalMinutes || 0);
        if (mode === 'composition-asc') return (Number(a.dataset.compositionYearSort || 99999) || 99999) - (Number(b.dataset.compositionYearSort || 99999) || 99999);
        if (mode === 'composition-desc') return Number(b.dataset.compositionYearSort || 0) - Number(a.dataset.compositionYearSort || 0);
        return Number(b.dataset.date || 0) - Number(a.dataset.date || 0) || Number(b.dataset.row || 0) - Number(a.dataset.row || 0);
      });
      items.forEach((item) => { item.hidden = true; });
      filtered.forEach((item, index) => { list?.append(item); item.hidden = index >= visibleLimit; });
      const shown = Math.min(filtered.length, visibleLimit);
      if (results) results.textContent = filtered.length ? `Showing ${shown.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')} works` : 'No matching works';
      if (empty) empty.hidden = filtered.length > 0;
      if (more) more.hidden = filtered.length <= visibleLimit;
      if (clearButton) clearButton.hidden = !(words.length || selectedComposer || selectedPeriod || selectedForm || selectedRating || repeatMode || mode !== 'latest');
    }
    [composer, period, form, rating, repeatFilter].forEach((control) => control?.addEventListener('change', () => { visibleLimit = CLASSICAL_PAGE_SIZE; window.setTimeout(apply, 0); }));
    search?.addEventListener('input', () => { visibleLimit = CLASSICAL_PAGE_SIZE; window.setTimeout(apply, 0); });
    sort?.addEventListener('change', () => window.setTimeout(apply, 0));
    more?.addEventListener('click', () => { visibleLimit += CLASSICAL_PAGE_SIZE; window.setTimeout(apply, 0); });
    clearButton?.addEventListener('click', () => { repeatFilter.value = ''; visibleLimit = CLASSICAL_PAGE_SIZE; window.setTimeout(apply, 0); });

    if (!repeatFilter.dataset.customRepeatReady) {
      repeatFilter.dataset.customRepeatReady = 'true';
      repeatFilter.hidden = true;
      repeatFilter.tabIndex = -1;
      repeatFilter.setAttribute('aria-hidden', 'true');
      const shell = document.createElement('div');
      shell.className = 'classical-repeat-select';
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'classical-repeat-select__trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      const label = document.createElement('span');
      label.className = 'classical-repeat-select__label';
      const chevron = document.createElement('span');
      chevron.className = 'classical-repeat-select__chevron';
      chevron.textContent = '⌄';
      trigger.append(label, chevron);
      const menu = document.createElement('div');
      menu.className = 'classical-repeat-select__menu';
      menu.setAttribute('role', 'listbox');
      menu.hidden = true;
      Array.from(repeatFilter.options).forEach((option) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'classical-repeat-select__option';
        button.dataset.value = option.value;
        button.setAttribute('role', 'option');
        button.textContent = option.textContent || '';
        button.addEventListener('click', () => {
          repeatFilter.value = option.value;
          repeatFilter.dispatchEvent(new Event('change', { bubbles: true }));
          syncRepeat();
          menu.hidden = true;
          trigger.setAttribute('aria-expanded', 'false');
          trigger.focus();
        });
        menu.append(button);
      });
      shell.append(trigger, menu);
      repeatFilter.insertAdjacentElement('beforebegin', shell);
      function syncRepeat() {
        label.textContent = repeatFilter.options[repeatFilter.selectedIndex]?.textContent || 'All listens';
        menu.querySelectorAll('[role="option"]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.value === repeatFilter.value)));
      }
      trigger.addEventListener('click', () => {
        menu.hidden = !menu.hidden;
        trigger.setAttribute('aria-expanded', String(!menu.hidden));
        if (!menu.hidden) requestAnimationFrame(() => menu.querySelector('[aria-selected="true"]')?.focus());
      });
      menu.addEventListener('keydown', (event) => {
        const options = Array.from(menu.querySelectorAll('[role="option"]'));
        const index = options.indexOf(document.activeElement);
        if (event.key === 'Escape') { event.preventDefault(); menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); trigger.focus(); }
        else if (event.key === 'ArrowDown') { event.preventDefault(); options[(index + 1 + options.length) % options.length]?.focus(); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); options[(index - 1 + options.length) % options.length]?.focus(); }
        else if (event.key === 'Home') { event.preventDefault(); options[0]?.focus(); }
        else if (event.key === 'End') { event.preventDefault(); options.at(-1)?.focus(); }
      });
      document.addEventListener('click', (event) => { if (!shell.contains(event.target)) { menu.hidden = true; trigger.setAttribute('aria-expanded', 'false'); } });
      repeatFilter.addEventListener('change', syncRepeat);
      clearButton?.addEventListener('click', () => window.setTimeout(syncRepeat, 0));
      syncRepeat();
    }
    apply();
  }

  function enhanceComposerTemplates() {
    composers.forEach((composer, composerId) => {
      const template = document.querySelector(`#composer-template-${CSS.escape(composerId)}`);
      if (!template?.content || template.dataset.classicalRuntimeEnhanced) return;
      template.dataset.classicalRuntimeEnhanced = 'true';
      const composerWorks = workRecords.filter((work) => work.composerId === composerId).sort((a, b) => b.latestDate - a.latestDate || collator.compare(a.piece, b.piece));
      const repeated = composerWorks.filter((work) => work.listenCount > 1);
      const repeatListens = composerWorks.reduce((sum, work) => sum + Math.max(0, work.listenCount - 1), 0);
      const mostReplayed = [...repeated].sort((a, b) => b.listenCount - a.listenCount || b.totalMinutes - a.totalMinutes)[0];
      const summary = template.content.querySelector('.detail-summary');
      if (summary) summary.insertAdjacentHTML('beforeend', `<div><strong>${repeated.length}</strong><span>repeated works</span></div><div><strong>${repeatListens}</strong><span>repeat listens</span></div>`);
      const note = template.content.querySelector('.overview-note');
      if (note && mostReplayed) note.insertAdjacentHTML('beforeend', ` <strong>Most replayed:</strong> ${esc(mostReplayed.piece)} (${mostReplayed.listenCount} listens, ${esc(formatMinutes(mostReplayed.totalMinutes))}).`);
      const tablist = template.content.querySelector('.detail-tabs');
      const overview = template.content.querySelector('[data-detail-panel="overview"]');
      if (!tablist || !overview || tablist.querySelector('[data-detail-tab="works"]')) return;
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'detail-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.tabIndex = -1;
      tab.dataset.detailTab = 'works';
      tab.textContent = `Works (${composerWorks.length})`;
      tablist.insertBefore(tab, tablist.querySelector('[data-detail-tab="favorites"]') || null);
      const panel = document.createElement('section');
      panel.className = 'detail-panel classical-composer-works-panel';
      panel.setAttribute('role', 'tabpanel');
      panel.dataset.detailPanel = 'works';
      panel.hidden = true;
      panel.innerHTML = `<div class="section-heading"><div><h3>Works</h3><p>${composerWorks.length} unique works · ${repeated.length} revisited</p></div><div class="classical-segmented" data-composer-works-controls><button type="button" aria-pressed="true" data-composer-work-filter="all">All</button><button type="button" aria-pressed="false" data-composer-work-filter="favorites">Favorites</button><button type="button" aria-pressed="false" data-composer-work-filter="repeats">Repeats</button></div></div>${composerWorks.length ? `<ul class="classical-composer-work-list">${composerWorks.map((work) => `<li data-composer-work-row data-favorite="${work.favorite}" data-repeat="${work.listenCount > 1}"><button type="button" data-work-open="${esc(work.key)}"><span class="classical-composer-work-title">${esc(work.piece)}</span><span class="classical-composer-work-meta"><span class="rating ${esc(work.rating)}">${esc(ratingLabel(work.rating))}</span> ${esc([work.form, work.period, work.compositionYear].filter(Boolean).join(' · ') || 'Metadata not logged')}</span></button><span class="classical-composer-work-side"><b>${work.listenCount}×</b>${esc(formatMinutes(work.totalMinutes))}</span></li>`).join('')}</ul>` : '<p class="empty-detail">No works are available for this composer.</p>'}`;
      overview.insertAdjacentElement('afterend', panel);
    });
  }

  function openComposerWorks(composerIdOrName) {
    const composer = composers.get(composerIdOrName) || findComposerByName(composerIdOrName);
    const trigger = composer?.card.querySelector('[data-composer-trigger]');
    if (!trigger) return;
    trigger.click();
    const select = (tries = 0) => {
      const dialog = document.querySelector('#composer-dialog');
      const worksTab = dialog?.querySelector('[data-detail-tab="works"]');
      if (worksTab) { worksTab.click(); return; }
      if (tries < 40) window.setTimeout(() => select(tries + 1), 25);
    };
    window.setTimeout(() => select(), 0);
  }

  function patchOverview() {
    const overview = document.querySelector('[data-page-panel="overview"]');
    const layout = overview?.querySelector('.overview-layout');
    if (!overview || !layout) return;

    overview.querySelectorAll('.recent-item').forEach((item) => {
      if (item.dataset.classicalRuntimeVisual) return;
      item.dataset.classicalRuntimeVisual = 'true';
      const link = item.querySelector('a[href]');
      const title = clean(item.querySelector('strong')?.textContent);
      const composer = findComposerByName(title.split(' · ')[0]);
      const id = youtubeId(link?.href);
      if (id) item.insertAdjacentHTML('afterbegin', `<a class="classical-recent-thumbnail" href="${esc(link.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(title)}"><img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="classical-polish-play" aria-hidden="true">▶</span></a>`);
      else if (composer) item.insertAdjacentHTML('afterbegin', composerVisual(composer, 'classical-recent-avatar'));
    });

    if (!layout.querySelector('[data-most-revisited]')) {
      const top = [...repeatedWorks].sort((a, b) => b.listenCount - a.listenCount || b.totalMinutes - a.totalMinutes || b.latestDate - a.latestDate).slice(0, 10);
      const article = document.createElement('article');
      article.className = 'overview-card classical-most-revisited';
      article.dataset.mostRevisited = 'true';
      article.innerHTML = `<div class="overview-card-header"><div><h3>Most Revisited Works</h3><p>Compositions that have pulled me back more than once.</p></div><span class="classical-mini-stat">${repeatedWorks.length} repeated works</span></div>${top.length ? `<ol class="classical-revisited-list">${top.map((work, index) => `<li><span class="classical-rank">${index + 1}</span><button type="button" data-work-open="${esc(work.key)}"><strong>${esc(work.composer)}</strong><span>${esc(work.piece)}</span></button><span class="classical-revisit-meta"><b>${work.listenCount}×</b>${esc(formatMinutes(work.totalMinutes))}</span></li>`).join('')}</ol>` : '<p class="classical-empty">No repeated works are available yet.</p>'}`;
      layout.append(article);
    }

    if (!layout.querySelector('[data-current-obsessions]')) {
      const cutoff = latestEntryDate - 90 * DAY;
      const byComposer = new Map();
      entries.filter((entry) => entry.date >= cutoff).forEach((entry) => {
        if (!byComposer.has(entry.composerId)) byComposer.set(entry.composerId, { composer: composers.get(entry.composerId), entries: 0, minutes: 0, latest: 0, works: new Set() });
        const stat = byComposer.get(entry.composerId);
        stat.entries += 1;
        stat.minutes += entry.minutes;
        stat.latest = Math.max(stat.latest, entry.date);
        stat.works.add(norm(entry.piece));
      });
      const top = [...byComposer.values()].filter((stat) => stat.composer).sort((a, b) => b.minutes - a.minutes || b.entries - a.entries || b.latest - a.latest).slice(0, 6);
      if (top.length) {
        const article = document.createElement('article');
        article.className = 'overview-card classical-current-obsessions';
        article.dataset.currentObsessions = 'true';
        article.innerHTML = `<div class="overview-card-header"><div><h3>Current Obsessions</h3><p>Composers dominating the latest 90 days of the listening archive.</p></div></div><div class="classical-obsession-grid">${top.map((stat) => `<article class="classical-composer-shortcut" role="button" tabindex="0" data-composer-shortcut="${esc(stat.composer.id)}" aria-label="Open ${esc(stat.composer.name)} works">${composerVisual(stat.composer, 'classical-obsession-avatar')}<div><b>${esc(stat.composer.name)}</b><span>${esc(formatMinutes(stat.minutes))} · ${stat.works.size} works · ${stat.entries} entries</span></div></article>`).join('')}</div>`;
        layout.append(article);
      }
    }
  }

  function buildCalendar() {
    const host = calendarPanel.querySelector('[data-classical-panel-content]');
    if (!host) return;
    const byDay = new Map();
    entries.forEach((entry) => {
      const key = dateKey(entry.date);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(entry);
    });
    const maxDayMinutes = Math.max(1, ...Array.from(byDay.values()).map((list) => list.reduce((sum, entry) => sum + entry.minutes, 0)));
    const earliest = new Date(earliestEntryDate);
    const latest = new Date(latestEntryDate);
    const state = { year: latest.getUTCFullYear(), month: latest.getUTCMonth() };
    const minIndex = earliest.getUTCFullYear() * 12 + earliest.getUTCMonth();
    const maxIndex = latest.getUTCFullYear() * 12 + latest.getUTCMonth();

    function groupedRows(dayEntries) {
      const grouped = new Map();
      dayEntries.forEach((entry) => {
        if (!grouped.has(entry.key)) grouped.set(entry.key, []);
        grouped.get(entry.key).push(entry);
      });
      return Array.from(grouped.entries()).map(([key, group]) => {
        const work = works.get(key);
        const composer = composers.get(group[0].composerId);
        const minutes = group.reduce((sum, entry) => sum + entry.minutes, 0);
        const best = [...group].sort((a, b) => ratingRank(b.rating) - ratingRank(a.rating))[0]?.rating || 'other';
        return `<button type="button" class="classical-calendar-work rating-border-${esc(best)}" data-work-open="${esc(key)}" title="${esc(`${group[0].composer} · ${group[0].piece} · ${formatMinutes(minutes)} · ${ratingLabel(best)}`)}">${composerVisual(composer, 'classical-calendar-composer-avatar')}<span><b>${esc(group[0].composer)}</b><em>${esc(work?.piece || group[0].piece)}</em></span>${group.length > 1 ? `<i>${group.length}×</i>` : ''}</button>`;
      });
    }

    function render() {
      const first = new Date(Date.UTC(state.year, state.month, 1));
      const daysInMonth = new Date(Date.UTC(state.year, state.month + 1, 0)).getUTCDate();
      const leading = first.getUTCDay();
      const monthEntries = entries.filter((entry) => {
        const date = new Date(entry.date);
        return date.getUTCFullYear() === state.year && date.getUTCMonth() === state.month;
      });
      const monthMinutes = monthEntries.reduce((sum, entry) => sum + entry.minutes, 0);
      const monthWorks = new Set(monthEntries.map((entry) => entry.key)).size;
      const cells = [];
      const agendaDays = [];
      for (let i = 0; i < leading; i += 1) cells.push('<div class="classical-calendar-day classical-calendar-day--outside" aria-hidden="true"></div>');
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = dateKey(Date.UTC(state.year, state.month, day));
        const dayEntries = [...(byDay.get(key) || [])].sort((a, b) => b.minutes - a.minutes || b.row - a.row);
        const rows = groupedRows(dayEntries);
        const dayMinutes = dayEntries.reduce((sum, entry) => sum + entry.minutes, 0);
        const intensity = Math.min(1, dayMinutes / maxDayMinutes);
        const visible = rows.slice(0, 4);
        cells.push(`<div class="classical-calendar-day" style="--calendar-activity:${intensity.toFixed(3)}"><div class="classical-calendar-day__head"><b>${day}</b>${dayMinutes ? `<span>${esc(formatMinutes(dayMinutes))}</span>` : ''}</div><div class="classical-calendar-day__works">${visible.join('')}${rows.length > visible.length ? `<span class="classical-calendar-more">+${rows.length - visible.length} more</span>` : ''}</div></div>`);
        if (rows.length) agendaDays.push(`<section class="classical-calendar-agenda-day"><div class="classical-calendar-agenda-day__head"><b>${day}</b><span>${esc(formatMinutes(dayMinutes))}</span></div><div class="classical-calendar-agenda-day__works">${rows.join('')}</div></section>`);
      }
      while (cells.length % 7) cells.push('<div class="classical-calendar-day classical-calendar-day--outside" aria-hidden="true"></div>');
      const currentIndex = state.year * 12 + state.month;
      host.innerHTML = `<div class="classical-calendar-shell"><div class="classical-view-toolbar classical-calendar-toolbar"><div class="classical-calendar-nav"><button type="button" data-calendar-prev aria-label="Previous month" ${currentIndex <= minIndex ? 'disabled' : ''}>‹</button><strong>${esc(formatMonth(first))}</strong><button type="button" data-calendar-next aria-label="Next month" ${currentIndex >= maxIndex ? 'disabled' : ''}>›</button><button type="button" data-calendar-latest>Latest</button></div><div class="classical-calendar-summary"><span><b>${monthEntries.length}</b> entries</span><span><b>${monthWorks}</b> works</span><span><b>${esc(formatMinutes(monthMinutes))}</b></span></div></div><div class="classical-calendar-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => `<span>${day}</span>`).join('')}</div><div class="classical-calendar-grid">${cells.join('')}</div><div class="classical-agenda-heading"><h3>Daily Listening</h3><p>The same month as a complete day-by-day list.</p></div><div class="classical-calendar-agenda classical-calendar-agenda--mainstay">${agendaDays.join('') || '<p class="classical-empty">No listening was logged this month.</p>'}</div></div>`;
      host.querySelector('[data-calendar-prev]')?.addEventListener('click', () => { state.month -= 1; if (state.month < 0) { state.month = 11; state.year -= 1; } render(); });
      host.querySelector('[data-calendar-next]')?.addEventListener('click', () => { state.month += 1; if (state.month > 11) { state.month = 0; state.year += 1; } render(); });
      host.querySelector('[data-calendar-latest]')?.addEventListener('click', () => { state.year = latest.getUTCFullYear(); state.month = latest.getUTCMonth(); render(); });
    }
    render();
  }

  function buildJourney() {
    const host = journeyPanel.querySelector('[data-classical-panel-content]');
    if (!host) return;
    const profiled = Array.from(composers.values()).filter((composer) => composer.profiled);
    const profiledIds = new Set(profiled.map((composer) => composer.id));
    const canonWorks = workRecords.filter((work) => profiledIds.has(work.composerId));
    const canonEntries = entries.filter((entry) => profiledIds.has(entry.composerId));
    const canonFavorites = canonWorks.filter((work) => work.favorite);
    const canonPeriods = new Set(profiled.map((composer) => composer.period).filter(Boolean)).size;
    const recentCutoff = latestEntryDate - 90 * DAY;
    const activeRecently = profiled.filter((composer) => composer.lastListened >= recentCutoff && composer.lastListened > 0).length;
    const periodOrder = ['Medieval','Renaissance','Baroque','Galant','Classical','Romantic','Late Romantic','Impressionist','Modern','Contemporary'];

    const grouped = new Map();
    profiled.forEach((composer) => {
      const period = composer.period || 'Unclassified';
      if (!grouped.has(period)) grouped.set(period, []);
      grouped.get(period).push(composer);
    });
    const orderedPeriods = [...grouped.keys()].sort((a, b) => {
      const ai = periodOrder.indexOf(a); const bi = periodOrder.indexOf(b);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      return collator.compare(a, b);
    });

    function canonNode(composer, index) {
      const composerWorks = workRecords.filter((work) => work.composerId === composer.id);
      const repeated = composerWorks.filter((work) => work.listenCount > 1);
      const topReplay = [...repeated].sort((a, b) => b.listenCount - a.listenCount || b.totalMinutes - a.totalMinutes)[0];
      return `<button type="button" class="canon-node canon-node--${index % 2 === 0 ? 'left' : 'right'}" data-composer-shortcut="${esc(composer.id)}" aria-label="Open ${esc(composer.name)} repertoire"><span class="canon-node__anchor" aria-hidden="true"></span><span class="canon-node__card">${composerVisual(composer, 'canon-node__portrait')}<span class="canon-node__copy"><span class="canon-node__name">${esc(composer.name)}</span><span class="canon-node__identity">${esc([composer.life, composer.nationality].filter(Boolean).join(' · ') || composer.period || 'Composer profile')}</span><span class="canon-node__stats"><span><b>${composerWorks.length}</b> works</span><span><b>${esc(formatMinutes(composer.minutes))}</b> heard</span><span><b>${composerWorks.filter((work) => work.favorite).length}</b> favorites</span><span><b>${repeated.length}</b> repeated</span></span><span class="canon-node__replay">${topReplay ? `${topReplay.listenCount}× ${esc(topReplay.piece)}` : 'No repeat work yet'}</span></span></span></button>`;
    }

    const canonTrail = `<section class="canon-view" data-journey-view="canon"><div class="canon-view__intro"><span class="canon-kicker">THE CANON TRAIL</span><h3>Composer by composer, era by era.</h3><p>This is the formal part of the quest: the composers I have deliberately reached, profiled, and explored. Portraits light up the path as the canon grows; click any composer to open the repertoire I have heard.</p></div><div class="canon-trail">${orderedPeriods.map((period, periodIndex) => {
      const era = [...grouped.get(period)].sort((a, b) => (a.birthYear || 9999) - (b.birthYear || 9999) || collator.compare(a.name, b.name));
      const eraWorks = canonWorks.filter((work) => era.some((composer) => composer.id === work.composerId));
      const eraMinutes = era.reduce((sum, composer) => sum + composer.minutes, 0);
      return `<section class="canon-era"><div class="canon-era__portal"><span class="canon-era__number">${String(periodIndex + 1).padStart(2, '0')}</span><div><h4>${esc(period)}</h4><p>${era.length} composers · ${eraWorks.length} works · ${esc(formatMinutes(eraMinutes))} · ${eraWorks.filter((work) => work.favorite).length} favorites</p></div></div><div class="canon-era__path"><span class="canon-era__spine" aria-hidden="true"></span><span class="canon-era__glyph canon-era__glyph--a" aria-hidden="true">♪</span><span class="canon-era__glyph canon-era__glyph--b" aria-hidden="true">♬</span>${era.map((composer, index) => canonNode(composer, index)).join('')}</div></section>`;
    }).join('')}</div></section>`;

    const years = new Map();
    entries.forEach((entry) => {
      const date = new Date(entry.date);
      const year = date.getUTCFullYear();
      const month = `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!years.has(year)) years.set(year, new Map());
      const months = years.get(year);
      if (!months.has(month)) months.set(month, []);
      months.get(month).push(entry);
    });
    const personal = `<section class="canon-view" data-journey-view="personal" hidden><div class="canon-view__intro"><span class="canon-kicker">MY LISTENING PATH</span><h3>How the archive actually unfolded.</h3><p>The canon has a historical order; my education did not. This chronology shows the order in which the music entered my life after formal tracking began.</p></div><div class="personal-canon-years">${[...years.keys()].sort((a, b) => b - a).map((year, yearIndex) => {
      const months = years.get(year); const yearEntries = [...months.values()].flat();
      return `<details class="personal-canon-year" ${yearIndex === 0 ? 'open' : ''}><summary><span class="personal-canon-year__year">${year}</span><span><b>${yearEntries.length} listens</b><em>${new Set(yearEntries.map((entry) => entry.key)).size} works · ${new Set(yearEntries.map((entry) => entry.composerId)).size} composers</em></span><strong>${esc(formatMinutes(yearEntries.reduce((sum, entry) => sum + entry.minutes, 0)))}</strong></summary><div class="personal-canon-months">${[...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, monthEntries]) => `<details class="personal-canon-month"><summary><span><b>${esc(formatMonth(new Date(`${month}-01T00:00:00Z`)))}</b><em>${monthEntries.length} listens · ${new Set(monthEntries.map((entry) => entry.composerId)).size} composers</em></span><strong>${esc(formatMinutes(monthEntries.reduce((sum, entry) => sum + entry.minutes, 0)))}</strong></summary><ol>${[...monthEntries].sort((a, b) => b.date - a.date || b.row - a.row).map((entry) => `<li><time>${esc(formatDate(entry.date, { short: true }))}</time><button type="button" data-work-open="${esc(entry.key)}"><b>${esc(entry.composer)}</b><span>${esc(entry.piece)}</span></button><span><i class="rating ${esc(entry.rating)}">${esc(ratingLabel(entry.rating))}</i>${esc(formatMinutes(entry.minutes))}</span></li>`).join('')}</ol></details>`).join('')}</div></details>`;
    }).join('')}</div></section>`;

    host.innerHTML = `<div class="canon-journey-shell"><section class="canon-quest-hero"><div class="canon-quest-hero__copy"><span class="canon-kicker">CLASSICAL CANON QUEST</span><h3>My education in an artistic tradition, made visible.</h3><p>I listened to classical music before I tracked it. The project changed when I set a deliberate goal: move through the Western canon composer by composer, hear the major repertoire, compare performances, and find the music that survives repeated listening.</p></div><div class="canon-quest-stats" aria-label="Classical Canon progress"><div><strong>${profiled.length}</strong><span>composer profiles reached</span></div><div><strong>${canonWorks.length}</strong><span>profiled-canon works heard</span></div><div><strong>${canonFavorites.length}</strong><span>favorites found</span></div><div><strong>${esc(formatMinutes(canonEntries.reduce((sum, entry) => sum + entry.minutes, 0)))}</strong><span>profiled-canon listening time</span></div><div><strong>${canonPeriods}</strong><span>profiled periods</span></div><div><strong>${activeRecently}</strong><span>composers active in latest 90 days</span></div></div></section><nav class="canon-journey-switch" aria-label="Classical journey views"><button type="button" aria-pressed="true" data-journey-mode="canon">Canon Trail</button><button type="button" aria-pressed="false" data-journey-mode="personal">My Listening</button></nav>${canonTrail}${personal}</div>`;
    host.querySelectorAll('[data-journey-mode]').forEach((button) => button.addEventListener('click', () => {
      const mode = button.dataset.journeyMode;
      host.querySelectorAll('[data-journey-mode]').forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
      host.querySelectorAll('[data-journey-view]').forEach((view) => { view.hidden = view.dataset.journeyView !== mode; });
    }));
  }

  function buildRecords() {
    const host = recordsPanel.querySelector('[data-classical-panel-content]');
    if (!host) return;
    const mostReplayed = [...workRecords].sort((a, b) => b.listenCount - a.listenCount || b.totalMinutes - a.totalMinutes)[0];
    const mostTime = [...workRecords].sort((a, b) => b.totalMinutes - a.totalMinutes || b.listenCount - a.listenCount)[0];
    const longestEntry = [...entries].sort((a, b) => b.minutes - a.minutes || b.date - a.date)[0];
    const byDay = new Map(); const byMonth = new Map();
    entries.forEach((entry) => {
      const day = dateKey(entry.date); const month = monthKey(entry.date);
      if (!byDay.has(day)) byDay.set(day, []); byDay.get(day).push(entry);
      if (!byMonth.has(month)) byMonth.set(month, []); byMonth.get(month).push(entry);
    });
    const busiestDay = [...byDay.entries()].map(([key, values]) => ({ key, values, minutes: values.reduce((sum, entry) => sum + entry.minutes, 0) })).sort((a, b) => b.minutes - a.minutes || b.values.length - a.values.length)[0];
    const busiestMonth = [...byMonth.entries()].map(([key, values]) => ({ key, values, minutes: values.reduce((sum, entry) => sum + entry.minutes, 0) })).sort((a, b) => b.minutes - a.minutes || b.values.length - a.values.length)[0];

    const runs = []; let current = null;
    entries.forEach((entry) => {
      if (!current || current.composerId !== entry.composerId) {
        if (current) runs.push(current);
        current = { composerId: entry.composerId, composer: entry.composer, entries: [], minutes: 0, firstDate: entry.date, lastDate: entry.date, pieces: new Set() };
      }
      current.entries.push(entry); current.minutes += entry.minutes; current.lastDate = entry.date; current.pieces.add(norm(entry.piece));
    });
    if (current) runs.push(current);
    const marathon = [...(runs.filter((run) => run.entries.length > 1).length ? runs.filter((run) => run.entries.length > 1) : runs)]
      .sort((a, b) => b.entries.length - a.entries.length || b.minutes - a.minutes || (b.lastDate - b.firstDate) - (a.lastDate - a.firstDate))[0];

    const dated = workRecords.filter((work) => work.compositionYearNumber);
    const earliestComposition = [...dated].sort((a, b) => a.compositionYearNumber - b.compositionYearNumber)[0];
    const latestComposition = [...dated].sort((a, b) => b.compositionYearNumber - a.compositionYearNumber)[0];
    const sessionDays = [...new Set(entries.map((entry) => dateKey(entry.date)).filter(Boolean))].sort();
    let longestGap = null;
    for (let i = 1; i < sessionDays.length; i += 1) {
      const start = Date.parse(`${sessionDays[i - 1]}T00:00:00Z`); const end = Date.parse(`${sessionDays[i]}T00:00:00Z`); const days = Math.round((end - start) / DAY);
      if (!longestGap || days > longestGap.days) longestGap = { days, start, end };
    }

    const cards = [
      mostReplayed && { icon: '↻', label: 'Most replayed work', value: `${mostReplayed.listenCount} listens`, detail: `${mostReplayed.composer} · ${mostReplayed.piece}`, sub: formatMinutes(mostReplayed.totalMinutes), key: mostReplayed.key },
      mostTime && { icon: '◷', label: 'Most time with one work', value: formatMinutes(mostTime.totalMinutes), detail: `${mostTime.composer} · ${mostTime.piece}`, sub: `${mostTime.listenCount} listens`, key: mostTime.key },
      longestEntry && { icon: '▶', label: 'Longest logged performance', value: formatMinutes(longestEntry.minutes), detail: `${longestEntry.composer} · ${longestEntry.piece}`, sub: formatDate(longestEntry.date, { short: true }), key: longestEntry.key },
      busiestDay && { icon: '☀', label: 'Busiest classical day', value: formatMinutes(busiestDay.minutes), detail: formatDate(Date.parse(`${busiestDay.key}T00:00:00Z`)), sub: `${busiestDay.values.length} entries` },
      busiestMonth && { icon: '▦', label: 'Busiest classical month', value: formatMinutes(busiestMonth.minutes), detail: formatMonth(new Date(`${busiestMonth.key}-01T00:00:00Z`)), sub: `${busiestMonth.values.length} entries` },
      marathon && { icon: '♬', label: 'Longest composer marathon', value: `${marathon.entries.length} consecutive listens`, detail: marathon.composer, sub: `${marathon.pieces.size} unique works · ${formatMinutes(marathon.minutes)} · ${marathon.firstDate === marathon.lastDate ? formatDate(marathon.firstDate, { short: true }) : `${formatDate(marathon.firstDate, { short: true })} → ${formatDate(marathon.lastDate, { short: true })}`}`, composerId: marathon.composerId },
      earliestComposition && { icon: '←', label: 'Earliest composition heard', value: String(earliestComposition.compositionYearNumber), detail: `${earliestComposition.composer} · ${earliestComposition.piece}`, sub: earliestComposition.period || 'Period not logged', key: earliestComposition.key },
      latestComposition && { icon: '→', label: 'Most recently composed work', value: String(latestComposition.compositionYearNumber), detail: `${latestComposition.composer} · ${latestComposition.piece}`, sub: latestComposition.period || 'Period not logged', key: latestComposition.key },
      longestGap && { icon: '⋯', label: 'Longest gap between sessions', value: `${longestGap.days} days`, detail: `${formatDate(longestGap.start, { short: true })} → ${formatDate(longestGap.end, { short: true })}`, sub: 'Between dated listening days' },
    ].filter(Boolean);

    const targets = [];
    if (entries.length >= 100) targets.push(100);
    if (entries.length >= 250) targets.push(250);
    for (let target = 500; target <= entries.length; target += 250) targets.push(target);
    const milestones = targets.map((target) => ({ target, entry: entries[target - 1] }));

    host.innerHTML = `<div class="classical-records-shell"><div class="classical-record-grid">${cards.map((card) => {
      const composer = card.composerId ? composers.get(card.composerId) : card.key ? composers.get(works.get(card.key)?.composerId) : findComposerByName(card.detail);
      return `<article class="classical-record-card"><span class="classical-record-icon">${esc(card.icon)}</span><p>${esc(card.label)}</p><strong>${esc(card.value)}</strong>${card.key ? `<button type="button" data-work-open="${esc(card.key)}">${esc(card.detail)}</button>` : card.composerId ? `<button type="button" data-composer-shortcut="${esc(card.composerId)}">${esc(card.detail)}</button>` : `<span class="classical-record-detail">${esc(card.detail)}</span>`}<em>${esc(card.sub)}</em>${composer ? composerVisual(composer, 'classical-record-avatar') : ''}</article>`;
    }).join('')}</div>${milestones.length ? `<section class="classical-milestones"><div class="classical-section-heading"><div><h3>Listening Milestones</h3><p>Where major entry-count thresholds landed in the archive.</p></div></div><div class="classical-milestone-row">${milestones.map(({ target, entry }) => {
      const composer = composers.get(entry.composerId); const id = youtubeId(entry.url);
      return `<button type="button" class="classical-milestone-rich classical-milestone-visual" data-work-open="${esc(entry.key)}" title="Entry ${target}: ${esc(entry.composer)} — ${esc(entry.piece)}">${composer ? composerVisual(composer, 'classical-milestone-composer') : ''}<span class="classical-milestone-number">#${target}</span><span class="classical-milestone-date">${esc(formatDate(entry.date))}</span>${id ? `<span class="classical-milestone-thumbnail" aria-hidden="true"><img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="classical-milestone-play">▶</span></span>` : ''}<strong>${esc(entry.piece)}</strong><em>${esc(entry.composer)} · ${esc(ratingLabel(entry.rating))} · ${esc(formatMinutes(entry.minutes))}</em></button>`;
    }).join('')}</div></section>` : ''}</div>`;
  }

  function buildFavorites() {
    const host = favoritesPanel.querySelector('[data-classical-panel-content]');
    if (!host) return;
    const favoriteComposers = Array.from(composers.values()).filter((composer) => composer.favoritesCount > 0).sort((a, b) => b.favoritesCount - a.favoritesCount || b.favoriteRate - a.favoriteRate).slice(0, 8);
    const composerOptions = [...new Set(favoriteWorks.map((work) => work.composerId))].map((id) => composers.get(id)).filter(Boolean).sort((a, b) => collator.compare(a.name, b.name));
    host.innerHTML = `<div class="classical-favorites-shell"><section class="classical-favorite-composers"><div class="classical-section-heading"><div><h3>Favorite Composers</h3><p>Ranked by the number of unique works that have been marked Amazing or Gorgeous.</p></div></div><div class="classical-favorite-composer-grid">${favoriteComposers.map((composer) => `<article class="classical-composer-shortcut" role="button" tabindex="0" data-composer-shortcut="${esc(composer.id)}" aria-label="Open ${esc(composer.name)} works">${composerVisual(composer, 'classical-favorite-composer-avatar')}<div><b>${esc(composer.name)}</b><span>${composer.favoritesCount} favorites · ${composer.favoriteRate.toFixed(0)}% favorite rate</span></div></article>`).join('')}</div></section><section class="classical-favorite-works"><div class="classical-section-heading"><div><h3>Favorite Works</h3><p>${favoriteWorks.length} unique works have been marked Amazing or Gorgeous at least once.</p></div></div><div class="classical-favorites-toolbar"><input type="search" placeholder="Search favorite works or composers…" aria-label="Search favorite classical works" data-favorites-search><select aria-label="Filter favorite works by composer" data-favorites-composer><option value="">All composers</option>${composerOptions.map((composer) => `<option value="${esc(composer.id)}">${esc(composer.name)}</option>`).join('')}</select><select aria-label="Filter favorite works by rating" data-favorites-rating><option value="">All favorite ratings</option><option value="amazing">Amazing</option><option value="gorgeous">Gorgeous</option></select><select aria-label="Sort favorite classical works" data-favorites-sort><option value="latest">Recently heard</option><option value="repeats">Most replayed</option><option value="time">Most time spent</option><option value="composer">Composer A–Z</option><option value="title">Work A–Z</option></select></div><p class="classical-favorites-results" data-favorites-results></p><ul class="classical-favorite-work-list" data-favorite-work-list>${favoriteWorks.map((work) => {
      const composer = composers.get(work.composerId); const id = youtubeId(work.performanceUrls[0]);
      return `<li data-favorite-work-row data-key="${esc(work.key)}" data-composer="${esc(work.composerId)}" data-rating="${esc(work.rating)}" data-search="${esc(norm(`${work.composer} ${work.piece} ${work.form} ${work.period} ${work.compositionYear}`))}" data-date="${work.latestDate}" data-listens="${work.listenCount}" data-time="${work.totalMinutes}" data-composer-name="${esc(norm(work.composer))}" data-title="${esc(norm(work.piece))}">${id ? `<a class="classical-favorite-work-thumbnail" href="${esc(work.performanceUrls[0])}" target="_blank" rel="noopener noreferrer" aria-label="Open linked performance"><img src="https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="classical-polish-play" aria-hidden="true">▶</span></a>` : composerVisual(composer, 'classical-favorite-work-avatar')}<button type="button" data-work-open="${esc(work.key)}"><span class="entry-composer">${esc(work.composer)}</span><b>${esc(work.piece)}</b><span><i class="rating ${esc(work.rating)}">${esc(ratingLabel(work.rating))}</i>${esc([work.form, work.period, work.compositionYear].filter(Boolean).join(' · ') || 'Metadata not logged')}</span></button><span><b>${work.listenCount}×</b><em>${esc(formatMinutes(work.totalMinutes))}</em></span></li>`;
    }).join('')}</ul><p class="classical-empty" data-favorites-empty hidden>No favorite works match these filters.</p><button type="button" class="show-more" data-favorites-more hidden>Show more</button></section></div>`;

    const search = host.querySelector('[data-favorites-search]'); const composer = host.querySelector('[data-favorites-composer]'); const rating = host.querySelector('[data-favorites-rating]'); const sort = host.querySelector('[data-favorites-sort]'); const list = host.querySelector('[data-favorite-work-list]'); const rows = Array.from(host.querySelectorAll('[data-favorite-work-row]')); const results = host.querySelector('[data-favorites-results]'); const empty = host.querySelector('[data-favorites-empty]'); const more = host.querySelector('[data-favorites-more]'); let visibleLimit = CLASSICAL_PAGE_SIZE;
    function apply() {
      const words = norm(search?.value).split(/\s+/).filter(Boolean); const selectedComposer = composer?.value || ''; const selectedRating = rating?.value || ''; const mode = sort?.value || 'latest';
      const filtered = rows.filter((row) => (!words.length || words.every((word) => clean(row.dataset.search).includes(word))) && (!selectedComposer || row.dataset.composer === selectedComposer) && (!selectedRating || row.dataset.rating === selectedRating));
      filtered.sort((a, b) => mode === 'repeats' ? Number(b.dataset.listens || 0) - Number(a.dataset.listens || 0) || Number(b.dataset.time || 0) - Number(a.dataset.time || 0) : mode === 'time' ? Number(b.dataset.time || 0) - Number(a.dataset.time || 0) : mode === 'composer' ? collator.compare(a.dataset.composerName || '', b.dataset.composerName || '') || collator.compare(a.dataset.title || '', b.dataset.title || '') : mode === 'title' ? collator.compare(a.dataset.title || '', b.dataset.title || '') : Number(b.dataset.date || 0) - Number(a.dataset.date || 0));
      rows.forEach((row) => { row.hidden = true; }); filtered.forEach((row, index) => { list.append(row); row.hidden = index >= visibleLimit; }); const shown = Math.min(filtered.length, visibleLimit); results.textContent = filtered.length ? `Showing ${shown} of ${filtered.length} favorite works` : 'No matching favorite works'; empty.hidden = filtered.length > 0; more.hidden = filtered.length <= visibleLimit;
    }
    [composer, rating].forEach((control) => control?.addEventListener('change', () => { visibleLimit = CLASSICAL_PAGE_SIZE; apply(); })); search?.addEventListener('input', () => { visibleLimit = CLASSICAL_PAGE_SIZE; apply(); }); sort?.addEventListener('change', apply); more?.addEventListener('click', () => { visibleLimit += CLASSICAL_PAGE_SIZE; apply(); }); apply();
  }

  const PROFILE_COUNTRY = new Map(Object.entries({
    'frederic chopin':'616','johann nepomuk hummel':'040','robert schumann':'276','franz liszt':'348','johannes brahms':'276','henry purcell':'826','francesco antonio bonporti':'380','tomaso albinoni':'380','dieterich buxtehude':'276','alessandro scarlatti':'380','domenico scarlatti':'380','francois couperin':'250','george frideric handel':'276','jean baptiste lully':'250','jean philippe rameau':'250','jan dismas zelenka':'203','carlo tessarini':'380','claudio monteverdi':'380','luigi boccherini':'380','salvatore lanzetti':'380','giovanni gabrieli':'380','william byrd':'826','thomas tallis':'826','tomas luis de victoria':'724','john dowland':'826','josquin des prez':'056','giovanni pierluigi da palestrina':'380','arcangelo corelli':'380','wilhelm friedemann bach':'276','johann christian bach':'276','carl philipp emanuel bach':'276','georg philipp telemann':'276','antonio vivaldi':'380','johann sebastian bach':'276','felix mendelssohn':'276','franz schubert':'040','ludwig van beethoven':'276','wolfgang amadeus mozart':'040','joseph haydn':'040'
  }));
  const NATIONALITY_COUNTRY = [[['franco flemish','flemish','belgian'],'056'],[['german danish'],'276'],[['german british'],'276'],[['french italian born'],'250'],[['polish'],'616'],[['austrian'],'040'],[['german'],'276'],[['hungarian'],'348'],[['english','british'],'826'],[['italian'],'380'],[['french'],'250'],[['czech','bohemian'],'203'],[['spanish'],'724'],[['portuguese'],'620'],[['dutch'],'528'],[['danish'],'208'],[['norwegian'],'578'],[['swedish'],'752'],[['finnish'],'246'],[['romanian'],'642'],[['swiss'],'756'],[['greek'],'300'],[['ukrainian'],'804'],[['croatian'],'191'],[['slovenian'],'705'],[['serbian'],'688'],[['russian'],'643'],[['american','united states'],'840'],[['canadian'],'124'],[['mexican'],'484'],[['brazilian'],'076'],[['argentine','argentinian'],'032'],[['chinese'],'156'],[['japanese'],'392'],[['korean'],'410']];
  const COUNTRY_FALLBACK = new Map(Object.entries({'056':['Belgium','🇧🇪'],'040':['Austria','🇦🇹'],'276':['Germany','🇩🇪'],'348':['Hungary','🇭🇺'],'826':['United Kingdom','🇬🇧'],'380':['Italy','🇮🇹'],'250':['France','🇫🇷'],'203':['Czechia','🇨🇿'],'724':['Spain','🇪🇸'],'616':['Poland','🇵🇱'],'620':['Portugal','🇵🇹'],'528':['Netherlands','🇳🇱'],'208':['Denmark','🇩🇰'],'578':['Norway','🇳🇴'],'752':['Sweden','🇸🇪'],'246':['Finland','🇫🇮'],'642':['Romania','🇷🇴'],'756':['Switzerland','🇨🇭'],'300':['Greece','🇬🇷'],'804':['Ukraine','🇺🇦'],'191':['Croatia','🇭🇷'],'705':['Slovenia','🇸🇮'],'688':['Serbia','🇷🇸'],'643':['Russia','🇷🇺'],'840':['United States','🇺🇸'],'124':['Canada','🇨🇦'],'484':['Mexico','🇲🇽'],'076':['Brazil','🇧🇷'],'032':['Argentina','🇦🇷'],'156':['China','🇨🇳'],'392':['Japan','🇯🇵'],'410':['South Korea','🇰🇷']}));
  const EUROPE_IDS = new Set(['008','020','040','056','070','100','112','191','196','203','208','233','246','250','276','300','348','352','372','380','428','438','440','442','470','492','498','499','528','578','616','620','642','674','688','703','705','724','752','756','792','804','807','826','336']);

  function countryIdFor(composer) {
    const exact = PROFILE_COUNTRY.get(norm(composer.name));
    if (exact) return exact;
    const haystack = norm(composer.nationality);
    return NATIONALITY_COUNTRY.find(([keys]) => keys.some((key) => haystack.includes(norm(key))))?.[1] || '';
  }

  async function buildWorld() {
    const host = worldPanel.querySelector('[data-classical-panel-content]');
    if (!host) return;
    const profiled = Array.from(composers.values()).filter((composer) => composer.profiled).map((composer) => ({ ...composer, countryId: countryIdFor(composer) }));
    const mapped = profiled.filter((composer) => composer.countryId);
    const byCountry = new Map(); mapped.forEach((composer) => byCountry.set(composer.countryId, [...(byCountry.get(composer.countryId) || []), composer]));
    const countryInfo = (id) => COUNTRY_FALLBACK.get(id) || [id, ''];

    host.innerHTML = `<div class="classical-world14-shell"><section class="classical-world14-intro"><span>CLASSICAL CANON GEOGRAPHY</span><h3>First Europe. Then the world.</h3><p>Country shapes do the geographic work. That matches the metadata I actually store and avoids pretending a regional profile identifies one exact career city. Exact city trails can come later.</p></section><div class="classical-world14-switch" role="group" aria-label="Composer map view"><button type="button" aria-pressed="true" data-world14-mode="europe">Europe</button><button type="button" aria-pressed="false" data-world14-mode="world">World</button></div><div class="classical-world14-layout"><section class="classical-world14-map-card"><div class="classical-world14-stage" data-world14-stage><div class="classical-world14-loading"><strong>Building the map…</strong><span>Using the same vector-country system as Albums.</span></div><div class="classical-world14-tooltip" data-world14-tooltip hidden></div></div><div class="classical-world14-footer"><span data-world14-status>${mapped.length} profiled composers have usable country metadata.</span><span class="classical-world14-legend"><span>Fewer</span><i></i><i></i><i></i><i></i><i></i><span>More</span></span></div></section><aside class="classical-world14-country-panel" data-world14-country-panel></aside></div><section class="classical-world14-directory"><div><h3>Mapped Composers</h3><p data-world14-directory-copy>${mapped.length} of ${profiled.length} profiled composers resolve to a country.</p></div><div class="classical-world14-directory-grid" data-world14-directory>${[...mapped].sort((a,b) => countryInfo(a.countryId)[0].localeCompare(countryInfo(b.countryId)[0]) || a.name.localeCompare(b.name)).map((composer) => `<button type="button" class="classical-world14-composer is-compact" data-composer-shortcut="${esc(composer.id)}">${composerVisual(composer, 'classical-world14-portrait')}<span><b>${esc(composer.name)}</b><em>${esc(composer.nationality || countryInfo(composer.countryId)[0])}</em><small>${composer.worksCount} works · ${composer.favoritesCount} favorites</small></span></button>`).join('')}</div></section></div>`;

    const stage = host.querySelector('[data-world14-stage]'); const tooltip = host.querySelector('[data-world14-tooltip]'); const panel = host.querySelector('[data-world14-country-panel]'); const status = host.querySelector('[data-world14-status]'); const modeButtons = Array.from(host.querySelectorAll('[data-world14-mode]'));
    let mode = 'europe'; let selected = '';

    function renderFallbackPanel() {
      const visibleIds = mode === 'europe' ? new Set([...byCountry.keys()].filter((id) => EUROPE_IDS.has(id))) : new Set(byCountry.keys());
      const ranking = [...visibleIds].map((id) => ({ id, count: byCountry.get(id).length, name: countryInfo(id)[0], flag: countryInfo(id)[1] })).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
      const max = ranking[0]?.count || 1;
      if (selected && visibleIds.has(selected)) {
        const group = [...byCountry.get(selected)].sort((a,b) => a.name.localeCompare(b.name));
        panel.innerHTML = `<div class="classical-world14-panel-head"><div><h3>${esc(countryInfo(selected)[1])} ${esc(countryInfo(selected)[0])}</h3><p>${group.length} profiled composer${group.length === 1 ? '' : 's'} anchored here.</p></div><button type="button" data-world14-clear>Clear</button></div><div class="classical-world14-selected-composers">${group.map((composer) => `<button type="button" class="classical-world14-composer" data-composer-shortcut="${esc(composer.id)}">${composerVisual(composer, 'classical-world14-portrait')}<span><b>${esc(composer.name)}</b><em>${esc(composer.nationality)}</em><small>${composer.worksCount} works · ${composer.favoritesCount} favorites</small></span></button>`).join('')}</div>`;
        panel.querySelector('[data-world14-clear]')?.addEventListener('click', () => { selected = ''; renderFallbackPanel(); });
      } else {
        panel.innerHTML = `<div class="classical-world14-panel-head"><div><h3>${mode === 'europe' ? 'Composer countries in Europe' : 'Composer countries'}</h3><p>Select a colored country on the map or choose one below.</p></div></div><div class="classical-world14-ranking">${ranking.map((item) => `<button type="button" data-world14-country="${item.id}"><span>${esc(item.flag)} ${esc(item.name)}</span><b>${item.count}</b><i><span style="width:${Math.max(8, item.count / max * 100)}%"></span></i></button>`).join('')}</div>`;
        panel.querySelectorAll('[data-world14-country]').forEach((button) => button.addEventListener('click', () => { selected = button.dataset.world14Country; renderFallbackPanel(); }));
      }
    }
    renderFallbackPanel();

    let d3, topo, atlas, countryRows;
    try {
      [d3, topo, atlas, countryRows] = await Promise.all([
        import('https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm'),
        import('https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm'),
        import('https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json/+esm'),
        import('https://cdn.jsdelivr.net/npm/world-countries@5.1.0/+esm'),
      ]);
      atlas = atlas.default || atlas; countryRows = countryRows.default || countryRows;
    } catch (error) {
      console.error('[Classical World] Vector map modules failed to load.', error);
      const loading = stage.querySelector('.classical-world14-loading');
      if (loading) loading.innerHTML = '<strong>The vector map could not load.</strong><span>The country ranking and mapped-composer directory remain available.</span>';
      return;
    }

    const countryById = new Map(); countryRows.forEach((country) => { if (country?.ccn3) countryById.set(String(country.ccn3).padStart(3,'0'), { name: country.name?.common || country.name?.official, flag: country.flag || '' }); });
    const collection = topo.feature(atlas, atlas.objects.countries); const features = collection.features.filter((feature) => String(feature.id).padStart(3,'0') !== '010');
    const featureIds = new Set(features.map((feature) => String(feature.id).padStart(3,'0')));
    const actualMapped = mapped.filter((composer) => featureIds.has(composer.countryId));
    const actualByCountry = new Map(); actualMapped.forEach((composer) => actualByCountry.set(composer.countryId, [...(actualByCountry.get(composer.countryId) || []), composer]));
    const nameFor = (id) => countryById.get(id)?.name || countryInfo(id)[0]; const flagFor = (id) => countryById.get(id)?.flag || countryInfo(id)[1];

    function visibleFeatures() { return mode === 'europe' ? features.filter((feature) => EUROPE_IDS.has(String(feature.id).padStart(3,'0'))) : features; }
    function counts() { const visible = new Set(visibleFeatures().map((feature) => String(feature.id).padStart(3,'0'))); const map = new Map(); actualByCountry.forEach((group,id) => { if (visible.has(id)) map.set(id, group.length); }); return map; }
    function renderPanel(map) {
      const ranking = [...map].map(([id,count]) => ({ id,count,name:nameFor(id),flag:flagFor(id) })).sort((a,b) => b.count-a.count || a.name.localeCompare(b.name));
      if (selected && map.has(selected)) {
        const group = [...actualByCountry.get(selected)].sort((a,b) => a.name.localeCompare(b.name));
        panel.innerHTML = `<div class="classical-world14-panel-head"><div><h3>${esc(flagFor(selected))} ${esc(nameFor(selected))}</h3><p>${group.length} profiled composer${group.length===1?'':'s'} anchored here.</p></div><button type="button" data-world14-clear>Clear</button></div><div class="classical-world14-selected-composers">${group.map((composer) => `<button type="button" class="classical-world14-composer" data-composer-shortcut="${esc(composer.id)}">${composerVisual(composer,'classical-world14-portrait')}<span><b>${esc(composer.name)}</b><em>${esc(composer.nationality || nameFor(composer.countryId))}</em><small>${composer.worksCount} works · ${composer.favoritesCount} favorites</small></span></button>`).join('')}</div>`;
        panel.querySelector('[data-world14-clear]')?.addEventListener('click', () => { selected=''; render(); });
      } else {
        const max = ranking[0]?.count || 1;
        panel.innerHTML = `<div class="classical-world14-panel-head"><div><h3>${mode==='europe'?'Composer countries in Europe':'Composer countries'}</h3><p>Select a colored country on the map or choose one below.</p></div></div><div class="classical-world14-ranking">${ranking.map((item) => `<button type="button" data-world14-country="${item.id}"><span>${esc(item.flag)} ${esc(item.name)}</span><b>${item.count}</b><i><span style="width:${Math.max(8,item.count/max*100)}%"></span></i></button>`).join('')}</div>`;
        panel.querySelectorAll('[data-world14-country]').forEach((button) => button.addEventListener('click', () => { selected=button.dataset.world14Country; render(); }));
      }
    }
    function renderMap(map) {
      stage.querySelector('svg')?.remove(); stage.querySelector('.classical-world14-loading')?.remove(); tooltip.hidden = true;
      const shown = visibleFeatures(); const collection = { type:'FeatureCollection', features:shown };
      const projection = mode === 'europe' ? d3.geoMercator().fitExtent([[18,18],[942,512]], collection) : d3.geoNaturalEarth1().fitExtent([[16,16],[944,516]], collection);
      const path = d3.geoPath(projection); const max = Math.max(1,...map.values());
      const svg = document.createElementNS('http://www.w3.org/2000/svg','svg'); svg.classList.add('classical-world14-svg'); svg.setAttribute('viewBox','0 0 960 540'); svg.setAttribute('role','img'); svg.setAttribute('aria-label',`${mode==='europe'?'Europe':'World'} map showing profiled composer counts by country`);
      if (mode === 'world') { const ocean=document.createElementNS('http://www.w3.org/2000/svg','path'); ocean.classList.add('classical-world14-ocean'); ocean.setAttribute('d',path({type:'Sphere'})); svg.append(ocean); }
      shown.forEach((feature) => {
        const id=String(feature.id).padStart(3,'0'); const count=map.get(id)||0; const level=count?Math.max(1,Math.min(5,Math.ceil(Math.sqrt(count/max)*5))):0; const countryPath=document.createElementNS('http://www.w3.org/2000/svg','path'); countryPath.classList.add('classical-world14-country'); countryPath.dataset.countryId=id; countryPath.dataset.level=String(level); countryPath.dataset.active=String(count>0); countryPath.dataset.selected=String(selected===id); countryPath.setAttribute('d',path(feature)||''); const label=`${nameFor(id)}: ${count} profiled composer${count===1?'':'s'}`; const title=document.createElementNS('http://www.w3.org/2000/svg','title'); title.textContent=label; countryPath.append(title);
        if (count) {
          countryPath.tabIndex=0; countryPath.setAttribute('role','button'); countryPath.setAttribute('aria-label',label);
          const move=(event)=>{ const box=stage.getBoundingClientRect(); const x=Number.isFinite(event?.clientX)?event.clientX-box.left:box.width/2; const y=Number.isFinite(event?.clientY)?event.clientY-box.top:box.height/2; tooltip.style.left=`${Math.min(Math.max(x+10,8),Math.max(box.width-220,8))}px`; tooltip.style.top=`${Math.min(Math.max(y+10,8),Math.max(box.height-82,8))}px`; };
          const show=(event)=>{ const group=actualByCountry.get(id)||[]; tooltip.innerHTML=`<strong>${esc(flagFor(id))} ${esc(nameFor(id))}</strong><span>${count} composer${count===1?'':'s'}</span><small>${group.slice(0,4).map((composer)=>esc(composer.name)).join(' · ')}${group.length>4?` · +${group.length-4}`:''}</small>`; tooltip.hidden=false; move(event); };
          const choose=()=>{ selected=id; render(); };
          countryPath.addEventListener('pointerenter',show); countryPath.addEventListener('pointermove',move); countryPath.addEventListener('pointerleave',()=>{tooltip.hidden=true;}); countryPath.addEventListener('focus',show); countryPath.addEventListener('blur',()=>{tooltip.hidden=true;}); countryPath.addEventListener('click',choose); countryPath.addEventListener('keydown',(event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}});
        }
        svg.append(countryPath);
      });
      stage.insertBefore(svg,tooltip); status.textContent=`${[...map.values()].reduce((sum,value)=>sum+value,0)} profiled composers · ${map.size} mapped countries · ${mode==='europe'?'Europe':'World'} view`;
    }
    function render() { const map=counts(); if(selected&&!map.has(selected)) selected=''; renderMap(map); renderPanel(map); modeButtons.forEach((button)=>button.setAttribute('aria-pressed',String(button.dataset.world14Mode===mode))); }
    modeButtons.forEach((button)=>button.addEventListener('click',()=>{ const next=button.dataset.world14Mode==='world'?'world':'europe'; if(next===mode)return; mode=next; selected=''; render(); }));
    render();
  }

  function delegateInteractions() {
    document.addEventListener('click', (event) => {
      const work = event.target.closest?.('[data-work-open]');
      if (work) { event.preventDefault(); openWork(work.dataset.workOpen || ''); return; }
      const close = event.target.closest?.('[data-close-work-dialog]');
      if (close) { event.preventDefault(); document.querySelector('#classical-work-dialog')?.close(); return; }
      const composer = event.target.closest?.('[data-composer-shortcut]');
      if (composer) { event.preventDefault(); openComposerWorks(composer.dataset.composerShortcut || ''); return; }
      const filter = event.target.closest?.('[data-composer-work-filter]');
      if (filter) {
        const panel = filter.closest('[data-detail-panel="works"]');
        if (!panel) return;
        const mode = filter.dataset.composerWorkFilter || 'all';
        panel.querySelectorAll('[data-composer-work-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button === filter)));
        panel.querySelectorAll('[data-composer-work-row]').forEach((row) => { row.hidden = mode === 'favorites' ? row.dataset.favorite !== 'true' : mode === 'repeats' ? row.dataset.repeat !== 'true' : false; });
      }
    });
    document.addEventListener('keydown', (event) => {
      const composer = event.target.closest?.('[data-composer-shortcut]');
      if (composer && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openComposerWorks(composer.dataset.composerShortcut || ''); }
    });
  }

  repairTopStats();
  setupCanonHelp();
  setupComposerLibrary();
  enhanceComposerTemplates();
  patchWorksExplorer();
  patchOverview();
  buildCalendar();
  buildJourney();
  buildRecords();
  buildFavorites();
  buildWorld();
  ensureWorkDialog();
  delegateInteractions();
  activateView(new URL(window.location.href).searchParams.get('view') || 'composers', { updateUrl: false });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => bootClassicalRuntime(), { once: true });
else bootClassicalRuntime();
