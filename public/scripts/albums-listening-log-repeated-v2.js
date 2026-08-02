/* LifeLoggerz Albums: Unicode-safe repeat explorer and repeat identity. */

const ALBUMS_LISTENING_REPEATED_V2_VERSION = '20260802-0915';
const ALBUMS_LISTENING_REPEATED_V2_RETRIES = 200;
const ALBUMS_LISTENING_REPEATED_V2_PAGE_SIZE = 50;
const ALBUMS_REDISCOVERED_GAP_DAYS = 180;

function ensureRepeatedV2Css() {
  if (document.querySelector('link[data-albums-listening-repeated-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.albumsListeningRepeatedCss = 'true';
  link.href = new URL(`../styles/albums-listening-log-repeated.css?v=${ALBUMS_LISTENING_REPEATED_V2_VERSION}`, import.meta.url).toString();
  document.head.append(link);
}

const repeatClean = (value) => String(value ?? '').trim();

/*
 * Identity normalization deliberately keeps letters and numbers from every script.
 * NFKD + mark removal keeps the old Jose/José tolerance while no longer erasing
 * Cyrillic, Arabic, Persian, Greek, CJK, etc.
 */
const repeatNormalize = (value) => repeatClean(value)
  .normalize('NFKD')
  .replace(/\p{M}+/gu, '')
  .toLocaleLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const repeatIsHttpUrl = (value) => /^https?:\/\//i.test(repeatClean(value));
const repeatIsPlaceholderTitle = (value) => /^(?:linked music entry|untitled entry)$/i.test(repeatClean(value));

function canonicalSourceIdentity(value) {
  const raw = repeatClean(value);
  if (!repeatIsHttpUrl(raw)) return '';

  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);

    if (host === 'youtu.be') {
      const videoId = parts[0] || '';
      if (videoId) return `youtube:${videoId.toLowerCase()}`;
    }

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
    const keptParams = [];
    url.searchParams.forEach((paramValue, paramKey) => {
      if (!ignoredParams.has(paramKey.toLowerCase())) keptParams.push([paramKey, paramValue]);
    });
    keptParams.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    const query = keptParams.length
      ? `?${keptParams.map(([key, paramValue]) => `${encodeURIComponent(key)}=${encodeURIComponent(paramValue)}`).join('&')}`
      : '';
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `url:${host}${path}${query}`.toLocaleLowerCase();
  } catch (_error) {
    return `url:${repeatNormalize(raw)}`;
  }
}

function repeatIdentityKey(entry) {
  const artistKey = repeatNormalize(entry?.artist);
  const titleRaw = repeatClean(entry?.title);
  const titleKey = repeatNormalize(titleRaw);

  if (repeatIsPlaceholderTitle(titleRaw) || !titleKey) {
    const sourceKey = canonicalSourceIdentity(entry?.sourceUrl);
    if (sourceKey) return `${artistKey}|source:${sourceKey}`;

    /* Unknown placeholder rows are intentionally unique rather than falsely merged. */
    return `${artistKey}|row:${Number(entry?.rowNumber || 0)}`;
  }

  return `${artistKey}|title:${titleKey}`;
}

function parseRepeatDate(value) {
  const raw = repeatClean(value).replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
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

function parseRepeatMinutes(value) {
  const raw = repeatClean(value).toLowerCase();
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

const repeatDateKey = (date) => date
  ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  : '';

const formatRepeatDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  : '';

const formatRepeatDuration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder.toLocaleString('en-US')} min`;
  return remainder
    ? `${hours.toLocaleString('en-US')} hr ${remainder} min`
    : `${hours.toLocaleString('en-US')} hr`;
};

function formatRepeatSpan(firstDate, latestDate) {
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

const repeatIsAlbum = (row) => typeof row?.isAlbum === 'boolean'
  ? row.isAlbum
  : /^(?:y|yes|true|1|album|full album)$/i.test(repeatClean(row?.albumRaw ?? row?.albumFlag ?? row?.['album?']));

function normalizeRepeatEntry(row, index) {
  if (!row || typeof row !== 'object') return null;
  const date = parseRepeatDate(row.date ?? row.listeningDate ?? row.dateListened);
  const artist = repeatClean(row.artist ?? row.performer);
  let title = repeatClean(row.title ?? row.piece ?? row.albumPiece ?? row.album ?? row.work);
  let sourceUrl = repeatClean(row.sourceUrl ?? row.youtubeUrl ?? row.url ?? row.link);

  if (repeatIsHttpUrl(title)) {
    if (!sourceUrl) sourceUrl = title;
    title = 'Untitled entry';
  } else if (title === 'Linked music entry') {
    title = 'Untitled entry';
  }

  if (!date || !artist || !title) return null;

  return {
    rowNumber: Number(row.rowNumber ?? row.sourceRow ?? index + 2) || index + 2,
    date,
    dateKey: repeatDateKey(date),
    listenedYear: String(date.getUTCFullYear()),
    artist,
    title,
    minutes: parseRepeatMinutes(row.minutes ?? row.min ?? row.duration ?? row.length),
    rating: repeatClean(row.rating ?? row.score),
    genre: repeatClean(row.genre ?? row.style).replace(/^\d+\.\s*/, ''),
    subgenre: repeatClean(row.subgenre ?? row.subGenre),
    country: repeatClean(row.country ?? row.coo ?? row.origin),
    releaseYear: repeatClean(row.year ?? row.releaseYear ?? row.releasePeriod),
    instrumentRaw: repeatClean(row.instrumentRaw ?? row.instrument ?? row.instrm),
    annotation: repeatClean(row.annotation ?? row.note ?? row.albumRaw),
    isAlbum: repeatIsAlbum(row),
    sourceUrl: repeatIsHttpUrl(sourceUrl) ? sourceUrl : '',
  };
}

function aggregateIdentityGroups(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = repeatIdentityKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return groups;
}

function aggregateRepeated(entries, collator) {
  return Array.from(aggregateIdentityGroups(entries).values())
    .filter((group) => group.length > 1)
    .map((group) => {
      const chronological = [...group].sort((a, b) => a.date - b.date || a.rowNumber - b.rowNumber);
      const newestFirst = [...chronological].reverse();
      const first = chronological[0];
      const latest = chronological[chronological.length - 1];
      const pick = (field) => newestFirst.find((entry) => repeatClean(entry[field]))?.[field] || '';
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
        spanLabel: formatRepeatSpan(first.date, latest.date),
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

function bootAlbumsListeningRepeatedV2(attempt = 0) {
  ensureRepeatedV2Css();
  const expansion = document.querySelector('#albums-expansion-views');
  const viewToggle = document.querySelector('#album-view-toggle');

  if ((!expansion || !viewToggle) && attempt < ALBUMS_LISTENING_REPEATED_V2_RETRIES) {
    window.setTimeout(() => bootAlbumsListeningRepeatedV2(attempt + 1), 75);
    return;
  }
  if (!expansion || !viewToggle || document.body.dataset.albumsListeningRepeatedV2Ready) return;

  fetch(new URL(`../data/music-listening.json?v=${ALBUMS_LISTENING_REPEATED_V2_VERSION}`, import.meta.url).toString(), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Music snapshot returned ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const rawRows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
      const entries = rawRows.map(normalizeRepeatEntry).filter(Boolean);
      if (!entries.length) return;

      document.body.dataset.albumsListeningRepeatedReady = 'true';
      document.body.dataset.albumsListeningRepeatedV2Ready = 'true';

      const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
      const allGroups = aggregateIdentityGroups(entries);
      const allRepeatCounts = new Map(Array.from(allGroups.entries()).map(([key, group]) => [key, group.length]));

      const state = {
        active: false,
        limit: ALBUMS_LISTENING_REPEATED_V2_PAGE_SIZE,
        lastFilterSignature: '',
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

        const words = repeatNormalize(filters.search).split(/\s+/).filter(Boolean);
        if (words.length) {
          const haystack = repeatNormalize([
            entry.artist, entry.title, entry.genre, entry.subgenre, entry.country,
            entry.releaseYear, entry.rating, entry.annotation, entry.instrumentRaw,
          ].join(' '));
          if (!words.every((word) => haystack.includes(word))) return false;
        }
        return true;
      }

      function ensureRepeatedControl(shell) {
        const layoutGroup = shell.querySelector('.albums-listening-log-layout-group');
        if (!layoutGroup) return null;
        let button = layoutGroup.querySelector('[data-log-layout="repeated"]');
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.dataset.logLayout = 'repeated';
          button.textContent = 'Repeated';
          button.title = 'Rank titles heard more than once by number of recorded listens.';
          button.setAttribute('aria-pressed', 'false');
          layoutGroup.append(button);
        }
        return button;
      }

      function syncControlState(shell) {
        const layoutGroup = shell.querySelector('.albums-listening-log-layout-group');
        if (!layoutGroup) return;
        const repeatedButton = ensureRepeatedControl(shell);
        if (repeatedButton) repeatedButton.setAttribute('aria-pressed', String(state.active && activeMode() === 'entries'));
        if (state.active) {
          layoutGroup.querySelectorAll('[data-log-layout="rows"], [data-log-layout="days"]').forEach((button) => {
            button.setAttribute('aria-pressed', 'false');
          });
        }
      }

      function patchUniqueTitleMetric(shell) {
        const metricItems = Array.from(shell.querySelectorAll('.albums-listening-log-metrics > div'));
        const item = metricItems.find((candidate) => /unique (?:titles|works)/i.test(candidate.querySelector('span')?.textContent || ''));
        const strong = item?.querySelector('strong');
        if (strong) strong.textContent = allGroups.size.toLocaleString('en-US');
      }

      function domItemIdentity(item) {
        const artist = item.querySelector('.albums-listening-log-artist')?.textContent?.trim() || '';
        const title = item.querySelector('.albums-listening-log-title')?.textContent?.trim() || '';
        const sourceUrl = Array.from(item.querySelectorAll('a[href]'))
          .map((anchor) => anchor.href)
          .find((href) => repeatIsHttpUrl(href)) || '';
        const rowNumber = Number(item.dataset.rowNumber || item.getAttribute('data-row-number') || 0);
        return repeatIdentityKey({ artist, title, sourceUrl, rowNumber });
      }

      function patchRowRepeatBadges(shell) {
        if (state.active || activeMode() !== 'entries') return;
        shell.querySelectorAll('.albums-listening-log-item').forEach((item) => {
          const meta = item.querySelector('.albums-listening-log-meta');
          if (!meta) return;
          const count = allRepeatCounts.get(domItemIdentity(item)) || 0;
          let badge = meta.querySelector('.albums-listening-log-badge.is-repeat');
          if (count > 1) {
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'albums-listening-log-badge is-repeat';
              meta.append(badge);
            }
            badge.textContent = `↻ ${count.toLocaleString('en-US')} listens`;
            badge.title = `This title appears ${count.toLocaleString('en-US')} times in the listening log.`;
          } else if (badge) {
            badge.remove();
          }
        });
      }

      function patchSortLabel() {
        const sort = controls()?.sort;
        const option = sort ? Array.from(sort.options).find((item) => item.value === 'most-listened') : null;
        if (option) option.textContent = state.active ? 'Most repeats' : 'Most repeats → Repeated';
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
          <span><strong>${formatRepeatDuration(group.totalMinutes)}</strong> total</span>
          <span>First · <strong>${formatRepeatDate(group.firstDate)}</strong></span>
          <span>Latest · <strong>${formatRepeatDate(group.latestDate)}</strong></span>
          <span>${group.listenCount.toLocaleString('en-US')} listens${group.spanLabel ? ` across ${group.spanLabel}` : ''}</span>
        `;
        if (group.maxGapDays >= ALBUMS_REDISCOVERED_GAP_DAYS) {
          const rediscovered = document.createElement('span');
          rediscovered.className = 'albums-listening-log-rediscovered';
          rediscovered.textContent = `Rediscovered after ${group.maxGapDays.toLocaleString('en-US')} days`;
          rediscovered.title = `${formatRepeatDate(group.maxGapStart)} → ${formatRepeatDate(group.maxGapEnd)}`;
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
          date.textContent = formatRepeatDate(listen.date);
          const duration = document.createElement('span');
          duration.textContent = formatRepeatDuration(listen.minutes);
          row.append(date, duration);
          if (listen.sourceUrl) {
            const source = document.createElement('a');
            source.href = listen.sourceUrl;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            source.textContent = '↗';
            source.setAttribute('aria-label', `Open ${group.title} source from ${formatRepeatDate(listen.date)}`);
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
        if (!state.active || activeMode() !== 'entries') return;
        const list = shell.querySelector('.albums-listening-log-list');
        const resultsText = shell.querySelector('.albums-listening-log-results p');
        const baseMore = shell.querySelector('.albums-listening-log-more:not(.albums-listening-log-repeated-more)');
        if (!list || !resultsText) return;

        const filters = filterValues();
        const filterSignature = JSON.stringify(filters);
        if (filterSignature !== state.lastFilterSignature) {
          state.lastFilterSignature = filterSignature;
          state.limit = ALBUMS_LISTENING_REPEATED_V2_PAGE_SIZE;
        }

        const repeatedGroups = aggregateRepeated(entries.filter((entry) => matches(entry, filters)), collator);
        const visible = repeatedGroups.slice(0, state.limit);
        const totalListens = repeatedGroups.reduce((sum, group) => sum + group.listenCount, 0);
        const totalMinutes = repeatedGroups.reduce((sum, group) => sum + group.totalMinutes, 0);

        resultsText.textContent = repeatedGroups.length
          ? `Showing ${visible.length.toLocaleString('en-US')} of ${repeatedGroups.length.toLocaleString('en-US')} repeated titles · ${totalListens.toLocaleString('en-US')} underlying listens · ${formatRepeatDuration(totalMinutes)}`
          : 'No repeated titles within these filters';

        if (baseMore) baseMore.hidden = true;
        list.classList.add('is-repeated-ranking');
        list.replaceChildren();
        visible.forEach((group, index) => list.append(makeRepeatedCard(group, index + 1)));

        if (!visible.length) {
          const empty = document.createElement('li');
          empty.className = 'albums-listening-log-empty';
          empty.textContent = 'No titles occur more than once within these filters.';
          list.append(empty);
        }

        removeRepeatedMore(shell);
        if (repeatedGroups.length > state.limit) {
          const more = document.createElement('button');
          more.type = 'button';
          more.className = 'albums-listening-log-more albums-listening-log-repeated-more';
          more.textContent = `Show ${Math.min(ALBUMS_LISTENING_REPEATED_V2_PAGE_SIZE, repeatedGroups.length - state.limit).toLocaleString('en-US')} more`;
          more.addEventListener('click', () => {
            state.limit += ALBUMS_LISTENING_REPEATED_V2_PAGE_SIZE;
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
          if (activeMode() !== 'entries') state.active = false;
          ensureRepeatedControl(shell);
          syncControlState(shell);
          patchUniqueTitleMetric(shell);
          patchSortLabel();
          if (state.active) renderRepeated(shell);
          else patchRowRepeatBadges(shell);
        } finally {
          state.patching = false;
        }
      }

      function queuePatch() {
        window.cancelAnimationFrame(state.frame);
        state.frame = window.requestAnimationFrame(patch);
      }

      function leaveRepeatedForLayout() {
        state.active = false;
        state.lastFilterSignature = '';
        document.body.removeAttribute('data-albums-repeated-ui-active');
        const sort = controls()?.sort;
        if (sort) {
          sort.value = 'latest';
          sort.dispatchEvent(new Event('change', { bubbles: true }));
        } else queuePatch();
      }

      expansion.addEventListener('click', (event) => {
        const repeatedButton = event.target.closest('[data-log-layout="repeated"]');
        if (repeatedButton) {
          event.preventDefault();
          state.active = true;
          state.limit = ALBUMS_LISTENING_REPEATED_V2_PAGE_SIZE;
          state.lastFilterSignature = '';
          document.body.setAttribute('data-albums-repeated-ui-active', 'true');
          const sort = controls()?.sort;
          if (sort) sort.value = 'most-listened';
          queuePatch();
          return;
        }

        const ordinaryLayout = event.target.closest('[data-log-layout="rows"], [data-log-layout="days"]');
        if (ordinaryLayout && state.active) {
          leaveRepeatedForLayout();
          return;
        }

        const modeButton = event.target.closest('.albums-listening-log-mode-group button');
        if (modeButton && /titles|works/i.test(modeButton.textContent || '')) {
          state.active = false;
          document.body.removeAttribute('data-albums-repeated-ui-active');
          queuePatch();
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
            state.active = true;
            document.body.setAttribute('data-albums-repeated-ui-active', 'true');
          } else if (state.active) {
            state.active = false;
            document.body.removeAttribute('data-albums-repeated-ui-active');
          }
        }
        queuePatch();
      }, true);

      expansion.addEventListener('input', queuePatch, true);
      viewToggle.addEventListener('click', () => window.setTimeout(queuePatch, 60));

      const observer = new MutationObserver(queuePatch);
      observer.observe(expansion, { childList: true, subtree: true });
      queuePatch();
    })
    .catch((error) => {
      console.warn('[Albums] Unicode-safe repeat explorer could not load:', error);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsListeningRepeatedV2(), { once: true });
} else {
  bootAlbumsListeningRepeatedV2();
}
