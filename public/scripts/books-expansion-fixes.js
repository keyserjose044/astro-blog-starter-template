/* Follow-up guards for the expanded public Books views. */
(() => {
  const RETRIES = 120;
  const ACTIVITY_KEY = 'lifeloggerz-books-calendar-listening-activity';

  function start(attempt = 0) {
    const grid = document.querySelector('#grid');
    const calendar = document.querySelector('#books-calendar-view');
    const monthSelect = calendar?.querySelector('[data-calendar-month]');
    const monthSection = document.querySelector('.books-calendar-month-books');
    const timelineView = document.querySelector('#books-timeline-view');
    const timelineBottom = document.querySelector('[data-bottom-for="timeline"]');
    const sheet = document.querySelector('.books-calendar-book-sheet');

    if ((!grid || !calendar || !monthSelect || !monthSection || !timelineView || !timelineBottom || !sheet) && attempt < RETRIES) {
      window.setTimeout(() => start(attempt + 1), 80);
      return;
    }
    if (!grid || !calendar || !monthSelect || !monthSection || !timelineView || !timelineBottom || !sheet || document.body.dataset.booksExpansionFixesReady) return;
    document.body.dataset.booksExpansionFixesReady = 'true';

    const cards = Array.from(grid.querySelectorAll('.card'));
    let refreshTimer = 0;

    const particles = new Set(['da', 'das', 'de', 'del', 'della', 'di', 'dos', 'du', 'la', 'le', 'van', 'von', 'y', 'e', 'of', 'the']);
    const titleCaseName = (value) => {
      const words = String(value || '').trim().split(/\s+/).filter(Boolean);
      return words.map((word, index) => {
        const lower = word.toLowerCase();
        if (index > 0 && index < words.length - 1 && particles.has(lower)) return lower;
        return word.split(/([-’'])/).map((piece) => {
          if (piece === '-' || piece === '’' || piece === "'") return piece;
          if (/^(?:[a-z]\.){2,}$/i.test(piece)) return piece.toUpperCase();
          return piece ? piece[0].toUpperCase() + piece.slice(1).toLowerCase() : piece;
        }).join('');
      }).join(' ');
    };

    const parseDate = (value) => {
      const raw = String(value || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
      const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
      if (numeric) {
        const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
        return new Date(Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2])));
      }
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
    };

    const parseMinutes = (value) => {
      const raw = String(value || '').toLowerCase().trim();
      const hours = raw.match(/([\d.]+)\s*(?:h|hr|hrs|hour|hours)\b/);
      const minutes = raw.match(/([\d.]+)\s*(?:m|min|mins|minute|minutes)\b/);
      if (hours || minutes) return (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
      return 0;
    };

    const formatDuration = (value) => {
      const rounded = Math.round(Number(value || 0));
      const hours = Math.floor(rounded / 60);
      const minutes = rounded % 60;
      if (!hours) return `${minutes} min`;
      return minutes ? `${hours.toLocaleString('en-US')} hr ${minutes} min` : `${hours.toLocaleString('en-US')} hr`;
    };

    const formatDate = (date) => new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(date);

    const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

    const bookFromCard = (card) => {
      const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
      return {
        card,
        href: card.getAttribute('href') || '#',
        title: card.querySelector('.title')?.textContent?.replace(/↗|\s*\(?opens in (?:a )?new tab\)?|\s*\(?opens? book details\)?/gi, '').trim() || 'Untitled',
        author: titleCaseName(card.dataset.author || parts[2] || ''),
        cover: card.querySelector('.thumb')?.getAttribute('src') || '',
        date: parseDate(card.dataset.dateFinished || parts[0]),
        year: String(parts[3] || card.dataset.publicationYear || '').trim(),
        genre: String(card.dataset.genre || parts[4] || '').trim(),
        subgenre: String(card.dataset.subgenre || parts[5] || '').trim(),
        form: String(parts[6] || '').trim(),
        language: String(card.dataset.language || parts[7] || '').trim(),
        country: String(card.dataset.country || parts[8] || '').trim(),
        length: String(card.dataset.length || parts[9] || '').trim(),
      };
    };

    const allBooks = () => cards.map(bookFromCard).filter((book) => book.date);
    const visibleBooks = () => cards
      .filter((card) => card.style.display !== 'none' && !card.hidden && !card.classList.contains('atlas-country-hidden'))
      .map(bookFromCard)
      .filter((book) => book.date);

    const fillSheet = (book) => {
      const set = (selector, value) => { const node = sheet.querySelector(selector); if (node) node.textContent = value; };
      const image = sheet.querySelector('[data-rich-sheet-image]');
      if (image) { image.src = book.cover; image.alt = book.title; }
      set('[data-rich-sheet-date]', `Finished ${formatDate(book.date)}`);
      set('[data-rich-sheet-title]', book.title);
      set('[data-rich-sheet-author]', book.author || 'Author not recorded');
      const details = sheet.querySelector('[data-rich-sheet-details]');
      if (details) {
        details.replaceChildren();
        [
          ['Length', book.length], ['Published', book.year], ['Genre', book.genre],
          ['Subgenre', book.subgenre], ['Form', book.form], ['Language', book.language], ['Country', book.country],
        ].filter(([, value]) => value && !/^unknown$/i.test(value)).forEach(([label, value]) => {
          const dt = document.createElement('dt');
          const dd = document.createElement('dd');
          dt.textContent = label;
          dd.textContent = value;
          details.append(dt, dd);
        });
      }
      const link = sheet.querySelector('[data-rich-sheet-link]');
      if (link) { link.href = book.href; link.setAttribute('aria-label', `Open ${book.title} on Goodreads`); }
    };

    const openSheet = (book, trigger) => {
      fillSheet(book);
      sheet._booksExpansionTrigger = trigger;
      if (typeof sheet.showModal === 'function' && !sheet.open) sheet.showModal();
      else sheet.setAttribute('open', '');
    };

    const enableActivity = () => {
      const toggle = calendar.querySelector('[data-rich-activity-toggle]');
      try {
        if (localStorage.getItem(ACTIVITY_KEY) === null) localStorage.setItem(ACTIVITY_KEY, 'true');
        if (localStorage.getItem(ACTIVITY_KEY) === 'true' && toggle?.getAttribute('aria-pressed') !== 'true') toggle.click();
      } catch (_error) {}
      const label = Array.from(calendar.querySelectorAll('.books-calendar-metrics span'))
        .find((node) => /^(?:Listening time|Daily listening time)$/.test(node.textContent.trim()));
      if (label) label.textContent = 'Daily listening time';
      const status = calendar.querySelector('[data-rich-activity-status]');
      const copy = 'Green strips show daily audiobook minutes; darker green means more listening.';
      if (status && toggle?.getAttribute('aria-pressed') === 'true' && !/loading|unavailable|configured/i.test(status.textContent || '')) status.textContent = copy;
    };

    const comparison = (current, other, label) => {
      const difference = current - other;
      if (!difference) return `same as ${label}`;
      return `${Math.abs(difference)} ${difference > 0 ? 'more' : 'fewer'} than ${label}`;
    };

    const enhanceMonth = () => {
      const gridNode = monthSection.querySelector('[data-month-books-grid]');
      const match = monthSelect.value.match(/^(\d{4})-(\d{2})$/);
      if (!gridNode || !match) return;
      const selected = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
      const previous = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() - 1, 1));
      const priorYear = new Date(Date.UTC(selected.getUTCFullYear() - 1, selected.getUTCMonth(), 1));
      const books = visibleBooks().filter((book) => monthKey(book.date) === monthSelect.value);
      const previousCount = visibleBooks().filter((book) => monthKey(book.date) === monthKey(previous)).length;
      const priorYearCount = visibleBooks().filter((book) => monthKey(book.date) === monthKey(priorYear)).length;
      const totalLength = books.reduce((sum, book) => sum + parseMinutes(book.length), 0);
      let summary = monthSection.querySelector('.books-calendar-month-books-summary');
      if (!summary) {
        summary = document.createElement('p');
        summary.className = 'books-calendar-month-books-summary';
        monthSection.querySelector('.books-calendar-month-books-heading > div')?.append(summary);
      }
      const previousName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(previous);
      const priorYearName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(priorYear);
      summary.textContent = `${books.length} ${books.length === 1 ? 'book' : 'books'} · ${formatDuration(totalLength)} of completed-book length · ${comparison(books.length, previousCount, previousName)} · ${comparison(books.length, priorYearCount, priorYearName)}`;

      gridNode.querySelectorAll('.books-calendar-month-book').forEach((item) => {
        const href = item.getAttribute('href') || '';
        const book = allBooks().find((candidate) => candidate.href === href || candidate.title === item.querySelector('img')?.alt);
        if (!book) return;
        const copy = item.querySelector('.books-calendar-month-book-copy');
        if (copy && !copy.querySelector('.books-calendar-month-book-genre')) {
          const genre = document.createElement('span');
          genre.className = 'books-calendar-month-book-genre';
          genre.textContent = [book.genre, book.subgenre].filter(Boolean).join(' · ');
          if (genre.textContent) copy.append(genre);
        }
        copy?.querySelector('small')?.classList.add('books-calendar-month-book-date');
        if (!item.dataset.monthDetailsBound) {
          item.dataset.monthDetailsBound = 'true';
          item.addEventListener('click', (event) => {
            if (event.target.closest('.books-calendar-month-book-arrow')) return;
            event.preventDefault();
            openSheet(book, item);
          });
        }
      });
    };

    const enhanceDays = () => {
      const match = monthSelect.value.match(/^(\d{4})-(\d{2})$/);
      const calendarGrid = calendar.querySelector('[data-calendar-grid]');
      if (!match || !calendarGrid) return;
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
      const start = new Date(Date.UTC(year, month, 1 - firstWeekday));
      Array.from(calendarGrid.children).forEach((cell, index) => {
        const date = new Date(start);
        date.setUTCDate(start.getUTCDate() + index);
        const books = cell.querySelectorAll('.books-calendar-cover').length;
        const activity = cell.querySelector('.books-calendar-activity-strip')?.title?.split('·').slice(1).join('·').trim() || 'Listening data unavailable';
        cell.title = `${formatDate(date)} · ${activity} · ${books ? `${books} ${books === 1 ? 'book' : 'books'} completed` : 'No book completed'}`;
      });
    };

    const stabilizePublicationBottom = () => {
      const timelineButton = document.querySelector('[data-atlas-view="timeline"]');
      const publicationButton = timelineView.querySelector('[data-timeline-mode="publication"]');
      const period = document.querySelector('#period-filter');
      if (timelineButton?.getAttribute('aria-pressed') !== 'true' || publicationButton?.getAttribute('aria-pressed') !== 'true' || period?.value) return;
      timelineBottom.querySelector('[data-bottom-title]').textContent = 'Select a publication era to view its books';
      timelineBottom.querySelector('[data-bottom-count]').textContent = '';
      timelineBottom.querySelector('[data-bottom-summary]').textContent = '';
      const list = timelineBottom.querySelector('[data-bottom-grid]');
      if (list.children.length) list.replaceChildren();
      const empty = timelineBottom.querySelector('[data-bottom-empty]');
      empty.textContent = 'Select a publication era above. Its books will appear here with a comfortable gap beneath the timeline.';
      empty.hidden = false;
    };

    const refresh = () => {
      enableActivity();
      enhanceMonth();
      enhanceDays();
      stabilizePublicationBottom();
    };

    /* Do not force Timeline mode buttons off/on to make downstream observers
       rerender. That old workaround caused the reading heatmap and zoom content
       to repeatedly tear down and rebuild while the user was scrolling. */
    const schedule = (delay = 60) => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(refresh, delay);
    };

    monthSelect.addEventListener('change', () => schedule(90));
    ['#q', '#genre-filter', '#year-filter', '#period-filter', '#language-filter', '#country-filter', '#clear-filters']
      .forEach((selector) => {
        const control = document.querySelector(selector);
        control?.addEventListener('input', () => schedule(160));
        control?.addEventListener('change', () => schedule(60));
        control?.addEventListener('click', () => schedule(80));
      });

    const observer = new MutationObserver(() => schedule(70));
    observer.observe(calendar, { attributes: true, subtree: true, attributeFilter: ['hidden', 'aria-pressed'] });
    observer.observe(monthSection, { childList: true, subtree: true });
    observer.observe(timelineBottom, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-timeline-mode], [data-reading-year], [data-reading-month], [data-country-rank-id], .books-map-country')) schedule(90);
    });

    refresh();
    window.setTimeout(refresh, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => start(), { once: true });
  else start();
})();
