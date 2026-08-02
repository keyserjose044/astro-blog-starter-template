/* LifeLoggerz Albums: complete music listening log + calendar activity. */

const ALBUMS_LISTENING_LOG_VERSION = '20260801-2058';
const ALBUMS_LISTENING_LOG_RETRIES = 160;
const ALBUMS_LISTENING_LOG_PAGE_SIZE = 50;
const ALBUMS_MUSIC_ACTIVITY_KEY = 'lifeloggerz-albums-music-activity';

function ensureAlbumsListeningLogCss() {
  if (document.querySelector('link[data-albums-listening-log-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.albumsListeningLogCss = 'true';
  link.href = new URL(`../styles/albums-listening-log.css?v=${ALBUMS_LISTENING_LOG_VERSION}`, import.meta.url).toString();
  document.head.append(link);
}

const clean = (value) => String(value ?? '').trim();
const normalize = (value) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

function parseListeningDate(value) {
  const raw = clean(value).replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
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
}

function parseMinutes(value) {
  const raw = clean(value).toLowerCase();
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

const isYes = (value) => /^(?:y|yes|true|1|album)$/i.test(clean(value));
const isHttpUrl = (value) => /^https?:\/\//i.test(clean(value));
const cleanGenre = (value) => clean(value).replace(/^\d+\.\s*/, '');
const dateKey = (date) => date
  ? `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
  : '';
const formatDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  : '';
const formatFullDate = (date) => date
  ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
  : '';
const formatDuration = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes || 0)));
  const hours = Math.floor(total / 60);
  const remainder = total % 60;
  if (!hours) return `${remainder.toLocaleString('en-US')} min`;
  return remainder
    ? `${hours.toLocaleString('en-US')} hr ${remainder} min`
    : `${hours.toLocaleString('en-US')} hr`;
};

function normalizeListeningRow(row, index) {
  if (!row || typeof row !== 'object') return null;
  const dateRaw = clean(row.date ?? row.listeningDate ?? row.dateListened);
  const date = parseListeningDate(dateRaw);
  const artist = clean(row.artist ?? row.performer);
  let title = clean(row.title ?? row.piece ?? row.albumPiece ?? row.album ?? row.work);
  let sourceUrl = clean(row.sourceUrl ?? row.youtubeUrl ?? row.url ?? row.link);
  if (!sourceUrl && isHttpUrl(title)) {
    sourceUrl = title;
    title = 'Linked music entry';
  }
  if (!dateRaw || !date || !artist || !title) return null;

  const albumRaw = clean(row.albumRaw ?? row.albumFlag ?? row.isAlbumRaw ?? row['album?'] ?? row.albumMarker);
  const instrumentRaw = clean(row.instrumentRaw ?? row.instrument ?? row.instrm);
  const explicitAlbum = typeof row.isAlbum === 'boolean' ? row.isAlbum : isYes(albumRaw);
  const annotation = albumRaw && !isYes(albumRaw) ? albumRaw : clean(row.annotation ?? row.note);

  return {
    rowNumber: Number(row.rowNumber ?? row.sourceRow ?? index + 2) || index + 2,
    dateRaw,
    date,
    dateKey: dateKey(date),
    listenedYear: String(date.getUTCFullYear()),
    artist,
    title,
    minutes: parseMinutes(row.minutes ?? row.min ?? row.duration ?? row.length),
    rating: clean(row.rating ?? row.score),
    genre: cleanGenre(row.genre ?? row.style),
    subgenre: clean(row.subgenre ?? row.subGenre),
    country: clean(row.country ?? row.coo ?? row.origin),
    releaseYear: clean(row.year ?? row.releaseYear ?? row.releasePeriod),
    instrumentRaw,
    albumRaw,
    isAlbum: explicitAlbum,
    annotation,
    sourceUrl: isHttpUrl(sourceUrl) ? sourceUrl : '',
  };
}

function aggregateWorks(entries) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = `${normalize(entry.artist)}|${normalize(entry.title)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });

  return Array.from(groups.values()).map((group) => {
    const sorted = [...group].sort((a, b) => b.date - a.date || b.rowNumber - a.rowNumber);
    const latest = sorted[0];
    const first = sorted[sorted.length - 1];
    const withField = (field) => sorted.find((entry) => clean(entry[field]))?.[field] || '';
    return {
      ...latest,
      genre: withField('genre'),
      subgenre: withField('subgenre'),
      country: withField('country'),
      releaseYear: withField('releaseYear'),
      rating: withField('rating'),
      sourceUrl: withField('sourceUrl'),
      instrumentRaw: withField('instrumentRaw'),
      isAlbum: group.some((entry) => entry.isAlbum),
      listenCount: group.length,
      totalMinutes: group.reduce((sum, entry) => sum + entry.minutes, 0),
      firstDate: first.date,
      latestDate: latest.date,
    };
  });
}

async function loadListeningPayload() {
  const url = new URL(`../data/music-listening.json?v=${ALBUMS_LISTENING_LOG_VERSION}`, import.meta.url);
  const response = await fetch(url.toString(), { cache: 'no-store', headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Music listening snapshot returned ${response.status}`);
  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
  return {
    generatedAt: clean(payload?.generatedAt),
    sourceSheet: clean(payload?.sourceSheet),
    rows,
  };
}

function addOption(select, value, label = value) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.append(option);
}

function bootAlbumsListeningLog(attempt = 0) {
  ensureAlbumsListeningLogCss();
  const viewToggle = document.querySelector('#album-view-toggle');
  const grid = document.querySelector('#albums-grid');
  const explorer = document.querySelector('#albums-explorer');
  const expansion = document.querySelector('#albums-expansion-views');
  const surprise = document.querySelector('#albums-surprise');

  const ready = viewToggle && grid && explorer && expansion && surprise;
  if (!ready && attempt < ALBUMS_LISTENING_LOG_RETRIES) {
    window.setTimeout(() => bootAlbumsListeningLog(attempt + 1), 75);
    return;
  }
  if (!ready || document.body.dataset.albumsListeningLogBooted) return;
  document.body.dataset.albumsListeningLogBooted = 'true';

  loadListeningPayload().then(({ rows, generatedAt, sourceSheet }) => {
    const entries = rows.map(normalizeListeningRow).filter(Boolean);
    if (!entries.length) return;

    document.body.dataset.albumsListeningLogReady = 'true';
    const works = aggregateWorks(entries);
    const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
    const dailyMinutes = new Map();
    entries.forEach((entry) => dailyMinutes.set(entry.dateKey, (dailyMinutes.get(entry.dateKey) || 0) + entry.minutes));
    const trackingDates = entries.map((entry) => entry.date).sort((a, b) => a - b);
    const firstTracked = trackingDates[0] || null;
    const latestTracked = trackingDates[trackingDates.length - 1] || null;

    const state = {
      active: false,
      mode: 'entries',
      search: '',
      artist: '',
      genre: '',
      type: '',
      year: '',
      sort: 'latest',
      visibleLimit: ALBUMS_LISTENING_LOG_PAGE_SIZE,
      activityEnabled: true,
      calendarFrame: 0,
    };

    try {
      const saved = localStorage.getItem(ALBUMS_MUSIC_ACTIVITY_KEY);
      state.activityEnabled = saved === null ? true : saved === 'true';
    } catch (_error) {
      state.activityEnabled = true;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'albums-view-button albums-listening-log-view-button';
    button.dataset.albumsListeningView = 'log';
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = '<span aria-hidden="true">♫</span><span>Listening Log</span>';

    if (surprise.parentElement === viewToggle) viewToggle.insertBefore(button, surprise);
    else viewToggle.append(button);

    function setPressed(target) {
      viewToggle.querySelectorAll('.albums-view-button').forEach((candidate) => {
        candidate.setAttribute('aria-pressed', String(candidate === target));
      });
    }

    function leaveLog() {
      state.active = false;
      document.body.removeAttribute('data-albums-listening-log-active');
    }

    viewToggle.addEventListener('click', (event) => {
      const target = event.target.closest('.albums-view-button');
      if (target && target !== button) leaveLog();
    });

    function closeToQuilt() {
      leaveLog();
      const quilt = viewToggle.querySelector('[data-album-view="quilt"]');
      if (quilt) quilt.click();
    }

    function renderMetricRow(container) {
      const totalMinutes = entries.reduce((sum, entry) => sum + entry.minutes, 0);
      const uniqueDays = new Set(entries.map((entry) => entry.dateKey)).size;
      const albumEntries = entries.filter((entry) => entry.isAlbum).length;
      const metrics = [
        ['Listening entries', entries.length.toLocaleString('en-US')],
        ['Unique works', works.length.toLocaleString('en-US')],
        ['Listening time', formatDuration(totalMinutes)],
        ['Music days', uniqueDays.toLocaleString('en-US')],
        ['Album-tagged', albumEntries.toLocaleString('en-US')],
      ];
      const row = document.createElement('div');
      row.className = 'albums-listening-log-metrics';
      metrics.forEach(([labelText, value]) => {
        const item = document.createElement('div');
        const label = document.createElement('span');
        const strong = document.createElement('strong');
        label.textContent = labelText;
        strong.textContent = value;
        item.append(label, strong);
        row.append(item);
      });
      container.append(row);
    }

    function buildToolbar(container) {
      const toolbar = document.createElement('div');
      toolbar.className = 'albums-listening-log-toolbar';

      const search = document.createElement('input');
      search.type = 'search';
      search.placeholder = 'Search title, artist, genre, country, rating…';
      search.setAttribute('aria-label', 'Search the complete music listening log');
      search.value = state.search;

      const artist = document.createElement('select');
      artist.setAttribute('aria-label', 'Filter listening log by artist');
      addOption(artist, '', 'All artists');
      [...new Set(entries.map((entry) => entry.artist).filter(Boolean))]
        .sort(collator.compare)
        .forEach((value) => addOption(artist, value));
      artist.value = state.artist;

      const genre = document.createElement('select');
      genre.setAttribute('aria-label', 'Filter listening log by genre');
      addOption(genre, '', 'All genres');
      [...new Set(entries.map((entry) => entry.genre).filter(Boolean))]
        .sort(collator.compare)
        .forEach((value) => addOption(genre, value));
      genre.value = state.genre;

      const type = document.createElement('select');
      type.setAttribute('aria-label', 'Filter listening log by entry type');
      addOption(type, '', 'All entries');
      addOption(type, 'album', 'Album-tagged');
      addOption(type, 'other', 'Songs / other');
      type.value = state.type;

      const year = document.createElement('select');
      year.setAttribute('aria-label', 'Filter listening log by listening year');
      addOption(year, '', 'All listening years');
      [...new Set(entries.map((entry) => entry.listenedYear))]
        .sort((a, b) => Number(b) - Number(a))
        .forEach((value) => addOption(year, value));
      year.value = state.year;

      const sort = document.createElement('select');
      sort.setAttribute('aria-label', 'Sort listening log');
      [
        ['latest', 'Recently heard'],
        ['oldest', 'Oldest heard'],
        ['artist', 'Artist A–Z'],
        ['title', 'Title A–Z'],
        ['longest', state.mode === 'works' ? 'Most total time' : 'Longest first'],
        ['most-listened', 'Most listened'],
      ].forEach(([value, label]) => addOption(sort, value, label));
      sort.value = state.sort;

      toolbar.append(search, artist, genre, type, year, sort);
      container.append(toolbar);

      const update = (key, value) => {
        state[key] = value;
        state.visibleLimit = ALBUMS_LISTENING_LOG_PAGE_SIZE;
        renderLog();
      };
      search.addEventListener('input', () => update('search', search.value));
      artist.addEventListener('change', () => update('artist', artist.value));
      genre.addEventListener('change', () => update('genre', genre.value));
      type.addEventListener('change', () => update('type', type.value));
      year.addEventListener('change', () => update('year', year.value));
      sort.addEventListener('change', () => update('sort', sort.value));
    }

    function filterItems(source) {
      const words = normalize(state.search).split(/\s+/).filter(Boolean);
      return source.filter((item) => {
        if (state.artist && item.artist !== state.artist) return false;
        if (state.genre && item.genre !== state.genre) return false;
        if (state.type === 'album' && !item.isAlbum) return false;
        if (state.type === 'other' && item.isAlbum) return false;
        if (state.year && item.listenedYear !== state.year) return false;
        if (words.length) {
          const haystack = normalize([
            item.title, item.artist, item.genre, item.subgenre, item.country,
            item.releaseYear, item.rating, item.annotation, item.instrumentRaw,
          ].join(' '));
          if (!words.every((word) => haystack.includes(word))) return false;
        }
        return true;
      });
    }

    function sortItems(items) {
      const sorted = [...items];
      sorted.sort((a, b) => {
        if (state.sort === 'oldest') return a.date - b.date || a.rowNumber - b.rowNumber;
        if (state.sort === 'artist') return collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title);
        if (state.sort === 'title') return collator.compare(a.title, b.title) || collator.compare(a.artist, b.artist);
        if (state.sort === 'longest') {
          const aMinutes = state.mode === 'works' ? a.totalMinutes : a.minutes;
          const bMinutes = state.mode === 'works' ? b.totalMinutes : b.minutes;
          return bMinutes - aMinutes || b.date - a.date;
        }
        if (state.sort === 'most-listened') {
          const aCount = state.mode === 'works' ? a.listenCount : 1;
          const bCount = state.mode === 'works' ? b.listenCount : 1;
          return bCount - aCount || b.date - a.date;
        }
        return b.date - a.date || b.rowNumber - a.rowNumber;
      });
      return sorted;
    }

    function makeBadge(text, className = '') {
      const badge = document.createElement('span');
      badge.className = `albums-listening-log-badge ${className}`.trim();
      badge.textContent = text;
      return badge;
    }

    function makeItem(item) {
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
      if (item.isAlbum) meta.append(makeBadge('Album', 'is-album'));
      if (item.rating) {
        const rating = makeBadge(item.rating, 'is-rating');
        rating.title = item.rating;
        meta.append(rating);
      }
      const details = [item.genre, item.subgenre, item.country, item.releaseYear]
        .filter((value) => value && !/^unknown$/i.test(value))
        .join(' · ');
      if (details) {
        const span = document.createElement('span');
        span.textContent = details;
        meta.append(span);
      }
      if (state.mode === 'works' && item.listenCount > 1) {
        const repeat = document.createElement('span');
        repeat.textContent = `${item.listenCount.toLocaleString('en-US')} listens`;
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
      const date = document.createElement('time');
      date.dateTime = item.dateKey;
      date.textContent = formatDate(item.date);
      const duration = document.createElement('span');
      duration.textContent = state.mode === 'works'
        ? `${formatDuration(item.totalMinutes)} total`
        : formatDuration(item.minutes);
      side.append(date, duration);
      if (state.mode === 'works' && item.listenCount > 1) {
        const latest = document.createElement('small');
        latest.textContent = `Latest · ${formatDate(item.latestDate)}`;
        side.append(latest);
      }

      li.append(main, side);
      return li;
    }

    function renderLog() {
      if (!state.active) return;
      expansion.replaceChildren();
      const shell = document.createElement('div');
      shell.className = 'albums-extra-shell albums-listening-log-view';
      const heading = document.createElement('div');
      heading.className = 'albums-extra-heading';
      heading.innerHTML = `
        <div>
          <p class="albums-eyebrow">Complete listening archive</p>
          <h2>Listening Log</h2>
          <p>Every dated music entry from the Listen Log, including individual songs, full albums, mixes, repeats, and listening minutes.</p>
        </div>
      `;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'albums-explorer-close';
      close.setAttribute('aria-label', 'Close Listening Log');
      close.textContent = '×';
      close.addEventListener('click', closeToQuilt);
      heading.append(close);
      shell.append(heading);

      renderMetricRow(shell);

      const modeRow = document.createElement('div');
      modeRow.className = 'albums-listening-log-mode-row';
      const modeGroup = document.createElement('div');
      modeGroup.className = 'albums-listening-log-mode-group';
      modeGroup.setAttribute('role', 'group');
      modeGroup.setAttribute('aria-label', 'Listening Log grouping');
      [
        ['entries', `Entries · ${entries.length.toLocaleString('en-US')}`],
        ['works', `Works · ${works.length.toLocaleString('en-US')}`],
      ].forEach(([mode, label]) => {
        const modeButton = document.createElement('button');
        modeButton.type = 'button';
        modeButton.textContent = label;
        modeButton.setAttribute('aria-pressed', String(state.mode === mode));
        modeButton.addEventListener('click', () => {
          state.mode = mode;
          state.visibleLimit = ALBUMS_LISTENING_LOG_PAGE_SIZE;
          if (state.sort === 'most-listened' && mode === 'entries') state.sort = 'latest';
          renderLog();
        });
        modeGroup.append(modeButton);
      });
      const source = document.createElement('p');
      source.className = 'albums-listening-log-source-note';
      const generated = generatedAt ? new Date(generatedAt) : null;
      const generatedLabel = generated && !Number.isNaN(generated.getTime())
        ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Chicago' }).format(generated)
        : '';
      source.textContent = [sourceSheet ? `Source: ${sourceSheet}` : '', generatedLabel ? `Updated ${generatedLabel}` : '']
        .filter(Boolean).join(' · ');
      modeRow.append(modeGroup, source);
      shell.append(modeRow);

      buildToolbar(shell);

      const sourceItems = state.mode === 'works' ? works : entries;
      const filtered = sortItems(filterItems(sourceItems));
      const results = document.createElement('div');
      results.className = 'albums-listening-log-results';
      const resultText = document.createElement('p');
      const shown = Math.min(filtered.length, state.visibleLimit);
      resultText.textContent = filtered.length
        ? `Showing ${shown.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')} matching ${state.mode === 'works' ? 'works' : 'entries'}`
        : `No matching ${state.mode === 'works' ? 'works' : 'entries'}`;
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.textContent = 'Clear filters';
      clear.hidden = !(state.search || state.artist || state.genre || state.type || state.year || state.sort !== 'latest');
      clear.addEventListener('click', () => {
        Object.assign(state, { search: '', artist: '', genre: '', type: '', year: '', sort: 'latest', visibleLimit: ALBUMS_LISTENING_LOG_PAGE_SIZE });
        renderLog();
      });
      results.append(resultText, clear);
      shell.append(results);

      const list = document.createElement('ul');
      list.className = 'albums-listening-log-list';
      filtered.slice(0, state.visibleLimit).forEach((item) => list.append(makeItem(item)));
      if (!filtered.length) {
        const empty = document.createElement('li');
        empty.className = 'albums-listening-log-empty';
        empty.textContent = 'Nothing in the listening archive matches these filters.';
        list.append(empty);
      }
      shell.append(list);

      if (filtered.length > state.visibleLimit) {
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'albums-listening-log-more';
        more.textContent = `Show ${Math.min(ALBUMS_LISTENING_LOG_PAGE_SIZE, filtered.length - state.visibleLimit).toLocaleString('en-US')} more`;
        more.addEventListener('click', () => {
          state.visibleLimit += ALBUMS_LISTENING_LOG_PAGE_SIZE;
          renderLog();
          expansion.querySelector('.albums-listening-log-results')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        shell.append(more);
      }

      expansion.append(shell);
    }

    button.addEventListener('click', () => {
      const quilt = viewToggle.querySelector('[data-album-view="quilt"]');
      if (quilt) quilt.click();
      window.requestAnimationFrame(() => {
        state.active = true;
        document.body.dataset.albumsListeningLogActive = 'true';
        explorer.hidden = true;
        grid.hidden = true;
        expansion.hidden = false;
        setPressed(button);
        renderLog();
        expansion.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    function activityLevel(minutes, known) {
      if (!known) return 'missing';
      if (minutes <= 0) return 'zero';
      if (minutes <= 30) return 'low';
      if (minutes <= 60) return 'medium';
      if (minutes <= 120) return 'high';
      return 'very-high';
    }

    function patchCalendarActivity() {
      const calendarView = expansion.querySelector('.albums-calendar-view');
      if (!calendarView || state.active) return;
      const select = calendarView.querySelector('.albums-calendar-controls select');
      const calendarGrid = calendarView.querySelector('.albums-calendar-grid');
      const metrics = calendarView.querySelector('.albums-extra-metrics');
      if (!select || !calendarGrid || !metrics || !/^\d{4}-\d{2}$/.test(select.value)) return;

      const signature = `${select.value}|${state.activityEnabled}|${entries.length}|${latestTracked?.getTime() || 0}`;
      if (calendarView.dataset.musicActivitySignature === signature && calendarView.querySelector('[data-music-activity-row]')) return;
      calendarView.dataset.musicActivitySignature = signature;

      let activityRow = calendarView.querySelector('[data-music-activity-row]');
      if (!activityRow) {
        activityRow = document.createElement('div');
        activityRow.className = 'albums-music-activity-row';
        activityRow.dataset.musicActivityRow = 'true';
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'albums-music-activity-toggle';
        toggle.innerHTML = '<span aria-hidden="true">♫</span><span>All-music activity</span><strong></strong>';
        toggle.addEventListener('click', () => {
          state.activityEnabled = !state.activityEnabled;
          try { localStorage.setItem(ALBUMS_MUSIC_ACTIVITY_KEY, String(state.activityEnabled)); } catch (_error) { /* noop */ }
          calendarView.dataset.musicActivitySignature = '';
          patchCalendarActivity();
        });
        const note = document.createElement('p');
        note.textContent = 'Actual minutes from every Listen Log entry, not album runtime.';
        activityRow.append(toggle, note);
        calendarView.querySelector('.albums-calendar-controls')?.insertAdjacentElement('afterend', activityRow);
      }

      const toggle = activityRow.querySelector('.albums-music-activity-toggle');
      toggle?.setAttribute('aria-pressed', String(state.activityEnabled));
      const stateLabel = toggle?.querySelector('strong');
      if (stateLabel) stateLabel.textContent = state.activityEnabled ? 'On' : 'Off';
      calendarView.classList.toggle('show-music-activity', state.activityEnabled);

      let legend = calendarView.querySelector('[data-music-activity-legend]');
      if (!legend) {
        legend = document.createElement('div');
        legend.className = 'albums-music-activity-legend';
        legend.dataset.musicActivityLegend = 'true';
        legend.innerHTML = `
          <span><i data-level="zero"></i>0 min</span>
          <span><i data-level="low"></i>1–30</span>
          <span><i data-level="medium"></i>31–60</span>
          <span><i data-level="high"></i>61–120</span>
          <span><i data-level="very-high"></i>120+</span>
        `;
        activityRow.insertAdjacentElement('afterend', legend);
      }
      legend.hidden = !state.activityEnabled;

      calendarView.querySelectorAll('[data-music-listening-metric]').forEach((node) => node.remove());
      const [year, month] = select.value.split('-').map(Number);
      const monthEntries = entries.filter((entry) => entry.date.getUTCFullYear() === year && entry.date.getUTCMonth() === month - 1);
      const monthMinutes = monthEntries.reduce((sum, entry) => sum + entry.minutes, 0);
      const monthDays = new Set(monthEntries.map((entry) => entry.dateKey)).size;
      [
        ['Music listened', formatDuration(monthMinutes)],
        ['Music days', monthDays.toLocaleString('en-US')],
      ].forEach(([labelText, value]) => {
        const item = document.createElement('div');
        item.dataset.musicListeningMetric = 'true';
        const label = document.createElement('span');
        const strong = document.createElement('strong');
        label.textContent = labelText;
        strong.textContent = value;
        item.append(label, strong);
        metrics.append(item);
      });

      calendarGrid.querySelectorAll('.albums-music-activity-strip,.albums-music-activity-most').forEach((node) => node.remove());
      const first = new Date(Date.UTC(year, month - 1, 1));
      const leading = first.getUTCDay();
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      let maxMinutes = 0;
      let maxDateKey = '';
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = `${select.value}-${String(day).padStart(2, '0')}`;
        const minutes = dailyMinutes.get(key) || 0;
        if (minutes > maxMinutes) {
          maxMinutes = minutes;
          maxDateKey = key;
        }
      }

      Array.from(calendarGrid.children).forEach((cell, index) => {
        const day = index - leading + 1;
        if (day < 1 || day > daysInMonth || cell.classList.contains('is-outside')) return;
        const date = new Date(Date.UTC(year, month - 1, day));
        const key = dateKey(date);
        const withinTracking = Boolean(firstTracked && latestTracked && date >= firstTracked && date <= latestTracked);
        const minutes = dailyMinutes.get(key) || 0;
        const strip = document.createElement('span');
        strip.className = 'albums-music-activity-strip';
        strip.dataset.level = activityLevel(minutes, withinTracking);
        strip.title = withinTracking
          ? `${formatFullDate(date)} · ${Math.round(minutes).toLocaleString('en-US')} music minutes`
          : `${formatFullDate(date)} · music log not available`;
        cell.append(strip);
        if (key === maxDateKey && minutes > 0) {
          const marker = document.createElement('span');
          marker.className = 'albums-music-activity-most';
          marker.textContent = '♫';
          marker.title = `Most music this month · ${formatDuration(minutes)}`;
          cell.append(marker);
        }
      });
    }

    function queueCalendarPatch() {
      window.cancelAnimationFrame(state.calendarFrame);
      state.calendarFrame = window.requestAnimationFrame(patchCalendarActivity);
    }

    const expansionObserver = new MutationObserver(queueCalendarPatch);
    expansionObserver.observe(expansion, { childList: true, subtree: true });
    viewToggle.addEventListener('click', () => window.setTimeout(queueCalendarPatch, 40));
    queueCalendarPatch();
  }).catch((error) => {
    console.warn('[Albums] Complete music listening snapshot could not be loaded:', error);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsListeningLog(), { once: true });
} else {
  bootAlbumsListeningLog();
}
