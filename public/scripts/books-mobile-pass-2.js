/* Books mobile pass 2 — August 1, 2026. */

const BOOKS_MOBILE_PASS_2_RETRIES = 160;
const BOOKS_AUDIO_CACHE_PREFIX_V2 = 'lifeloggerz-books-calendar-audio-year:';
const BOOKS_AUDIO_CACHE_TTL_V2 = 30 * 60 * 1000;

function bootBooksMobilePass2(attempt = 0) {
  const grid = document.querySelector('#grid');
  const viewToggle = document.querySelector('#book-view-toggle');
  const toolbar = document.querySelector('.toolbar');
  const surprise = document.querySelector('.books-surprise');
  const explorer = document.querySelector('#books-explorer');
  const calendar = document.querySelector('#books-calendar-view');
  const authorsView = document.querySelector('#books-authors-view');
  const recordsView = document.querySelector('#books-insights-view');
  const authorsButton = viewToggle?.querySelector('[data-books-expansion-view="authors"]');
  const recordsButton = viewToggle?.querySelector('[data-books-expansion-view="records"]');
  const richSheet = document.querySelector('.books-calendar-book-sheet');

  const ready = grid && viewToggle && toolbar && surprise && explorer && calendar && authorsView && recordsView && authorsButton && recordsButton && richSheet;
  if (!ready && attempt < BOOKS_MOBILE_PASS_2_RETRIES) {
    window.setTimeout(() => bootBooksMobilePass2(attempt + 1), 80);
    return;
  }
  if (!ready || document.body.dataset.booksMobilePass2Ready) return;
  document.body.dataset.booksMobilePass2Ready = 'true';

  const mobileQuery = window.matchMedia('(max-width: 900px)');
  const cards = Array.from(grid.querySelectorAll('.card'));
  const toolbarPlaceholder = document.createComment('books-surprise-desktop-position');
  surprise.before(toolbarPlaceholder);

  let authorSignature = '';
  let recordsEnhanceTimer = 0;
  let recordsMode = 'time';
  let listeningPromise = null;
  let listeningRows = null;
  let listeningError = '';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  function parseDate(value) {
    const raw = String(value || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
    if (!raw) return null;
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
    if (numeric) {
      const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
      return new Date(Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2])));
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  }

  function parseMinutes(value) {
    const raw = String(value || '').toLowerCase().trim();
    if (!raw) return 0;
    const colon = raw.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
    if (colon) return Number(colon[1]) * 60 + Number(colon[2]) + (colon[3] ? Number(colon[3]) / 60 : 0);
    const hours = raw.match(/([\d.]+)\s*(?:h|hr|hrs|hour|hours)\b/);
    const minutes = raw.match(/([\d.]+)\s*(?:m|min|mins|minute|minutes)\b/);
    if (hours || minutes) return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
    const numeric = Number.parseFloat(raw.replace(/[^\d.]/g, ''));
    return Number.isFinite(numeric) ? numeric * 60 : 0;
  }

  function formatDuration(minutes) {
    const rounded = Math.round(Number(minutes || 0));
    const hours = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(date);
  }

  function formatMonth(key) {
    const [year, month] = String(key).split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1)));
  }

  function cleanTitle(value) {
    return String(value || '')
      .replace(/↗/g, '')
      .replace(/\s*\(?\s*opens in (?:a )?new tab\s*\)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cardInfo(card) {
    const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
    const rawDate = String(card.dataset.dateFinished || parts[0] || '').trim();
    return {
      card,
      index: String(card.dataset.originalIndex || ''),
      href: card.getAttribute('href') || '#',
      title: cleanTitle(card.querySelector('.title')?.textContent || card.dataset.title || 'Untitled'),
      author: String(card.dataset.author || parts[2] || 'Author not recorded').trim() || 'Author not recorded',
      cover: card.querySelector('.thumb')?.getAttribute('src') || '',
      finishedDate: parseDate(rawDate),
      rawDate,
      publicationYear: String(card.dataset.publicationYear || parts[3] || '').trim(),
      genre: String(card.dataset.genre || parts[4] || '').trim(),
      subgenre: String(card.dataset.subgenre || parts[5] || '').trim(),
      form: String(parts[6] || '').trim(),
      language: String(card.dataset.language || parts[7] || '').trim(),
      country: String(card.dataset.country || parts[8] || '').trim(),
      length: String(card.dataset.length || parts[9] || '').trim(),
      lengthMinutes: parseMinutes(card.dataset.length || parts[9]),
    };
  }

  const infoByCard = new Map(cards.map((card) => [card, cardInfo(card)]));
  const infoByIndex = new Map([...infoByCard.values()].map((book) => [book.index, book]));

  function visibleBooks() {
    return cards
      .filter((card) => card.style.display !== 'none' && !card.hidden && !card.classList.contains('atlas-country-hidden'))
      .map((card) => infoByCard.get(card));
  }

  function fillSheet(book, trigger) {
    if (!book) return;
    const setText = (selector, value) => {
      const node = richSheet.querySelector(selector);
      if (node) node.textContent = value;
    };
    const image = richSheet.querySelector('[data-rich-sheet-image]');
    if (image) {
      image.src = book.cover;
      image.alt = book.title;
    }
    setText('[data-rich-sheet-date]', book.finishedDate ? `Finished ${formatDate(book.finishedDate)}` : 'Book details');
    setText('[data-rich-sheet-title]', book.title);
    setText('[data-rich-sheet-author]', book.author || 'Author not recorded');
    const details = richSheet.querySelector('[data-rich-sheet-details]');
    if (details) {
      const rows = [
        ['Length', book.length],
        ['Published', book.publicationYear],
        ['Genre', [book.genre, book.subgenre].filter(Boolean).join(' · ')],
        ['Form', book.form],
        ['Language', book.language],
        ['Country', book.country],
      ].filter(([, value]) => value && !/^unknown$/i.test(value));
      details.replaceChildren();
      rows.forEach(([label, value]) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        details.append(dt, dd);
      });
    }
    const link = richSheet.querySelector('[data-rich-sheet-link]');
    if (link) {
      link.href = book.href;
      link.setAttribute('aria-label', `Open ${book.title} on Goodreads in a new tab`);
    }
    richSheet._booksMobilePass2Trigger = trigger;
    if (typeof richSheet.showModal === 'function' && !richSheet.open) richSheet.showModal();
    else richSheet.setAttribute('open', '');
  }

  function syncToolbarAndViews() {
    const trigger = surprise.querySelector('.books-surprise-trigger');
    const triggerLabel = trigger?.querySelector('span:nth-child(2)');
    const filters = toolbar.querySelector('#filters-toggle');
    const sort = toolbar.querySelector('#sort-books');
    const info = toolbar.querySelector('#info-toggle');
    const stats = toolbar.querySelector('a.info-toggle');

    if (mobileQuery.matches) {
      if (surprise.parentElement !== viewToggle) viewToggle.append(surprise);
      if (triggerLabel) triggerLabel.textContent = 'Random';

      toolbar.style.gridTemplateColumns = 'minmax(0,1fr) minmax(0,1.45fr) 44px 44px';
      [filters, sort, info, stats].forEach((item) => {
        if (!item) return;
        item.style.gridRow = '2';
      });
      if (filters) itemGrid(filters, '1');
      if (sort) itemGrid(sort, '2');
      if (info) itemGrid(info, '3');
      if (stats) itemGrid(stats, '4');
    } else {
      if (surprise.parentElement !== toolbar) toolbar.insertBefore(surprise, toolbarPlaceholder);
      if (triggerLabel) triggerLabel.textContent = 'Surprise me';
      toolbar.style.removeProperty('grid-template-columns');
      [filters, sort, info, stats].forEach((item) => {
        item?.style.removeProperty('grid-column');
        item?.style.removeProperty('grid-row');
      });
    }
  }

  function itemGrid(item, column) {
    item.style.gridColumn = column;
  }

  function cleanWorldCopy() {
    const mapView = explorer.querySelector('#books-map-view');
    const instruction = mapView?.querySelector('.books-map-footer > span:first-child');
    if (instruction && /click a colored country to filter the collection/i.test(instruction.textContent || '')) {
      instruction.remove();
    }
    const empty = document.querySelector('[data-bottom-for="world"] [data-bottom-empty]');
    if (empty && /comfortable gap beneath the atlas/i.test(empty.textContent || '')) {
      empty.textContent = 'Choose a country on the map or ranking.';
    }
  }

  function syncTimelineZoomProxy() {
    const timelineView = explorer.querySelector('#books-timeline-view');
    if (!timelineView) return;
    timelineView.querySelectorAll('.books-timeline-zoom-proxy').forEach((proxy, index) => {
      if (index > 0 || !mobileQuery.matches) proxy.remove();
    });
    if (!mobileQuery.matches) return;

    const readingActive = timelineView.querySelector('[data-timeline-mode="reading"]')?.getAttribute('aria-pressed') === 'true';
    const calendarPanel = timelineView.querySelector('.books-reading-calendar-panel');
    const original = timelineView.querySelector('.books-timeline-controls .books-timeline-zoom');
    if (!readingActive || !calendarPanel || !original) return;

    let proxy = timelineView.querySelector('.books-timeline-zoom-proxy');
    if (!proxy) {
      proxy = document.createElement('div');
      proxy.className = 'books-timeline-zoom-proxy';
      proxy.setAttribute('role', 'group');
      proxy.setAttribute('aria-label', 'Reading timeline detail');
      proxy.innerHTML = '<button type="button" data-zoom-proxy="year">Year overview</button><button type="button" data-zoom-proxy="month">Month detail</button>';
      proxy.addEventListener('click', (event) => {
        const button = event.target.closest('[data-zoom-proxy]');
        if (!button) return;
        original.querySelector(`[data-reading-zoom="${button.dataset.zoomProxy}"]`)?.click();
        window.setTimeout(syncTimelineZoomProxy, 30);
      });
      calendarPanel.insertAdjacentElement('afterend', proxy);
    }

    proxy.querySelectorAll('[data-zoom-proxy]').forEach((button) => {
      const source = original.querySelector(`[data-reading-zoom="${button.dataset.zoomProxy}"]`);
      button.setAttribute('aria-pressed', source?.getAttribute('aria-pressed') === 'true' ? 'true' : 'false');
    });
  }

  function authorMetric(label, value, note = '') {
    return `<div class="books-atlas-metric"><span class="books-atlas-metric-label">${escapeHtml(label)}</span><strong class="books-atlas-metric-value">${escapeHtml(value)}</strong>${note ? `<span class="books-atlas-metric-note">${escapeHtml(note)}</span>` : ''}</div>`;
  }

  function topGenre(books) {
    const counts = new Map();
    books.forEach((book) => {
      if (book.genre) counts.set(book.genre, (counts.get(book.genre) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '';
  }

  function finishedRange(books) {
    const dates = books.map((book) => book.finishedDate).filter(Boolean).sort((a, b) => a - b);
    if (!dates.length) return '';
    const first = formatDate(dates[0]);
    const last = formatDate(dates.at(-1));
    return first === last ? first : `${first}–${last}`;
  }

  function renderFastAuthors() {
    const books = visibleBooks();
    const signature = books.map((book) => book.index).join('|');
    if (signature === authorSignature && authorsView.dataset.fastAuthorsReady === 'true') return;
    authorSignature = signature;
    authorsView.dataset.fastAuthorsReady = 'true';

    const groups = new Map();
    books.forEach((book) => {
      const key = normalize(book.author) || 'author-not-recorded';
      if (!groups.has(key)) groups.set(key, { key, author: book.author, books: [] });
      groups.get(key).books.push(book);
    });
    const authors = [...groups.values()].sort((a, b) => b.books.length - a.books.length || a.author.localeCompare(b.author));
    const repeated = authors.filter((entry) => entry.books.length > 1);
    const repeatBooks = repeated.reduce((sum, entry) => sum + entry.books.length, 0);
    const totalMinutes = books.reduce((sum, book) => sum + book.lengthMinutes, 0);
    const most = authors[0];

    const metrics = authorsView.querySelector('[data-authors-metrics]');
    const content = authorsView.querySelector('[data-authors-content]');
    if (metrics) {
      metrics.innerHTML = [
        authorMetric('Authors in view', authors.length.toLocaleString('en-US'), `${books.length.toLocaleString('en-US')} books after filters`),
        authorMetric('Most read author', most?.author || '—', most ? `${most.books.length} books` : 'No author metadata'),
        authorMetric('Repeat-author books', books.length ? `${Math.round((repeatBooks / books.length) * 100)}%` : '—', `${repeated.length} authors represented more than once`),
        authorMetric('Completed-book length', formatDuration(totalMinutes), 'Sum of audiobook lengths in this view'),
      ].join('');
    }
    if (!content) return;
    if (!authors.length) {
      content.innerHTML = '<div class="books-timeline-empty">No authors match the current filters.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();
    const authorGrid = document.createElement('div');
    authorGrid.className = 'books-authors-grid';

    authors.forEach((entry) => {
      const representative = [...entry.books].sort((a, b) => (b.finishedDate?.getTime() || 0) - (a.finishedDate?.getTime() || 0))[0];
      const total = entry.books.reduce((sum, book) => sum + book.lengthMinutes, 0);
      const details = document.createElement('details');
      details.className = 'books-author-card';
      details.dataset.fastAuthor = entry.key;
      details.innerHTML = `
        <summary>
          <img src="${escapeHtml(representative?.cover || '')}" alt="" loading="lazy" decoding="async">
          <div>
            <h3>${escapeHtml(entry.author)}</h3>
            <p>${entry.books.length} ${entry.books.length === 1 ? 'book' : 'books'} · ${escapeHtml(formatDuration(total))}</p>
            <p>${escapeHtml([topGenre(entry.books), finishedRange(entry.books)].filter(Boolean).join(' · ') || 'Additional metadata not recorded')}</p>
          </div>
        </summary>
        <div class="books-author-works" data-fast-author-works></div>`;

      details.addEventListener('toggle', () => {
        if (!details.open) return;
        const works = details.querySelector('[data-fast-author-works]');
        if (!works || works.dataset.loaded === 'true') return;
        works.dataset.loaded = 'true';
        const ordered = [...entry.books].sort((a, b) => (b.finishedDate?.getTime() || 0) - (a.finishedDate?.getTime() || 0)).slice(0, 16);
        works.innerHTML = ordered.map((book) => `<button type="button" class="books-author-work" data-fast-author-book="${escapeHtml(book.index)}" title="Open ${escapeHtml(book.title)} details"><img src="${escapeHtml(book.cover)}" alt="" loading="lazy" decoding="async"><span>${escapeHtml(book.title)}</span></button>`).join('');
        works.querySelectorAll('[data-fast-author-book]').forEach((button) => {
          button.addEventListener('click', () => fillSheet(infoByIndex.get(button.dataset.fastAuthorBook), button));
        });
      });
      authorGrid.append(details);
    });

    fragment.append(authorGrid);
    content.replaceChildren(fragment);
  }

  function showFastAuthors(event) {
    if (!mobileQuery.matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    calendar.hidden = true;
    document.body.classList.remove('books-calendar-open');
    explorer.hidden = false;
    grid.hidden = true;
    document.body.classList.add('books-explorer-open');
    explorer.querySelectorAll('.books-explorer-view').forEach((candidate) => {
      candidate.hidden = candidate !== authorsView;
    });
    document.querySelectorAll('.books-explorer-bottom-list').forEach((section) => { section.hidden = true; });
    viewToggle.querySelectorAll('.view-button').forEach((button) => {
      button.setAttribute('aria-pressed', button === authorsButton ? 'true' : 'false');
    });
    renderFastAuthors();
    requestAnimationFrame(() => explorer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  function cachedListeningYear(year) {
    try {
      const cached = JSON.parse(localStorage.getItem(`${BOOKS_AUDIO_CACHE_PREFIX_V2}${year}`) || 'null');
      if (!cached || !Array.isArray(cached.records) || Date.now() - Number(cached.savedAt || 0) > BOOKS_AUDIO_CACHE_TTL_V2) return null;
      return cached.records;
    } catch (_error) {
      return null;
    }
  }

  async function fetchListeningYear(apiUrl, year) {
    const cached = cachedListeningYear(year);
    if (cached) return cached;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const url = new URL(apiUrl);
      url.searchParams.set('view', 'year');
      url.searchParams.set('year', String(year));
      const response = await fetch(url.toString(), { cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload)) throw new Error(payload?.message || payload?.error || 'Listening data could not be loaded.');
      try {
        localStorage.setItem(`${BOOKS_AUDIO_CACHE_PREFIX_V2}${year}`, JSON.stringify({ savedAt: Date.now(), records: payload }));
      } catch (_error) {}
      return payload;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function loadListeningRecords() {
    if (listeningPromise) return listeningPromise;
    const apiUrl = document.querySelector('meta[name="lifeloggerz-daily-data-api"]')?.content || '';
    if (!apiUrl) {
      listeningError = 'Public audiobook-minute data is not configured.';
      listeningPromise = Promise.resolve([]);
      return listeningPromise;
    }

    const years = [...new Set([...infoByCard.values()]
      .map((book) => book.finishedDate?.getUTCFullYear())
      .filter(Number.isFinite))].sort((a, b) => a - b);

    listeningPromise = Promise.all(years.map(async (year) => {
      try {
        return await fetchListeningYear(apiUrl, year);
      } catch (error) {
        console.warn(`Books Records could not load audiobook minutes for ${year}.`, error);
        return [];
      }
    })).then((yearPayloads) => {
      const rows = [];
      yearPayloads.flat().forEach((record) => {
        const date = String(record?.date || '');
        const minutes = record?.audiobook?.minutes;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || typeof minutes !== 'number' || !Number.isFinite(minutes)) return;
        rows.push({ date, minutes: Math.max(0, minutes) });
      });
      listeningRows = rows;
      if (!rows.length && !listeningError) listeningError = 'No public audiobook-minute records were available.';
      scheduleRecordsEnhancement(0);
      return rows;
    });
    return listeningPromise;
  }

  function rankingMarkup(entries, type) {
    const maximum = Math.max(1, ...entries.map((entry) => entry.minutes));
    return entries.map((entry, index) => {
      const label = type === 'day'
        ? formatDate(new Date(`${entry.key}T00:00:00Z`))
        : formatMonth(entry.key);
      return `<article class="books-record-time-rank"><b>#${index + 1}</b><span><strong>${escapeHtml(label)}</strong><small>${type === 'day' ? 'Audiobook listening that day' : 'Audiobook listening that month'}</small></span><em>${escapeHtml(formatDuration(entry.minutes))}</em><i><span style="width:${Math.max(5, (entry.minutes / maximum) * 100)}%"></span></i></article>`;
    }).join('');
  }

  function renderListeningRanks(timeColumns) {
    if (!timeColumns) return;
    if (!listeningRows) {
      timeColumns.innerHTML = '<p class="books-record-time-status">Loading public audiobook listening time…</p>';
      void loadListeningRecords();
      return;
    }
    if (listeningError && !listeningRows.length) {
      timeColumns.innerHTML = `<p class="books-record-time-status">${escapeHtml(listeningError)}</p>`;
      return;
    }

    const selectedYear = document.querySelector('#year-filter')?.value || '';
    const rows = selectedYear ? listeningRows.filter((row) => row.date.startsWith(`${selectedYear}-`)) : listeningRows;
    const days = rows.filter((row) => row.minutes > 0)
      .map((row) => ({ key: row.date, minutes: row.minutes }))
      .sort((a, b) => b.minutes - a.minutes || b.key.localeCompare(a.key))
      .slice(0, 5);
    const months = new Map();
    rows.forEach((row) => {
      if (row.minutes <= 0) return;
      const key = row.date.slice(0, 7);
      months.set(key, (months.get(key) || 0) + row.minutes);
    });
    const monthRanks = [...months.entries()]
      .map(([key, minutes]) => ({ key, minutes }))
      .sort((a, b) => b.minutes - a.minutes || b.key.localeCompare(a.key))
      .slice(0, 5);

    if (!days.length && !monthRanks.length) {
      timeColumns.innerHTML = '<p class="books-record-time-status">No listening minutes are available for this reading-year selection.</p>';
      return;
    }

    timeColumns.innerHTML = `
      <div><h4>Biggest days</h4><div class="books-record-time-list">${rankingMarkup(days, 'day')}</div></div>
      <div><h4>Biggest months</h4><div class="books-record-time-list">${rankingMarkup(monthRanks, 'month')}</div></div>`;
  }

  function setRecordsMode(panel, mode) {
    recordsMode = mode;
    const booksColumns = panel.querySelector('.books-record-burst-columns--books');
    const timeColumns = panel.querySelector('.books-record-burst-columns--time');
    panel.querySelectorAll('[data-record-burst-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.recordBurstMode === mode ? 'true' : 'false');
    });
    if (booksColumns) booksColumns.hidden = mode !== 'books';
    if (timeColumns) {
      timeColumns.hidden = mode !== 'time';
      if (mode === 'time') renderListeningRanks(timeColumns);
    }
  }

  function enhanceRecords() {
    const content = recordsView.querySelector('[data-insights-content]');
    const panel = content?.querySelector('.books-record-panel--bursts');
    if (!panel) return;

    let booksColumns = panel.querySelector('.books-record-burst-columns');
    if (!booksColumns) return;
    if (!booksColumns.classList.contains('books-record-burst-columns--books')) {
      booksColumns.classList.add('books-record-burst-columns--books');
    }

    let switcher = panel.querySelector('.books-record-burst-switch');
    if (!switcher) {
      switcher = document.createElement('div');
      switcher.className = 'books-record-burst-switch';
      switcher.setAttribute('role', 'group');
      switcher.setAttribute('aria-label', 'Rank busiest days and months by');
      switcher.innerHTML = '<button type="button" data-record-burst-mode="time">Listening time</button><button type="button" data-record-burst-mode="books">Books finished</button>';
      panel.querySelector('.books-record-section-heading')?.insertAdjacentElement('afterend', switcher);
      switcher.addEventListener('click', (event) => {
        const button = event.target.closest('[data-record-burst-mode]');
        if (!button) return;
        setRecordsMode(panel, button.dataset.recordBurstMode);
      });
    }

    let timeColumns = panel.querySelector('.books-record-burst-columns--time');
    if (!timeColumns) {
      timeColumns = document.createElement('div');
      timeColumns.className = 'books-record-burst-columns books-record-burst-columns--time';
      booksColumns.insertAdjacentElement('afterend', timeColumns);
    }

    const headingNote = panel.querySelector('.books-record-section-heading > span');
    if (headingNote) headingNote.textContent = 'Switch between actual audiobook minutes and clustered finish counts';
    setRecordsMode(panel, recordsMode);
  }

  function scheduleRecordsEnhancement(delay = 30) {
    window.clearTimeout(recordsEnhanceTimer);
    recordsEnhanceTimer = window.setTimeout(enhanceRecords, delay);
  }

  authorsButton.addEventListener('click', showFastAuthors, true);

  ['#q', '#genre-filter', '#year-filter', '#period-filter', '#language-filter', '#country-filter', '#clear-filters']
    .forEach((selector) => {
      const control = document.querySelector(selector);
      if (!control) return;
      const markAuthorsDirty = () => { authorSignature = ''; };
      control.addEventListener('input', markAuthorsDirty);
      control.addEventListener('change', () => {
        markAuthorsDirty();
        scheduleRecordsEnhancement(120);
      });
      control.addEventListener('click', () => scheduleRecordsEnhancement(140));
    });

  const timelineView = explorer.querySelector('#books-timeline-view');
  if (timelineView) {
    timelineView.addEventListener('click', () => window.setTimeout(syncTimelineZoomProxy, 60));
    new MutationObserver(() => window.setTimeout(syncTimelineZoomProxy, 0))
      .observe(timelineView.querySelector('#books-timeline-content') || timelineView, { childList: true, subtree: true });
  }

  const worldBottom = document.querySelector('[data-bottom-for="world"]');
  const mapView = explorer.querySelector('#books-map-view');
  if (worldBottom || mapView) {
    const worldObserver = new MutationObserver(cleanWorldCopy);
    if (worldBottom) worldObserver.observe(worldBottom, { childList: true, subtree: true, characterData: true });
    if (mapView) worldObserver.observe(mapView, { childList: true, subtree: true });
  }

  const recordsContent = recordsView.querySelector('[data-insights-content]');
  if (recordsContent) {
    new MutationObserver(() => scheduleRecordsEnhancement(0)).observe(recordsContent, { childList: true, subtree: false });
  }
  recordsButton.addEventListener('click', () => scheduleRecordsEnhancement(80));

  const syncViewport = () => {
    syncToolbarAndViews();
    cleanWorldCopy();
    syncTimelineZoomProxy();
    if (!mobileQuery.matches) authorSignature = '';
  };
  if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', syncViewport);
  else mobileQuery.addListener(syncViewport);

  cleanWorldCopy();
  syncToolbarAndViews();
  syncTimelineZoomProxy();
  scheduleRecordsEnhancement(100);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksMobilePass2(), { once: true });
} else {
  bootBooksMobilePass2();
}
