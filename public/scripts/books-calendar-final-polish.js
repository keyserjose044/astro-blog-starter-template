/* Final public Books calendar polish: metadata cleanup, annual context, and month-only books. */

const BOOKS_CALENDAR_FINAL_RETRIES = 100;
const BOOKS_CALENDAR_YEAR_CACHE_PREFIX = 'lifeloggerz-books-calendar-audio-year:';
const BOOKS_CALENDAR_YEAR_CACHE_TTL = 30 * 60 * 1000;

function bootBooksCalendarFinalPolish(attempt = 0) {
  const calendar = document.querySelector('#books-calendar-view');
  const grid = document.querySelector('#grid');
  const monthSelect = calendar?.querySelector('[data-calendar-month]');
  const summary = calendar?.querySelector('[data-calendar-rich-summary]');
  const preview = document.querySelector('.books-calendar-preview');
  const sheet = document.querySelector('.books-calendar-book-sheet');

  if ((!calendar || !grid || !monthSelect || !summary || !preview || !sheet) && attempt < BOOKS_CALENDAR_FINAL_RETRIES) {
    window.setTimeout(() => bootBooksCalendarFinalPolish(attempt + 1), 80);
    return;
  }
  if (!calendar || !grid || !monthSelect || !summary || !preview || !sheet || calendar.dataset.finalCalendarReady) return;
  calendar.dataset.finalCalendarReady = 'true';

  const cards = Array.from(grid.querySelectorAll('.card'));
  const dailyApiUrl = document.querySelector('meta[name="lifeloggerz-daily-data-api"]')?.content || '';
  const yearRequests = new Map();
  const state = {
    activeBook: null,
    renderTimer: 0,
    summaryGuard: false,
  };

  const cleanTitle = (value) => String(value || '')
    .replace(/↗/g, '')
    .replace(/\s*\(?\s*opens in (?:a )?new tab\s*\)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const nameParticles = new Set([
    'da', 'das', 'de', 'del', 'della', 'di', 'dos', 'du', 'la', 'le',
    'van', 'von', 'y', 'e', 'of', 'the',
  ]);

  function capitalizeNamePiece(piece) {
    if (!piece) return piece;
    if (/^(?:[a-z]\.){2,}$/i.test(piece)) return piece.toUpperCase();
    if (/^[a-z]$/i.test(piece)) return piece.toUpperCase();
    return piece.charAt(0).toUpperCase() + piece.slice(1).toLowerCase();
  }

  function titleCaseName(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const words = raw.split(/\s+/);
    return words.map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && index < words.length - 1 && nameParticles.has(lower)) return lower;
      return word.split(/([-’'])/).map((piece) => (
        piece === '-' || piece === '’' || piece === "'" ? piece : capitalizeNamePiece(piece)
      )).join('');
    }).join(' ');
  }

  const parseDate = (value) => {
    const raw = String(value || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
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
  };

  const monthKey = (date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const monthDate = (key) => {
    const match = String(key || '').match(/^(\d{4})-(\d{2})$/);
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : null;
  };
  const formatMonth = (key) => {
    const date = monthDate(key);
    return date ? new Intl.DateTimeFormat('en-US', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    }).format(date) : '';
  };
  const formatDate = (date) => new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
  const formatShortDate = (date) => new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
  const formatDuration = (minutes) => {
    const rounded = Math.round(Number(minutes || 0));
    const hours = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
  };

  function cardInfo(card) {
    const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
    const rawDate = String(card.dataset.dateFinished || parts[0] || '').trim();
    return {
      card,
      href: card.getAttribute('href') || '#',
      title: cleanTitle(card.querySelector('.title')?.textContent || card.dataset.title || 'Untitled'),
      author: titleCaseName(card.dataset.author || parts[2] || ''),
      cover: card.querySelector('.thumb')?.getAttribute('src') || '',
      finishedDate: parseDate(rawDate),
      rawDate,
      publicationYear: String(parts[3] || card.dataset.publicationYear || '').trim(),
      genre: String(card.dataset.genre || parts[4] || '').trim(),
      subgenre: String(card.dataset.subgenre || parts[5] || '').trim(),
      form: String(parts[6] || '').trim(),
      language: String(card.dataset.language || parts[7] || '').trim(),
      country: String(card.dataset.country || parts[8] || '').trim(),
      length: String(card.dataset.length || parts[9] || '').trim(),
    };
  }

  const allBooks = () => cards.map(cardInfo).filter((book) => book.finishedDate);
  const visibleBooks = () => cards
    .filter((card) => card.style.display !== 'none' && !card.hidden && !card.classList.contains('atlas-country-hidden'))
    .map(cardInfo)
    .filter((book) => book.finishedDate);

  function bookFromLink(link) {
    if (!link) return null;
    const href = link.getAttribute('href') || '';
    const alt = cleanTitle(link.querySelector('img')?.alt || '');
    return visibleBooks().find((book) => book.href === href)
      || allBooks().find((book) => book.href === href || book.title === alt)
      || null;
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

  function fillDetails(list, rows) {
    if (!list) return;
    list.replaceChildren();
    rows.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      list.append(dt, dd);
    });
  }

  function fillPanel(root, prefix, book) {
    if (!root || !book) return;
    const title = root.querySelector(`[data-${prefix}-title]`);
    const author = root.querySelector(`[data-${prefix}-author]`);
    const date = root.querySelector(`[data-${prefix}-date]`);
    const details = root.querySelector(`[data-${prefix}-details]`);
    const image = root.querySelector(`[data-${prefix}-image]`);
    const link = root.querySelector(`[data-${prefix}-link]`);
    if (title) title.textContent = book.title;
    if (author) author.textContent = book.author || 'Author not recorded';
    if (date) date.textContent = book.finishedDate ? `Finished ${formatShortDate(book.finishedDate)}` : 'Book details';
    if (image) {
      image.src = book.cover;
      image.alt = book.title;
    }
    fillDetails(details, detailRows(book));
    if (link) {
      link.href = book.href;
      link.setAttribute('aria-label', `Open ${book.title} on Goodreads`);
    }
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

  function polishActivePanels() {
    if (!state.activeBook) return;
    fillPanel(preview, 'rich-preview', state.activeBook);
    fillPanel(sheet, 'rich-sheet', state.activeBook);
    if (!preview.hidden) requestAnimationFrame(() => positionPreview(state.activeBook.anchor));
  }

  function setActiveBook(link) {
    const book = bookFromLink(link);
    if (!book) return;
    book.anchor = link;
    state.activeBook = book;
    window.setTimeout(polishActivePanels, 0);
  }

  calendar.addEventListener('pointerover', (event) => {
    const link = event.target.closest('.books-calendar-cover,.books-calendar-agenda-cover');
    if (link) setActiveBook(link);
  });
  calendar.addEventListener('focusin', (event) => {
    const link = event.target.closest('.books-calendar-cover,.books-calendar-agenda-cover');
    if (link) setActiveBook(link);
  });
  calendar.addEventListener('click', (event) => {
    const link = event.target.closest('.books-calendar-cover,.books-calendar-agenda-cover');
    if (link) setActiveBook(link);
  });

  const panelObserver = new MutationObserver(() => {
    if (!state.activeBook) return;
    window.clearTimeout(state.panelTimer);
    state.panelTimer = window.setTimeout(polishActivePanels, 0);
  });
  panelObserver.observe(preview, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
  panelObserver.observe(sheet, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['open'] });

  const monthSection = document.createElement('section');
  monthSection.className = 'books-calendar-month-books';
  monthSection.setAttribute('aria-labelledby', 'books-calendar-month-books-title');
  monthSection.innerHTML = `
    <div class="books-calendar-month-books-heading">
      <div>
        <p>Selected month</p>
        <h2 id="books-calendar-month-books-title"></h2>
      </div>
      <span data-month-books-count></span>
    </div>
    <div class="books-calendar-month-books-grid" data-month-books-grid></div>
    <p class="books-calendar-month-books-empty" data-month-books-empty hidden>No finished books match this month and the current filters.</p>
  `;
  calendar.querySelector('.books-calendar-shell')?.insertAdjacentElement('afterend', monthSection);

  function renderMonthBooks() {
    const selectedKey = monthSelect.value;
    const books = visibleBooks()
      .filter((book) => monthKey(book.finishedDate) === selectedKey)
      .sort((a, b) => a.finishedDate - b.finishedDate || a.title.localeCompare(b.title));
    const title = monthSection.querySelector('#books-calendar-month-books-title');
    const count = monthSection.querySelector('[data-month-books-count]');
    const list = monthSection.querySelector('[data-month-books-grid]');
    const empty = monthSection.querySelector('[data-month-books-empty]');
    title.textContent = `Books finished in ${formatMonth(selectedKey)}`;
    count.textContent = `${books.length.toLocaleString('en-US')} ${books.length === 1 ? 'book' : 'books'}`;
    list.replaceChildren();
    empty.hidden = books.length !== 0;

    books.forEach((book) => {
      const link = document.createElement('a');
      link.className = 'books-calendar-month-book';
      link.href = book.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `Open ${book.title} on Goodreads`);

      const image = document.createElement('img');
      image.src = book.cover;
      image.alt = book.title;
      image.loading = 'lazy';
      image.decoding = 'async';

      const copy = document.createElement('span');
      copy.className = 'books-calendar-month-book-copy';
      const name = document.createElement('strong');
      name.textContent = book.title;
      const author = document.createElement('span');
      author.textContent = book.author || 'Author not recorded';
      const meta = document.createElement('small');
      meta.textContent = [formatShortDate(book.finishedDate), book.length].filter(Boolean).join(' · ');
      copy.append(name, author, meta);

      const arrow = document.createElement('span');
      arrow.className = 'books-calendar-month-book-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      link.append(image, copy, arrow);
      list.append(link);
    });
  }

  function cachedYear(year) {
    try {
      const stored = JSON.parse(localStorage.getItem(`${BOOKS_CALENDAR_YEAR_CACHE_PREFIX}${year}`) || 'null');
      if (!stored || !Array.isArray(stored.records) || Date.now() - stored.savedAt > BOOKS_CALENDAR_YEAR_CACHE_TTL) return null;
      return stored.records;
    } catch (_error) {
      return null;
    }
  }

  async function getYearRecords(year) {
    const cached = cachedYear(year);
    if (cached) return cached;
    if (yearRequests.has(year)) return yearRequests.get(year);
    if (!dailyApiUrl) throw new Error('Public listening data is not configured.');
    const request = (async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        const url = new URL(dailyApiUrl);
        url.searchParams.set('view', 'year');
        url.searchParams.set('year', String(year));
        const response = await fetch(url.toString(), {
          cache: 'no-store', headers: { Accept: 'application/json' }, signal: controller.signal,
        });
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload)) throw new Error(payload?.message || payload?.error || 'Public listening data could not be loaded.');
        try {
          localStorage.setItem(`${BOOKS_CALENDAR_YEAR_CACHE_PREFIX}${year}`, JSON.stringify({ savedAt: Date.now(), records: payload }));
        } catch (_error) {}
        return payload;
      } finally {
        window.clearTimeout(timeout);
        yearRequests.delete(year);
      }
    })();
    yearRequests.set(year, request);
    return request;
  }

  async function renderAnnualSummary() {
    const selected = monthDate(monthSelect.value);
    if (!selected) return;
    const year = selected.getUTCFullYear();
    const currentYear = new Date().getFullYear();
    const books = allBooks().filter((book) => book.finishedDate.getUTCFullYear() === year);
    const lead = year === currentYear ? `${year} so far` : String(year);
    const loadingText = `${lead} · ${books.length.toLocaleString('en-US')} ${books.length === 1 ? 'book' : 'books'} finished · listening time loading…`;
    if (summary.textContent !== loadingText) summary.textContent = loadingText;

    try {
      const records = await getYearRecords(year);
      if (monthSelect.value.slice(0, 4) !== String(year)) return;
      const total = records.reduce((sum, record) => {
        const value = record?.audiobook?.minutes;
        return sum + (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0);
      }, 0);
      const text = `${lead} · ${books.length.toLocaleString('en-US')} ${books.length === 1 ? 'book' : 'books'} finished · ${formatDuration(total)} listened`;
      if (summary.textContent !== text) summary.textContent = text;
    } catch (_error) {
      const text = `${lead} · ${books.length.toLocaleString('en-US')} ${books.length === 1 ? 'book' : 'books'} finished · listening time unavailable`;
      if (summary.textContent !== text) summary.textContent = text;
    }
  }

  function updateActivityCopy() {
    const toggle = calendar.querySelector('[data-rich-activity-toggle]');
    const status = calendar.querySelector('[data-rich-activity-status]');
    if (!toggle || !status || toggle.getAttribute('aria-pressed') !== 'true') return;
    if (!/loading|unavailable|not configured/i.test(status.textContent || '')) {
      status.textContent = 'Colored strips show listening intensity; gray hatching means unavailable data.';
    }
  }

  function renderAll() {
    renderMonthBooks();
    void renderAnnualSummary();
    window.setTimeout(updateActivityCopy, 20);
    calendar.querySelectorAll('.books-calendar-cover,.books-calendar-agenda-cover').forEach((link) => {
      const book = bookFromLink(link);
      if (!book) return;
      link.title = book.title;
      link.setAttribute('aria-label', `Open ${book.title} on Goodreads`);
    });
  }

  function scheduleRender(delay = 35) {
    window.clearTimeout(state.renderTimer);
    state.renderTimer = window.setTimeout(renderAll, delay);
  }

  monthSelect.addEventListener('change', () => scheduleRender(30));
  document.querySelectorAll('#q,#genre-filter,#year-filter,#period-filter,#language-filter,#country-filter,#clear-filters')
    .forEach((control) => {
      control.addEventListener('input', () => scheduleRender(140));
      control.addEventListener('change', () => scheduleRender(35));
      control.addEventListener('click', () => scheduleRender(55));
    });

  const summaryObserver = new MutationObserver(() => {
    if (state.summaryGuard) return;
    state.summaryGuard = true;
    window.setTimeout(() => {
      state.summaryGuard = false;
      void renderAnnualSummary();
      updateActivityCopy();
    }, 0);
  });
  summaryObserver.observe(summary, { childList: true, subtree: true, characterData: true });

  const gridObserver = new MutationObserver(() => scheduleRender(55));
  gridObserver.observe(grid, {
    attributes: true, subtree: true, attributeFilter: ['style', 'hidden', 'class'],
  });

  calendar.querySelector('[data-rich-activity-toggle]')?.addEventListener('click', () => window.setTimeout(updateActivityCopy, 30));
  renderAll();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksCalendarFinalPolish(), { once: true });
} else {
  bootBooksCalendarFinalPolish();
}
