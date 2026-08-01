/* Desktop Authors prewarm — August 1, 2026.
 * The original Authors renderer eagerly builds every nested work card on click.
 * This renderer prepares author summaries during idle time and only builds a
 * person's works when that author is expanded.
 */

const BOOKS_DESKTOP_AUTHORS_RETRIES = 160;

function bootBooksDesktopAuthorsFast(attempt = 0) {
  const grid = document.querySelector('#grid');
  const viewToggle = document.querySelector('#book-view-toggle');
  const explorer = document.querySelector('#books-explorer');
  const calendar = document.querySelector('#books-calendar-view');
  const authorsView = document.querySelector('#books-authors-view');
  const authorsButton = viewToggle?.querySelector('[data-books-expansion-view="authors"]');
  const sheet = document.querySelector('.books-calendar-book-sheet');

  const ready = grid && viewToggle && explorer && calendar && authorsView && authorsButton && sheet;
  if (!ready && attempt < BOOKS_DESKTOP_AUTHORS_RETRIES) {
    window.setTimeout(() => bootBooksDesktopAuthorsFast(attempt + 1), 80);
    return;
  }
  if (!ready || document.body.dataset.booksDesktopAuthorsFastReady) return;
  document.body.dataset.booksDesktopAuthorsFastReady = 'true';

  /* <=900px already uses the lightweight mobile Authors renderer. */
  const desktopQuery = window.matchMedia('(min-width: 901px) and (hover: hover) and (pointer: fine)');
  const cards = Array.from(grid.querySelectorAll('.card'));
  const particles = new Set(['da', 'das', 'de', 'del', 'della', 'di', 'dos', 'du', 'la', 'le', 'van', 'von', 'y', 'e', 'of', 'the']);
  let renderedSignature = '';

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

  function titleCaseName(value) {
    const words = String(value || '').trim().split(/\s+/).filter(Boolean);
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
    const hours = raw.match(/([\d.]+)\s*(?:h|hr|hrs|hour|hours)\b/);
    const minutes = raw.match(/([\d.]+)\s*(?:m|min|mins|minute|minutes)\b/);
    if (hours || minutes) return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
    return 0;
  }

  function formatDuration(minutes) {
    const rounded = Math.round(Number(minutes || 0));
    const hours = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
  }

  function formatDate(date) {
    return date ? new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(date) : '';
  }

  function cleanTitle(value) {
    return String(value || '')
      .replace(/↗/g, '')
      .replace(/\s*\(?\s*opens in (?:a )?new tab\s*\)?/gi, '')
      .replace(/\s*\(?\s*opens? book details\s*\)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cardInfo(card) {
    const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
    const noteAuthor = parts[2] || '';
    return {
      card,
      index: String(card.dataset.originalIndex || ''),
      href: card.getAttribute('href') || '#',
      title: cleanTitle(card.querySelector('.title')?.textContent || card.dataset.title || 'Untitled'),
      author: noteAuthor || titleCaseName(card.dataset.author || '') || 'Author not recorded',
      cover: card.querySelector('.thumb')?.getAttribute('src') || '',
      finishedDate: parseDate(card.dataset.dateFinished || parts[0]),
      publicationYear: String(parts[3] || card.dataset.publicationYear || '').trim(),
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
    const image = sheet.querySelector('[data-rich-sheet-image]');
    if (image) { image.src = book.cover; image.alt = book.title; }
    const setText = (selector, value) => {
      const node = sheet.querySelector(selector);
      if (node) node.textContent = value;
    };
    setText('[data-rich-sheet-date]', book.finishedDate ? `Finished ${formatDate(book.finishedDate)}` : 'Book details');
    setText('[data-rich-sheet-title]', book.title);
    setText('[data-rich-sheet-author]', book.author || 'Author not recorded');

    const details = sheet.querySelector('[data-rich-sheet-details]');
    if (details) {
      details.replaceChildren();
      [
        ['Length', book.length], ['Published', book.publicationYear],
        ['Genre', [book.genre, book.subgenre].filter(Boolean).join(' · ')],
        ['Form', book.form], ['Language', book.language], ['Country', book.country],
      ].filter(([, value]) => value && !/^unknown$/i.test(value)).forEach(([label, value]) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        details.append(dt, dd);
      });
    }

    const link = sheet.querySelector('[data-rich-sheet-link]');
    if (link) {
      link.href = book.href;
      link.setAttribute('aria-label', `Open ${book.title} on Goodreads in a new tab`);
    }
    sheet._booksDesktopAuthorsTrigger = trigger;
    if (typeof sheet.showModal === 'function' && !sheet.open) sheet.showModal();
    else sheet.setAttribute('open', '');
  }

  function metric(label, value, note = '') {
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

  function renderAuthors() {
    const books = visibleBooks();
    const signature = books.map((book) => book.index).join('|');
    const content = authorsView.querySelector('[data-authors-content]');
    if (signature === renderedSignature && content?.querySelector('.books-authors-grid')) return;
    renderedSignature = signature;

    const groups = new Map();
    books.forEach((book) => {
      const key = normalize(book.author) || 'author-not-recorded';
      if (!groups.has(key)) groups.set(key, { author: book.author, books: [] });
      groups.get(key).books.push(book);
    });
    const authors = [...groups.values()].sort((a, b) => b.books.length - a.books.length || a.author.localeCompare(b.author));
    const repeated = authors.filter((entry) => entry.books.length > 1);
    const repeatBooks = repeated.reduce((sum, entry) => sum + entry.books.length, 0);
    const totalMinutes = books.reduce((sum, book) => sum + book.lengthMinutes, 0);
    const most = authors[0];

    const metrics = authorsView.querySelector('[data-authors-metrics]');
    if (metrics) {
      metrics.innerHTML = [
        metric('Authors in view', authors.length.toLocaleString('en-US'), `${books.length.toLocaleString('en-US')} books after filters`),
        metric('Most read author', most?.author || '—', most ? `${most.books.length} books` : 'No author metadata'),
        metric('Repeat-author books', books.length ? `${Math.round((repeatBooks / books.length) * 100)}%` : '—', `${repeated.length} authors represented more than once`),
        metric('Completed-book length', formatDuration(totalMinutes), 'Sum of audiobook lengths in this view'),
      ].join('');
    }

    if (!content) return;
    if (!authors.length) {
      content.innerHTML = '<div class="books-timeline-empty">No authors match the current filters.</div>';
      return;
    }

    const authorGrid = document.createElement('div');
    authorGrid.className = 'books-authors-grid';

    authors.forEach((entry) => {
      const representative = [...entry.books].sort((a, b) => (b.finishedDate?.getTime() || 0) - (a.finishedDate?.getTime() || 0))[0];
      const total = entry.books.reduce((sum, book) => sum + book.lengthMinutes, 0);
      const details = document.createElement('details');
      details.className = 'books-author-card';
      details.innerHTML = `
        <summary>
          <img src="${escapeHtml(representative?.cover || '')}" alt="" loading="lazy" decoding="async">
          <div>
            <h3>${escapeHtml(entry.author)}</h3>
            <p>${entry.books.length} ${entry.books.length === 1 ? 'book' : 'books'} · ${escapeHtml(formatDuration(total))}</p>
            <p>${escapeHtml([topGenre(entry.books), finishedRange(entry.books)].filter(Boolean).join(' · ') || 'Additional metadata not recorded')}</p>
          </div>
        </summary>
        <div class="books-author-works" data-desktop-author-works></div>`;

      details.addEventListener('toggle', () => {
        if (!details.open) return;
        const works = details.querySelector('[data-desktop-author-works]');
        if (!works || works.dataset.loaded === 'true') return;
        works.dataset.loaded = 'true';
        const ordered = [...entry.books]
          .sort((a, b) => (b.finishedDate?.getTime() || 0) - (a.finishedDate?.getTime() || 0))
          .slice(0, 16);
        works.innerHTML = ordered.map((book) => `<button type="button" class="books-author-work" data-desktop-author-book="${escapeHtml(book.index)}" title="Open ${escapeHtml(book.title)} details"><img src="${escapeHtml(book.cover)}" alt="" loading="lazy" decoding="async"><span>${escapeHtml(book.title)}</span></button>`).join('');
        works.querySelectorAll('[data-desktop-author-book]').forEach((button) => {
          button.addEventListener('click', () => fillSheet(infoByIndex.get(button.dataset.desktopAuthorBook), button));
        });
      });
      authorGrid.append(details);
    });

    content.replaceChildren(authorGrid);
  }

  function showAuthors(event) {
    if (!desktopQuery.matches) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    calendar.hidden = true;
    document.body.classList.remove('books-calendar-open');
    explorer.hidden = false;
    grid.hidden = true;
    document.body.classList.add('books-explorer-open');
    explorer.querySelectorAll('.books-explorer-view').forEach((view) => {
      view.hidden = view !== authorsView;
    });
    document.querySelectorAll('.books-explorer-bottom-list').forEach((section) => { section.hidden = true; });
    viewToggle.querySelectorAll('.view-button').forEach((button) => {
      button.setAttribute('aria-pressed', button === authorsButton ? 'true' : 'false');
    });
    renderAuthors();
    requestAnimationFrame(() => explorer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  }

  authorsButton.addEventListener('click', showAuthors, true);

  const markDirty = () => { renderedSignature = ''; };
  document.querySelectorAll('#q,#genre-filter,#year-filter,#period-filter,#language-filter,#country-filter,#clear-filters')
    .forEach((control) => {
      control.addEventListener('input', markDirty);
      control.addEventListener('change', markDirty);
      control.addEventListener('click', markDirty);
    });

  const prewarm = () => {
    if (!desktopQuery.matches || !authorsView.hidden) return;
    renderAuthors();
  };
  if ('requestIdleCallback' in window) window.requestIdleCallback(prewarm, { timeout: 1200 });
  else window.setTimeout(prewarm, 260);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksDesktopAuthorsFast(), { once: true });
} else {
  bootBooksDesktopAuthorsFast();
}
