/* LifeLoggerz Albums: stabilized Calendar, Artists, Records, and mobile view navigation. */

const ALBUMS_EXPANSION_STORAGE_KEY = 'lifeloggerz-albums-calendar-month';
const ALBUMS_EXPANSION_RETRIES = 100;

function bootAlbumsExpansion(attempt = 0) {
  const grid = document.querySelector('#albums-grid');
  const viewToggle = document.querySelector('#album-view-toggle');
  const explorer = document.querySelector('#albums-explorer');
  const toolbar = document.querySelector('.albums-toolbar');
  const surprise = document.querySelector('#albums-surprise');

  if ((!grid || !viewToggle || !explorer || !toolbar || !surprise) && attempt < ALBUMS_EXPANSION_RETRIES) {
    window.setTimeout(() => bootAlbumsExpansion(attempt + 1), 75);
    return;
  }
  if (!grid || !viewToggle || !explorer || !toolbar || !surprise || document.body.dataset.albumsExpansionReady) return;
  document.body.dataset.albumsExpansionReady = 'true';

  const cards = Array.from(grid.querySelectorAll('.album-card'));
  if (!cards.length) return;

  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  const originalViewButtons = Array.from(viewToggle.querySelectorAll('.albums-view-button'));
  const mobileQuery = window.matchMedia('(max-width: 900px)');
  const phoneCalendarQuery = window.matchMedia('(max-width: 900px)');
  const surprisePlaceholder = document.createComment('albums-surprise-desktop-position');
  surprise.before(surprisePlaceholder);

  const state = {
    activeView: '',
    calendarMonth: '',
    calendarKeys: [],
    dayDialogTrigger: null,
  };

  const clean = (value) => String(value || '').trim();
  const normalize = (value) => clean(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

  function parseDate(value) {
    const raw = clean(value).replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
    if (!raw) return null;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

  const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const dateKey = (date) => `${monthKey(date)}-${String(date.getUTCDate()).padStart(2, '0')}`;
  const formatMonth = (key) => {
    const match = String(key || '').match(/^(\d{4})-(\d{2})$/);
    if (!match) return '';
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
  };
  const formatShortDate = (date) => date
    ? new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
    : '';
  const formatFullDate = (date) => date
    ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date)
    : '';
  const formatRuntime = (minutes) => {
    const total = Math.max(0, Math.round(Number(minutes || 0)));
    const hours = Math.floor(total / 60);
    const remainder = total % 60;
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
  };

  function albumFromCard(card) {
    return {
      card,
      title: clean(card.dataset.title) || 'Untitled album',
      artist: clean(card.dataset.artist) || 'Artist not recorded',
      country: clean(card.dataset.country),
      style: clean(card.dataset.style),
      subgenre: clean(card.dataset.subgenre),
      mood: clean(card.dataset.mood),
      date: parseDate(card.dataset.dateListened),
      dateRaw: clean(card.dataset.dateListened),
      listenedYear: clean(card.dataset.listenedYear),
      release: clean(card.dataset.releaseLabel),
      releaseSort: Number(card.dataset.releaseSort || 0) || null,
      releasePrecision: clean(card.dataset.releasePrecision),
      length: clean(card.dataset.length),
      minutes: Number(card.dataset.lengthMinutes || 0) || 0,
      cover: card.querySelector('.album-cover')?.getAttribute('src') || '',
      href: clean(card.dataset.href),
      originalIndex: Number(card.dataset.originalIndex || 0),
    };
  }

  const allAlbums = () => cards.map(albumFromCard);
  const visibleAlbums = () => cards
    .filter((card) => card.style.display !== 'none' && !card.hidden)
    .map(albumFromCard);

  function openAlbum(album, trigger = null) {
    if (!album?.card) return;
    const hit = album.card.querySelector('.album-details-hit');
    if (!hit) return;
    if (trigger) hit._albumsExpansionTrigger = trigger;
    hit.click();
  }

  function makeQuiltTile(album, options = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = options.className || 'albums-quilt-tile';
    button.setAttribute('aria-label', `${album.title} — open album details`);

    const image = document.createElement('img');
    image.src = album.cover;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';

    const copy = document.createElement('span');
    copy.className = 'albums-quilt-tile-copy';
    const title = document.createElement('strong');
    title.textContent = album.title;
    const artist = document.createElement('small');
    artist.textContent = album.artist;
    copy.append(title, artist);

    if (options.date && album.date) {
      const date = document.createElement('em');
      date.textContent = formatShortDate(album.date);
      copy.append(date);
    }

    button.append(image, copy);
    button.addEventListener('click', () => openAlbum(album, button));
    return button;
  }

  function createViewButton(view, icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'albums-view-button albums-expansion-view-button';
    button.dataset.albumsExpansionView = view;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`;
    return button;
  }

  const calendarButton = createViewButton('calendar', '▣', 'Calendar');
  const artistsButton = createViewButton('artists', '♬', 'Artists');
  const recordsButton = createViewButton('records', '◆', 'Records');
  viewToggle.append(calendarButton, artistsButton, recordsButton);

  const views = document.createElement('section');
  views.id = 'albums-expansion-views';
  views.className = 'albums-expansion-views';
  views.hidden = true;
  grid.parentElement.insertBefore(views, grid);

  const dayDialog = document.createElement('dialog');
  dayDialog.className = 'albums-calendar-day-dialog';
  dayDialog.setAttribute('aria-labelledby', 'albums-calendar-day-dialog-title');
  dayDialog.innerHTML = `
    <div class="albums-calendar-day-dialog-shell">
      <div class="albums-calendar-day-dialog-heading">
        <div>
          <p class="albums-eyebrow">Albums logged on</p>
          <h2 id="albums-calendar-day-dialog-title"></h2>
          <p data-albums-day-dialog-summary></p>
        </div>
        <button type="button" class="albums-details-close" data-albums-day-dialog-close aria-label="Close day albums">×</button>
      </div>
      <div class="albums-calendar-day-dialog-grid" data-albums-day-dialog-grid></div>
    </div>
  `;
  document.body.append(dayDialog);

  function setPressed(target) {
    viewToggle.querySelectorAll('.albums-view-button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button === target));
    });
  }

  function normalizePressedAfterClick(button) {
    window.queueMicrotask(() => setPressed(button));
  }

  viewToggle.addEventListener('click', (event) => {
    const button = event.target.closest('.albums-view-button');
    if (button) normalizePressedAfterClick(button);
  });

  function closeExpansion() {
    state.activeView = '';
    views.hidden = true;
  }

  originalViewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      closeExpansion();
      normalizePressedAfterClick(button);
    });
  });

  function activate(view, button) {
    state.activeView = view;
    explorer.hidden = true;
    grid.hidden = true;
    views.hidden = false;
    setPressed(button);
    renderActive();
    views.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  calendarButton.addEventListener('click', () => activate('calendar', calendarButton));
  artistsButton.addEventListener('click', () => activate('artists', artistsButton));
  recordsButton.addEventListener('click', () => activate('records', recordsButton));

  function syncSurprisePlacement() {
    const trigger = surprise.querySelector('#albums-surprise-trigger');
    const label = trigger?.querySelector('span:nth-child(2)');

    if (mobileQuery.matches) {
      if (surprise.parentElement !== viewToggle) viewToggle.append(surprise);
      if (label) label.textContent = 'Random';
    } else {
      if (surprise.parentElement !== toolbar) toolbar.insertBefore(surprise, surprisePlaceholder.nextSibling);
      if (label) label.textContent = 'Surprise Me';
    }
  }

  if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', syncSurprisePlacement);
  else mobileQuery.addListener(syncSurprisePlacement);
  syncSurprisePlacement();

  function viewShell(eyebrow, title, description, bodyClass) {
    views.replaceChildren();
    const shell = document.createElement('div');
    shell.className = `albums-extra-shell ${bodyClass}`;
    shell.innerHTML = `
      <div class="albums-extra-heading">
        <div>
          <p class="albums-eyebrow">${eyebrow}</p>
          <h2>${title}</h2>
          <p>${description}</p>
        </div>
        <button type="button" class="albums-explorer-close" data-close-extra aria-label="Close ${title}">×</button>
      </div>
      <div data-extra-content></div>
    `;
    shell.querySelector('[data-close-extra]').addEventListener('click', () => {
      closeExpansion();
      viewToggle.querySelector('[data-album-view="quilt"]')?.click();
    });
    views.append(shell);
    return shell.querySelector('[data-extra-content]');
  }

  function buildCalendarKeys() {
    const dates = allAlbums().map((album) => album.date).filter(Boolean).sort((a, b) => a - b);
    if (!dates.length) return [];
    const cursor = new Date(Date.UTC(dates[0].getUTCFullYear(), dates[0].getUTCMonth(), 1));
    const end = new Date(Date.UTC(dates[dates.length - 1].getUTCFullYear(), dates[dates.length - 1].getUTCMonth(), 1));
    const keys = [];
    while (cursor <= end) {
      keys.push(monthKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return keys;
  }

  function ensureCalendarMonth() {
    state.calendarKeys = buildCalendarKeys();
    if (!state.calendarKeys.length) return;
    if (state.calendarKeys.includes(state.calendarMonth)) return;

    let saved = '';
    try { saved = localStorage.getItem(ALBUMS_EXPANSION_STORAGE_KEY) || ''; } catch (_error) { /* noop */ }

    const latestVisible = visibleAlbums().filter((album) => album.date).sort((a, b) => b.date - a.date)[0];
    state.calendarMonth = state.calendarKeys.includes(saved)
      ? saved
      : latestVisible
        ? monthKey(latestVisible.date)
        : state.calendarKeys[state.calendarKeys.length - 1];
  }

  function persistCalendarMonth() {
    try { localStorage.setItem(ALBUMS_EXPANSION_STORAGE_KEY, state.calendarMonth); } catch (_error) { /* noop */ }
  }

  function closeDayDialog() {
    if (typeof dayDialog.close === 'function' && dayDialog.open) dayDialog.close();
    else dayDialog.removeAttribute('open');
  }

  function openDayChooser(dayDate, albums, trigger) {
    if (!albums.length) return;
    state.dayDialogTrigger = trigger || document.activeElement;
    const title = dayDialog.querySelector('#albums-calendar-day-dialog-title');
    const summary = dayDialog.querySelector('[data-albums-day-dialog-summary]');
    const list = dayDialog.querySelector('[data-albums-day-dialog-grid]');
    title.textContent = formatFullDate(dayDate);
    const runtime = albums.reduce((sum, album) => sum + album.minutes, 0);
    summary.textContent = `${albums.length} ${albums.length === 1 ? 'album' : 'albums'} · ${formatRuntime(runtime)} of album runtime`;
    list.replaceChildren();

    albums.forEach((album) => {
      const tile = makeQuiltTile(album, { className: 'albums-day-dialog-album' });
      tile.addEventListener('click', (event) => {
        event.stopImmediatePropagation();
        closeDayDialog();
        window.requestAnimationFrame(() => openAlbum(album, tile));
      }, { capture: true, once: true });
      list.append(tile);
    });

    if (typeof dayDialog.showModal === 'function' && !dayDialog.open) dayDialog.showModal();
    else dayDialog.setAttribute('open', '');
  }

  dayDialog.querySelector('[data-albums-day-dialog-close]')?.addEventListener('click', closeDayDialog);
  dayDialog.addEventListener('click', (event) => {
    if (event.target === dayDialog) closeDayDialog();
  });
  dayDialog.addEventListener('close', () => {
    state.dayDialogTrigger?.focus?.({ preventScroll: true });
    state.dayDialogTrigger = null;
  });

  function addCalendarStackStyles(button, index, count) {
    const middle = (count - 1) / 2;
    const offset = index - middle;
    button.style.setProperty('--collapsed-shift', `${Math.round(offset * 7)}px`);
    button.style.setProperty('--collapsed-rotation', `${(offset * 2.8).toFixed(1)}deg`);
    button.style.setProperty('--splay-shift', `${Math.round(offset * 35)}px`);
    button.style.setProperty('--splay-rotation', `${(offset * 4.5).toFixed(1)}deg`);
    button.style.setProperty('--stack-index', String(index));
  }

  function renderCalendarDay(cell, date, dayAlbums) {
    const label = dayAlbums.length ? document.createElement('button') : document.createElement('span');
    if (label instanceof HTMLButtonElement) {
      label.type = 'button';
      label.setAttribute('aria-label', `${formatFullDate(date)} — ${dayAlbums.length} ${dayAlbums.length === 1 ? 'album' : 'albums'}`);
      label.addEventListener('click', () => {
        if (dayAlbums.length === 1) openAlbum(dayAlbums[0], label);
        else openDayChooser(date, dayAlbums, label);
      });
    }
    label.className = 'albums-calendar-day-number';
    label.textContent = String(date.getUTCDate());
    cell.append(label);

    if (!dayAlbums.length) return;
    cell.classList.add('has-albums');

    const stack = document.createElement('div');
    stack.className = `albums-calendar-cover-stack ${dayAlbums.length === 1 ? 'is-single' : 'is-stack'}`;

    if (dayAlbums.length === 1) {
      const album = dayAlbums[0];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'albums-calendar-cover';
      button.setAttribute('aria-label', `${album.title} — open album details`);
      const image = document.createElement('img');
      image.src = album.cover;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      button.append(image);
      button.addEventListener('click', () => openAlbum(album, button));
      stack.append(button);
    } else {
      const rendered = dayAlbums.slice(0, 4);
      rendered.forEach((album, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'albums-calendar-cover';
        button.setAttribute('aria-label', `${album.title} — open album details`);
        addCalendarStackStyles(button, index, rendered.length);
        const image = document.createElement('img');
        image.src = album.cover;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        button.append(image);
        button.addEventListener('click', (event) => {
          if (phoneCalendarQuery.matches) {
            event.preventDefault();
            event.stopPropagation();
            openDayChooser(date, dayAlbums, stack);
          } else {
            openAlbum(album, button);
          }
        });
        stack.append(button);
      });

      if (dayAlbums.length > 2) {
        const overflow = document.createElement('span');
        overflow.className = 'albums-calendar-stack-overflow';
        overflow.textContent = `+${dayAlbums.length - 2}`;
        stack.append(overflow);
      }

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'albums-calendar-stack-toggle';
      toggle.textContent = `${dayAlbums.length} albums`;
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', (event) => {
        event.stopPropagation();
        if (phoneCalendarQuery.matches) {
          openDayChooser(date, dayAlbums, toggle);
          return;
        }
        const expanded = !stack.classList.contains('is-expanded');
        stack.classList.toggle('is-expanded', expanded);
        toggle.setAttribute('aria-expanded', String(expanded));
      });
      cell.append(toggle);
    }

    cell.append(stack);
  }

  function renderCalendar() {
    ensureCalendarMonth();
    const content = viewShell(
      'Listening calendar',
      'Albums listened by day',
      phoneCalendarQuery.matches
        ? 'Covers mark the logged album date. Tap a multi-album stack or date to choose from larger covers.'
        : 'Covers mark the logged album date. Multi-album days fan out on hover or focus; use the day count to choose from all albums.',
      'albums-calendar-view',
    );

    if (!state.calendarKeys.length) {
      content.innerHTML = '<p class="albums-extra-empty">No album dates are available.</p>';
      return;
    }

    const controls = document.createElement('div');
    controls.className = 'albums-calendar-controls';
    const prev = document.createElement('button');
    const next = document.createElement('button');
    const latest = document.createElement('button');
    const select = document.createElement('select');
    prev.type = next.type = latest.type = 'button';
    prev.textContent = '←';
    next.textContent = '→';
    latest.textContent = 'Latest';
    prev.setAttribute('aria-label', 'Previous month');
    next.setAttribute('aria-label', 'Next month');
    select.setAttribute('aria-label', 'Choose calendar month');
    state.calendarKeys.forEach((key) => select.add(new Option(formatMonth(key), key)));
    select.value = state.calendarMonth;
    controls.append(prev, select, next, latest);
    content.append(controls);

    const albums = visibleAlbums().filter((album) => album.date && monthKey(album.date) === state.calendarMonth);
    const dayGroups = new Map();
    albums.forEach((album) => {
      const key = dateKey(album.date);
      if (!dayGroups.has(key)) dayGroups.set(key, []);
      dayGroups.get(key).push(album);
    });

    const metrics = document.createElement('div');
    metrics.className = 'albums-extra-metrics';
    const runtime = albums.reduce((sum, album) => sum + album.minutes, 0);
    [
      ['Albums logged', albums.length.toLocaleString('en-US')],
      ['Album days', dayGroups.size.toLocaleString('en-US')],
      ['Album runtime', formatRuntime(runtime)],
    ].forEach(([labelText, value]) => {
      const item = document.createElement('div');
      const label = document.createElement('span');
      const strong = document.createElement('strong');
      label.textContent = labelText;
      strong.textContent = value;
      item.append(label, strong);
      metrics.append(item);
    });
    content.append(metrics);

    const weekdays = document.createElement('div');
    weekdays.className = 'albums-calendar-weekdays';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach((day) => {
      const span = document.createElement('span');
      span.textContent = day;
      weekdays.append(span);
    });
    content.append(weekdays);

    const calendar = document.createElement('div');
    calendar.className = 'albums-calendar-grid';
    calendar.setAttribute('role', 'grid');
    calendar.setAttribute('aria-label', `${formatMonth(state.calendarMonth)} album calendar`);

    const [year, month] = state.calendarMonth.split('-').map(Number);
    const first = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const leading = first.getUTCDay();
    const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7;

    for (let cellIndex = 0; cellIndex < totalCells; cellIndex += 1) {
      const dayNumber = cellIndex - leading + 1;
      const cell = document.createElement('div');
      cell.className = 'albums-calendar-day';
      cell.setAttribute('role', 'gridcell');

      if (dayNumber < 1 || dayNumber > daysInMonth) {
        cell.classList.add('is-outside');
        calendar.append(cell);
        continue;
      }

      const date = new Date(Date.UTC(year, month - 1, dayNumber));
      renderCalendarDay(cell, date, dayGroups.get(dateKey(date)) || []);
      calendar.append(cell);
    }
    content.append(calendar);

    const shelf = document.createElement('section');
    shelf.className = 'albums-calendar-month-shelf';
    const shelfHeading = document.createElement('div');
    shelfHeading.className = 'albums-calendar-month-heading';
    const shelfTitle = document.createElement('h3');
    const shelfSummary = document.createElement('p');
    shelfTitle.textContent = formatMonth(state.calendarMonth);
    shelfSummary.textContent = `${albums.length.toLocaleString('en-US')} ${albums.length === 1 ? 'album' : 'albums'} · ${formatRuntime(runtime)} of album runtime`;
    shelfHeading.append(shelfTitle, shelfSummary);

    const shelfGrid = document.createElement('div');
    shelfGrid.className = 'albums-calendar-month-grid';
    albums
      .slice()
      .sort((a, b) => a.date - b.date || a.originalIndex - b.originalIndex)
      .forEach((album) => shelfGrid.append(makeQuiltTile(album, {
        className: 'albums-quilt-tile albums-calendar-month-tile',
        date: true,
      })));

    if (!albums.length) {
      const empty = document.createElement('p');
      empty.className = 'albums-extra-empty';
      empty.textContent = 'No albums match the current filters in this month.';
      shelfGrid.append(empty);
    }

    shelf.append(shelfHeading, shelfGrid);
    content.append(shelf);

    const move = (delta) => {
      const index = state.calendarKeys.indexOf(state.calendarMonth);
      const nextIndex = Math.max(0, Math.min(state.calendarKeys.length - 1, index + delta));
      state.calendarMonth = state.calendarKeys[nextIndex];
      persistCalendarMonth();
      renderCalendar();
    };

    prev.disabled = state.calendarKeys.indexOf(state.calendarMonth) <= 0;
    next.disabled = state.calendarKeys.indexOf(state.calendarMonth) >= state.calendarKeys.length - 1;
    prev.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    latest.addEventListener('click', () => {
      const latestVisible = visibleAlbums().filter((album) => album.date).sort((a, b) => b.date - a.date)[0];
      state.calendarMonth = latestVisible ? monthKey(latestVisible.date) : state.calendarKeys[state.calendarKeys.length - 1];
      persistCalendarMonth();
      renderCalendar();
    });
    select.addEventListener('change', () => {
      state.calendarMonth = select.value;
      persistCalendarMonth();
      renderCalendar();
    });
  }

  function artistGroups(albums) {
    const groups = new Map();
    albums.forEach((album) => {
      const artist = album.artist || 'Artist not recorded';
      const key = normalize(artist) || 'artist-not-recorded';
      if (!groups.has(key)) groups.set(key, { artist, albums: [] });
      groups.get(key).albums.push(album);
    });

    return Array.from(groups.values()).map((group) => {
      const dated = group.albums.filter((album) => album.date).sort((a, b) => a.date - b.date);
      const styles = Array.from(new Set(group.albums.map((album) => album.style).filter(Boolean)));
      const countries = Array.from(new Set(group.albums.map((album) => album.country).filter(Boolean)));
      return {
        ...group,
        runtime: group.albums.reduce((sum, album) => sum + album.minutes, 0),
        first: dated[0]?.date || null,
        latest: dated[dated.length - 1]?.date || null,
        styles,
        countries,
      };
    }).sort((a, b) => b.albums.length - a.albums.length || collator.compare(a.artist, b.artist));
  }

  function renderArtists() {
    const content = viewShell(
      'Artist explorer',
      'The artists behind the archive',
      'Artists and groups stay exactly as recorded. Open an artist to explore that part of the archive.',
      'albums-artists-view',
    );
    const albums = visibleAlbums();
    const groups = artistGroups(albums);
    const totalRuntime = albums.reduce((sum, album) => sum + album.minutes, 0);

    const metrics = document.createElement('div');
    metrics.className = 'albums-extra-metrics albums-artists-metrics';
    [
      ['Artists / groups', groups.length.toLocaleString('en-US')],
      ['Albums represented', albums.length.toLocaleString('en-US')],
      ['Album runtime', formatRuntime(totalRuntime)],
      ['Most explored', groups[0] ? `${groups[0].artist} · ${groups[0].albums.length}` : '—'],
    ].forEach(([labelText, value]) => {
      const item = document.createElement('div');
      const label = document.createElement('span');
      const strong = document.createElement('strong');
      label.textContent = labelText;
      strong.textContent = value;
      item.append(label, strong);
      metrics.append(item);
    });
    content.append(metrics);

    const list = document.createElement('div');
    list.className = 'albums-artists-grid';

    groups.forEach((group) => {
      const card = document.createElement('article');
      card.className = 'albums-artist-card';

      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'albums-artist-head';
      head.setAttribute('aria-expanded', 'false');

      const covers = document.createElement('span');
      covers.className = 'albums-artist-covers';
      group.albums.slice(0, 3).forEach((album, index) => {
        const image = document.createElement('img');
        image.src = album.cover;
        image.alt = '';
        image.loading = 'lazy';
        image.style.setProperty('--cover-index', String(index));
        covers.append(image);
      });

      const copy = document.createElement('span');
      copy.className = 'albums-artist-copy';
      const name = document.createElement('strong');
      name.textContent = group.artist;
      const summary = document.createElement('small');
      summary.textContent = `${group.albums.length} ${group.albums.length === 1 ? 'album' : 'albums'} · ${formatRuntime(group.runtime)}`;
      const metadata = document.createElement('small');
      metadata.className = 'albums-artist-meta';
      metadata.textContent = [
        group.first && group.latest ? `${formatShortDate(group.first)} → ${formatShortDate(group.latest)}` : '',
        group.styles.slice(0, 2).join(' · '),
        group.countries.slice(0, 2).join(' / '),
      ].filter(Boolean).join(' · ');
      const chevron = document.createElement('span');
      chevron.className = 'albums-artist-chevron';
      chevron.textContent = '⌄';
      copy.append(name, summary, metadata);
      head.append(covers, copy, chevron);

      const works = document.createElement('div');
      works.className = 'albums-artist-works';
      works.hidden = true;
      group.albums
        .slice()
        .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0) || a.originalIndex - b.originalIndex)
        .forEach((album) => works.append(makeQuiltTile(album, { className: 'albums-quilt-tile albums-artist-album' })));

      head.addEventListener('click', () => {
        const opening = works.hidden;
        list.querySelectorAll('.albums-artist-card').forEach((otherCard) => {
          if (otherCard === card) return;
          otherCard.classList.remove('is-open');
          const otherHead = otherCard.querySelector('.albums-artist-head');
          const otherWorks = otherCard.querySelector('.albums-artist-works');
          otherHead?.setAttribute('aria-expanded', 'false');
          if (otherWorks) otherWorks.hidden = true;
        });

        works.hidden = !opening;
        head.setAttribute('aria-expanded', String(opening));
        card.classList.toggle('is-open', opening);
      });

      card.append(head, works);
      list.append(card);
    });

    if (!groups.length) {
      const empty = document.createElement('p');
      empty.className = 'albums-extra-empty';
      empty.textContent = 'No artists match the current filters.';
      list.append(empty);
    }
    content.append(list);
  }

  function groupBy(albums, keyer) {
    const map = new Map();
    albums.forEach((album) => {
      const key = keyer(album);
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(album);
    });
    return map;
  }

  function biggestGroup(map) {
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length || collator.compare(String(a[0]), String(b[0])))[0] || null;
  }

  function makeRecordFeature(album) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'albums-record-feature';
    button.setAttribute('aria-label', `${album.title} — open album metadata`);

    const image = document.createElement('img');
    image.src = album.cover;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';

    const copy = document.createElement('span');
    const title = document.createElement('strong');
    const artist = document.createElement('small');
    title.textContent = album.title;
    artist.textContent = album.artist;
    copy.append(title, artist);

    button.append(image, copy);
    button.addEventListener('click', () => openAlbum(album, button));
    return button;
  }

  function recordCard(label, value, description, album = null) {
    const item = document.createElement('article');
    item.className = 'albums-record-card';
    const kicker = document.createElement('span');
    kicker.className = 'albums-record-kicker';
    kicker.textContent = label;
    const main = document.createElement('strong');
    main.className = 'albums-record-value';
    main.textContent = value;
    const text = document.createElement('p');
    text.textContent = description;
    item.append(kicker, main, text);
    if (album) item.append(makeRecordFeature(album));
    return item;
  }

  function renderRecords() {
    const content = viewShell(
      'Collection records',
      'Extremes, streaks, and milestones',
      'Large covers lead each record. Tap or click one to open the same LifeLoggerz album metadata card used throughout the page.',
      'albums-records-view',
    );
    const albums = visibleAlbums();

    if (!albums.length) {
      content.innerHTML = '<p class="albums-extra-empty">No albums match the current filters.</p>';
      return;
    }

    const records = document.createElement('div');
    records.className = 'albums-records-grid';

    const timed = albums.filter((album) => album.minutes > 0).sort((a, b) => a.minutes - b.minutes);
    if (timed.length) {
      records.append(recordCard('Longest album', formatRuntime(timed[timed.length - 1].minutes), timed[timed.length - 1].title, timed[timed.length - 1]));
      records.append(recordCard('Shortest album', formatRuntime(timed[0].minutes), timed[0].title, timed[0]));
    }

    const released = albums
      .filter((album) => album.releaseSort && (album.releasePrecision === 'year' || album.releasePrecision === 'decade'))
      .sort((a, b) => a.releaseSort - b.releaseSort);
    if (released.length) {
      records.append(recordCard('Oldest release', released[0].release || String(released[0].releaseSort), released[0].title, released[0]));
      records.append(recordCard('Newest release', released[released.length - 1].release || String(released[released.length - 1].releaseSort), released[released.length - 1].title, released[released.length - 1]));
    }

    const dated = albums.filter((album) => album.date).sort((a, b) => a.date - b.date || a.originalIndex - b.originalIndex);
    const byDay = groupBy(dated, (album) => dateKey(album.date));
    const busyDay = biggestGroup(byDay);
    if (busyDay) {
      records.append(recordCard(
        'Biggest album day',
        `${busyDay[1].length} albums`,
        `${formatShortDate(busyDay[1][0].date)} · ${formatRuntime(busyDay[1].reduce((sum, album) => sum + album.minutes, 0))} of album runtime`,
        busyDay[1][0],
      ));
    }

    const byMonth = groupBy(dated, (album) => monthKey(album.date));
    const busyMonth = biggestGroup(byMonth);
    if (busyMonth) {
      records.append(recordCard(
        'Biggest album month',
        `${busyMonth[1].length} albums`,
        `${formatMonth(busyMonth[0])} · ${formatRuntime(busyMonth[1].reduce((sum, album) => sum + album.minutes, 0))} of album runtime`,
        busyMonth[1][0],
      ));
    }

    let gap = null;
    for (let index = 1; index < dated.length; index += 1) {
      const days = Math.round((dated[index].date - dated[index - 1].date) / 86400000);
      if (!gap || days > gap.days) gap = { days, before: dated[index - 1], after: dated[index] };
    }
    if (gap) {
      records.append(recordCard(
        'Longest gap between album logs',
        `${gap.days.toLocaleString('en-US')} ${gap.days === 1 ? 'day' : 'days'}`,
        `${formatShortDate(gap.before.date)} → ${formatShortDate(gap.after.date)}`,
        gap.after,
      ));
    }

    const artists = artistGroups(albums);
    if (artists.length) {
      records.append(recordCard(
        'Artist marathon',
        `${artists[0].albums.length} albums`,
        `${artists[0].artist} · ${formatRuntime(artists[0].runtime)} of album runtime`,
        artists[0].albums[0],
      ));
    }

    content.append(records);

    if (dated.length) {
      const milestones = document.createElement('section');
      milestones.className = 'albums-milestones';
      const heading = document.createElement('div');
      heading.className = 'albums-record-section-heading';
      heading.innerHTML = '<h3>Milestone shelf</h3><p>Chronological checkpoints in this filtered listening history.</p>';
      const shelf = document.createElement('div');
      shelf.className = 'albums-milestone-grid';

      const numbers = [1, 50, 100, 200, 300, 400, 500].filter((number) => number <= dated.length);
      if (!numbers.includes(dated.length) && dated.length < 50) numbers.push(dated.length);

      Array.from(new Set(numbers)).forEach((number) => {
        const album = dated[number - 1];
        const item = document.createElement('article');
        item.className = 'albums-milestone-card';
        const badge = document.createElement('span');
        badge.textContent = `#${number}`;
        item.append(badge, makeQuiltTile(album, { className: 'albums-quilt-tile albums-milestone-album' }));
        shelf.append(item);
      });

      milestones.append(heading, shelf);
      content.append(milestones);
    }
  }

  function renderActive() {
    if (!state.activeView) return;
    if (state.activeView === 'calendar') renderCalendar();
    else if (state.activeView === 'artists') renderArtists();
    else if (state.activeView === 'records') renderRecords();
  }

  const refreshTargets = [
    document.querySelector('#album-search'),
    document.querySelector('#album-style-filter'),
    document.querySelector('#album-subgenre-filter'),
    document.querySelector('#album-mood-filter'),
    document.querySelector('#album-country-filter'),
    document.querySelector('#album-listened-year-filter'),
    document.querySelector('#album-release-filter'),
    document.querySelector('#album-sort'),
    document.querySelector('#albums-clear-filters'),
  ].filter(Boolean);

  refreshTargets.forEach((control) => {
    const eventName = control.matches('input[type="search"]') ? 'input' : control.tagName === 'SELECT' ? 'change' : 'click';
    control.addEventListener(eventName, () => {
      if (state.activeView) window.setTimeout(renderActive, 0);
    });
  });

  const handleCalendarViewport = () => {
    if (state.activeView === 'calendar') renderCalendar();
  };
  if (typeof phoneCalendarQuery.addEventListener === 'function') phoneCalendarQuery.addEventListener('change', handleCalendarViewport);
  else phoneCalendarQuery.addListener(handleCalendarViewport);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsExpansion(), { once: true });
} else {
  bootAlbumsExpansion();
}
