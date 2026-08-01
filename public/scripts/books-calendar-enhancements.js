/* Public Books calendar: rich previews, listening activity, and month continuity. */

const BOOKS_CALENDAR_ENHANCEMENT_RETRIES = 100;
const BOOKS_CALENDAR_ACTIVITY_KEY = 'lifeloggerz-books-calendar-listening-activity';
const BOOKS_CALENDAR_AUDIO_CACHE_PREFIX = 'lifeloggerz-books-calendar-audio-year:';
const BOOKS_CALENDAR_AUDIO_CACHE_TTL = 30 * 60 * 1000;
const BOOKS_CALENDAR_MAX_SPLAY = 6;

function bootBooksCalendarEnhancements(attempt = 0) {
  const calendar = document.querySelector('#books-calendar-view');
  const grid = document.querySelector('#grid');
  const calendarGrid = calendar?.querySelector('[data-calendar-grid]');
  const monthSelect = calendar?.querySelector('[data-calendar-month]');

  if ((!calendar || !grid || !calendarGrid || !monthSelect) && attempt < BOOKS_CALENDAR_ENHANCEMENT_RETRIES) {
    window.setTimeout(() => bootBooksCalendarEnhancements(attempt + 1), 80);
    return;
  }
  if (!calendar || !grid || !calendarGrid || !monthSelect || calendar.dataset.richCalendarReady) return;
  calendar.dataset.richCalendarReady = 'true';

  const cards = Array.from(grid.querySelectorAll('.card'));
  const dailyApiUrl = document.querySelector('meta[name="lifeloggerz-daily-data-api"]')?.content || '';
  const desktopPreviewQuery = window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
  const mobileSheetQuery = window.matchMedia('(max-width: 760px), (hover: none), (pointer: coarse)');
  const state = {
    activityEnabled: false,
    dailyByDate: new Map(),
    loadedYears: new Set(),
    loadingYears: new Map(),
    yearErrors: new Map(),
    previewAnchor: null,
    previewTimer: 0,
    lastSheetTrigger: null,
    patchTimer: 0,
    patching: false,
  };

  try {
    state.activityEnabled = localStorage.getItem(BOOKS_CALENDAR_ACTIVITY_KEY) === 'true';
  } catch (_error) {
    state.activityEnabled = false;
  }

  const parseDate = (value) => {
    const raw = String(value || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
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
  const dateKey = (date) => `${monthKey(date)}-${String(date.getUTCDate()).padStart(2, '0')}`;
  const monthDate = (key) => {
    const match = String(key || '').match(/^(\d{4})-(\d{2})$/);
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : null;
  };
  const formatMonth = (key) => {
    const date = monthDate(key);
    return date ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date) : '';
  };
  const formatDate = (date) => new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
  const formatShortDate = (date) => new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date);
  const formatDuration = (minutes) => {
    const rounded = Math.round(Number(minutes || 0));
    if (!rounded) return '0 min';
    const hours = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours.toLocaleString()} hr ${remainder} min` : `${hours.toLocaleString()} hr`;
  };

  function cardInfo(card) {
    const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
    const rawDate = String(card.dataset.dateFinished || parts[0] || '').trim();
    return {
      card,
      href: card.getAttribute('href') || '#',
      title: card.querySelector('.title')?.textContent?.replace('↗', '').trim() || card.dataset.title || 'Untitled',
      author: String(card.dataset.author || parts[2] || '').trim(),
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

  const visibleBooks = () => cards
    .filter((card) => card.style.display !== 'none' && !card.hidden && !card.classList.contains('atlas-country-hidden'))
    .map(cardInfo)
    .filter((book) => book.finishedDate);

  const bookByLink = (link) => {
    const href = link.getAttribute('href') || '';
    const imageAlt = link.querySelector('img')?.alt || '';
    return visibleBooks().find((book) => book.href === href)
      || cards.map(cardInfo).find((book) => book.href === href || book.title === imageAlt)
      || null;
  };

  const metrics = calendar.querySelector('.books-calendar-metrics');
  const completionDaysMetric = Array.from(metrics?.children || []).find((item) => (
    item.querySelector('span')?.textContent.trim() === 'Completion days'
  ));
  completionDaysMetric?.remove();

  const listeningMetric = Array.from(metrics?.children || []).find((item) => (
    item.querySelector('span')?.textContent.trim() === 'Listening time'
  ));
  const listeningMetricValue = listeningMetric?.querySelector('strong');

  const summary = document.createElement('p');
  summary.className = 'books-calendar-summary';
  summary.dataset.calendarRichSummary = '';
  metrics?.insertAdjacentElement('afterend', summary);

  const controls = calendar.querySelector('.books-calendar-controls');
  const activityRow = document.createElement('div');
  activityRow.className = 'books-calendar-activity-row';
  activityRow.innerHTML = `
    <button type="button" class="books-calendar-activity-toggle" data-rich-activity-toggle aria-pressed="false">
      <span aria-hidden="true">🎧</span><span>Listening activity</span><strong data-rich-activity-state>Off</strong>
    </button>
    <p class="books-calendar-activity-status" data-rich-activity-status aria-live="polite"></p>
  `;
  controls?.insertAdjacentElement('afterend', activityRow);

  const activityLegend = document.createElement('div');
  activityLegend.className = 'books-calendar-activity-legend';
  activityLegend.hidden = true;
  activityLegend.innerHTML = `
    <span><i data-level="zero"></i>0 min</span><span><i data-level="low"></i>1–30</span>
    <span><i data-level="medium"></i>31–60</span><span><i data-level="high"></i>61–120</span>
    <span><i data-level="very-high"></i>120+</span><span><i data-level="missing"></i>Unavailable</span>
  `;
  activityRow.insertAdjacentElement('afterend', activityLegend);

  const mobileActivity = document.createElement('div');
  mobileActivity.className = 'books-calendar-mobile-activity';
  mobileActivity.hidden = true;
  calendar.querySelector('.books-calendar-desktop')?.insertAdjacentElement('afterend', mobileActivity);

  const preview = document.createElement('aside');
  preview.className = 'books-calendar-preview';
  preview.hidden = true;
  preview.innerHTML = `
    <div class="books-calendar-preview-shell">
      <img data-rich-preview-image alt="" />
      <div class="books-calendar-preview-copy">
        <p class="books-calendar-preview-eyebrow" data-rich-preview-date></p>
        <h3 data-rich-preview-title></h3>
        <p class="books-calendar-preview-author" data-rich-preview-author></p>
        <dl data-rich-preview-details></dl>
        <a data-rich-preview-link target="_blank" rel="noopener noreferrer">Open Goodreads <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  `;
  document.body.append(preview);

  const sheet = document.createElement('dialog');
  sheet.className = 'books-calendar-book-sheet';
  sheet.innerHTML = `
    <div class="books-calendar-book-sheet-shell">
      <button type="button" class="books-calendar-book-sheet-close" data-rich-sheet-close aria-label="Close book details">×</button>
      <img data-rich-sheet-image alt="" />
      <div class="books-calendar-book-sheet-copy">
        <p class="books-calendar-preview-eyebrow" data-rich-sheet-date></p>
        <h2 data-rich-sheet-title></h2>
        <p class="books-calendar-preview-author" data-rich-sheet-author></p>
        <dl data-rich-sheet-details></dl>
        <a class="books-calendar-book-sheet-link" data-rich-sheet-link target="_blank" rel="noopener noreferrer">Open Goodreads <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  `;
  document.body.append(sheet);

  function metadataRows(book) {
    return [
      ['Finished', book.finishedDate ? formatDate(book.finishedDate) : book.rawDate],
      ['Length', book.length], ['Published', book.publicationYear],
      ['Genre', [book.genre, book.subgenre].filter(Boolean).join(' · ')],
      ['Form', book.form], ['Language', book.language], ['Country', book.country],
    ].filter(([, value]) => value && value !== 'unknown' && value !== 'Unknown date');
  }

  function fillDetails(list, rows) {
    list.replaceChildren();
    rows.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      list.append(dt, dd);
    });
  }

  function fillBookView(root, prefix, book) {
    root.querySelector(`[data-${prefix}-image]`).src = book.cover;
    root.querySelector(`[data-${prefix}-image]`).alt = book.title;
    root.querySelector(`[data-${prefix}-date]`).textContent = book.finishedDate
      ? `Finished ${formatShortDate(book.finishedDate)}` : 'Book details';
    root.querySelector(`[data-${prefix}-title]`).textContent = book.title;
    root.querySelector(`[data-${prefix}-author]`).textContent = book.author || 'Author not recorded';
    fillDetails(root.querySelector(`[data-${prefix}-details]`), metadataRows(book));
    const link = root.querySelector(`[data-${prefix}-link]`);
    link.href = book.href;
    link.setAttribute('aria-label', `Open ${book.title} on Goodreads in a new tab`);
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

  function cancelPreviewHide() {
    window.clearTimeout(state.previewTimer);
  }

  function showPreview(book, anchor) {
    if (!desktopPreviewQuery.matches || !book) return;
    cancelPreviewHide();
    state.previewAnchor = anchor;
    fillBookView(preview, 'rich-preview', book);
    preview.hidden = false;
    preview.classList.remove('is-visible');
    requestAnimationFrame(() => {
      positionPreview(anchor);
      preview.classList.add('is-visible');
    });
  }

  function hidePreview(immediate = false) {
    cancelPreviewHide();
    const hide = () => {
      preview.classList.remove('is-visible');
      window.setTimeout(() => {
        if (!preview.classList.contains('is-visible')) preview.hidden = true;
      }, 120);
      state.previewAnchor = null;
    };
    if (immediate) hide();
    else state.previewTimer = window.setTimeout(hide, 140);
  }

  function openSheet(book, trigger) {
    state.lastSheetTrigger = trigger;
    fillBookView(sheet, 'rich-sheet', book);
    if (typeof sheet.showModal === 'function') sheet.showModal();
    else sheet.setAttribute('open', '');
  }

  function closeSheet() {
    if (typeof sheet.close === 'function' && sheet.open) sheet.close();
    else sheet.removeAttribute('open');
  }

  function enhanceCover(link, book = bookByLink(link)) {
    if (!link || !book || link.dataset.richBookPreview) return;
    link.dataset.richBookPreview = 'true';
    link.addEventListener('pointerenter', () => showPreview(book, link));
    link.addEventListener('pointerleave', () => hidePreview(false));
    link.addEventListener('focus', () => showPreview(book, link));
    link.addEventListener('blur', () => hidePreview(false));
    link.addEventListener('click', (event) => {
      if (!mobileSheetQuery.matches) return;
      event.preventDefault();
      hidePreview(true);
      openSheet(book, link);
    });
  }

  function createCover(book) {
    const link = document.createElement('a');
    link.className = 'books-calendar-cover';
    link.href = book.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', `${book.title} — opens in a new tab`);
    const image = document.createElement('img');
    image.src = book.cover;
    image.alt = book.title;
    image.loading = 'lazy';
    image.decoding = 'async';
    link.append(image);
    enhanceCover(link, book);
    return link;
  }

  function cacheKey(year) {
    return `${BOOKS_CALENDAR_AUDIO_CACHE_PREFIX}${year}`;
  }

  function applyDailyRecords(year, records) {
    records.forEach((record) => {
      if (!record || !/^\d{4}-\d{2}-\d{2}$/.test(String(record.date || ''))) return;
      const raw = record?.audiobook?.minutes;
      const minutes = typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, raw) : null;
      state.dailyByDate.set(record.date, { state: minutes === null ? 'missing' : 'known', minutes });
    });
    state.loadedYears.add(year);
    state.yearErrors.delete(year);
  }

  function cachedYear(year) {
    try {
      const value = JSON.parse(localStorage.getItem(cacheKey(year)) || 'null');
      if (!value || !Array.isArray(value.records) || Date.now() - value.savedAt > BOOKS_CALENDAR_AUDIO_CACHE_TTL) return null;
      return value.records;
    } catch (_error) {
      return null;
    }
  }

  async function loadYear(year) {
    if (state.loadedYears.has(year)) return;
    if (state.loadingYears.has(year)) return state.loadingYears.get(year);
    const cached = cachedYear(year);
    if (cached) {
      applyDailyRecords(year, cached);
      return;
    }
    if (!dailyApiUrl) {
      state.yearErrors.set(year, 'Public listening data is not configured.');
      return;
    }

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
        applyDailyRecords(year, payload);
        try {
          localStorage.setItem(cacheKey(year), JSON.stringify({ savedAt: Date.now(), records: payload }));
        } catch (_error) {}
      } catch (error) {
        state.yearErrors.set(year, error instanceof Error ? error.message : 'Public listening data could not be loaded.');
      } finally {
        clearTimeout(timeout);
        state.loadingYears.delete(year);
        schedulePatch(0);
      }
    })();
    state.loadingYears.set(year, request);
    return request;
  }

  function dailyPoint(date) {
    const year = date.getUTCFullYear();
    if (state.loadingYears.has(year) || !state.loadedYears.has(year) && !state.yearErrors.has(year)) return { state: 'loading', minutes: null };
    if (state.yearErrors.has(year) && !state.loadedYears.has(year)) return { state: 'error', minutes: null };
    return state.dailyByDate.get(dateKey(date)) || { state: 'missing', minutes: null };
  }

  function activityLevel(point) {
    if (point.state !== 'known') return point.state;
    if (point.minutes === 0) return 'zero';
    if (point.minutes <= 30) return 'low';
    if (point.minutes <= 60) return 'medium';
    if (point.minutes <= 120) return 'high';
    return 'very-high';
  }

  function activityLabel(point) {
    if (point.state === 'loading') return 'Loading audiobook minutes';
    if (point.state === 'missing') return 'No public audiobook-minute record';
    if (point.state === 'error') return 'Audiobook minutes unavailable';
    const minutes = Math.round(point.minutes);
    return `${minutes.toLocaleString()} audiobook ${minutes === 1 ? 'minute' : 'minutes'}`;
  }

  function calendarRange(date, daysInMonth) {
    const firstWeekday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).getUTCDay();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1 - firstWeekday));
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + totalCells - 1);
    return { start, end, totalCells };
  }

  function monthListening(date, daysInMonth) {
    let total = 0;
    let known = 0;
    let missing = 0;
    let loading = 0;
    let maxMinutes = -1;
    let maxKey = '';
    for (let day = 1; day <= daysInMonth; day += 1) {
      const current = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), day));
      const point = dailyPoint(current);
      if (point.state === 'known') {
        total += point.minutes;
        known += 1;
        if (point.minutes > maxMinutes) {
          maxMinutes = point.minutes;
          maxKey = dateKey(current);
        }
      } else if (point.state === 'missing') missing += 1;
      else loading += 1;
    }
    return { total, known, missing, loading, maxMinutes, maxKey };
  }

  function addActivity(cell, date, listening) {
    cell.querySelectorAll('.books-calendar-activity-strip,.books-calendar-most-active').forEach((item) => item.remove());
    const point = dailyPoint(date);
    const strip = document.createElement('span');
    strip.className = 'books-calendar-activity-strip';
    strip.dataset.level = activityLevel(point);
    strip.title = `${formatDate(date)} · ${activityLabel(point)}`;
    cell.append(strip);
    if (dateKey(date) === listening.maxKey && point.minutes > 0 && date.getUTCMonth() === monthDate(monthSelect.value)?.getUTCMonth()) {
      const marker = document.createElement('span');
      marker.className = 'books-calendar-most-active';
      marker.textContent = '🎧';
      marker.title = `Most listening this month · ${formatDuration(point.minutes)}`;
      cell.append(marker);
    }
  }

  function patchStack(covers) {
    if (!covers?.classList.contains('is-stack')) return;
    const links = Array.from(covers.querySelectorAll(':scope > .books-calendar-cover'));
    const shown = links.slice(0, BOOKS_CALENDAR_MAX_SPLAY);
    links.forEach((link, index) => { link.hidden = index >= BOOKS_CALENDAR_MAX_SPLAY; });
    const center = (shown.length - 1) / 2;
    const spread = shown.length <= 3 ? 44 : shown.length <= 5 ? 31 : 25;
    shown.forEach((link, index) => {
      const distance = index - center;
      link.style.setProperty('--stack-index', String(index));
      link.style.setProperty('--collapsed-shift', `${(distance * 3.2).toFixed(1)}px`);
      link.style.setProperty('--collapsed-rotation', `${(distance * 1.25).toFixed(2)}deg`);
      link.style.setProperty('--splay-shift', `${(distance * spread).toFixed(1)}px`);
      link.style.setProperty('--splay-rotation', `${(distance * 2.25).toFixed(2)}deg`);
      enhanceCover(link);
    });
    covers.querySelector('.books-calendar-stack-overflow')?.remove();
    if (links.length > shown.length) {
      const overflow = document.createElement('span');
      overflow.className = 'books-calendar-stack-overflow';
      overflow.textContent = `+${links.length - shown.length}`;
      overflow.title = `${links.length - shown.length} more in the day details`;
      covers.append(overflow);
    }
    const toggle = covers.closest('.books-calendar-day')?.querySelector('.books-calendar-stack-toggle');
    if (toggle) toggle.setAttribute('aria-label', `Fan out ${shown.length} of ${links.length} book covers`);
  }

  function createSpilloverStack(cell, books) {
    if (books.length === 1) {
      const covers = document.createElement('div');
      covers.className = 'books-calendar-day-covers is-single';
      covers.append(createCover(books[0]));
      cell.append(covers);
      return;
    }
    if (!books.length) return;
    const covers = document.createElement('div');
    covers.className = 'books-calendar-day-covers is-stack';
    books.forEach((book) => covers.append(createCover(book)));
    cell.append(covers);
    patchStack(covers);

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'books-calendar-stack-toggle';
    toggle.textContent = `${books.length} books`;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', () => {
      const expanded = !covers.classList.contains('is-expanded');
      calendarGrid.querySelectorAll('.is-stack.is-expanded').forEach((stack) => stack.classList.remove('is-expanded'));
      covers.classList.toggle('is-expanded', expanded);
      toggle.setAttribute('aria-expanded', String(expanded));
      cell.toggleAttribute('data-stack-expanded', expanded);
    });
    cell.append(toggle);
  }

  function goToMonth(key) {
    const option = Array.from(monthSelect.options).find((candidate) => candidate.value === key);
    if (!option) return;
    monthSelect.value = key;
    monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function patchCalendarGrid(date, daysInMonth, range, booksByDay, listening) {
    const cells = Array.from(calendarGrid.children);
    cells.forEach((cell, index) => {
      const current = new Date(range.start);
      current.setUTCDate(range.start.getUTCDate() + index);
      const key = dateKey(current);
      const outside = current.getUTCMonth() !== date.getUTCMonth();
      const books = booksByDay.get(key) || [];
      cell.dataset.outsideMonth = String(outside);
      cell.dataset.listeningLevel = activityLevel(dailyPoint(current));

      if (outside && cell.dataset.richSpilloverDate !== key) {
        cell.replaceChildren();
        cell.classList.remove('books-calendar-day--blank');
        cell.dataset.richSpilloverDate = key;
        cell.dataset.hasBooks = String(Boolean(books.length));
        const dayButton = document.createElement('button');
        dayButton.type = 'button';
        dayButton.className = 'books-calendar-day-number books-calendar-day-number--outside';
        dayButton.textContent = String(current.getUTCDate());
        dayButton.setAttribute('aria-label', `Go to ${formatMonth(monthKey(current))}`);
        dayButton.addEventListener('click', () => goToMonth(monthKey(current)));
        cell.append(dayButton);
        createSpilloverStack(cell, books);
      }

      cell.querySelectorAll('.books-calendar-cover,.books-calendar-agenda-cover').forEach((link) => enhanceCover(link));
      cell.querySelectorAll('.books-calendar-day-covers.is-stack').forEach(patchStack);
      addActivity(cell, current, listening);
    });
  }

  function renderMobileActivity(date, daysInMonth, range, booksByDay, listening) {
    mobileActivity.hidden = !state.activityEnabled;
    mobileActivity.replaceChildren();
    if (!state.activityEnabled) return;
    const weekdays = document.createElement('div');
    weekdays.className = 'books-calendar-mobile-weekdays';
    'SMTWTFS'.split('').forEach((label) => {
      const span = document.createElement('span');
      span.textContent = label;
      weekdays.append(span);
    });
    const cells = document.createElement('div');
    cells.className = 'books-calendar-mobile-activity-grid';
    for (let index = 0; index < range.totalCells; index += 1) {
      const current = new Date(range.start);
      current.setUTCDate(range.start.getUTCDate() + index);
      const outside = current.getUTCMonth() !== date.getUTCMonth();
      const books = booksByDay.get(dateKey(current)) || [];
      const point = dailyPoint(current);
      const item = document.createElement(outside ? 'button' : 'span');
      item.className = 'books-calendar-mobile-activity-day';
      item.dataset.level = activityLevel(point);
      item.dataset.outsideMonth = String(outside);
      item.textContent = String(current.getUTCDate());
      item.title = `${formatDate(current)} · ${activityLabel(point)}`;
      if (dateKey(current) === listening.maxKey && point.minutes > 0 && !outside) item.dataset.mostActive = 'true';
      if (outside) {
        item.type = 'button';
        item.addEventListener('click', () => goToMonth(monthKey(current)));
      } else if (books.length) {
        item.dataset.hasBooks = 'true';
      }
      cells.append(item);
    }
    mobileActivity.append(weekdays, cells);
  }

  function updateActivityUi(year) {
    calendar.classList.toggle('show-listening-activity', state.activityEnabled);
    const toggle = activityRow.querySelector('[data-rich-activity-toggle]');
    toggle.setAttribute('aria-pressed', String(state.activityEnabled));
    activityRow.querySelector('[data-rich-activity-state]').textContent = state.activityEnabled ? 'On' : 'Off';
    activityLegend.hidden = !state.activityEnabled;
    const status = activityRow.querySelector('[data-rich-activity-status]');
    if (!dailyApiUrl) status.textContent = 'Public listening data is not configured.';
    else if (state.loadingYears.has(year)) status.textContent = 'Loading public listening data…';
    else if (state.yearErrors.has(year) && !state.loadedYears.has(year)) status.textContent = 'Listening data is temporarily unavailable.';
    else status.textContent = state.activityEnabled ? 'Blue strips show minutes; gray hatching means unavailable data.' : '';
  }

  function patch() {
    if (state.patching) return;
    const selected = monthDate(monthSelect.value);
    if (!selected || !calendarGrid.children.length) return;
    state.patching = true;
    observer.disconnect();
    try {
      const daysInMonth = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 0)).getUTCDate();
      const range = calendarRange(selected, daysInMonth);
      new Set([range.start.getUTCFullYear(), range.end.getUTCFullYear()]).forEach((year) => void loadYear(year));

      const books = visibleBooks();
      const booksByDay = new Map();
      books.forEach((book) => {
        const key = dateKey(book.finishedDate);
        if (!booksByDay.has(key)) booksByDay.set(key, []);
        booksByDay.get(key).push(book);
      });
      const monthBooks = books.filter((book) => monthKey(book.finishedDate) === monthSelect.value);
      const listening = monthListening(selected, daysInMonth);

      if (listeningMetricValue) {
        listeningMetricValue.textContent = listening.known
          ? formatDuration(listening.total)
          : listening.loading ? 'Loading…' : '—';
      }
      const parts = [
        formatMonth(monthSelect.value),
        `${monthBooks.length.toLocaleString()} ${monthBooks.length === 1 ? 'book' : 'books'} finished`,
      ];
      if (listening.known) {
        parts.push(`${formatDuration(listening.total)} listened`);
        if (listening.missing) parts.push(`${listening.missing} ${listening.missing === 1 ? 'day' : 'days'} unavailable`);
      } else parts.push(listening.loading ? 'listening data loading' : 'listening data unavailable');
      summary.textContent = parts.join(' · ');

      updateActivityUi(selected.getUTCFullYear());
      patchCalendarGrid(selected, daysInMonth, range, booksByDay, listening);
      renderMobileActivity(selected, daysInMonth, range, booksByDay, listening);
      calendar.querySelectorAll('.books-calendar-agenda-cover').forEach((link) => enhanceCover(link));
    } finally {
      state.patching = false;
      observer.observe(calendarGrid, { childList: true, subtree: true });
    }
  }

  function schedulePatch(delay = 35) {
    clearTimeout(state.patchTimer);
    state.patchTimer = window.setTimeout(patch, delay);
  }

  const observer = new MutationObserver(() => schedulePatch(30));
  observer.observe(calendarGrid, { childList: true, subtree: true });

  activityRow.querySelector('[data-rich-activity-toggle]').addEventListener('click', () => {
    state.activityEnabled = !state.activityEnabled;
    try { localStorage.setItem(BOOKS_CALENDAR_ACTIVITY_KEY, String(state.activityEnabled)); } catch (_error) {}
    schedulePatch(0);
  });

  preview.addEventListener('pointerenter', cancelPreviewHide);
  preview.addEventListener('pointerleave', () => hidePreview(false));
  preview.addEventListener('focusin', cancelPreviewHide);
  preview.addEventListener('focusout', () => hidePreview(false));
  sheet.querySelector('[data-rich-sheet-close]').addEventListener('click', closeSheet);
  sheet.addEventListener('click', (event) => { if (event.target === sheet) closeSheet(); });
  sheet.addEventListener('close', () => state.lastSheetTrigger?.focus?.());

  monthSelect.addEventListener('change', () => schedulePatch(25));
  document.querySelectorAll('#q,#genre-filter,#year-filter,#period-filter,#language-filter,#country-filter,#clear-filters')
    .forEach((control) => {
      control.addEventListener('input', () => schedulePatch(150));
      control.addEventListener('change', () => schedulePatch(30));
      control.addEventListener('click', () => schedulePatch(50));
    });

  window.addEventListener('resize', () => { if (state.previewAnchor) positionPreview(state.previewAnchor); });
  window.addEventListener('scroll', () => { if (state.previewAnchor) positionPreview(state.previewAnchor); }, true);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sheet.open) {
      closeSheet();
      return;
    }
    if (event.key === 'Escape' && !preview.hidden) {
      hidePreview(true);
      return;
    }
    if (calendar.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const direction = event.key === 'ArrowLeft' ? -1 : 1;
    const next = monthSelect.selectedIndex + direction;
    if (next < 0 || next >= monthSelect.options.length) return;
    event.preventDefault();
    monthSelect.selectedIndex = next;
    monthSelect.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const infoPanel = document.querySelector('#reading-info');
  if (infoPanel && !infoPanel.querySelector('.books-calendar-rich-info')) {
    const note = document.createElement('p');
    note.className = 'books-calendar-rich-info';
    note.textContent = 'The optional listening layer uses sanitized public daily audiobook minutes. Zero minutes and unavailable data are deliberately shown differently.';
    infoPanel.append(note);
  }

  schedulePatch(0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksCalendarEnhancements(), { once: true });
} else {
  bootBooksCalendarEnhancements();
}
