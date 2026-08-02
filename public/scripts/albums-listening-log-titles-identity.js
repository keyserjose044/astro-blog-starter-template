/* LifeLoggerz Albums: Unicode-safe Titles mode for the complete Listening Log. */

const ALBUMS_LISTENING_TITLES_IDENTITY_VERSION = '20260802-0945';
const ALBUMS_LISTENING_TITLES_PAGE_SIZE = 50;

const titleClean = (value) => String(value ?? '').trim();
const titleNormalize = (value) => titleClean(value)
  .normalize('NFKD')
  .replace(/\p{M}+/gu, '')
  .toLocaleLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const titleIsHttpUrl = (value) => /^https?:\/\//i.test(titleClean(value));
const titleIsPlaceholder = (value) => /^(?:linked music entry|untitled entry)$/i.test(titleClean(value));

function titleSourceIdentity(value) {
  const raw = titleClean(value);
  if (!titleIsHttpUrl(raw)) return '';
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
    return `url:${host}${url.pathname.replace(/\/+$/, '') || '/'}${query}`.toLocaleLowerCase();
  } catch (_error) {
    return `url:${titleNormalize(raw)}`;
  }
}

function titleIdentityKey(entry) {
  const artist = titleNormalize(entry?.artist);
  const rawTitle = titleClean(entry?.title);
  const title = titleNormalize(rawTitle);
  if (titleIsPlaceholder(rawTitle) || !title) {
    const source = titleSourceIdentity(entry?.sourceUrl);
    if (source) return `${artist}|source:${source}`;
    return `${artist}|row:${Number(entry?.rowNumber || 0)}`;
  }
  return `${artist}|title:${title}`;
}

function titleParseDate(value) {
  const raw = titleClean(value).replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
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

function titleParseMinutes(value) {
  const raw = titleClean(value).toLowerCase();
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

const titleDateKey = (date) => date
  ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  : '';
const titleFormatDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  : '';
const titleFormatDuration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder.toLocaleString('en-US')} min`;
  return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
};
const titleIsAlbum = (row) => typeof row?.isAlbum === 'boolean'
  ? row.isAlbum
  : /^(?:y|yes|true|1|album|full album)$/i.test(titleClean(row?.albumRaw ?? row?.albumFlag ?? row?.['album?']));

function normalizeTitleEntry(row, index) {
  if (!row || typeof row !== 'object') return null;
  const date = titleParseDate(row.date ?? row.listeningDate ?? row.dateListened);
  const artist = titleClean(row.artist ?? row.performer);
  let title = titleClean(row.title ?? row.piece ?? row.albumPiece ?? row.album ?? row.work);
  let sourceUrl = titleClean(row.sourceUrl ?? row.youtubeUrl ?? row.url ?? row.link);
  if (titleIsHttpUrl(title)) {
    if (!sourceUrl) sourceUrl = title;
    title = 'Untitled entry';
  } else if (title === 'Linked music entry') title = 'Untitled entry';
  if (!date || !artist || !title) return null;
  return {
    rowNumber: Number(row.rowNumber ?? row.sourceRow ?? index + 2) || index + 2,
    date,
    dateKey: titleDateKey(date),
    listenedYear: String(date.getUTCFullYear()),
    artist,
    title,
    minutes: titleParseMinutes(row.minutes ?? row.min ?? row.duration ?? row.length),
    rating: titleClean(row.rating ?? row.score),
    genre: titleClean(row.genre ?? row.style).replace(/^\d+\.\s*/, ''),
    subgenre: titleClean(row.subgenre ?? row.subGenre),
    country: titleClean(row.country ?? row.coo ?? row.origin),
    releaseYear: titleClean(row.year ?? row.releaseYear ?? row.releasePeriod),
    annotation: titleClean(row.annotation ?? row.note ?? row.albumRaw),
    instrumentRaw: titleClean(row.instrumentRaw ?? row.instrument ?? row.instrm),
    isAlbum: titleIsAlbum(row),
    sourceUrl: titleIsHttpUrl(sourceUrl) ? sourceUrl : '',
  };
}

function aggregateTitles(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = titleIdentityKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return Array.from(groups.values()).map((group) => {
    const chronological = [...group].sort((a, b) => a.date - b.date || a.rowNumber - b.rowNumber);
    const newest = chronological[chronological.length - 1];
    const newestFirst = [...chronological].reverse();
    const pick = (field) => newestFirst.find((entry) => titleClean(entry[field]))?.[field] || '';
    return {
      ...newest,
      genre: pick('genre'),
      subgenre: pick('subgenre'),
      country: pick('country'),
      releaseYear: pick('releaseYear'),
      rating: pick('rating'),
      annotation: pick('annotation'),
      sourceUrl: pick('sourceUrl'),
      instrumentRaw: pick('instrumentRaw'),
      isAlbum: group.some((entry) => entry.isAlbum),
      listenCount: group.length,
      totalMinutes: group.reduce((sum, entry) => sum + entry.minutes, 0),
      firstDate: chronological[0].date,
      latestDate: newest.date,
    };
  });
}

function bootAlbumsTitlesIdentity() {
  const expansion = document.querySelector('#albums-expansion-views');
  const viewToggle = document.querySelector('#album-view-toggle');
  if (!expansion || !viewToggle || document.body.dataset.albumsTitlesIdentityReady) return;

  fetch(new URL(`../data/music-listening.json?v=${ALBUMS_LISTENING_TITLES_IDENTITY_VERSION}`, import.meta.url).toString(), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Music snapshot returned ${response.status}`);
      return response.json();
    })
    .then((payload) => {
      const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
      const entries = rows.map(normalizeTitleEntry).filter(Boolean);
      if (!entries.length) return;
      document.body.dataset.albumsTitlesIdentityReady = 'true';

      const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
      const allTitles = aggregateTitles(entries);
      const state = { limit: ALBUMS_LISTENING_TITLES_PAGE_SIZE, lastFilterSignature: '', frame: 0 };

      function titleModeActive() {
        const pressed = expansion.querySelector('.albums-listening-log-mode-group button[aria-pressed="true"]');
        return /works|titles/i.test(pressed?.textContent || '');
      }

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

      function filters() {
        const c = controls();
        return c ? {
          search: c.search?.value || '',
          artist: c.artist?.value || '',
          genre: c.genre?.value || '',
          type: c.type?.value || '',
          year: c.year?.value || '',
          sort: c.sort?.value || 'latest',
        } : { search: '', artist: '', genre: '', type: '', year: '', sort: 'latest' };
      }

      function entryMatches(entry, f) {
        if (f.artist && entry.artist !== f.artist) return false;
        if (f.genre && entry.genre !== f.genre) return false;
        if (f.type === 'album' && !entry.isAlbum) return false;
        if (f.type === 'other' && entry.isAlbum) return false;
        if (f.year && entry.listenedYear !== f.year) return false;
        const words = titleNormalize(f.search).split(/\s+/).filter(Boolean);
        if (words.length) {
          const haystack = titleNormalize([
            entry.artist, entry.title, entry.genre, entry.subgenre, entry.country,
            entry.releaseYear, entry.rating, entry.annotation, entry.instrumentRaw,
          ].join(' '));
          if (!words.every((word) => haystack.includes(word))) return false;
        }
        return true;
      }

      function sortTitles(items, sort) {
        return [...items].sort((a, b) => {
          if (sort === 'oldest') return a.firstDate - b.firstDate || collator.compare(a.artist, b.artist);
          if (sort === 'artist') return collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title);
          if (sort === 'title') return collator.compare(a.title, b.title) || collator.compare(a.artist, b.artist);
          if (sort === 'longest') return b.totalMinutes - a.totalMinutes || b.latestDate - a.latestDate;
          if (sort === 'most-listened') return b.listenCount - a.listenCount || b.latestDate - a.latestDate;
          return b.latestDate - a.latestDate || b.rowNumber - a.rowNumber;
        });
      }

      function makeBadge(text, className = '') {
        const badge = document.createElement('span');
        badge.className = `albums-listening-log-badge ${className}`.trim();
        badge.textContent = text;
        return badge;
      }

      function makeTitleItem(item) {
        const li = document.createElement('li');
        li.className = 'albums-listening-log-item';
        if (item.sourceUrl) {
          const play = document.createElement('a');
          play.className = 'albums-listening-log-play';
          play.href = item.sourceUrl;
          play.target = '_blank';
          play.rel = 'noopener noreferrer';
          play.textContent = '▶';
          play.setAttribute('aria-label', `Open ${item.title} in a new tab`);
          li.append(play);
        } else {
          const missing = document.createElement('span');
          missing.className = 'albums-listening-log-play is-missing';
          missing.textContent = '—';
          li.append(missing);
        }

        const main = document.createElement('span');
        main.className = 'albums-listening-log-main';
        const artist = document.createElement('span');
        artist.className = 'albums-listening-log-artist';
        artist.textContent = item.artist;
        const title = document.createElement('strong');
        title.className = 'albums-listening-log-title';
        title.textContent = item.title;
        const meta = document.createElement('span');
        meta.className = 'albums-listening-log-meta';
        if (item.isAlbum) meta.append(makeBadge('Full album', 'is-album'));
        if (item.rating) meta.append(makeBadge(item.rating, 'is-rating'));
        const details = [item.genre, item.subgenre, item.country, item.releaseYear]
          .filter((value) => value && !/^unknown$/i.test(value)).join(' · ');
        if (details) {
          const detail = document.createElement('span');
          detail.textContent = details;
          meta.append(detail);
        }
        if (item.listenCount > 1) {
          const repeat = makeBadge(`↻ ${item.listenCount.toLocaleString('en-US')} listens`, 'is-repeat');
          meta.append(repeat);
        }
        if (item.annotation) {
          const note = document.createElement('span');
          note.className = 'albums-listening-log-note';
          note.textContent = item.annotation;
          meta.append(note);
        }
        main.append(artist, title, meta);

        const side = document.createElement('span');
        side.className = 'albums-listening-log-side';
        const first = document.createElement('time');
        first.dateTime = item.dateKey;
        first.textContent = titleFormatDate(item.firstDate);
        const duration = document.createElement('span');
        duration.textContent = `${titleFormatDuration(item.totalMinutes)} total`;
        side.append(first, duration);
        if (item.listenCount > 1) {
          const latest = document.createElement('small');
          latest.textContent = `Latest · ${titleFormatDate(item.latestDate)}`;
          side.append(latest);
        }
        li.append(main, side);
        return li;
      }

      function patchModeCounts(shell) {
        const buttons = Array.from(shell.querySelectorAll('.albums-listening-log-mode-group button'));
        const entriesButton = buttons.find((button) => /^Entries\b/i.test(button.textContent || ''));
        const titlesButton = buttons.find((button) => /^(?:Works|Titles)\b/i.test(button.textContent || ''));
        if (entriesButton) entriesButton.textContent = `Entries · ${entries.length.toLocaleString('en-US')}`;
        if (titlesButton) titlesButton.textContent = `Titles · ${allTitles.length.toLocaleString('en-US')}`;
      }

      function renderTitles() {
        const shell = expansion.querySelector('.albums-listening-log-view');
        if (!shell) return;
        patchModeCounts(shell);
        if (!titleModeActive()) return;

        const list = shell.querySelector('.albums-listening-log-list');
        const results = shell.querySelector('.albums-listening-log-results p');
        const baseMore = shell.querySelector('.albums-listening-log-more:not(.albums-listening-log-titles-more)');
        if (!list || !results) return;

        const f = filters();
        const signature = JSON.stringify(f);
        if (signature !== state.lastFilterSignature) {
          state.lastFilterSignature = signature;
          state.limit = ALBUMS_LISTENING_TITLES_PAGE_SIZE;
        }

        const filteredEntries = entries.filter((entry) => entryMatches(entry, f));
        const titles = sortTitles(aggregateTitles(filteredEntries), f.sort);
        const visible = titles.slice(0, state.limit);
        const listens = titles.reduce((sum, item) => sum + item.listenCount, 0);
        const minutes = titles.reduce((sum, item) => sum + item.totalMinutes, 0);

        results.textContent = titles.length
          ? `Showing ${visible.length.toLocaleString('en-US')} of ${titles.length.toLocaleString('en-US')} matching titles · ${listens.toLocaleString('en-US')} listens · ${titleFormatDuration(minutes)}`
          : 'No matching titles';

        list.classList.remove('is-repeated-ranking');
        list.replaceChildren();
        visible.forEach((item) => list.append(makeTitleItem(item)));
        if (!visible.length) {
          const empty = document.createElement('li');
          empty.className = 'albums-listening-log-empty';
          empty.textContent = 'Nothing in the listening archive matches these filters.';
          list.append(empty);
        }

        shell.querySelectorAll('.albums-listening-log-titles-more').forEach((node) => node.remove());
        if (baseMore) baseMore.hidden = true;
        if (titles.length > state.limit) {
          const more = document.createElement('button');
          more.type = 'button';
          more.className = 'albums-listening-log-more albums-listening-log-titles-more';
          more.textContent = `Show ${Math.min(ALBUMS_LISTENING_TITLES_PAGE_SIZE, titles.length - state.limit).toLocaleString('en-US')} more`;
          more.addEventListener('click', () => {
            state.limit += ALBUMS_LISTENING_TITLES_PAGE_SIZE;
            renderTitles();
          });
          shell.append(more);
        }
      }

      function queueTitles() {
        window.cancelAnimationFrame(state.frame);
        state.frame = window.requestAnimationFrame(renderTitles);
      }

      function queueSequence() {
        queueTitles();
        window.setTimeout(queueTitles, 80);
        window.setTimeout(queueTitles, 180);
      }

      expansion.addEventListener('click', queueSequence, true);
      expansion.addEventListener('change', queueSequence, true);
      expansion.addEventListener('input', queueSequence, true);
      viewToggle.addEventListener('click', queueSequence, true);
      queueSequence();
      window.setTimeout(queueSequence, 500);
    })
    .catch((error) => console.warn('[Albums] Unicode-safe Titles mode could not load:', error));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAlbumsTitlesIdentity, { once: true });
} else {
  bootAlbumsTitlesIdentity();
}
