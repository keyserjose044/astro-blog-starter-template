/* LifeLoggerz Albums: Listening Log polish with repeat-aware, Unicode-safe identity. */

const ALBUMS_LISTENING_LOG_POLISH_V2_VERSION = '20260802-0915';
const ALBUMS_LISTENING_LOG_POLISH_V2_RETRIES = 200;

function ensureListeningLogPolishV2Css() {
  if (document.querySelector('link[data-albums-listening-log-polish-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.albumsListeningLogPolishCss = 'true';
  link.href = new URL(`../styles/albums-listening-log-polish.css?v=${ALBUMS_LISTENING_LOG_POLISH_V2_VERSION}`, import.meta.url).toString();
  document.head.append(link);
}

const polishClean = (value) => String(value ?? '').trim();
const polishNormalize = (value) => polishClean(value)
  .normalize('NFKD')
  .replace(/\p{M}+/gu, '')
  .toLocaleLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const polishIsHttpUrl = (value) => /^https?:\/\//i.test(polishClean(value));
const polishPlaceholderTitle = (value) => /^(?:linked music entry|untitled entry)$/i.test(polishClean(value));

function polishSourceIdentity(value) {
  const raw = polishClean(value);
  if (!polishIsHttpUrl(raw)) return '';
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    if (host === 'youtu.be' && parts[0]) return `youtube:${parts[0].toLowerCase()}`;
    if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const videoId = url.searchParams.get('v')
        || ((['shorts', 'embed', 'live'].includes(parts[0])) ? parts[1] : '')
        || '';
      if (videoId) return `youtube:${videoId.toLowerCase()}`;
    }
    const ignored = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'si', 'feature', 'ref', 'referrer']);
    const params = [];
    url.searchParams.forEach((paramValue, paramKey) => {
      if (!ignored.has(paramKey.toLowerCase())) params.push([paramKey, paramValue]);
    });
    params.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const query = params.length
      ? `?${params.map(([key, paramValue]) => `${encodeURIComponent(key)}=${encodeURIComponent(paramValue)}`).join('&')}`
      : '';
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `url:${host}${path}${query}`.toLocaleLowerCase();
  } catch (_error) {
    return `url:${polishNormalize(raw)}`;
  }
}

function polishIdentityKey(entry) {
  const artist = polishNormalize(entry?.artist);
  const rawTitle = polishClean(entry?.title);
  const title = polishNormalize(rawTitle);
  if (polishPlaceholderTitle(rawTitle) || !title) {
    const source = polishSourceIdentity(entry?.sourceUrl);
    if (source) return `${artist}|source:${source}`;
    return `${artist}|row:${Number(entry?.rowNumber || 0)}`;
  }
  return `${artist}|title:${title}`;
}

function polishParseDate(value) {
  const raw = polishClean(value).replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
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

function polishParseMinutes(value) {
  const raw = polishClean(value).toLowerCase();
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

const polishDateKey = (date) => date
  ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  : '';

const polishFormatFullDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  : '';

const polishFormatDuration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder.toLocaleString('en-US')} min`;
  return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
};

const polishIsAlbum = (row) => typeof row?.isAlbum === 'boolean'
  ? row.isAlbum
  : /^(?:y|yes|true|1|album|full album)$/i.test(polishClean(row?.albumRaw ?? row?.albumFlag ?? row?.['album?']));

function normalizePolishV2Entry(row, index) {
  if (!row || typeof row !== 'object') return null;
  const date = polishParseDate(row.date ?? row.listeningDate ?? row.dateListened);
  const artist = polishClean(row.artist ?? row.performer);
  let title = polishClean(row.title ?? row.piece ?? row.albumPiece ?? row.album ?? row.work);
  let sourceUrl = polishClean(row.sourceUrl ?? row.youtubeUrl ?? row.url ?? row.link);
  if (polishIsHttpUrl(title)) {
    if (!sourceUrl) sourceUrl = title;
    title = 'Untitled entry';
  } else if (title === 'Linked music entry') {
    title = 'Untitled entry';
  }
  if (!date || !artist || !title) return null;
  return {
    rowNumber: Number(row.rowNumber ?? row.sourceRow ?? index + 2) || index + 2,
    date,
    dateKey: polishDateKey(date),
    listenedYear: String(date.getUTCFullYear()),
    artist,
    title,
    minutes: polishParseMinutes(row.minutes ?? row.min ?? row.duration ?? row.length),
    rating: polishClean(row.rating ?? row.score),
    genre: polishClean(row.genre ?? row.style).replace(/^\d+\.\s*/, ''),
    subgenre: polishClean(row.subgenre ?? row.subGenre),
    country: polishClean(row.country ?? row.coo ?? row.origin),
    releaseYear: polishClean(row.year ?? row.releaseYear ?? row.releasePeriod),
    annotation: polishClean(row.annotation ?? row.note ?? row.albumRaw),
    instrumentRaw: polishClean(row.instrumentRaw ?? row.instrument ?? row.instrm),
    isAlbum: polishIsAlbum(row),
    sourceUrl: polishIsHttpUrl(sourceUrl) ? sourceUrl : '',
  };
}

function bootAlbumsListeningLogPolishV2(attempt = 0) {
  ensureListeningLogPolishV2Css();
  const expansion = document.querySelector('#albums-expansion-views');
  const viewToggle = document.querySelector('#album-view-toggle');
  if ((!expansion || !viewToggle) && attempt < ALBUMS_LISTENING_LOG_POLISH_V2_RETRIES) {
    window.setTimeout(() => bootAlbumsListeningLogPolishV2(attempt + 1), 75);
    return;
  }
  if (!expansion || !viewToggle || document.body.dataset.albumsListeningLogPolishV2Ready) return;

  fetch(new URL(`../data/music-listening.json?v=${ALBUMS_LISTENING_LOG_POLISH_V2_VERSION}`, import.meta.url).toString(), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Music snapshot returned ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const rawRows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
      const entries = rawRows.map(normalizePolishV2Entry).filter(Boolean);
      if (!entries.length) return;

      document.body.dataset.albumsListeningLogPolishV2Ready = 'true';
      const groups = new Map();
      entries.forEach((entry) => {
        const key = polishIdentityKey(entry);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(entry);
      });
      const repeatCounts = new Map(Array.from(groups.entries()).map(([key, group]) => [key, group.length]));
      const state = { layout: 'rows', patching: false, frame: 0 };

      const repeatedActive = () => document.body.getAttribute('data-albums-repeated-ui-active') === 'true';
      const activeMode = () => {
        const pressed = expansion.querySelector('.albums-listening-log-mode-group button[aria-pressed="true"]');
        return /works|titles/i.test(pressed?.textContent || '') ? 'titles' : 'entries';
      };

      function toolbarValues() {
        const toolbar = expansion.querySelector('.albums-listening-log-toolbar');
        if (!toolbar) return null;
        const selects = Array.from(toolbar.querySelectorAll('select'));
        return {
          search: toolbar.querySelector('input[type="search"]')?.value || '',
          artist: selects.find((select) => /artist/i.test(select.getAttribute('aria-label') || ''))?.value || '',
          genre: selects.find((select) => /genre/i.test(select.getAttribute('aria-label') || ''))?.value || '',
          type: selects.find((select) => /entry type/i.test(select.getAttribute('aria-label') || ''))?.value || '',
          year: selects.find((select) => /listening year/i.test(select.getAttribute('aria-label') || ''))?.value || '',
        };
      }

      function matches(entry, filters) {
        if (!filters) return true;
        if (filters.artist && entry.artist !== filters.artist) return false;
        if (filters.genre && entry.genre !== filters.genre) return false;
        if (filters.type === 'album' && !entry.isAlbum) return false;
        if (filters.type === 'other' && entry.isAlbum) return false;
        if (filters.year && entry.listenedYear !== filters.year) return false;
        const words = polishNormalize(filters.search).split(/\s+/).filter(Boolean);
        if (words.length) {
          const haystack = polishNormalize([
            entry.title, entry.artist, entry.genre, entry.subgenre, entry.country,
            entry.releaseYear, entry.rating, entry.annotation, entry.instrumentRaw,
          ].join(' '));
          if (!words.every((word) => haystack.includes(word))) return false;
        }
        return true;
      }

      function patchMetrics(shell) {
        const tooltips = {
          'Listening entries': 'Every dated row in the complete Listen Log, including repeat listens.',
          'Unique titles': 'Distinct music identities after repeat listens are collapsed. Unicode titles and URL-only rows are handled safely.',
          'Listening time': 'Total recorded minutes across every dated Listen Log entry.',
          'Music days': 'Distinct calendar days with at least one recorded music entry.',
          'Full-album listens': 'Listening-log entries marked as full albums. This is not the number of unique albums in the Albums archive.',
        };
        shell.querySelectorAll('.albums-listening-log-metrics > div').forEach((item) => {
          const label = item.querySelector('span');
          const strong = item.querySelector('strong');
          if (!label) return;
          if (/^unique works$/i.test(label.textContent.trim())) label.textContent = 'Unique titles';
          if (/^album-tagged$/i.test(label.textContent.trim())) label.textContent = 'Full-album listens';
          if (/^unique titles$/i.test(label.textContent.trim()) && strong) strong.textContent = groups.size.toLocaleString('en-US');
          const tooltip = tooltips[label.textContent.trim()];
          if (tooltip) {
            item.title = tooltip;
            item.setAttribute('aria-label', `${label.textContent.trim()}: ${strong?.textContent || ''}. ${tooltip}`);
          }
        });
      }

      function ensureLayoutControls(shell) {
        const modeRow = shell.querySelector('.albums-listening-log-mode-row');
        const modeGroup = modeRow?.querySelector('.albums-listening-log-mode-group');
        if (!modeRow || !modeGroup) return;

        modeGroup.querySelectorAll('button').forEach((button) => {
          if (/^Works\b/i.test(button.textContent)) button.textContent = button.textContent.replace(/^Works\b/i, 'Titles');
        });

        let switches = modeRow.querySelector('.albums-listening-log-switches');
        let layoutGroup = modeRow.querySelector('.albums-listening-log-layout-group');
        if (!layoutGroup) {
          switches = document.createElement('div');
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
            layoutGroup.append(control);
          });
          switches.append(layoutGroup);
        }

        const mode = activeMode();
        if (mode === 'titles' && state.layout === 'days') state.layout = 'rows';
        layoutGroup.hidden = mode === 'titles';
        if (!repeatedActive()) {
          layoutGroup.querySelectorAll('[data-log-layout="rows"], [data-log-layout="days"]').forEach((control) => {
            control.setAttribute('aria-pressed', String(control.dataset.logLayout === state.layout));
          });
        }
      }

      function patchTypeFilter(shell) {
        const select = shell.querySelector('.albums-listening-log-toolbar select[aria-label="Filter listening log by entry type"]');
        if (!select) return;
        const labels = { '': 'All types', album: 'Full albums', other: 'Other music' };
        Array.from(select.options).forEach((option) => {
          if (Object.prototype.hasOwnProperty.call(labels, option.value)) option.textContent = labels[option.value];
        });
      }

      function domIdentity(item) {
        const artist = item.querySelector('.albums-listening-log-artist')?.textContent?.trim() || '';
        const title = item.querySelector('.albums-listening-log-title')?.textContent?.trim() || '';
        const sourceUrl = Array.from(item.querySelectorAll('a[href]')).map((anchor) => anchor.href).find((href) => polishIsHttpUrl(href)) || '';
        const rowNumber = Number(item.dataset.rowNumber || item.getAttribute('data-row-number') || 0);
        return polishIdentityKey({ artist, title, sourceUrl, rowNumber });
      }

      function patchItems(shell) {
        if (repeatedActive() || activeMode() !== 'entries') return;
        shell.querySelectorAll('.albums-listening-log-item').forEach((item) => {
          const titleNode = item.querySelector('.albums-listening-log-title');
          const meta = item.querySelector('.albums-listening-log-meta');
          if (!titleNode || !meta) return;
          if (titleNode.textContent.trim() === 'Linked music entry') titleNode.textContent = 'Untitled entry';

          const albumBadge = Array.from(meta.querySelectorAll('.albums-listening-log-badge')).find((badge) => /^Album$/i.test(badge.textContent.trim()));
          if (albumBadge) {
            albumBadge.textContent = 'Full album';
            albumBadge.title = 'This listening entry was marked as a full-album listen.';
          }

          const count = repeatCounts.get(domIdentity(item)) || 0;
          let repeatBadge = meta.querySelector('.albums-listening-log-badge.is-repeat-v2');
          if (count > 1) {
            if (!repeatBadge) {
              repeatBadge = document.createElement('span');
              repeatBadge.className = 'albums-listening-log-badge is-repeat-v2';
              meta.append(repeatBadge);
            }
            repeatBadge.textContent = `↻ ${count.toLocaleString('en-US')} listens`;
            repeatBadge.title = `This title appears ${count.toLocaleString('en-US')} times in the listening log.`;
          } else if (repeatBadge) repeatBadge.remove();
        });
      }

      function patchSummary(shell) {
        if (repeatedActive() || activeMode() !== 'entries') return;
        const text = shell.querySelector('.albums-listening-log-results p');
        if (!text) return;
        const filtered = entries.filter((entry) => matches(entry, toolbarValues()));
        const shown = shell.querySelectorAll('.albums-listening-log-item').length;
        if (!filtered.length) {
          text.textContent = 'No matching entries';
          return;
        }
        const minutes = filtered.reduce((sum, entry) => sum + entry.minutes, 0);
        const uniqueTitles = new Set(filtered.map(polishIdentityKey)).size;
        text.textContent = `Showing ${shown.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')} matching entries · ${polishFormatDuration(minutes)} · ${uniqueTitles.toLocaleString('en-US')} titles`;
      }

      function ungroupDays(list) {
        const dayGroups = Array.from(list.querySelectorAll(':scope > .albums-listening-log-day-group'));
        if (!dayGroups.length) return;
        const fragment = document.createDocumentFragment();
        dayGroups.forEach((group) => {
          group.querySelectorAll(':scope > .albums-listening-log-day-items > .albums-listening-log-item').forEach((item) => fragment.append(item));
        });
        list.replaceChildren(fragment);
        delete list.dataset.logDaysGrouped;
      }

      function groupDays(shell) {
        const list = shell.querySelector('.albums-listening-log-list');
        if (!list || repeatedActive()) return;
        if (state.layout !== 'days' || activeMode() !== 'entries') {
          ungroupDays(list);
          return;
        }
        if (list.dataset.logDaysGrouped === 'true') return;

        const items = Array.from(list.querySelectorAll(':scope > .albums-listening-log-item'));
        if (!items.length) return;
        const filtered = entries.filter((entry) => matches(entry, toolbarValues()));
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
          const date = stat?.date || polishParseDate(key);
          const group = document.createElement('li');
          group.className = 'albums-listening-log-day-group';
          const heading = document.createElement('div');
          heading.className = 'albums-listening-log-day-heading';
          const title = document.createElement('strong');
          title.textContent = polishFormatFullDate(date);
          const summary = document.createElement('span');
          const fullCount = stat?.count || dayItems.length;
          summary.textContent = `${fullCount.toLocaleString('en-US')} ${fullCount === 1 ? 'entry' : 'entries'} · ${polishFormatDuration(stat?.minutes || 0)}`;
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

      expansion.addEventListener('click', (event) => {
        const ordinaryLayout = event.target.closest('[data-log-layout="rows"], [data-log-layout="days"]');
        if (ordinaryLayout) {
          state.layout = ordinaryLayout.dataset.logLayout;
          if (state.layout === 'days') {
            const sort = expansion.querySelector('.albums-listening-log-toolbar select[aria-label="Sort listening log"]');
            if (sort && sort.value !== 'latest') {
              sort.value = 'latest';
              sort.dispatchEvent(new Event('change', { bubbles: true }));
              return;
            }
          }
        }
        window.setTimeout(queuePatch, 0);
      }, true);

      expansion.addEventListener('change', (event) => {
        const sort = event.target.closest('select[aria-label="Sort listening log"]');
        if (sort && state.layout === 'days' && sort.value !== 'latest') state.layout = 'rows';
        queuePatch();
      }, true);
      expansion.addEventListener('input', queuePatch, true);
      viewToggle.addEventListener('click', () => window.setTimeout(queuePatch, 60));

      const observer = new MutationObserver(queuePatch);
      observer.observe(expansion, { childList: true, subtree: true });
      queuePatch();
    })
    .catch((error) => {
      console.warn('[Albums] Listening Log polish v2 could not load:', error);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsListeningLogPolishV2(), { once: true });
} else {
  bootAlbumsListeningLogPolishV2();
}
