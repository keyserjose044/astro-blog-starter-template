/* LifeLoggerz Albums: human-readable polish for the complete Listening Log. */

const ALBUMS_LISTENING_LOG_POLISH_VERSION = '20260801-2221';
const ALBUMS_LISTENING_LOG_POLISH_RETRIES = 180;

function ensureListeningLogPolishCss() {
  if (document.querySelector('link[data-albums-listening-log-polish-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.albumsListeningLogPolishCss = 'true';
  link.href = new URL(`../styles/albums-listening-log-polish.css?v=${ALBUMS_LISTENING_LOG_POLISH_VERSION}`, import.meta.url).toString();
  document.head.append(link);
}

const logClean = (value) => String(value ?? '').trim();
const logNormalize = (value) => logClean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

function logParseDate(value) {
  const raw = logClean(value).replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
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
  return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function logParseMinutes(value) {
  const raw = logClean(value).toLowerCase();
  if (!raw) return 0;
  const numeric = Number(raw.replace(/,/g, ''));
  if (Number.isFinite(numeric)) return Math.max(0, numeric);
  const clock = raw.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    if (clock[3]) return Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3]) / 60;
    return Number(clock[1]) + Number(clock[2]) / 60;
  }
  const hours = Number(raw.match(/([\d.]+)\s*(?:h|hr|hrs|hour|hours)\b/)?.[1] || 0);
  const minutes = Number(raw.match(/([\d.]+)\s*(?:m|min|mins|minute|minutes)\b/)?.[1] || 0);
  return Math.max(0, hours * 60 + minutes);
}

const logDateKey = (date) => date
  ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  : '';
const logFormatFullDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  : '';
const logFormatDuration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder.toLocaleString('en-US')} min`;
  return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
};
const logIsAlbum = (row) => typeof row?.isAlbum === 'boolean'
  ? row.isAlbum
  : /^(?:y|yes|true|1|album|full album)$/i.test(logClean(row?.albumRaw ?? row?.albumFlag ?? row?.['album?']));

function normalizePolishEntry(row, index) {
  if (!row || typeof row !== 'object') return null;
  const date = logParseDate(row.date ?? row.listeningDate ?? row.dateListened);
  const artist = logClean(row.artist ?? row.performer);
  let title = logClean(row.title ?? row.piece ?? row.albumPiece ?? row.album ?? row.work);
  if (/^https?:\/\//i.test(title) || title === 'Linked music entry') title = 'Untitled entry';
  if (!date || !artist || !title) return null;
  return {
    rowNumber: Number(row.rowNumber ?? row.sourceRow ?? index + 2) || index + 2,
    date,
    dateKey: logDateKey(date),
    listenedYear: String(date.getUTCFullYear()),
    artist,
    title,
    minutes: logParseMinutes(row.minutes ?? row.min ?? row.duration ?? row.length),
    rating: logClean(row.rating ?? row.score),
    genre: logClean(row.genre ?? row.style).replace(/^\d+\.\s*/, ''),
    subgenre: logClean(row.subgenre ?? row.subGenre),
    country: logClean(row.country ?? row.coo ?? row.origin),
    releaseYear: logClean(row.year ?? row.releaseYear ?? row.releasePeriod),
    annotation: logClean(row.annotation ?? row.note ?? row.albumRaw),
    instrumentRaw: logClean(row.instrumentRaw ?? row.instrument ?? row.instrm),
    isAlbum: logIsAlbum(row),
  };
}

function aggregatePolishTitles(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = `${logNormalize(entry.artist)}|${logNormalize(entry.title)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return Array.from(groups.values()).map((group) => {
    const sorted = [...group].sort((a, b) => b.date - a.date || b.rowNumber - a.rowNumber);
    const latest = sorted[0];
    const withField = (field) => sorted.find((entry) => logClean(entry[field]))?.[field] || '';
    return {
      ...latest,
      rating: withField('rating'),
      genre: withField('genre'),
      subgenre: withField('subgenre'),
      country: withField('country'),
      releaseYear: withField('releaseYear'),
      annotation: withField('annotation'),
      instrumentRaw: withField('instrumentRaw'),
      isAlbum: group.some((entry) => entry.isAlbum),
      listenCount: group.length,
      totalMinutes: group.reduce((sum, entry) => sum + entry.minutes, 0),
    };
  });
}

async function bootAlbumsListeningLogPolish(attempt = 0) {
  ensureListeningLogPolishCss();
  const expansion = document.querySelector('#albums-expansion-views');
  const viewToggle = document.querySelector('#album-view-toggle');
  if ((!expansion || !viewToggle) && attempt < ALBUMS_LISTENING_LOG_POLISH_RETRIES) {
    window.setTimeout(() => bootAlbumsListeningLogPolish(attempt + 1), 75);
    return;
  }
  if (!expansion || !viewToggle || document.body.dataset.albumsListeningLogPolishReady) return;

  let payload;
  try {
    const url = new URL(`../data/music-listening.json?v=${ALBUMS_LISTENING_LOG_POLISH_VERSION}`, import.meta.url);
    const response = await fetch(url.toString(), { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Music snapshot returned ${response.status}`);
    payload = await response.json();
  } catch (error) {
    console.warn('[Albums] Listening Log polish could not load the music snapshot:', error);
    return;
  }

  const rawRows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
  const entries = rawRows.map(normalizePolishEntry).filter(Boolean);
  if (!entries.length) return;

  document.body.dataset.albumsListeningLogPolishReady = 'true';
  const titles = aggregatePolishTitles(entries);
  const repeatCounts = new Map();
  entries.forEach((entry) => {
    const key = `${logNormalize(entry.artist)}|${logNormalize(entry.title)}`;
    repeatCounts.set(key, (repeatCounts.get(key) || 0) + 1);
  });

  const state = { layout: 'rows', patching: false, frame: 0 };

  const activeMode = () => {
    const group = expansion.querySelector('.albums-listening-log-mode-group');
    const pressed = group?.querySelector('button[aria-pressed="true"]');
    return /works|titles/i.test(pressed?.textContent || '') ? 'titles' : 'entries';
  };

  function toolbarValues() {
    const toolbar = expansion.querySelector('.albums-listening-log-toolbar');
    if (!toolbar) return null;
    const search = toolbar.querySelector('input[type="search"]');
    const selects = Array.from(toolbar.querySelectorAll('select'));
    return {
      search: search?.value || '',
      artist: selects.find((select) => /artist/i.test(select.getAttribute('aria-label') || ''))?.value || '',
      genre: selects.find((select) => /genre/i.test(select.getAttribute('aria-label') || ''))?.value || '',
      type: selects.find((select) => /entry type/i.test(select.getAttribute('aria-label') || ''))?.value || '',
      year: selects.find((select) => /listening year/i.test(select.getAttribute('aria-label') || ''))?.value || '',
      sort: selects.find((select) => /sort/i.test(select.getAttribute('aria-label') || ''))?.value || 'latest',
    };
  }

  function matchesFilters(item, filters) {
    if (!filters) return true;
    if (filters.artist && item.artist !== filters.artist) return false;
    if (filters.genre && item.genre !== filters.genre) return false;
    if (filters.type === 'album' && !item.isAlbum) return false;
    if (filters.type === 'other' && item.isAlbum) return false;
    if (filters.year && item.listenedYear !== filters.year) return false;
    const words = logNormalize(filters.search).split(/\s+/).filter(Boolean);
    if (words.length) {
      const haystack = logNormalize([
        item.title, item.artist, item.genre, item.subgenre, item.country,
        item.releaseYear, item.rating, item.annotation, item.instrumentRaw,
      ].join(' '));
      if (!words.every((word) => haystack.includes(word))) return false;
    }
    return true;
  }

  function filteredData(mode = activeMode()) {
    const filters = toolbarValues();
    const source = mode === 'titles' ? titles : entries;
    return source.filter((item) => matchesFilters(item, filters));
  }

  function patchMetrics(shell) {
    const metricItems = Array.from(shell.querySelectorAll('.albums-listening-log-metrics > div'));
    const tooltips = {
      'Listening entries': 'Every dated row in the complete Listen Log, including repeat listens.',
      'Unique titles': 'Distinct artist + title combinations after repeat listens are collapsed.',
      'Listening time': 'Total recorded minutes across every dated Listen Log entry.',
      'Music days': 'Distinct calendar days with at least one recorded music entry.',
      'Full-album listens': 'Listening-log entries marked as full albums. This is not the number of unique albums in the Albums archive.',
    };
    metricItems.forEach((item) => {
      const label = item.querySelector('span');
      if (!label) return;
      if (/^unique works$/i.test(label.textContent.trim())) label.textContent = 'Unique titles';
      if (/^album-tagged$/i.test(label.textContent.trim())) label.textContent = 'Full-album listens';
      const text = label.textContent.trim();
      const tooltip = tooltips[text];
      if (tooltip) {
        item.title = tooltip;
        item.setAttribute('aria-label', `${text}: ${item.querySelector('strong')?.textContent || ''}. ${tooltip}`);
      }
    });
  }

  function ensureLayoutControls(shell) {
    const modeRow = shell.querySelector('.albums-listening-log-mode-row');
    const modeGroup = modeRow?.querySelector('.albums-listening-log-mode-group');
    if (!modeRow || !modeGroup) return;

    Array.from(modeGroup.querySelectorAll('button')).forEach((button) => {
      if (/^Works\b/i.test(button.textContent)) button.textContent = button.textContent.replace(/^Works\b/i, 'Titles');
    });

    let layoutGroup = modeRow.querySelector('.albums-listening-log-layout-group');
    if (!layoutGroup) {
      const switches = document.createElement('div');
      switches.className = 'albums-listening-log-switches';
      modeGroup.before(switches);
      switches.append(modeGroup);
      layoutGroup = document.createElement('div');
      layoutGroup.className = 'albums-listening-log-layout-group';
      layoutGroup.setAttribute('role', 'group');
      layoutGroup.setAttribute('aria-label', 'Listening entry layout');
      [['rows', 'Rows'], ['days', 'Days']].forEach(([layout, label]) => {
        const control = document.createElement('button');
        control.type = 'button';
        control.dataset.logLayout = layout;
        control.textContent = label;
        control.setAttribute('aria-pressed', String(state.layout === layout));
        control.addEventListener('click', () => {
          if (layout === 'days') {
            const sort = expansion.querySelector('.albums-listening-log-toolbar select[aria-label="Sort listening log"]');
            state.layout = 'days';
            if (sort && sort.value !== 'latest') {
              sort.value = 'latest';
              sort.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
          } else state.layout = 'rows';
          queuePatch();
        });
        layoutGroup.append(control);
      });
      switches.append(layoutGroup);
    }

    const mode = activeMode();
    if (mode === 'titles' && state.layout === 'days') state.layout = 'rows';
    layoutGroup.hidden = mode === 'titles';
    layoutGroup.querySelectorAll('button').forEach((control) => {
      control.setAttribute('aria-pressed', String(control.dataset.logLayout === state.layout));
    });
  }

  function patchTypeFilter(shell) {
    const select = shell.querySelector('.albums-listening-log-toolbar select[aria-label="Filter listening log by entry type"]');
    if (!select) return;
    const labels = { '': 'All types', album: 'Full albums', other: 'Other music' };
    Array.from(select.options).forEach((option) => {
      if (Object.prototype.hasOwnProperty.call(labels, option.value)) option.textContent = labels[option.value];
    });
  }

  function makeRepeatBadge(count) {
    const badge = document.createElement('span');
    badge.className = 'albums-listening-log-badge is-repeat';
    badge.textContent = `↻ ${count.toLocaleString('en-US')} listens`;
    badge.title = `This title appears ${count.toLocaleString('en-US')} times in the listening log.`;
    return badge;
  }

  function patchItems(shell) {
    const mode = activeMode();
    shell.querySelectorAll('.albums-listening-log-item').forEach((item) => {
      const artist = item.querySelector('.albums-listening-log-artist')?.textContent?.trim() || '';
      const titleNode = item.querySelector('.albums-listening-log-title');
      if (!titleNode) return;
      if (titleNode.textContent.trim() === 'Linked music entry') titleNode.textContent = 'Untitled entry';
      const title = titleNode.textContent.trim();
      const meta = item.querySelector('.albums-listening-log-meta');
      if (!meta) return;

      const albumBadge = Array.from(meta.querySelectorAll('.albums-listening-log-badge')).find((badge) => /^Album$/i.test(badge.textContent.trim()));
      if (albumBadge) {
        albumBadge.textContent = 'Full album';
        albumBadge.title = 'This listening entry was marked as a full-album listen.';
      }

      const key = `${logNormalize(artist)}|${logNormalize(title)}`;
      const count = repeatCounts.get(key) || 0;
      const existingRepeat = meta.querySelector('.albums-listening-log-badge.is-repeat');
      if (count > 1) {
        const label = `↻ ${count.toLocaleString('en-US')} listens`;
        const tooltip = `This title appears ${count.toLocaleString('en-US')} times in the listening log.`;
        if (existingRepeat) {
          if (existingRepeat.textContent !== label) existingRepeat.textContent = label;
          if (existingRepeat.title !== tooltip) existingRepeat.title = tooltip;
        } else meta.append(makeRepeatBadge(count));
      } else if (existingRepeat) existingRepeat.remove();

      if (mode === 'titles') {
        Array.from(meta.children).forEach((child) => {
          if (child.classList?.contains('albums-listening-log-badge')) return;
          if (/^\d[\d,]* listens$/i.test(child.textContent.trim())) child.remove();
        });
      }
    });
  }

  function patchSummary(shell) {
    const text = shell.querySelector('.albums-listening-log-results p');
    if (!text) return;
    const mode = activeMode();
    const filtered = filteredData(mode);
    const shown = shell.querySelectorAll('.albums-listening-log-item').length;
    if (!filtered.length) {
      const next = `No matching ${mode === 'titles' ? 'titles' : 'entries'}`;
      if (text.textContent !== next) text.textContent = next;
      return;
    }
    if (mode === 'titles') {
      const listens = filtered.reduce((sum, item) => sum + (item.listenCount || 1), 0);
      const minutes = filtered.reduce((sum, item) => sum + (item.totalMinutes || item.minutes || 0), 0);
      const next = `Showing ${shown.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')} matching titles · ${listens.toLocaleString('en-US')} listens · ${logFormatDuration(minutes)}`;
      if (text.textContent !== next) text.textContent = next;
      return;
    }
    const minutes = filtered.reduce((sum, item) => sum + item.minutes, 0);
    const uniqueTitles = new Set(filtered.map((item) => `${logNormalize(item.artist)}|${logNormalize(item.title)}`)).size;
    const next = `Showing ${shown.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')} matching entries · ${logFormatDuration(minutes)} · ${uniqueTitles.toLocaleString('en-US')} titles`;
    if (text.textContent !== next) text.textContent = next;
  }

  function ungroupDays(list) {
    const groups = Array.from(list.querySelectorAll(':scope > .albums-listening-log-day-group'));
    if (!groups.length) return;
    const fragment = document.createDocumentFragment();
    groups.forEach((group) => {
      group.querySelectorAll(':scope > .albums-listening-log-day-items > .albums-listening-log-item').forEach((item) => fragment.append(item));
    });
    list.replaceChildren(fragment);
    delete list.dataset.logDaysGrouped;
  }

  function groupDays(shell) {
    const list = shell.querySelector('.albums-listening-log-list');
    if (!list) return;
    if (state.layout !== 'days' || activeMode() !== 'entries') {
      ungroupDays(list);
      return;
    }
    if (list.dataset.logDaysGrouped === 'true') return;

    const items = Array.from(list.querySelectorAll(':scope > .albums-listening-log-item'));
    if (!items.length) return;
    const filtered = filteredData('entries');
    const dayStats = new Map();
    filtered.forEach((entry) => {
      if (!dayStats.has(entry.dateKey)) dayStats.set(entry.dateKey, { count: 0, minutes: 0, date: entry.date });
      const stat = dayStats.get(entry.dateKey);
      stat.count += 1;
      stat.minutes += entry.minutes;
    });

    const renderedByDay = new Map();
    items.forEach((item) => {
      const key = item.querySelector('.albums-listening-log-side time')?.dateTime || '';
      if (!renderedByDay.has(key)) renderedByDay.set(key, []);
      renderedByDay.get(key).push(item);
    });

    const fragment = document.createDocumentFragment();
    renderedByDay.forEach((dayItems, key) => {
      const stat = dayStats.get(key);
      const date = stat?.date || logParseDate(key);
      const group = document.createElement('li');
      group.className = 'albums-listening-log-day-group';
      const heading = document.createElement('div');
      heading.className = 'albums-listening-log-day-heading';
      const title = document.createElement('strong');
      title.textContent = logFormatFullDate(date);
      const summary = document.createElement('span');
      const fullCount = stat?.count || dayItems.length;
      const minutes = stat?.minutes || 0;
      const hiddenCount = Math.max(0, fullCount - dayItems.length);
      summary.textContent = `${fullCount.toLocaleString('en-US')} ${fullCount === 1 ? 'entry' : 'entries'} · ${logFormatDuration(minutes)}${hiddenCount ? ` · ${hiddenCount.toLocaleString('en-US')} more below` : ''}`;
      heading.append(title, summary);
      const nested = document.createElement('ul');
      nested.className = 'albums-listening-log-day-items';
      dayItems.forEach((item) => nested.append(item));
      group.append(heading, nested);
      fragment.append(group);
    });
    list.replaceChildren(fragment);
    list.dataset.logDaysGrouped = 'true';
  }

  function patch() {
    if (state.patching) return;
    const shell = expansion.querySelector('.albums-listening-log-view');
    if (!shell || expansion.hidden) return;
    state.patching = true;
    try {
      patchMetrics(shell);
      ensureLayoutControls(shell);
      patchTypeFilter(shell);
      patchItems(shell);
      patchSummary(shell);
      groupDays(shell);
    } finally {
      state.patching = false;
    }
  }

  function queuePatch() {
    window.cancelAnimationFrame(state.frame);
    state.frame = window.requestAnimationFrame(patch);
  }

  expansion.addEventListener('change', (event) => {
    const sort = event.target.closest('select[aria-label="Sort listening log"]');
    if (sort && state.layout === 'days' && sort.value !== 'latest') state.layout = 'rows';
    queuePatch();
  }, true);
  expansion.addEventListener('input', queuePatch, true);
  expansion.addEventListener('click', () => window.setTimeout(queuePatch, 0), true);

  const observer = new MutationObserver(queuePatch);
  observer.observe(expansion, { childList: true, subtree: true });
  viewToggle.addEventListener('click', () => window.setTimeout(queuePatch, 60));
  queuePatch();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsListeningLogPolish(), { once: true });
} else {
  bootAlbumsListeningLogPolish();
}
