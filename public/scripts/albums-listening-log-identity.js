/* LifeLoggerz Albums: Unicode-safe identity, Rows/Days polish, and Repeated explorer. */

const ALBUMS_LISTENING_IDENTITY_VERSION = '20260802-0945';
const ALBUMS_LISTENING_IDENTITY_RETRIES = 200;
const ALBUMS_LISTENING_REPEATED_PAGE_SIZE = 50;
const ALBUMS_REDISCOVERED_GAP_DAYS = 180;

function ensureIdentityStyles() {
  if (!document.querySelector('link[data-albums-listening-log-polish-css]')) {
    const polish = document.createElement('link');
    polish.rel = 'stylesheet';
    polish.dataset.albumsListeningLogPolishCss = 'true';
    polish.href = new URL(`../styles/albums-listening-log-polish.css?v=${ALBUMS_LISTENING_IDENTITY_VERSION}`, import.meta.url).toString();
    document.head.append(polish);
  }
  if (!document.querySelector('link[data-albums-listening-repeated-css]')) {
    const repeated = document.createElement('link');
    repeated.rel = 'stylesheet';
    repeated.dataset.albumsListeningRepeatedCss = 'true';
    repeated.href = new URL(`../styles/albums-listening-log-repeated.css?v=${ALBUMS_LISTENING_IDENTITY_VERSION}`, import.meta.url).toString();
    document.head.append(repeated);
  }
}

const identityClean = (value) => String(value ?? '').trim();

/* Keep letters/numbers from every writing system while retaining accent tolerance. */
const identityNormalize = (value) => identityClean(value)
  .normalize('NFKD')
  .replace(/\p{M}+/gu, '')
  .toLocaleLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const identityIsHttpUrl = (value) => /^https?:\/\//i.test(identityClean(value));
const identityIsPlaceholderTitle = (value) => /^(?:linked music entry|untitled entry)$/i.test(identityClean(value));

function canonicalSourceIdentity(value) {
  const raw = identityClean(value);
  if (!identityIsHttpUrl(raw)) return '';

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

    const ignoredParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'si', 'feature', 'ref', 'referrer',
    ]);
    const kept = [];
    url.searchParams.forEach((paramValue, paramKey) => {
      if (!ignoredParams.has(paramKey.toLowerCase())) kept.push([paramKey, paramValue]);
    });
    kept.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const query = kept.length
      ? `?${kept.map(([key, paramValue]) => `${encodeURIComponent(key)}=${encodeURIComponent(paramValue)}`).join('&')}`
      : '';
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `url:${host}${path}${query}`.toLocaleLowerCase();
  } catch (_error) {
    return `url:${identityNormalize(raw)}`;
  }
}

function musicIdentityKey(entry) {
  const artistKey = identityNormalize(entry?.artist);
  const rawTitle = identityClean(entry?.title);
  const titleKey = identityNormalize(rawTitle);

  if (identityIsPlaceholderTitle(rawTitle) || !titleKey) {
    const sourceKey = canonicalSourceIdentity(entry?.sourceUrl);
    if (sourceKey) return `${artistKey}|source:${sourceKey}`;

    /* Ambiguous untitled/no-source rows stay separate instead of creating false repeats. */
    return `${artistKey}|row:${Number(entry?.rowNumber || 0)}`;
  }

  return `${artistKey}|title:${titleKey}`;
}

function parseIdentityDate(value) {
  const raw = identityClean(value).replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
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
  return Number.isNaN(parsed.getTime())
    ? null
    : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function parseIdentityMinutes(value) {
  const raw = identityClean(value).toLowerCase();
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

const identityDateKey = (date) => date
  ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  : '';

const formatIdentityDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  : '';

const formatIdentityFullDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  : '';

const formatIdentityDuration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder.toLocaleString('en-US')} min`;
  return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
};

function formatIdentitySpan(firstDate, latestDate) {
  if (!firstDate || !latestDate) return '';
  const days = Math.max(0, Math.round((latestDate - firstDate) / 86400000));
  if (days < 31) return days === 1 ? '1 day' : `${days} days`;
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30.44));
    return months === 1 ? '1 mo' : `${months} mo`;
  }
  const years = Math.floor(days / 365.25);
  const remainderDays = Math.max(0, days - Math.round(years * 365.25));
  const months = Math.floor(remainderDays / 30.44);
  if (!months) return years === 1 ? '1 yr' : `${years} yr`;
  return `${years} yr ${months} mo`;
}

const identityIsAlbum = (row) => typeof row?.isAlbum === 'boolean'
  ? row.isAlbum
  : /^(?:y|yes|true|1|album|full album)$/i.test(identityClean(row?.albumRaw ?? row?.albumFlag ?? row?.['album?']));

function normalizeIdentityEntry(row, index) {
  if (!row || typeof row !== 'object') return null;
  const date = parseIdentityDate(row.date ?? row.listeningDate ?? row.dateListened);
  const artist = identityClean(row.artist ?? row.performer);
  let title = identityClean(row.title ?? row.piece ?? row.albumPiece ?? row.album ?? row.work);
  let sourceUrl = identityClean(row.sourceUrl ?? row.youtubeUrl ?? row.url ?? row.link);

  if (identityIsHttpUrl(title)) {
    if (!sourceUrl) sourceUrl = title;
    title = 'Untitled entry';
  } else if (title === 'Linked music entry') {
    title = 'Untitled entry';
  }

  if (!date || !artist || !title) return null;

  return {
    rowNumber: Number(row.rowNumber ?? row.sourceRow ?? index + 2) || index + 2,
    date,
    dateKey: identityDateKey(date),
    listenedYear: String(date.getUTCFullYear()),
    artist,
    title,
    minutes: parseIdentityMinutes(row.minutes ?? row.min ?? row.duration ?? row.length),
    rating: identityClean(row.rating ?? row.score),
    genre: identityClean(row.genre ?? row.style).replace(/^\d+\.\s*/, ''),
    subgenre: identityClean(row.subgenre ?? row.subGenre),
    country: identityClean(row.country ?? row.coo ?? row.origin),
    releaseYear: identityClean(row.year ?? row.releaseYear ?? row.releasePeriod),
    annotation: identityClean(row.annotation ?? row.note ?? row.albumRaw),
    instrumentRaw: identityClean(row.instrumentRaw ?? row.instrument ?? row.instrm),
    isAlbum: identityIsAlbum(row),
    sourceUrl: identityIsHttpUrl(sourceUrl) ? sourceUrl : '',
  };
}

function buildIdentityGroups(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = musicIdentityKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return groups;
}

function aggregateRepeatedGroups(entries, collator) {
  return Array.from(buildIdentityGroups(entries).values())
    .filter((group) => group.length > 1)
    .map((group) => {
      const chronological = [...group].sort((a, b) => a.date - b.date || a.rowNumber - b.rowNumber);
      const newestFirst = [...chronological].reverse();
      const first = chronological[0];
      const latest = chronological[chronological.length - 1];
      const pick = (field) => newestFirst.find((entry) => identityClean(entry[field]))?.[field] || '';
      let maxGapDays = 0;
      let maxGapStart = null;
      let maxGapEnd = null;

      for (let i = 1; i < chronological.length; i += 1) {
        const gap = Math.round((chronological[i].date - chronological[i - 1].date) / 86400000);
        if (gap > maxGapDays) {
          maxGapDays = gap;
          maxGapStart = chronological[i - 1].date;
          maxGapEnd = chronological[i].date;
        }
      }

      return {
        artist: latest.artist,
        title: latest.title,
        genre: pick('genre'),
        subgenre: pick('subgenre'),
        country: pick('country'),
        releaseYear: pick('releaseYear'),
        rating: pick('rating'),
        isAlbum: group.some((entry) => entry.isAlbum),
        listens: newestFirst,
        listenCount: group.length,
        totalMinutes: group.reduce((sum, entry) => sum + entry.minutes, 0),
        firstDate: first.date,
        latestDate: latest.date,
        spanLabel: formatIdentitySpan(first.date, latest.date),
        maxGapDays,
        maxGapStart,
        maxGapEnd,
      };
    })
    .sort((a, b) => b.listenCount - a.listenCount
      || b.totalMinutes - a.totalMinutes
      || b.latestDate - a.latestDate
      || collator.compare(a.artist, b.artist)
      || collator.compare(a.title, b.title));
}

function setText(node, text) {
  if (node && node.textContent !== text) node.textContent = text;
}

function bootAlbumsListeningIdentity(attempt = 0) {
  ensureIdentityStyles();
  const expansion = document.querySelector('#albums-expansion-views');
  const viewToggle = document.querySelector('#album-view-toggle');

  if ((!expansion || !viewToggle) && attempt < ALBUMS_LISTENING_IDENTITY_RETRIES) {
    window.setTimeout(() => bootAlbumsListeningIdentity(attempt + 1), 75);
    return;
  }
  if (!expansion || !viewToggle || document.body.dataset.albumsListeningIdentityReady) return;

  fetch(new URL(`../data/music-listening.json?v=${ALBUMS_LISTENING_IDENTITY_VERSION}`, import.meta.url).toString(), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Music snapshot returned ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const rawRows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
      const entries = rawRows.map(normalizeIdentityEntry).filter(Boolean);
      if (!entries.length) return;

      document.body.dataset.albumsListeningIdentityReady = 'true';
      document.body.dataset.albumsListeningRepeatedReady = 'true';

      const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
      const allGroups = buildIdentityGroups(entries);
      const repeatCounts = new Map(Array.from(allGroups.entries()).map(([key, group]) => [key, group.length]));
      const state = {
        layout: 'rows',
        repeated: false,
        limit: ALBUMS_LISTENING_REPEATED_PAGE_SIZE,
        lastFilterSignature: '',
        lastRenderSignature: '',
        frame: 0,
        patching: false,
      };

      const activeMode = () => {
        const pressed = expansion.querySelector('.albums-listening-log-mode-group button[aria-pressed="true"]');
        return /works|titles/i.test(pressed?.textContent || '') ? 'titles' : 'entries';
      };

      function controls() {
        const toolbar = expansion.querySelector('.albums-listening-log-toolbar');
        if (!toolbar) return null;
        const selects = Array.from(toolbar.querySelectorAll('select'));
        return {
          search: toolbar.querySelector('input[type="search"]'),
          artist: selects.find((select) => /artist/i.test(select.getAttribute('aria-label') || '')),
          genre: selects.find((select) => /genre/i.test(select.getAttribute('aria-label') || '')),
          type: selects.find((select) => /entry type/i.test(select.getAttribute('aria-label') || '')),
          year: selects.find((select) => /listening year/i.test(select.getAttribute('aria-label') || '')),
          sort: selects.find((select) => /sort/i.test(select.getAttribute('aria-label') || '')),
        };
      }

      function filterValues() {
        const c = controls();
        return c ? {
          search: c.search?.value || '',
          artist: c.artist?.value || '',
          genre: c.genre?.value || '',
          type: c.type?.value || '',
          year: c.year?.value || '',
        } : { search: '', artist: '', genre: '', type: '', year: '' };
      }

      function matches(entry, filters) {
        if (filters.artist && entry.artist !== filters.artist) return false;
        if (filters.genre && entry.genre !== filters.genre) return false;
        if (filters.type === 'album' && !entry.isAlbum) return false;
        if (filters.type === 'other' && entry.isAlbum) return false;
        if (filters.year && entry.listenedYear !== filters.year) return false;
        const words = identityNormalize(filters.search).split(/\s+/).filter(Boolean);
        if (words.length) {
          const haystack = identityNormalize([
            entry.artist, entry.title, entry.genre, entry.subgenre, entry.country,
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
          if (/^unique works$/i.test(label.textContent.trim())) setText(label, 'Unique titles');
          if (/^album-tagged$/i.test(label.textContent.trim())) setText(label, 'Full-album listens');
          if (/^unique titles$/i.test(label.textContent.trim()) && strong) setText(strong, allGroups.size.toLocaleString('en-US'));
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
        if (!modeRow || !modeGroup) return null;

        modeGroup.querySelectorAll('button').forEach((button) => {
          if (/^Works\b/i.test(button.textContent)) setText(button, button.textContent.replace(/^Works\b/i, 'Titles'));
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
          [['rows', 'Rows'], ['days', 'Days'], ['repeated', 'Repeated']].forEach(([layout, label]) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.logLayout = layout;
            button.textContent = label;
            button.setAttribute('aria-pressed', 'false');
            layoutGroup.append(button);
          });
          switches.append(layoutGroup);
        } else if (!layoutGroup.querySelector('[data-log-layout="repeated"]')) {
          const repeated = document.createElement('button');
          repeated.type = 'button';
          repeated.dataset.logLayout = 'repeated';
          repeated.textContent = 'Repeated';
          repeated.setAttribute('aria-pressed', 'false');
          layoutGroup.append(repeated);
        }

        const mode = activeMode();
        if (mode === 'titles' && state.layout === 'days') state.layout = 'rows';
        layoutGroup.hidden = mode === 'titles';

        if (mode === 'entries') {
          layoutGroup.querySelectorAll('[data-log-layout]').forEach((button) => {
            const pressed = state.repeated
              ? button.dataset.logLayout === 'repeated'
              : button.dataset.logLayout === state.layout;
            if (button.getAttribute('aria-pressed') !== String(pressed)) button.setAttribute('aria-pressed', String(pressed));
          });
        }

        return layoutGroup;
      }

      function patchTypeFilter(shell) {
        const select = shell.querySelector('.albums-listening-log-toolbar select[aria-label="Filter listening log by entry type"]');
        if (!select) return;
        const labels = { '': 'All types', album: 'Full albums', other: 'Other music' };
        Array.from(select.options).forEach((option) => {
          if (Object.prototype.hasOwnProperty.call(labels, option.value) && option.textContent !== labels[option.value]) {
            option.textContent = labels[option.value];
          }
        });
      }

      function domItemIdentity(item) {
        const artist = item.querySelector('.albums-listening-log-artist')?.textContent?.trim() || '';
        const title = item.querySelector('.albums-listening-log-title')?.textContent?.trim() || '';
        const sourceUrl = Array.from(item.querySelectorAll('a[href]'))
          .map((anchor) => anchor.href)
          .find((href) => identityIsHttpUrl(href)) || '';
        const rowNumber = Number(item.dataset.rowNumber || item.getAttribute('data-row-number') || 0);
        return musicIdentityKey({ artist, title, sourceUrl, rowNumber });
      }

      function patchRows(shell) {
        if (state.repeated || activeMode() !== 'entries') return;
        shell.querySelectorAll('.albums-listening-log-item').forEach((item) => {
          const title = item.querySelector('.albums-listening-log-title');
          const meta = item.querySelector('.albums-listening-log-meta');
          if (!title || !meta) return;
          if (title.textContent.trim() === 'Linked music entry') setText(title, 'Untitled entry');

          const albumBadge = Array.from(meta.querySelectorAll('.albums-listening-log-badge')).find((badge) => /^Album$/i.test(badge.textContent.trim()));
          if (albumBadge) {
            setText(albumBadge, 'Full album');
            albumBadge.title = 'This listening entry was marked as a full-album listen.';
          }

          const count = repeatCounts.get(domItemIdentity(item)) || 0;
          let repeatBadge = meta.querySelector('.albums-listening-log-badge.is-repeat');
          if (count > 1) {
            if (!repeatBadge) {
              repeatBadge = document.createElement('span');
              repeatBadge.className = 'albums-listening-log-badge is-repeat';
              meta.append(repeatBadge);
            }
            setText(repeatBadge, `↻ ${count.toLocaleString('en-US')} listens`);
            repeatBadge.title = `This title appears ${count.toLocaleString('en-US')} times in the listening log.`;
          } else if (repeatBadge) repeatBadge.remove();
        });
      }

      function patchNormalSummary(shell) {
        if (state.repeated || activeMode() !== 'entries') return;
        const text = shell.querySelector('.albums-listening-log-results p');
        if (!text) return;
        const filtered = entries.filter((entry) => matches(entry, filterValues()));
        const shown = shell.querySelectorAll('.albums-listening-log-item').length;
        if (!filtered.length) {
          setText(text, 'No matching entries');
          return;
        }
        const minutes = filtered.reduce((sum, entry) => sum + entry.minutes, 0);
        const uniqueTitles = new Set(filtered.map(musicIdentityKey)).size;
        setText(text, `Showing ${shown.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')} matching entries · ${formatIdentityDuration(minutes)} · ${uniqueTitles.toLocaleString('en-US')} titles`);
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
        if (!list || state.repeated) return;
        if (state.layout !== 'days' || activeMode() !== 'entries') {
          ungroupDays(list);
          return;
        }
        if (list.dataset.logDaysGrouped === 'true') return;

        const items = Array.from(list.querySelectorAll(':scope > .albums-listening-log-item'));
        if (!items.length) return;
        const filtered = entries.filter((entry) => matches(entry, filterValues()));
        const dayStats = new Map();
        filtered.forEach((entry) => {
          if (!dayStats.has(entry.dateKey)) dayStats.set(entry.dateKey, { count: 0, minutes: 0, date: entry.date });
          const stat = dayStats.get(entry.dateKey);
          stat.count += 1;
          stat.minutes += entry.minutes;
        });

        const rendered = new Map();
        items.forEach((item) => {
          const key = item.querySelector('.albums-listening-log-side time')?.dateTime || '';
          if (!rendered.has(key)) rendered.set(key, []);
          rendered.get(key).push(item);
        });

        const fragment = document.createDocumentFragment();
        rendered.forEach((dayItems, key) => {
          const stat = dayStats.get(key);
          const date = stat?.date || parseIdentityDate(key);
          const group = document.createElement('li');
          group.className = 'albums-listening-log-day-group';
          const heading = document.createElement('div');
          heading.className = 'albums-listening-log-day-heading';
          const title = document.createElement('strong');
          title.textContent = formatIdentityFullDate(date);
          const summary = document.createElement('span');
          const count = stat?.count || dayItems.length;
          summary.textContent = `${count.toLocaleString('en-US')} ${count === 1 ? 'entry' : 'entries'} · ${formatIdentityDuration(stat?.minutes || 0)}`;
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

      function patchSortLabel() {
        const sort = controls()?.sort;
        const option = sort ? Array.from(sort.options).find((item) => item.value === 'most-listened') : null;
        if (!option) return;
        setText(option, state.repeated ? 'Most repeats' : 'Most repeats → Repeated');
      }

      function makeChip(label, value, kind) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'albums-listening-log-filter-chip';
        button.dataset.logFilterKind = kind;
        button.dataset.logFilterValue = value;
        button.textContent = label;
        return button;
      }

      function makeRepeatedCard(group, rank) {
        const li = document.createElement('li');
        li.className = 'albums-listening-log-repeated-card';

        const rankNode = document.createElement('span');
        rankNode.className = 'albums-listening-log-repeat-rank';
        rankNode.textContent = `#${rank}`;

        const main = document.createElement('div');
        main.className = 'albums-listening-log-repeat-main';

        const artist = document.createElement('button');
        artist.type = 'button';
        artist.className = 'albums-listening-log-repeat-artist';
        artist.dataset.logFilterKind = 'artist';
        artist.dataset.logFilterValue = group.artist;
        artist.textContent = group.artist;
        artist.title = `Filter to ${group.artist}`;

        const title = document.createElement('strong');
        title.className = 'albums-listening-log-repeat-title';
        title.textContent = group.title;

        const meta = document.createElement('div');
        meta.className = 'albums-listening-log-repeat-meta';
        if (group.isAlbum) {
          const album = document.createElement('span');
          album.className = 'albums-listening-log-repeat-pill is-album';
          album.textContent = 'Full album';
          meta.append(album);
        }
        const count = document.createElement('span');
        count.className = 'albums-listening-log-repeat-pill is-count';
        count.textContent = `↻ ${group.listenCount.toLocaleString('en-US')} listens`;
        meta.append(count);
        if (group.genre) meta.append(makeChip(group.genre, group.genre, 'genre'));
        if (group.subgenre && group.subgenre !== group.genre) meta.append(makeChip(group.subgenre, group.subgenre, 'search'));
        if (group.country) meta.append(makeChip(group.country, group.country, 'search'));
        if (group.releaseYear) meta.append(makeChip(group.releaseYear, group.releaseYear, 'search'));

        const stats = document.createElement('div');
        stats.className = 'albums-listening-log-repeat-stats';
        stats.innerHTML = `
          <span><strong>${formatIdentityDuration(group.totalMinutes)}</strong> total</span>
          <span>First · <strong>${formatIdentityDate(group.firstDate)}</strong></span>
          <span>Latest · <strong>${formatIdentityDate(group.latestDate)}</strong></span>
          <span>${group.listenCount.toLocaleString('en-US')} listens${group.spanLabel ? ` across ${group.spanLabel}` : ''}</span>
        `;
        if (group.maxGapDays >= ALBUMS_REDISCOVERED_GAP_DAYS) {
          const rediscovered = document.createElement('span');
          rediscovered.className = 'albums-listening-log-rediscovered';
          rediscovered.textContent = `Rediscovered after ${group.maxGapDays.toLocaleString('en-US')} days`;
          rediscovered.title = `${formatIdentityDate(group.maxGapStart)} → ${formatIdentityDate(group.maxGapEnd)}`;
          stats.append(rediscovered);
        }

        const details = document.createElement('details');
        details.className = 'albums-listening-log-repeat-history';
        const summary = document.createElement('summary');
        summary.textContent = `Show ${group.listenCount.toLocaleString('en-US')} listen dates`;
        const history = document.createElement('ol');
        group.listens.forEach((listen) => {
          const row = document.createElement('li');
          const date = document.createElement('time');
          date.dateTime = listen.dateKey;
          date.textContent = formatIdentityDate(listen.date);
          const duration = document.createElement('span');
          duration.textContent = formatIdentityDuration(listen.minutes);
          row.append(date, duration);
          if (listen.sourceUrl) {
            const source = document.createElement('a');
            source.href = listen.sourceUrl;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            source.textContent = '↗';
            source.setAttribute('aria-label', `Open ${group.title} source from ${formatIdentityDate(listen.date)}`);
            row.append(source);
          }
          history.append(row);
        });
        details.append(summary, history);

        main.append(artist, title, meta, stats, details);
        li.append(rankNode, main);
        return li;
      }

      function removeRepeatedMore(shell) {
        shell.querySelectorAll('.albums-listening-log-repeated-more').forEach((node) => node.remove());
      }

      function renderRepeated(shell) {
        if (!state.repeated || activeMode() !== 'entries') return;
        const list = shell.querySelector('.albums-listening-log-list');
        const resultsText = shell.querySelector('.albums-listening-log-results p');
        const baseMore = shell.querySelector('.albums-listening-log-more:not(.albums-listening-log-repeated-more)');
        if (!list || !resultsText) return;

        const filters = filterValues();
        const filterSignature = JSON.stringify(filters);
        if (filterSignature !== state.lastFilterSignature) {
          state.lastFilterSignature = filterSignature;
          state.limit = ALBUMS_LISTENING_REPEATED_PAGE_SIZE;
        }

        const repeatedGroups = aggregateRepeatedGroups(entries.filter((entry) => matches(entry, filters)), collator);
        const visible = repeatedGroups.slice(0, state.limit);
        const totalListens = repeatedGroups.reduce((sum, group) => sum + group.listenCount, 0);
        const totalMinutes = repeatedGroups.reduce((sum, group) => sum + group.totalMinutes, 0);
        const summaryText = repeatedGroups.length
          ? `Showing ${visible.length.toLocaleString('en-US')} of ${repeatedGroups.length.toLocaleString('en-US')} repeated titles · ${totalListens.toLocaleString('en-US')} underlying listens · ${formatIdentityDuration(totalMinutes)}`
          : 'No repeated titles within these filters';
        setText(resultsText, summaryText);
        if (baseMore) baseMore.hidden = true;

        const renderSignature = `${filterSignature}|${state.limit}|${repeatedGroups.length}|${visible.map((group) => `${musicIdentityKey(group)}:${group.listenCount}`).join('~')}`;
        if (list.classList.contains('is-repeated-ranking') && state.lastRenderSignature === renderSignature) return;

        list.classList.add('is-repeated-ranking');
        list.replaceChildren();
        visible.forEach((group, index) => list.append(makeRepeatedCard(group, index + 1)));
        if (!visible.length) {
          const empty = document.createElement('li');
          empty.className = 'albums-listening-log-empty';
          empty.textContent = 'No titles occur more than once within these filters.';
          list.append(empty);
        }
        state.lastRenderSignature = renderSignature;

        removeRepeatedMore(shell);
        if (repeatedGroups.length > state.limit) {
          const more = document.createElement('button');
          more.type = 'button';
          more.className = 'albums-listening-log-more albums-listening-log-repeated-more';
          more.textContent = `Show ${Math.min(ALBUMS_LISTENING_REPEATED_PAGE_SIZE, repeatedGroups.length - state.limit).toLocaleString('en-US')} more`;
          more.addEventListener('click', () => {
            state.limit += ALBUMS_LISTENING_REPEATED_PAGE_SIZE;
            state.lastRenderSignature = '';
            queuePatch();
          });
          shell.append(more);
        }
      }

      function patch() {
        if (state.patching) return;
        const shell = expansion.querySelector('.albums-listening-log-view');
        if (!shell || expansion.hidden) return;
        state.patching = true;
        try {
          if (activeMode() !== 'entries' && state.repeated) {
            state.repeated = false;
            document.body.removeAttribute('data-albums-repeated-ui-active');
          }
          patchMetrics(shell);
          ensureLayoutControls(shell);
          patchTypeFilter(shell);
          patchSortLabel();
          if (state.repeated) renderRepeated(shell);
          else {
            patchRows(shell);
            patchNormalSummary(shell);
            groupDays(shell);
          }
        } finally {
          state.patching = false;
        }
      }

      function queuePatch() {
        window.cancelAnimationFrame(state.frame);
        state.frame = window.requestAnimationFrame(patch);
      }

      function queuePatchSequence() {
        queuePatch();
        window.setTimeout(queuePatch, 70);
        window.setTimeout(queuePatch, 180);
      }

      function leaveRepeatedForLayout(nextLayout) {
        state.repeated = false;
        state.layout = nextLayout;
        state.lastRenderSignature = '';
        document.body.removeAttribute('data-albums-repeated-ui-active');
        const sort = controls()?.sort;
        if (sort) {
          sort.value = 'latest';
          sort.dispatchEvent(new Event('change', { bubbles: true }));
        }
        queuePatchSequence();
      }

      expansion.addEventListener('click', (event) => {
        const layoutButton = event.target.closest('[data-log-layout]');
        if (layoutButton) {
          const nextLayout = layoutButton.dataset.logLayout;
          if (nextLayout === 'repeated') {
            event.preventDefault();
            state.repeated = true;
            state.lastRenderSignature = '';
            state.limit = ALBUMS_LISTENING_REPEATED_PAGE_SIZE;
            document.body.setAttribute('data-albums-repeated-ui-active', 'true');
            const sort = controls()?.sort;
            if (sort) sort.value = 'most-listened';
            queuePatchSequence();
            return;
          }
          if (nextLayout === 'rows' || nextLayout === 'days') {
            if (state.repeated) {
              leaveRepeatedForLayout(nextLayout);
              return;
            }
            state.layout = nextLayout;
            if (state.layout === 'days') {
              const sort = controls()?.sort;
              if (sort && sort.value !== 'latest') {
                sort.value = 'latest';
                sort.dispatchEvent(new Event('change', { bubbles: true }));
                return;
              }
            }
            queuePatchSequence();
            return;
          }
        }

        const modeButton = event.target.closest('.albums-listening-log-mode-group button');
        if (modeButton && /titles|works/i.test(modeButton.textContent || '')) {
          state.repeated = false;
          state.lastRenderSignature = '';
          document.body.removeAttribute('data-albums-repeated-ui-active');
          queuePatchSequence();
          return;
        }

        const chip = event.target.closest('[data-log-filter-kind][data-log-filter-value]');
        if (chip) {
          const kind = chip.dataset.logFilterKind;
          const value = chip.dataset.logFilterValue || '';
          const c = controls();
          if (kind === 'artist' && c?.artist && Array.from(c.artist.options).some((option) => option.value === value)) {
            c.artist.value = value;
            c.artist.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (kind === 'genre' && c?.genre && Array.from(c.genre.options).some((option) => option.value === value)) {
            c.genre.value = value;
            c.genre.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (c?.search) {
            c.search.value = value;
            c.search.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }, true);

      expansion.addEventListener('change', (event) => {
        const sort = event.target.closest('select[aria-label="Sort listening log"]');
        if (sort && activeMode() === 'entries') {
          if (sort.value === 'most-listened') {
            state.repeated = true;
            state.layout = 'rows';
            state.lastRenderSignature = '';
            document.body.setAttribute('data-albums-repeated-ui-active', 'true');
          } else if (state.repeated) {
            state.repeated = false;
            state.lastRenderSignature = '';
            document.body.removeAttribute('data-albums-repeated-ui-active');
          }
        }
        if (sort && state.layout === 'days' && sort.value !== 'latest') state.layout = 'rows';
        queuePatchSequence();
      }, true);

      expansion.addEventListener('input', queuePatchSequence, true);
      viewToggle.addEventListener('click', queuePatchSequence, true);

      /* Core creates the Listening Log shell lazily; these cover initial async rendering without a competing observer. */
      queuePatchSequence();
      window.setTimeout(queuePatchSequence, 500);
    })
    .catch((error) => {
      console.warn('[Albums] Listening identity module could not load:', error);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsListeningIdentity(), { once: true });
} else {
  bootAlbumsListeningIdentity();
}
