/* LifeLoggerz Albums: repeat-focused Listening Log explorer and quick filtering. */

const ALBUMS_LISTENING_REPEATED_VERSION = '20260801-2242';
const ALBUMS_LISTENING_REPEATED_RETRIES = 180;
const ALBUMS_LISTENING_REPEATED_PAGE_SIZE = 50;
const ALBUMS_REDISCOVERED_GAP_DAYS = 180;

function ensureRepeatedListeningCss() {
  if (document.querySelector('link[data-albums-listening-repeated-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.albumsListeningRepeatedCss = 'true';
  link.href = new URL(`../styles/albums-listening-log-repeated.css?v=${ALBUMS_LISTENING_REPEATED_VERSION}`, import.meta.url).toString();
  document.head.append(link);
}

const repeatedClean = (value) => String(value ?? '').trim();
const repeatedNormalize = (value) => repeatedClean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

function repeatedParseDate(value) {
  const raw = repeatedClean(value).replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
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

function repeatedParseMinutes(value) {
  const raw = repeatedClean(value).toLowerCase();
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

const repeatedDateKey = (date) => date
  ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  : '';
const repeatedFormatDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  : '';
const repeatedFormatDuration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder.toLocaleString('en-US')} min`;
  return remainder
    ? `${hours.toLocaleString('en-US')} hr ${remainder} min`
    : `${hours.toLocaleString('en-US')} hr`;
};
const repeatedIsHttpUrl = (value) => /^https?:\/\//i.test(repeatedClean(value));
const repeatedIsAlbum = (row) => typeof row?.isAlbum === 'boolean'
  ? row.isAlbum
  : /^(?:y|yes|true|1|album|full album)$/i.test(repeatedClean(row?.albumRaw ?? row?.albumFlag ?? row?.['album?']));

function repeatedFormatSpan(firstDate, latestDate) {
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

function normalizeRepeatedEntry(row, index) {
  if (!row || typeof row !== 'object') return null;
  const date = repeatedParseDate(row.date ?? row.listeningDate ?? row.dateListened);
  const artist = repeatedClean(row.artist ?? row.performer);
  let title = repeatedClean(row.title ?? row.piece ?? row.albumPiece ?? row.album ?? row.work);
  let sourceUrl = repeatedClean(row.sourceUrl ?? row.youtubeUrl ?? row.url ?? row.link);
  if (repeatedIsHttpUrl(title) || title === 'Linked music entry') {
    if (!sourceUrl && repeatedIsHttpUrl(title)) sourceUrl = title;
    title = 'Untitled entry';
  }
  if (!date || !artist || !title) return null;
  return {
    rowNumber: Number(row.rowNumber ?? row.sourceRow ?? index + 2) || index + 2,
    date,
    dateKey: repeatedDateKey(date),
    listenedYear: String(date.getUTCFullYear()),
    artist,
    title,
    minutes: repeatedParseMinutes(row.minutes ?? row.min ?? row.duration ?? row.length),
    rating: repeatedClean(row.rating ?? row.score),
    genre: repeatedClean(row.genre ?? row.style).replace(/^\d+\.\s*/, ''),
    subgenre: repeatedClean(row.subgenre ?? row.subGenre),
    country: repeatedClean(row.country ?? row.coo ?? row.origin),
    releaseYear: repeatedClean(row.year ?? row.releaseYear ?? row.releasePeriod),
    instrumentRaw: repeatedClean(row.instrumentRaw ?? row.instrument ?? row.instrm),
    annotation: repeatedClean(row.annotation ?? row.note ?? row.albumRaw),
    isAlbum: repeatedIsAlbum(row),
    sourceUrl: repeatedIsHttpUrl(sourceUrl) ? sourceUrl : '',
  };
}

function bootAlbumsListeningRepeated(attempt = 0) {
  ensureRepeatedListeningCss();
  const expansion = document.querySelector('#albums-expansion-views');
  const viewToggle = document.querySelector('#album-view-toggle');
  if ((!expansion || !viewToggle) && attempt < ALBUMS_LISTENING_REPEATED_RETRIES) {
    window.setTimeout(() => bootAlbumsListeningRepeated(attempt + 1), 75);
    return;
  }
  if (!expansion || !viewToggle || document.body.dataset.albumsListeningRepeatedReady) return;

  fetch(new URL(`../data/music-listening.json?v=${ALBUMS_LISTENING_REPEATED_VERSION}`, import.meta.url).toString(), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Music snapshot returned ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const rawRows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
      const entries = rawRows.map(normalizeRepeatedEntry).filter(Boolean);
      if (!entries.length) return;

      document.body.dataset.albumsListeningRepeatedReady = 'true';
      const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
      const metadataByKey = new Map();
      const entriesByKey = new Map();

      entries.forEach((entry) => {
        const key = `${repeatedNormalize(entry.artist)}|${repeatedNormalize(entry.title)}`;
        if (!entriesByKey.has(key)) entriesByKey.set(key, []);
        entriesByKey.get(key).push(entry);
      });

      entriesByKey.forEach((group, key) => {
        const sorted = [...group].sort((a, b) => b.date - a.date || b.rowNumber - a.rowNumber);
        const pick = (field) => sorted.find((item) => repeatedClean(item[field]))?.[field] || '';
        metadataByKey.set(key, {
          genre: pick('genre'),
          subgenre: pick('subgenre'),
          country: pick('country'),
          releaseYear: pick('releaseYear'),
        });
      });

      const state = {
        active: false,
        limit: ALBUMS_LISTENING_REPEATED_PAGE_SIZE,
        lastFilterSignature: '',
        lastRenderSignature: '',
        frame: 0,
        patching: false,
      };

      const setNodeText = (node, text) => {
        if (node && node.textContent !== text) node.textContent = text;
      };

      const activeMode = () => {
        const group = expansion.querySelector('.albums-listening-log-mode-group');
        const pressed = group?.querySelector('button[aria-pressed="true"]');
        return /works|titles/i.test(pressed?.textContent || '') ? 'titles' : 'entries';
      };

      function controls() {
        const toolbar = expansion.querySelector('.albums-listening-log-toolbar');
        if (!toolbar) return null;
        const selects = Array.from(toolbar.querySelectorAll('select'));
        return {
          toolbar,
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
        const words = repeatedNormalize(filters.search).split(/\s+/).filter(Boolean);
        if (words.length) {
          const haystack = repeatedNormalize([
            entry.artist, entry.title, entry.genre, entry.subgenre, entry.country,
            entry.releaseYear, entry.rating, entry.annotation, entry.instrumentRaw,
          ].join(' '));
          if (!words.every((word) => haystack.includes(word))) return false;
        }
        return true;
      }

      function aggregateRepeated(filteredEntries) {
        const groups = new Map();
        filteredEntries.forEach((entry) => {
          const key = `${repeatedNormalize(entry.artist)}|${repeatedNormalize(entry.title)}`;
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(entry);
        });

        return Array.from(groups.values())
          .filter((group) => group.length > 1)
          .map((group) => {
            const chronological = [...group].sort((a, b) => a.date - b.date || a.rowNumber - b.rowNumber);
            const newestFirst = [...chronological].reverse();
            const first = chronological[0];
            const latest = chronological[chronological.length - 1];
            const pick = (field) => newestFirst.find((entry) => repeatedClean(entry[field]))?.[field] || '';
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
              spanLabel: repeatedFormatSpan(first.date, latest.date),
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

      function setSelectAndDispatch(select, value) {
        if (!select) return;
        if (!Array.from(select.options).some((option) => option.value === value)) return;
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }

      function setSearch(value) {
        const c = controls();
        if (!c?.search) return;
        c.search.value = value;
        c.search.dispatchEvent(new Event('input', { bubbles: true }));
      }

      function ensureRepeatedControl(shell) {
        const layoutGroup = shell.querySelector('.albums-listening-log-layout-group');
        if (!layoutGroup || activeMode() !== 'entries') {
          state.active = false;
          return;
        }

        let repeatedButton = layoutGroup.querySelector('[data-log-layout="repeated"]');
        if (!repeatedButton) {
          repeatedButton = document.createElement('button');
          repeatedButton.type = 'button';
          repeatedButton.dataset.logLayout = 'repeated';
          repeatedButton.textContent = 'Repeated';
          repeatedButton.title = 'Rank titles heard more than once by number of recorded listens.';
          layoutGroup.append(repeatedButton);
        }

        layoutGroup.querySelectorAll('button').forEach((button) => {
          const repeated = button.dataset.logLayout === 'repeated';
          if (repeated) button.setAttribute('aria-pressed', String(state.active));
          else if (state.active) button.setAttribute('aria-pressed', 'false');
        });
      }

      function patchSort() {
        const c = controls();
        const option = c?.sort ? Array.from(c.sort.options).find((item) => item.value === 'most-listened') : null;
        if (!option) return;
        if (activeMode() === 'titles') {
          setNodeText(option, 'Most repeats');
          return;
        }
        setNodeText(option, state.active ? 'Most repeats' : 'Most repeats → Repeated');
        if (state.active && c.sort.value !== 'most-listened') c.sort.value = 'most-listened';
      }

      function makeChip(label, value, kind) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'albums-listening-log-filter-chip';
        button.dataset.logFilterKind = kind;
        button.dataset.logFilterValue = value;
        button.textContent = label;
        button.title = kind === 'genre' ? `Filter to ${value}` : `Search the Listening Log for ${value}`;
        return button;
      }

      function patchRowQuickFilters(shell) {
        if (state.active) return;
        shell.querySelectorAll('.albums-listening-log-item').forEach((item) => {
          const artistNode = item.querySelector('.albums-listening-log-artist');
          const titleNode = item.querySelector('.albums-listening-log-title');
          const meta = item.querySelector('.albums-listening-log-meta');
          if (!artistNode || !titleNode || !meta) return;

          artistNode.classList.add('is-filterable');
          artistNode.setAttribute('role', 'button');
          artistNode.setAttribute('tabindex', '0');
          artistNode.title = `Filter to ${artistNode.textContent.trim()}`;

          if (meta.querySelector('.albums-listening-log-inline-filters')) return;
          const key = `${repeatedNormalize(artistNode.textContent)}|${repeatedNormalize(titleNode.textContent)}`;
          const metadata = metadataByKey.get(key);
          if (!metadata) return;

          const wrapper = document.createElement('span');
          wrapper.className = 'albums-listening-log-inline-filters';
          if (metadata.genre) wrapper.append(makeChip(metadata.genre, metadata.genre, 'genre'));
          if (metadata.subgenre && metadata.subgenre !== metadata.genre) wrapper.append(makeChip(metadata.subgenre, metadata.subgenre, 'search'));
          if (metadata.country) wrapper.append(makeChip(metadata.country, metadata.country, 'search'));
          if (metadata.releaseYear) wrapper.append(makeChip(metadata.releaseYear, metadata.releaseYear, 'search'));
          if (!wrapper.children.length) return;

          const plainDetail = Array.from(meta.children).find((child) => {
            if (child.classList?.contains('albums-listening-log-badge')) return false;
            if (child.classList?.contains('albums-listening-log-note')) return false;
            if (child.classList?.contains('albums-listening-log-inline-filters')) return false;
            return / · /.test(child.textContent || '') || [metadata.genre, metadata.subgenre, metadata.country, metadata.releaseYear]
              .filter(Boolean).some((value) => (child.textContent || '').includes(value));
          });
          if (plainDetail) plainDetail.hidden = true;
          meta.append(wrapper);
        });
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
        const span = group.spanLabel ? ` across ${group.spanLabel}` : '';
        stats.innerHTML = `
          <span><strong>${repeatedFormatDuration(group.totalMinutes)}</strong> total</span>
          <span>First · <strong>${repeatedFormatDate(group.firstDate)}</strong></span>
          <span>Latest · <strong>${repeatedFormatDate(group.latestDate)}</strong></span>
          <span>${group.listenCount.toLocaleString('en-US')} listens${span}</span>
        `;
        if (group.maxGapDays >= ALBUMS_REDISCOVERED_GAP_DAYS) {
          const rediscovered = document.createElement('span');
          rediscovered.className = 'albums-listening-log-rediscovered';
          rediscovered.textContent = `Rediscovered after ${group.maxGapDays.toLocaleString('en-US')} days`;
          rediscovered.title = `${repeatedFormatDate(group.maxGapStart)} → ${repeatedFormatDate(group.maxGapEnd)}`;
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
          date.textContent = repeatedFormatDate(listen.date);
          const duration = document.createElement('span');
          duration.textContent = repeatedFormatDuration(listen.minutes);
          row.append(date, duration);
          if (listen.sourceUrl) {
            const source = document.createElement('a');
            source.href = listen.sourceUrl;
            source.target = '_blank';
            source.rel = 'noopener noreferrer';
            source.textContent = '↗';
            source.setAttribute('aria-label', `Open ${group.title} source from ${repeatedFormatDate(listen.date)}`);
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
        const list = shell.querySelector('.albums-listening-log-list');
        const resultsText = shell.querySelector('.albums-listening-log-results p');
        const baseMore = shell.querySelector('.albums-listening-log-more:not(.albums-listening-log-repeated-more)');
        if (!list || !resultsText) return;

        if (!state.active || activeMode() !== 'entries') {
          removeRepeatedMore(shell);
          if (baseMore) baseMore.hidden = false;
          state.lastRenderSignature = '';
          return;
        }

        const filters = filterValues();
        const filterSig = JSON.stringify(filters);
        if (filterSig !== state.lastFilterSignature) {
          state.lastFilterSignature = filterSig;
          state.limit = ALBUMS_LISTENING_REPEATED_PAGE_SIZE;
        }

        const repeatedGroups = aggregateRepeated(entries.filter((entry) => matches(entry, filters)));
        const visible = repeatedGroups.slice(0, state.limit);
        const totalListens = repeatedGroups.reduce((sum, group) => sum + group.listenCount, 0);
        const totalMinutes = repeatedGroups.reduce((sum, group) => sum + group.totalMinutes, 0);
        const summaryText = repeatedGroups.length
          ? `Showing ${visible.length.toLocaleString('en-US')} of ${repeatedGroups.length.toLocaleString('en-US')} repeated titles · ${totalListens.toLocaleString('en-US')} underlying listens · ${repeatedFormatDuration(totalMinutes)}`
          : 'No repeated titles within these filters';
        setNodeText(resultsText, summaryText);
        if (baseMore) baseMore.hidden = true;

        const renderSig = `${filterSig}|${state.limit}|${repeatedGroups.length}|${visible.map((group) => `${repeatedNormalize(group.artist)}:${repeatedNormalize(group.title)}:${group.listenCount}`).join('~')}`;
        if (list.dataset.repeatedRenderSignature === renderSig && list.classList.contains('is-repeated-ranking')) return;

        list.classList.add('is-repeated-ranking');
        list.replaceChildren();
        visible.forEach((group, index) => list.append(makeRepeatedCard(group, index + 1)));
        if (!repeatedGroups.length) {
          const empty = document.createElement('li');
          empty.className = 'albums-listening-log-empty';
          empty.textContent = 'No titles occur more than once within these filters.';
          list.append(empty);
        }
        list.dataset.repeatedRenderSignature = renderSig;
        state.lastRenderSignature = renderSig;

        removeRepeatedMore(shell);
        if (repeatedGroups.length > state.limit) {
          const more = document.createElement('button');
          more.type = 'button';
          more.className = 'albums-listening-log-more albums-listening-log-repeated-more';
          more.textContent = `Show ${Math.min(ALBUMS_LISTENING_REPEATED_PAGE_SIZE, repeatedGroups.length - state.limit).toLocaleString('en-US')} more`;
          more.addEventListener('click', () => {
            state.limit += ALBUMS_LISTENING_REPEATED_PAGE_SIZE;
            queuePatch();
          });
          shell.append(more);
        }
      }

      function cleanupRepeatedList(shell) {
        if (state.active) return;
        const list = shell.querySelector('.albums-listening-log-list');
        if (!list) return;
        list.classList.remove('is-repeated-ranking');
        delete list.dataset.repeatedRenderSignature;
      }

      function patch() {
        if (state.patching) return;
        const shell = expansion.querySelector('.albums-listening-log-view');
        if (!shell || expansion.hidden) return;
        state.patching = true;
        try {
          if (activeMode() === 'titles') state.active = false;
          ensureRepeatedControl(shell);
          patchSort();
          patchRowQuickFilters(shell);
          renderRepeated(shell);
          cleanupRepeatedList(shell);
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
        state.lastRenderSignature = '';
        const c = controls();
        if (c?.sort) {
          c.sort.value = 'latest';
          c.sort.dispatchEvent(new Event('change', { bubbles: true }));
        } else queuePatch();
      }

      expansion.addEventListener('click', (event) => {
        const repeatedButton = event.target.closest('[data-log-layout="repeated"]');
        if (repeatedButton) {
          event.preventDefault();
          state.active = true;
          state.limit = ALBUMS_LISTENING_REPEATED_PAGE_SIZE;
          state.lastRenderSignature = '';
          const c = controls();
          if (c?.sort) c.sort.value = 'most-listened';
          queuePatch();
          return;
        }

        const ordinaryLayout = event.target.closest('[data-log-layout="rows"],[data-log-layout="days"]');
        if (ordinaryLayout && state.active) {
          leaveRepeatedForLayout();
          return;
        }

        const modeButton = event.target.closest('.albums-listening-log-mode-group button');
        if (modeButton && /titles|works/i.test(modeButton.textContent || '')) {
          state.active = false;
          state.lastRenderSignature = '';
          queuePatch();
          return;
        }

        const artistNode = event.target.closest('.albums-listening-log-artist.is-filterable');
        if (artistNode) {
          const c = controls();
          setSelectAndDispatch(c?.artist, artistNode.textContent.trim());
          return;
        }

        const chip = event.target.closest('[data-log-filter-kind][data-log-filter-value]');
        if (chip) {
          const kind = chip.dataset.logFilterKind;
          const value = chip.dataset.logFilterValue || '';
          const c = controls();
          if (kind === 'artist') setSelectAndDispatch(c?.artist, value);
          else if (kind === 'genre') setSelectAndDispatch(c?.genre, value);
          else setSearch(value);
        }
      }, true);

      expansion.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const artistNode = event.target.closest('.albums-listening-log-artist.is-filterable');
        if (!artistNode) return;
        event.preventDefault();
        const c = controls();
        setSelectAndDispatch(c?.artist, artistNode.textContent.trim());
      }, true);

      expansion.addEventListener('change', (event) => {
        const sort = event.target.closest('select[aria-label="Sort listening log"]');
        if (sort && activeMode() === 'entries') {
          if (sort.value === 'most-listened') {
            state.active = true;
            state.limit = ALBUMS_LISTENING_REPEATED_PAGE_SIZE;
            state.lastRenderSignature = '';
          } else if (state.active) {
            state.active = false;
            state.lastRenderSignature = '';
          }
        }
        queuePatch();
      }, true);

      expansion.addEventListener('input', queuePatch, true);
      const observer = new MutationObserver(queuePatch);
      observer.observe(expansion, { childList: true, subtree: true });
      viewToggle.addEventListener('click', () => window.setTimeout(queuePatch, 80));
      queuePatch();
    })
    .catch((error) => {
      console.warn('[Albums] Repeated listening explorer could not load:', error);
    });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsListeningRepeated(), { once: true });
} else {
  bootAlbumsListeningRepeated();
}
