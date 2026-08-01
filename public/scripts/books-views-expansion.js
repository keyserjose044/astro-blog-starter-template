/* LifeLoggerz Books: Authors, Reading Insights, richer Timeline, and shared book details. */

const BOOKS_EXPANSION_RETRIES = 120;
const BOOKS_ACTIVITY_STORAGE_KEY = 'lifeloggerz-books-calendar-listening-activity';

function bootBooksExpansion(attempt = 0) {
  const grid = document.querySelector('#grid');
  const viewToggle = document.querySelector('#book-view-toggle');
  const explorer = document.querySelector('#books-explorer');
  const calendar = document.querySelector('#books-calendar-view');
  const preview = document.querySelector('.books-calendar-preview');
  const sheet = document.querySelector('.books-calendar-book-sheet');

  if ((!grid || !viewToggle || !explorer || !calendar || !preview || !sheet) && attempt < BOOKS_EXPANSION_RETRIES) {
    window.setTimeout(() => bootBooksExpansion(attempt + 1), 80);
    return;
  }
  if (!grid || !viewToggle || !explorer || !calendar || !preview || !sheet || document.body.dataset.booksExpansionReady) return;
  document.body.dataset.booksExpansionReady = 'true';

  const cards = Array.from(grid.querySelectorAll('.card'));
  const mapView = explorer.querySelector('#books-map-view');
  const timelineView = explorer.querySelector('#books-timeline-view');
  const explorerShell = explorer.querySelector('.books-explorer-shell');
  const timelineContent = explorer.querySelector('#books-timeline-content');
  const timelineMetrics = explorer.querySelector('#books-timeline-metrics');
  const timelineHelp = explorer.querySelector('#books-timeline-help');
  const monthSelect = calendar.querySelector('[data-calendar-month]');
  const monthBooksSection = document.querySelector('.books-calendar-month-books');
  const monthBooksGrid = monthBooksSection?.querySelector('[data-month-books-grid]');
  const mobileQuery = window.matchMedia('(max-width: 760px), (hover: none), (pointer: coarse)');
  const desktopPreviewQuery = window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');

  const state = {
    customView: '',
    previewTimer: 0,
    previewAnchor: null,
    activeBook: null,
    renderTimer: 0,
    timelineZoom: 'year',
    timelineYear: null,
    timelineMonth: null,
    patchingTimeline: false,
  };

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));

  const particles = new Set(['da', 'das', 'de', 'del', 'della', 'di', 'dos', 'du', 'la', 'le', 'van', 'von', 'y', 'e', 'of', 'the']);

  function titleCaseName(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const words = raw.split(/\s+/);
    return words.map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && index < words.length - 1 && particles.has(lower)) return lower;
      return word.split(/([-’'])/).map((piece) => {
        if (piece === '-' || piece === '’' || piece === "'") return piece;
        if (/^(?:[a-z]\.){2,}$/i.test(piece)) return piece.toUpperCase();
        if (/^[a-z]$/i.test(piece)) return piece.toUpperCase();
        return piece ? piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase() : piece;
      }).join('');
    }).join(' ');
  }

  function cleanTitle(value) {
    return String(value || '')
      .replace(/↗/g, '')
      .replace(/\s*\(?\s*opens in (?:a )?new tab\s*\)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

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

  function parseLengthMinutes(value) {
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

  function formatMonth(date) {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  function formatShortDate(date) {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  function monthKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function getBook(card) {
    const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
    const rawDate = String(card.dataset.dateFinished || parts[0] || '').trim();
    return {
      card,
      index: String(card.dataset.originalIndex || ''),
      href: card.getAttribute('href') || '#',
      title: cleanTitle(card.querySelector('.title')?.textContent || card.dataset.title || 'Untitled'),
      author: titleCaseName(card.dataset.author || parts[2] || ''),
      cover: card.querySelector('.thumb')?.getAttribute('src') || '',
      finishedDate: parseDate(rawDate),
      publicationYear: String(parts[3] || card.dataset.publicationYear || '').trim(),
      genre: String(card.dataset.genre || parts[4] || '').trim(),
      subgenre: String(card.dataset.subgenre || parts[5] || '').trim(),
      form: String(parts[6] || '').trim(),
      language: String(card.dataset.language || parts[7] || '').trim(),
      country: String(card.dataset.country || parts[8] || '').trim(),
      length: String(card.dataset.length || parts[9] || '').trim(),
      lengthMinutes: parseLengthMinutes(card.dataset.length || parts[9]),
    };
  }

  const allBooks = () => cards.map(getBook).filter((book) => book.finishedDate);
  const visibleBooks = () => cards
    .filter((card) => card.style.display !== 'none' && !card.hidden && !card.classList.contains('atlas-country-hidden'))
    .map(getBook)
    .filter((book) => book.finishedDate);

  function bookFromElement(element) {
    const card = element?.closest?.('.card');
    if (card) return getBook(card);
    const href = element?.closest?.('a')?.getAttribute('href') || element?.dataset?.bookHref || '';
    const index = element?.closest?.('[data-book-index]')?.dataset.bookIndex || '';
    return allBooks().find((book) => (index && book.index === index) || (href && book.href === href)) || null;
  }

  function detailRows(book) {
    return [
      ['Length', book.length],
      ['Published', book.publicationYear],
      ['Genre', book.genre],
      ['Subgenre', book.subgenre],
      ['Form', book.form],
      ['Language', book.language],
      ['Country', book.country],
    ].filter(([, value]) => value && !/^unknown$/i.test(value));
  }

  function fillPanel(root, prefix, book) {
    if (!root || !book) return;
    const title = root.querySelector(`[data-${prefix}-title]`);
    const author = root.querySelector(`[data-${prefix}-author]`);
    const date = root.querySelector(`[data-${prefix}-date]`);
    const image = root.querySelector(`[data-${prefix}-image]`);
    const details = root.querySelector(`[data-${prefix}-details]`);
    const link = root.querySelector(`[data-${prefix}-link]`);
    if (title) title.textContent = book.title;
    if (author) author.textContent = book.author || 'Author not recorded';
    if (date) date.textContent = book.finishedDate ? `Finished ${formatShortDate(book.finishedDate)}` : 'Book details';
    if (image) { image.src = book.cover; image.alt = book.title; }
    if (details) {
      details.replaceChildren();
      detailRows(book).forEach(([label, value]) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        details.append(dt, dd);
      });
    }
    if (link) { link.href = book.href; link.setAttribute('aria-label', `Open ${book.title} on Goodreads`); }
  }

  function positionPreview(anchor) {
    if (preview.hidden || !anchor?.isConnected) return;
    const anchorRect = anchor.getBoundingClientRect();
    const rect = preview.getBoundingClientRect();
    const margin = 14;
    const gap = 16;
    let side = 'right';
    let left = anchorRect.right + gap;
    if (left + rect.width > window.innerWidth - margin) {
      side = 'left';
      left = anchorRect.left - rect.width - gap;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
    let top = anchorRect.top + (anchorRect.height - rect.height) / 2;
    top = Math.max(margin, Math.min(top, window.innerHeight - rect.height - margin));
    preview.dataset.side = side;
    preview.style.left = `${Math.round(left)}px`;
    preview.style.top = `${Math.round(top)}px`;
  }

  function showPreview(book, anchor) {
    if (!desktopPreviewQuery.matches || !book) return;
    window.clearTimeout(state.previewTimer);
    state.activeBook = book;
    state.previewAnchor = anchor;
    fillPanel(preview, 'rich-preview', book);
    preview.hidden = false;
    requestAnimationFrame(() => {
      positionPreview(anchor);
      preview.classList.add('is-visible');
    });
  }

  function hidePreview(immediate = false) {
    window.clearTimeout(state.previewTimer);
    const hide = () => {
      preview.classList.remove('is-visible');
      window.setTimeout(() => {
        if (!preview.classList.contains('is-visible')) preview.hidden = true;
      }, 130);
      state.previewAnchor = null;
    };
    if (immediate) hide();
    else state.previewTimer = window.setTimeout(hide, 150);
  }

  function openSheet(book, trigger) {
    if (!book) return;
    state.activeBook = book;
    fillPanel(sheet, 'rich-sheet', book);
    sheet._booksExpansionTrigger = trigger;
    if (typeof sheet.showModal === 'function' && !sheet.open) sheet.showModal();
    else sheet.setAttribute('open', '');
  }

  preview.addEventListener('pointerenter', () => window.clearTimeout(state.previewTimer));
  preview.addEventListener('pointerleave', () => hidePreview(false));
  window.addEventListener('resize', () => { if (state.previewAnchor) positionPreview(state.previewAnchor); });
  window.addEventListener('scroll', () => { if (state.previewAnchor) positionPreview(state.previewAnchor); }, true);

  function bindInteractiveBook(element, book, options = {}) {
    if (!element || !book || element.dataset.sharedBookDetails) return;
    element.dataset.sharedBookDetails = 'true';
    element.dataset.bookIndex = book.index;
    element.addEventListener('pointerenter', () => showPreview(book, element));
    element.addEventListener('pointerleave', () => hidePreview(false));
    element.addEventListener('focus', () => showPreview(book, element));
    element.addEventListener('blur', () => hidePreview(false));
    element.addEventListener('click', (event) => {
      if (options.directTarget && event.target.closest(options.directTarget)) return;
      if (options.alwaysOpenSheet || mobileQuery.matches) {
        event.preventDefault();
        hidePreview(true);
        openSheet(book, element);
      }
    });
  }

  grid.addEventListener('pointerover', (event) => {
    if (grid.dataset.bookView !== 'quilt') return;
    const card = event.target.closest('.card');
    if (!card || card.contains(event.relatedTarget)) return;
    const book = getBook(card);
    showPreview(book, card);
  });
  grid.addEventListener('pointerout', (event) => {
    if (grid.dataset.bookView !== 'quilt') return;
    const card = event.target.closest('.card');
    if (card && !card.contains(event.relatedTarget)) hidePreview(false);
  });
  grid.addEventListener('focusin', (event) => {
    if (grid.dataset.bookView === 'quilt') showPreview(getBook(event.target.closest('.card')), event.target.closest('.card'));
  });
  grid.addEventListener('focusout', (event) => {
    if (grid.dataset.bookView === 'quilt') hidePreview(false);
  });
  grid.addEventListener('click', (event) => {
    if (grid.dataset.bookView !== 'quilt' || !mobileQuery.matches) return;
    const card = event.target.closest('.card');
    if (!card) return;
    event.preventDefault();
    hidePreview(true);
    openSheet(getBook(card), card);
  });

  function createViewButton(view, icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'view-button books-expansion-view-button';
    button.dataset.booksExpansionView = view;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<span aria-hidden="true">${icon}</span><span>${label}</span>`;
    return button;
  }

  const authorsButton = createViewButton('authors', '♟', 'Authors');
  const insightsButton = createViewButton('insights', '◫', 'Insights');
  viewToggle.append(authorsButton, insightsButton);

  const authorsView = document.createElement('div');
  authorsView.id = 'books-authors-view';
  authorsView.className = 'books-explorer-view books-expansion-view';
  authorsView.hidden = true;
  authorsView.innerHTML = `
    <div class="books-explorer-heading">
      <div class="books-explorer-heading-copy">
        <p class="books-explorer-eyebrow">Authors library</p>
        <h2 class="books-explorer-title">Who I have read the most</h2>
        <p class="books-explorer-description">An author-first view of the collection, modeled after the Artists view on the Art page. Expand a person to browse their books.</p>
      </div>
      <button type="button" class="books-explorer-close" data-close-books-expansion aria-label="Close authors view">×</button>
    </div>
    <div class="books-atlas-metrics" data-authors-metrics></div>
    <div data-authors-content></div>
  `;

  const insightsView = document.createElement('div');
  insightsView.id = 'books-insights-view';
  insightsView.className = 'books-explorer-view books-expansion-view';
  insightsView.hidden = true;
  insightsView.innerHTML = `
    <div class="books-explorer-heading">
      <div class="books-explorer-heading-copy">
        <p class="books-explorer-eyebrow">Reading insights</p>
        <h2 class="books-explorer-title">Patterns across the library</h2>
        <p class="books-explorer-description">Yearly volume, authors, genres, languages, origins, publication eras, and audiobook-length records. Every panel responds to the active Books filters.</p>
      </div>
      <button type="button" class="books-explorer-close" data-close-books-expansion aria-label="Close reading insights">×</button>
    </div>
    <div class="books-atlas-metrics" data-insights-metrics></div>
    <div class="books-insights-dashboard" data-insights-content></div>
  `;

  explorerShell.append(authorsView, insightsView);

  const worldBottom = createBottomCollection('world', 'World selection');
  const timelineBottom = createBottomCollection('timeline', 'Timeline selection');
  explorer.insertAdjacentElement('afterend', timelineBottom);
  explorer.insertAdjacentElement('afterend', worldBottom);

  function createBottomCollection(view, eyebrow) {
    const section = document.createElement('section');
    section.className = 'books-explorer-bottom-list';
    section.dataset.bottomFor = view;
    section.hidden = true;
    section.innerHTML = `
      <div class="books-explorer-bottom-heading">
        <div><p>${eyebrow}</p><h2 data-bottom-title></h2><span data-bottom-summary></span></div>
        <strong data-bottom-count></strong>
      </div>
      <div class="books-explorer-bottom-grid" data-bottom-grid></div>
      <p class="books-explorer-bottom-empty" data-bottom-empty></p>
    `;
    return section;
  }

  function setPressed(button) {
    viewToggle.querySelectorAll('.view-button').forEach((candidate) => {
      candidate.setAttribute('aria-pressed', candidate === button ? 'true' : 'false');
    });
  }

  function hideCustomViews() {
    state.customView = '';
    authorsView.hidden = true;
    insightsView.hidden = true;
    worldBottom.hidden = true;
    timelineBottom.hidden = true;
  }

  function showCustomView(view, button) {
    state.customView = view;
    calendar.hidden = true;
    document.body.classList.remove('books-calendar-open');
    explorer.hidden = false;
    grid.hidden = true;
    document.body.classList.add('books-explorer-open');
    mapView.hidden = true;
    timelineView.hidden = true;
    authorsView.hidden = view !== 'authors';
    insightsView.hidden = view !== 'insights';
    worldBottom.hidden = true;
    timelineBottom.hidden = true;
    setPressed(button);
    if (view === 'authors') renderAuthors();
    else renderInsights();
    explorer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  authorsButton.addEventListener('click', () => showCustomView('authors', authorsButton));
  insightsButton.addEventListener('click', () => showCustomView('insights', insightsButton));

  viewToggle.addEventListener('click', (event) => {
    const button = event.target.closest('.view-button');
    if (!button || button === authorsButton || button === insightsButton) return;
    hideCustomViews();
    window.setTimeout(renderExplorerBottomLists, 80);
  });

  authorsView.querySelector('[data-close-books-expansion]').addEventListener('click', () => viewToggle.querySelector('[data-book-view="list"]')?.click());
  insightsView.querySelector('[data-close-books-expansion]').addEventListener('click', () => viewToggle.querySelector('[data-book-view="list"]')?.click());

  function metric(label, value, note = '') {
    return `<div class="books-atlas-metric"><span class="books-atlas-metric-label">${escapeHtml(label)}</span><strong class="books-atlas-metric-value">${escapeHtml(value)}</strong>${note ? `<span class="books-atlas-metric-note">${escapeHtml(note)}</span>` : ''}</div>`;
  }

  function topCount(books, field) {
    const counts = new Map();
    books.forEach((book) => {
      const value = String(book[field] || '').trim();
      if (value) counts.set(value, (counts.get(value) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] || null;
  }

  function finishedRange(books) {
    const dates = books.map((book) => book.finishedDate).filter(Boolean).sort((a, b) => a - b);
    if (!dates.length) return '';
    const first = formatShortDate(dates[0]);
    const last = formatShortDate(dates.at(-1));
    return first === last ? first : `${first}–${last}`;
  }

  function renderAuthors() {
    const books = visibleBooks();
    const groups = new Map();
    books.forEach((book) => {
      const author = book.author || 'Author not recorded';
      const key = normalize(author) || 'unknown';
      if (!groups.has(key)) groups.set(key, { key, author, books: [] });
      groups.get(key).books.push(book);
    });
    const authors = [...groups.values()].sort((a, b) => b.books.length - a.books.length || a.author.localeCompare(b.author));
    const repeated = authors.filter((entry) => entry.books.length > 1);
    const repeatBooks = repeated.reduce((sum, entry) => sum + entry.books.length, 0);
    const totalLength = books.reduce((sum, book) => sum + book.lengthMinutes, 0);
    const most = authors[0];

    authorsView.querySelector('[data-authors-metrics]').innerHTML = [
      metric('Authors in view', authors.length.toLocaleString('en-US'), `${books.length.toLocaleString('en-US')} books after filters`),
      metric('Most read author', most?.author || '—', most ? `${most.books.length} books` : 'No author metadata'),
      metric('Repeat-author books', books.length ? `${Math.round((repeatBooks / books.length) * 100)}%` : '—', `${repeated.length} authors represented more than once`),
      metric('Completed-book length', formatDuration(totalLength), 'Sum of audiobook lengths in this view'),
    ].join('');

    const content = authorsView.querySelector('[data-authors-content]');
    if (!authors.length) {
      content.innerHTML = '<div class="books-timeline-empty">No authors match the current filters.</div>';
      return;
    }

    content.innerHTML = `<div class="books-authors-grid">${authors.map((entry) => {
      const representative = [...entry.books].sort((a, b) => b.finishedDate - a.finishedDate)[0];
      const genre = topCount(entry.books, 'genre');
      const length = entry.books.reduce((sum, book) => sum + book.lengthMinutes, 0);
      return `<details class="books-author-card" ${authors.length === 1 ? 'open' : ''}>
        <summary>
          <img src="${escapeHtml(representative.cover)}" alt="" loading="lazy">
          <div>
            <h3>${escapeHtml(entry.author)}</h3>
            <p>${entry.books.length} ${entry.books.length === 1 ? 'book' : 'books'} · ${escapeHtml(formatDuration(length))}</p>
            <p>${[genre?.[0], finishedRange(entry.books)].filter(Boolean).map(escapeHtml).join(' · ') || 'Additional metadata not recorded'}</p>
          </div>
        </summary>
        <div class="books-author-works">${entry.books
          .sort((a, b) => b.finishedDate - a.finishedDate)
          .slice(0, 16)
          .map((book) => `<button type="button" class="books-author-work" data-book-index="${escapeHtml(book.index)}" title="Open ${escapeHtml(book.title)} details"><img src="${escapeHtml(book.cover)}" alt="" loading="lazy"><span>${escapeHtml(book.title)}</span></button>`)
          .join('')}</div>
      </details>`;
    }).join('')}</div>`;

    content.querySelectorAll('.books-author-work').forEach((button) => {
      const book = allBooks().find((candidate) => candidate.index === button.dataset.bookIndex);
      if (!book) return;
      bindInteractiveBook(button, book, { alwaysOpenSheet: true });
    });
  }

  function countBy(books, field, splitter = false) {
    const counts = new Map();
    books.forEach((book) => {
      const raw = String(book[field] || '').trim();
      const values = splitter ? raw.split(/\s*(?:\/|;|\||\+)\s*|\s*,\s*/).filter(Boolean) : [raw];
      values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }

  function barRows(entries, maximum, limit = 10) {
    return entries.slice(0, limit).map(([label, value]) => `<div class="books-insight-bar-row"><span>${escapeHtml(label)}</span><strong>${Number(value).toLocaleString('en-US')}</strong><i><b style="width:${Math.max(5, (Number(value) / Math.max(1, maximum)) * 100)}%"></b></i></div>`).join('');
  }

  function publicationBucket(book) {
    const year = Number(book.publicationYear);
    if (!Number.isFinite(year)) return 'Unknown';
    if (year < 500) return 'Ancient';
    if (year <= 1400) return 'Medieval';
    const decade = Math.floor(year / 10) * 10;
    return `${decade}s`;
  }

  function renderInsights() {
    const books = visibleBooks();
    const authors = countBy(books, 'author');
    const genres = countBy(books, 'genre');
    const languages = countBy(books, 'language', true);
    const countries = countBy(books, 'country', true);
    const publication = new Map();
    books.forEach((book) => publication.set(publicationBucket(book), (publication.get(publicationBucket(book)) || 0) + 1));
    const publicationEntries = [...publication.entries()].sort((a, b) => {
      const parse = (label) => label === 'Ancient' ? -10000 : label === 'Medieval' ? 500 : label === 'Unknown' ? 100000 : Number(label.replace('s', ''));
      return parse(a[0]) - parse(b[0]);
    });
    const years = new Map();
    const activeMonths = new Set();
    books.forEach((book) => {
      if (!book.finishedDate) return;
      const year = book.finishedDate.getUTCFullYear();
      if (!years.has(year)) years.set(year, { count: 0, minutes: 0 });
      years.get(year).count += 1;
      years.get(year).minutes += book.lengthMinutes;
      activeMonths.add(monthKey(book.finishedDate));
    });
    const yearEntries = [...years.entries()].sort((a, b) => a[0] - b[0]);
    const longest = [...books].sort((a, b) => b.lengthMinutes - a.lengthMinutes).filter((book) => book.lengthMinutes > 0).slice(0, 5);
    const shortest = [...books].sort((a, b) => a.lengthMinutes - b.lengthMinutes).filter((book) => book.lengthMinutes > 0).slice(0, 5);
    const totalLength = books.reduce((sum, book) => sum + book.lengthMinutes, 0);
    const averagePerMonth = activeMonths.size ? books.length / activeMonths.size : 0;
    const topAuthor = authors[0];

    insightsView.querySelector('[data-insights-metrics]').innerHTML = [
      metric('Books in view', books.length.toLocaleString('en-US'), 'Responds to search and filters'),
      metric('Completed-book length', formatDuration(totalLength), 'Sum of audiobook lengths'),
      metric('Authors represented', authors.length.toLocaleString('en-US'), topAuthor ? `Most read: ${topAuthor[0]} (${topAuthor[1]})` : 'No author metadata'),
      metric('Average per active month', averagePerMonth ? averagePerMonth.toFixed(1) : '—', `${activeMonths.size} months containing a completion`),
    ].join('');

    const maxYear = Math.max(1, ...yearEntries.map(([, data]) => data.count));
    const maxGenre = Math.max(1, ...genres.map((entry) => entry[1]));
    const maxAuthor = Math.max(1, ...authors.map((entry) => entry[1]));
    const maxPublication = Math.max(1, ...publicationEntries.map((entry) => entry[1]));

    insightsView.querySelector('[data-insights-content]').innerHTML = `
      <section class="books-insight-panel books-insight-panel--wide"><div class="books-insight-heading"><div><p>Completions</p><h3>Books finished by year</h3></div><span>Count and completed-book length</span></div><div class="books-insight-years">${yearEntries.map(([year, data]) => `<div class="books-insight-year"><strong>${year}</strong><i><b style="height:${Math.max(8, (data.count / maxYear) * 100)}%"></b></i><span>${data.count} books</span><small>${escapeHtml(formatDuration(data.minutes))}</small></div>`).join('')}</div></section>
      <section class="books-insight-panel"><div class="books-insight-heading"><div><p>Subjects</p><h3>Top genres</h3></div></div><div class="books-insight-bars">${barRows(genres, maxGenre, 10)}</div></section>
      <section class="books-insight-panel"><div class="books-insight-heading"><div><p>People</p><h3>Most-read authors</h3></div></div><div class="books-insight-bars">${barRows(authors, maxAuthor, 10)}</div></section>
      <section class="books-insight-panel"><div class="books-insight-heading"><div><p>Publication history</p><h3>Works by era and decade</h3></div></div><div class="books-insight-bars">${barRows(publicationEntries, maxPublication, 12)}</div></section>
      <section class="books-insight-panel"><div class="books-insight-heading"><div><p>Language and origin</p><h3>Collection breadth</h3></div></div><div class="books-insight-split"><div><h4>Languages</h4>${barRows(languages, Math.max(1, ...languages.map((entry) => entry[1])), 8)}</div><div><h4>Countries</h4>${barRows(countries, Math.max(1, ...countries.map((entry) => entry[1])), 8)}</div></div></section>
      <section class="books-insight-panel books-insight-panel--wide"><div class="books-insight-heading"><div><p>Length records</p><h3>Longest and shortest audiobooks</h3></div></div><div class="books-insight-records"><div><h4>Longest</h4>${recordCards(longest)}</div><div><h4>Shortest</h4>${recordCards(shortest)}</div></div></section>
    `;

    insightsView.querySelectorAll('[data-book-index]').forEach((element) => {
      const book = allBooks().find((candidate) => candidate.index === element.dataset.bookIndex);
      if (book) bindInteractiveBook(element, book, { alwaysOpenSheet: true });
    });
  }

  function recordCards(books) {
    return books.map((book) => `<button type="button" class="books-insight-record" data-book-index="${escapeHtml(book.index)}"><img src="${escapeHtml(book.cover)}" alt="" loading="lazy"><span><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author)} · ${escapeHtml(formatDuration(book.lengthMinutes))}</small></span></button>`).join('') || '<p class="books-insight-empty">No length metadata available.</p>';
  }

  try {
    if (localStorage.getItem(BOOKS_ACTIVITY_STORAGE_KEY) === null) localStorage.setItem(BOOKS_ACTIVITY_STORAGE_KEY, 'true');
  } catch (_error) {}

  function enableActivityByDefault() {
    const toggle = calendar.querySelector('[data-rich-activity-toggle]');
    let stored = null;
    try { stored = localStorage.getItem(BOOKS_ACTIVITY_STORAGE_KEY); } catch (_error) {}
    if (stored === 'true' && toggle?.getAttribute('aria-pressed') !== 'true') toggle.click();
    const label = calendar.querySelector('.books-calendar-metrics span');
    const listeningLabel = Array.from(calendar.querySelectorAll('.books-calendar-metrics span')).find((item) => item.textContent.trim() === 'Listening time');
    if (listeningLabel) listeningLabel.textContent = 'Daily listening time';
    const status = calendar.querySelector('[data-rich-activity-status]');
    if (status && toggle?.getAttribute('aria-pressed') === 'true' && !/loading|unavailable|configured/i.test(status.textContent || '')) {
      status.textContent = 'Green strips show daily audiobook minutes; darker green means more listening.';
    }
    void label;
  }

  function comparisonPhrase(current, comparison, label) {
    const difference = current - comparison;
    if (difference === 0) return `same as ${label}`;
    return `${Math.abs(difference)} ${difference > 0 ? 'more' : 'fewer'} than ${label}`;
  }

  function enhanceMonthCollection() {
    if (!monthBooksSection || !monthBooksGrid || !monthSelect?.value) return;
    const selectedMatch = monthSelect.value.match(/^(\d{4})-(\d{2})$/);
    if (!selectedMatch) return;
    const selected = new Date(Date.UTC(Number(selectedMatch[1]), Number(selectedMatch[2]) - 1, 1));
    const books = visibleBooks().filter((book) => monthKey(book.finishedDate) === monthSelect.value);
    const previous = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() - 1, 1));
    const previousYear = new Date(Date.UTC(selected.getUTCFullYear() - 1, selected.getUTCMonth(), 1));
    const previousCount = visibleBooks().filter((book) => monthKey(book.finishedDate) === monthKey(previous)).length;
    const previousYearCount = visibleBooks().filter((book) => monthKey(book.finishedDate) === monthKey(previousYear)).length;
    const length = books.reduce((sum, book) => sum + book.lengthMinutes, 0);

    let summary = monthBooksSection.querySelector('.books-calendar-month-books-summary');
    if (!summary) {
      summary = document.createElement('p');
      summary.className = 'books-calendar-month-books-summary';
      monthBooksSection.querySelector('.books-calendar-month-books-heading > div')?.append(summary);
    }
    const previousLabel = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(previous);
    const sameMonthLastYear = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(previousYear);
    summary.textContent = `${books.length} ${books.length === 1 ? 'book' : 'books'} · ${formatDuration(length)} of completed-book length · ${comparisonPhrase(books.length, previousCount, previousLabel)} · ${comparisonPhrase(books.length, previousYearCount, sameMonthLastYear)}`;

    monthBooksGrid.querySelectorAll('.books-calendar-month-book').forEach((cardLink) => {
      const book = bookFromElement(cardLink);
      if (!book) return;
      const copy = cardLink.querySelector('.books-calendar-month-book-copy');
      if (copy && !copy.querySelector('.books-calendar-month-book-genre')) {
        const genre = document.createElement('span');
        genre.className = 'books-calendar-month-book-genre';
        genre.textContent = [book.genre, book.subgenre].filter(Boolean).join(' · ');
        if (genre.textContent) copy.append(genre);
      }
      const meta = copy?.querySelector('small');
      if (meta) meta.classList.add('books-calendar-month-book-date');
      bindInteractiveBook(cardLink, book, { alwaysOpenSheet: true, directTarget: '.books-calendar-month-book-arrow' });
    });
  }

  function enhanceCalendarDayTooltips() {
    if (!monthSelect?.value) return;
    const match = monthSelect.value.match(/^(\d{4})-(\d{2})$/);
    const calendarGrid = calendar.querySelector('[data-calendar-grid]');
    if (!match || !calendarGrid) return;
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    const start = new Date(Date.UTC(year, monthIndex, 1 - firstWeekday));
    Array.from(calendarGrid.children).forEach((cell, index) => {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      const count = Number(cell.dataset.bookCount || cell.querySelectorAll('.books-calendar-cover').length || 0);
      const strip = cell.querySelector('.books-calendar-activity-strip');
      const activity = strip?.title?.split('·').slice(1).join('·').trim() || 'Listening data unavailable';
      cell.title = `${formatShortDate(date)} · ${activity} · ${count ? `${count} ${count === 1 ? 'book' : 'books'} completed` : 'No book completed'}`;
    });
  }

  const calendarObserver = new MutationObserver(() => {
    window.clearTimeout(state.calendarTimer);
    state.calendarTimer = window.setTimeout(() => {
      enableActivityByDefault();
      enhanceMonthCollection();
      enhanceCalendarDayTooltips();
    }, 40);
  });
  calendarObserver.observe(calendar, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden'] });
  if (monthBooksSection) calendarObserver.observe(monthBooksSection, { childList: true, subtree: true });
  monthSelect?.addEventListener('change', () => window.setTimeout(() => { enhanceMonthCollection(); enhanceCalendarDayTooltips(); }, 90));

  function readingGroups() {
    const groups = new Map();
    visibleBooks().forEach((book) => {
      const year = book.finishedDate.getUTCFullYear();
      if (!groups.has(year)) groups.set(year, { year, books: [], months: new Map() });
      const group = groups.get(year);
      group.books.push(book);
      const month = book.finishedDate.getUTCMonth();
      if (!group.months.has(month)) group.months.set(month, []);
      group.months.get(month).push(book);
    });
    return [...groups.values()].sort((a, b) => a.year - b.year);
  }

  function ensureTimelineZoomControls() {
    const controls = timelineView?.querySelector('.books-timeline-controls');
    if (!controls || controls.querySelector('[data-reading-zoom]')) return;
    const group = document.createElement('div');
    group.className = 'books-timeline-zoom';
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', 'Reading timeline zoom');
    group.innerHTML = '<button type="button" data-reading-zoom="year" aria-pressed="true">Year overview</button><button type="button" data-reading-zoom="month" aria-pressed="false">Month detail</button>';
    controls.insertBefore(group, timelineHelp);
    group.addEventListener('click', (event) => {
      const button = event.target.closest('[data-reading-zoom]');
      if (!button) return;
      state.timelineZoom = button.dataset.readingZoom;
      group.querySelectorAll('button').forEach((candidate) => candidate.setAttribute('aria-pressed', candidate === button ? 'true' : 'false'));
      renderEnhancedTimeline();
    });
  }

  function cumulativeSvg(groups) {
    if (!groups.length) return '';
    let total = 0;
    const points = groups.map((group, index) => {
      total += group.books.length;
      return { x: groups.length === 1 ? 50 : 4 + (index / (groups.length - 1)) * 92, y: total, year: group.year };
    });
    const maximum = Math.max(1, ...points.map((point) => point.y));
    const polyline = points.map((point) => `${point.x},${92 - (point.y / maximum) * 78}`).join(' ');
    return `<div class="books-timeline-cumulative"><div><strong>Cumulative completions</strong><span>${total} books through ${groups.at(-1).year}</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Cumulative books completed by year"><polyline points="${polyline}"></polyline>${points.map((point) => `<circle cx="${point.x}" cy="${92 - (point.y / maximum) * 78}" r="1.7"><title>${point.year}: ${point.y} cumulative books</title></circle>`).join('')}</svg></div>`;
  }

  function renderEnhancedTimeline() {
    if (!timelineView || timelineView.hidden) return;
    const readingButton = timelineView.querySelector('[data-timeline-mode="reading"]');
    const isReading = readingButton?.getAttribute('aria-pressed') === 'true';
    ensureTimelineZoomControls();
    const zoom = timelineView.querySelector('.books-timeline-zoom');
    if (zoom) zoom.hidden = !isReading;
    if (!isReading) {
      renderTimelineBottom();
      return;
    }

    const groups = readingGroups();
    if (!groups.length) {
      timelineContent.innerHTML = '<div class="books-timeline-empty">No dated books match the current filters.</div>';
      timelineBottom.hidden = true;
      return;
    }
    if (!state.timelineYear || !groups.some((group) => group.year === state.timelineYear)) state.timelineYear = groups.at(-1).year;
    const selected = groups.find((group) => group.year === state.timelineYear);
    const total = groups.reduce((sum, group) => sum + group.books.length, 0);
    const busiest = [...groups].sort((a, b) => b.books.length - a.books.length)[0];
    if (timelineMetrics) timelineMetrics.innerHTML = [
      metric('Books in journey', total.toLocaleString('en-US'), 'After all active filters'),
      metric('Tracked years', groups.length.toLocaleString('en-US'), `${groups[0].year}–${groups.at(-1).year}`),
      metric('Busiest year', String(busiest.year), `${busiest.books.length} books`),
      metric('Selected year', String(selected.year), `${selected.books.length} books`),
    ].join('');

    if (state.timelineZoom === 'year') {
      timelineHelp.textContent = 'Select a year to open its month-level detail. The line shows cumulative completions.';
      timelineContent.innerHTML = `${cumulativeSvg(groups)}<div class="books-reading-years">${groups.map((group) => {
        const monthValues = Array.from({ length: 12 }, (_, month) => group.months.get(month)?.length || 0);
        const monthMax = Math.max(1, ...monthValues);
        return `<button type="button" class="books-reading-year ${group.year === state.timelineYear ? 'is-selected' : ''}" data-reading-year="${group.year}"><span><strong>${group.year}</strong><small>${group.books.length} books</small></span><div class="books-reading-year-covers">${group.books.slice(-4).map((book) => `<img src="${escapeHtml(book.cover)}" alt="" loading="lazy">`).join('')}</div><div class="books-reading-month-bars" aria-label="Monthly completion counts">${monthValues.map((value, month) => `<i style="height:${Math.max(6, (value / monthMax) * 100)}%"><title>${new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2020, month, 1)))}: ${value}</title></i>`).join('')}</div></button>`;
      }).join('')}</div>`;
      timelineContent.querySelectorAll('[data-reading-year]').forEach((button) => {
        button.addEventListener('click', () => {
          state.timelineYear = Number(button.dataset.readingYear);
          state.timelineZoom = 'month';
          timelineView.querySelectorAll('[data-reading-zoom]').forEach((candidate) => candidate.setAttribute('aria-pressed', candidate.dataset.readingZoom === 'month' ? 'true' : 'false'));
          renderEnhancedTimeline();
        });
      });
    } else {
      timelineHelp.textContent = 'Each month shows its completed books. Select a month to update the collection below.';
      timelineContent.innerHTML = `<div class="books-reading-detail-heading"><button type="button" data-timeline-year-prev aria-label="Previous tracked year">←</button><div><p>Month detail</p><h3>${selected.year}</h3><span>${selected.books.length} books completed</span></div><button type="button" data-timeline-year-next aria-label="Next tracked year">→</button></div><div class="books-reading-month-grid">${Array.from({ length: 12 }, (_, month) => {
        const monthBooks = selected.months.get(month) || [];
        const name = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(selected.year, month, 1)));
        return `<button type="button" class="books-reading-month ${state.timelineMonth === month ? 'is-selected' : ''}" data-reading-month="${month}" ${monthBooks.length ? '' : 'disabled'}><span><strong>${name}</strong><small>${monthBooks.length} ${monthBooks.length === 1 ? 'book' : 'books'}</small></span><div>${monthBooks.slice(0, 5).map((book) => `<img src="${escapeHtml(book.cover)}" alt="" loading="lazy">`).join('')}${monthBooks.length > 5 ? `<b>+${monthBooks.length - 5}</b>` : ''}</div></button>`;
      }).join('')}</div>`;
      const yearIndex = groups.findIndex((group) => group.year === selected.year);
      const previousButton = timelineContent.querySelector('[data-timeline-year-prev]');
      const nextButton = timelineContent.querySelector('[data-timeline-year-next]');
      previousButton.disabled = yearIndex <= 0;
      nextButton.disabled = yearIndex >= groups.length - 1;
      previousButton.addEventListener('click', () => { if (yearIndex > 0) { state.timelineYear = groups[yearIndex - 1].year; state.timelineMonth = null; renderEnhancedTimeline(); } });
      nextButton.addEventListener('click', () => { if (yearIndex < groups.length - 1) { state.timelineYear = groups[yearIndex + 1].year; state.timelineMonth = null; renderEnhancedTimeline(); } });
      timelineContent.querySelectorAll('[data-reading-month]').forEach((button) => {
        button.addEventListener('click', () => { state.timelineMonth = Number(button.dataset.readingMonth); renderEnhancedTimeline(); });
      });
    }
    renderTimelineBottom();
  }

  function renderBottomCards(section, title, books, summary, emptyText) {
    section.hidden = false;
    section.querySelector('[data-bottom-title]').textContent = title;
    section.querySelector('[data-bottom-count]').textContent = books.length ? `${books.length} ${books.length === 1 ? 'book' : 'books'}` : '';
    section.querySelector('[data-bottom-summary]').textContent = summary || '';
    const list = section.querySelector('[data-bottom-grid]');
    const empty = section.querySelector('[data-bottom-empty]');
    list.replaceChildren();
    empty.textContent = books.length ? '' : emptyText;
    empty.hidden = books.length !== 0;
    books.forEach((book) => {
      const item = document.createElement('article');
      item.className = 'books-explorer-bottom-book';
      item.dataset.bookIndex = book.index;
      item.innerHTML = `<button type="button" class="books-explorer-bottom-main"><img src="${escapeHtml(book.cover)}" alt="" loading="lazy"><span><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author)}</small><em>${escapeHtml([formatShortDate(book.finishedDate), book.genre, book.subgenre].filter(Boolean).join(' · '))}</em></span></button><a href="${escapeHtml(book.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(book.title)} on Goodreads">↗</a>`;
      const main = item.querySelector('button');
      bindInteractiveBook(main, book, { alwaysOpenSheet: true });
      list.append(item);
    });
  }

  function renderWorldBottom() {
    const worldButton = viewToggle.querySelector('[data-atlas-view="map"]');
    if (worldButton?.getAttribute('aria-pressed') !== 'true' || explorer.hidden) {
      worldBottom.hidden = true;
      return;
    }
    const selectedPath = explorer.querySelector('.books-map-country[data-selected="true"]');
    const books = visibleBooks();
    if (!selectedPath) {
      renderBottomCards(worldBottom, 'Select a country to view its books', [], '', 'Choose a country on the map or ranking. Its books will appear here with a comfortable gap beneath the atlas.');
      return;
    }
    const country = (selectedPath.getAttribute('aria-label') || '').split(':')[0] || 'Selected country';
    renderBottomCards(worldBottom, `Books from ${country}`, books, `${books.reduce((sum, book) => sum + book.lengthMinutes, 0) ? formatDuration(books.reduce((sum, book) => sum + book.lengthMinutes, 0)) : ''} of completed-book length`, 'No books match this country and the active filters.');
  }

  function renderTimelineBottom() {
    const timelineButton = viewToggle.querySelector('[data-atlas-view="timeline"]');
    if (timelineButton?.getAttribute('aria-pressed') !== 'true' || explorer.hidden) {
      timelineBottom.hidden = true;
      return;
    }
    const reading = timelineView.querySelector('[data-timeline-mode="reading"]')?.getAttribute('aria-pressed') === 'true';
    let books = visibleBooks();
    let title = 'Books in the current timeline view';
    if (reading && state.timelineYear) {
      books = books.filter((book) => book.finishedDate.getUTCFullYear() === state.timelineYear);
      title = `Books finished in ${state.timelineYear}`;
      if (state.timelineZoom === 'month' && state.timelineMonth != null) {
        books = books.filter((book) => book.finishedDate.getUTCMonth() === state.timelineMonth);
        const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(state.timelineYear, state.timelineMonth, 1)));
        title = `Books finished in ${monthName} ${state.timelineYear}`;
      }
    } else {
      const period = document.querySelector('#period-filter')?.selectedOptions?.[0]?.textContent;
      if (period && document.querySelector('#period-filter')?.value) title = `Books from ${period}`;
    }
    const length = books.reduce((sum, book) => sum + book.lengthMinutes, 0);
    renderBottomCards(timelineBottom, title, books, books.length ? `${formatDuration(length)} of completed-book length` : '', 'Select a year, month, or publication era to see its books here.');
  }

  function renderExplorerBottomLists() {
    renderWorldBottom();
    if (timelineView && !timelineView.hidden) renderEnhancedTimeline();
    else timelineBottom.hidden = true;
  }

  const timelineObserver = new MutationObserver(() => {
    if (state.patchingTimeline) return;
    window.clearTimeout(state.timelineTimer);
    state.timelineTimer = window.setTimeout(() => {
      state.patchingTimeline = true;
      try { renderEnhancedTimeline(); } finally { state.patchingTimeline = false; }
    }, 45);
  });
  if (timelineView) timelineObserver.observe(timelineView, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden'] });

  const explorerObserver = new MutationObserver(() => window.setTimeout(renderExplorerBottomLists, 50));
  explorerObserver.observe(explorer, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'data-selected', 'hidden'] });

  function scheduleRender(delay = 80) {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(() => {
      if (state.customView === 'authors') renderAuthors();
      if (state.customView === 'insights') renderInsights();
      enhanceMonthCollection();
      enhanceCalendarDayTooltips();
      renderExplorerBottomLists();
      window.setTimeout(() => {
        if (timelineView && !timelineView.hidden) renderEnhancedTimeline();
      }, 190);
    }, delay);
  }

  ['#q', '#genre-filter', '#year-filter', '#period-filter', '#language-filter', '#country-filter', '#clear-filters']
    .forEach((selector) => {
      const control = document.querySelector(selector);
      control?.addEventListener('input', () => scheduleRender(160));
      control?.addEventListener('change', () => scheduleRender(50));
      control?.addEventListener('click', () => scheduleRender(70));
    });

  const gridObserver = new MutationObserver(() => scheduleRender(90));
  gridObserver.observe(grid, { attributes: true, subtree: true, attributeFilter: ['style', 'class', 'data-book-view'] });

  try {
    localStorage.setItem('lifeloggerz-books-mobile-view', 'list');
    localStorage.setItem('lifeloggerz-books-desktop-view', 'list');
  } catch (_error) {}
  window.setTimeout(() => {
    const listButton = viewToggle.querySelector('[data-book-view="list"]');
    if (listButton && !viewToggle.querySelector('.view-button[aria-pressed="true"]:not([data-book-view="list"])')) listButton.click();
    else if (listButton && grid.dataset.bookView !== 'list' && !document.body.classList.contains('books-explorer-open') && !document.body.classList.contains('books-calendar-open')) listButton.click();
  }, 80);

  enableActivityByDefault();
  enhanceMonthCollection();
  enhanceCalendarDayTooltips();
  renderExplorerBottomLists();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksExpansion(), { once: true });
} else {
  bootBooksExpansion();
}
