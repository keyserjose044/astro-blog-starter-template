/*
 * LifeLoggerz Books completion calendar and chronological list polish.
 * Uses the public Raindrop metadata already rendered on /books.
 */

const BOOKS_CALENDAR_STORAGE_KEY = 'lifeloggerz-books-calendar-month';
const BOOKS_CALENDAR_BOOT_RETRIES = 80;

function bootBooksCalendar(attempt = 0) {
  const grid = document.querySelector('#grid');
  const viewToggle = document.querySelector('#book-view-toggle');
  const timelineButton = document.querySelector('[data-atlas-view="timeline"]');

  if ((!grid || !viewToggle || !timelineButton) && attempt < BOOKS_CALENDAR_BOOT_RETRIES) {
    window.setTimeout(() => bootBooksCalendar(attempt + 1), 75);
    return;
  }

  if (!grid || !viewToggle || viewToggle.querySelector('[data-calendar-view]')) return;

  const cards = Array.from(grid.querySelectorAll('.card'));
  if (!cards.length) return;

  const explorer = document.querySelector('#books-explorer');
  const sortSelect = document.querySelector('#sort-books');
  const filterControls = [
    document.querySelector('#q'),
    document.querySelector('#genre-filter'),
    document.querySelector('#year-filter'),
    document.querySelector('#period-filter'),
    document.querySelector('#language-filter'),
    document.querySelector('#country-filter'),
    document.querySelector('#clear-filters'),
  ].filter(Boolean);

  const state = {
    active: false,
    currentMonthKey: '',
    monthKeys: [],
    hasOpened: false,
    refreshTimer: 0,
    lastDayTrigger: null,
  };

  const parseFinishedDate = (value) => {
    const raw = String(value || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
    if (!raw) return null;

    const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoDate) {
      const year = Number(isoDate[1]);
      const month = Number(isoDate[2]);
      const day = Number(isoDate[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
      ) ? date : null;
    }

    const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
    if (numeric) {
      const month = Number(numeric[1]);
      const day = Number(numeric[2]);
      const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (
        Number.isNaN(date.getTime()) ||
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
      ) {
        return null;
      }
      return date;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  };

  const parseLengthMinutes = (value) => {
    const raw = String(value || '').toLowerCase().trim();
    if (!raw) return 0;

    const colonMatch = raw.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
    if (colonMatch) {
      const first = Number(colonMatch[1]);
      const second = Number(colonMatch[2]);
      const third = colonMatch[3] ? Number(colonMatch[3]) : null;
      return third === null ? first * 60 + second : first * 60 + second + third / 60;
    }

    const hoursMatch = raw.match(/([\d.]+)\s*(?:h|hr|hrs|hour|hours)\b/);
    const minutesMatch = raw.match(/([\d.]+)\s*(?:m|min|mins|minute|minutes)\b/);
    if (hoursMatch || minutesMatch) {
      return (hoursMatch ? Number(hoursMatch[1]) * 60 : 0) +
        (minutesMatch ? Number(minutesMatch[1]) : 0);
    }

    const numeric = Number.parseFloat(raw.replace(/[^\d.]/g, ''));
    return Number.isFinite(numeric) ? numeric * 60 : 0;
  };

  const monthKey = (date) => (
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  );

  const dateKey = (date) => (
    `${monthKey(date)}-${String(date.getUTCDate()).padStart(2, '0')}`
  );

  const monthDateFromKey = (key) => {
    const match = String(key || '').match(/^(\d{4})-(\d{2})$/);
    return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : null;
  };

  const formatMonth = (key) => {
    const date = monthDateFromKey(key);
    return date
      ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date)
      : '';
  };

  const formatFullDate = (date) => new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);

  const formatCompactDate = (date) => new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);

  const formatDuration = (minutes) => {
    const rounded = Math.round(Number(minutes || 0));
    if (!rounded) return '0 min';
    const hours = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    if (!hours) return `${remainder} min`;
    if (!remainder) return `${hours.toLocaleString('en-US')} hr`;
    return `${hours.toLocaleString('en-US')} hr ${remainder} min`;
  };

  const getCardTitle = (card) => (
    card.querySelector('.title')?.textContent?.replace('↗', '').trim() ||
    card.dataset.title ||
    'Untitled'
  );

  const getCardInfo = (card) => {
    const finishedDate = parseFinishedDate(card.dataset.dateFinished);
    return {
      card,
      title: getCardTitle(card),
      author: String(card.dataset.author || '').trim(),
      cover: card.querySelector('.thumb')?.getAttribute('src') || '',
      href: card.getAttribute('href') || '#',
      finishedDate,
      length: String(card.dataset.length || '').trim(),
      lengthMinutes: parseLengthMinutes(card.dataset.length),
    };
  };

  const isCardVisible = (card) => (
    card.style.display !== 'none' &&
    !card.hidden &&
    !card.classList.contains('atlas-country-hidden')
  );

  const visibleBookInfo = () => cards.filter(isCardVisible).map(getCardInfo);
  const allDatedBookInfo = () => cards.map(getCardInfo).filter((book) => book.finishedDate);

  function polishCompletionRows() {
    cards.forEach((card) => {
      const meta = card.querySelector('.card-meta');
      if (!meta || meta.querySelector('.book-completion-row')) return;

      const rawDate = String(card.dataset.dateFinished || '').trim();
      const rawLength = String(card.dataset.length || '').trim();
      if (!rawDate && !rawLength) return;

      const existing = Array.from(meta.children).find((element) => {
        const text = element.textContent.trim();
        return text.startsWith('Finished ') || (rawLength && text === rawLength);
      });

      const row = existing || document.createElement('span');
      row.className = 'book-completion-row';
      row.replaceChildren();

      const parsedDate = parseFinishedDate(rawDate);
      if (rawDate) {
        const pill = document.createElement('span');
        pill.className = 'book-finished-pill';
        pill.append('Finished · ');

        if (parsedDate) {
          const time = document.createElement('time');
          time.dateTime = dateKey(parsedDate);
          time.textContent = formatCompactDate(parsedDate);
          pill.append(time);
        } else {
          pill.append(rawDate);
        }

        row.append(pill);
      }

      if (rawLength) {
        const duration = document.createElement('span');
        duration.className = 'book-duration';
        duration.textContent = rawLength;
        row.append(duration);
      }

      if (!existing) meta.append(row);
    });
  }

  const calendarButton = document.createElement('button');
  calendarButton.type = 'button';
  calendarButton.className = 'view-button';
  calendarButton.dataset.calendarView = 'completion';
  calendarButton.setAttribute('aria-pressed', 'false');
  calendarButton.innerHTML = '<span class="books-calendar-button-icon" aria-hidden="true">▣</span><span>Calendar</span>';
  viewToggle.append(calendarButton);

  const calendar = document.createElement('section');
  calendar.id = 'books-calendar-view';
  calendar.className = 'books-calendar';
  calendar.hidden = true;
  calendar.setAttribute('aria-label', 'Books finished by day');
  calendar.innerHTML = `
    <div class="books-calendar-shell">
      <div class="books-calendar-heading">
        <div>
          <p class="books-calendar-eyebrow">Completion calendar</p>
          <h2 class="books-calendar-title">Books finished by day</h2>
          <p class="books-calendar-description">A public calendar built from completion dates. Covers mark the day each audiobook was finished.</p>
        </div>
        <button type="button" class="books-calendar-close" data-close-calendar aria-label="Close calendar view">×</button>
      </div>

      <div class="books-calendar-controls">
        <button type="button" class="books-calendar-nav" data-calendar-prev aria-label="Previous month">←</button>
        <label class="books-calendar-picker">
          <span class="sr-only">Choose month</span>
          <select data-calendar-month aria-label="Choose calendar month"></select>
        </label>
        <button type="button" class="books-calendar-nav" data-calendar-next aria-label="Next month">→</button>
        <button type="button" class="books-calendar-latest" data-calendar-latest>Latest</button>
      </div>

      <div class="books-calendar-metrics" aria-live="polite">
        <div><span>Books finished</span><strong data-calendar-book-count>0</strong></div>
        <div><span>Completion days</span><strong data-calendar-day-count>0</strong></div>
        <div><span>Listening time</span><strong data-calendar-duration>0 min</strong></div>
      </div>

      <div class="books-calendar-desktop">
        <div class="books-calendar-weekdays" aria-hidden="true">
          <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
        </div>
        <div class="books-calendar-grid" data-calendar-grid role="grid" aria-label="Monthly completion calendar"></div>
      </div>

      <div class="books-calendar-agenda" data-calendar-agenda></div>
      <p class="books-calendar-empty" data-calendar-empty hidden>No finished books match the current filters in this month.</p>
    </div>
  `;

  grid.parentElement.insertBefore(calendar, grid);

  const dialog = document.createElement('dialog');
  dialog.className = 'books-calendar-dialog';
  dialog.setAttribute('aria-labelledby', 'books-calendar-dialog-title');
  dialog.innerHTML = `
    <div class="books-calendar-dialog-shell">
      <div class="books-calendar-dialog-heading">
        <div>
          <p class="books-calendar-eyebrow">Finished on</p>
          <h2 id="books-calendar-dialog-title"></h2>
          <p data-calendar-dialog-summary></p>
        </div>
        <button type="button" class="books-calendar-dialog-close" data-calendar-dialog-close aria-label="Close day details">×</button>
      </div>
      <div class="books-calendar-dialog-list" data-calendar-dialog-list></div>
    </div>
  `;
  document.body.append(dialog);

  const monthSelect = calendar.querySelector('[data-calendar-month]');
  const previousButton = calendar.querySelector('[data-calendar-prev]');
  const nextButton = calendar.querySelector('[data-calendar-next]');
  const latestButton = calendar.querySelector('[data-calendar-latest]');
  const calendarGrid = calendar.querySelector('[data-calendar-grid]');
  const agenda = calendar.querySelector('[data-calendar-agenda]');
  const emptyMessage = calendar.querySelector('[data-calendar-empty]');
  const bookCount = calendar.querySelector('[data-calendar-book-count]');
  const dayCount = calendar.querySelector('[data-calendar-day-count]');
  const duration = calendar.querySelector('[data-calendar-duration]');
  const dialogTitle = dialog.querySelector('#books-calendar-dialog-title');
  const dialogSummary = dialog.querySelector('[data-calendar-dialog-summary]');
  const dialogList = dialog.querySelector('[data-calendar-dialog-list]');

  function setPressedButton(activeButton) {
    viewToggle.querySelectorAll('.view-button').forEach((button) => {
      button.setAttribute('aria-pressed', button === activeButton ? 'true' : 'false');
    });
  }

  function buildMonthKeys() {
    const dated = allDatedBookInfo();
    if (!dated.length) {
      const now = new Date();
      state.monthKeys = [monthKey(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)))];
      return;
    }

    const timestamps = dated.map((book) => book.finishedDate.getTime());
    const first = new Date(Math.min(...timestamps));
    const last = new Date(Math.max(...timestamps));
    const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
    const end = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1));
    const keys = [];

    while (cursor <= end) {
      keys.push(monthKey(cursor));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    state.monthKeys = keys;
  }

  function populateMonthSelect() {
    buildMonthKeys();
    monthSelect.replaceChildren();

    state.monthKeys.forEach((key) => {
      const option = document.createElement('option');
      option.value = key;
      option.textContent = formatMonth(key);
      monthSelect.append(option);
    });

    let saved = '';
    try {
      saved = localStorage.getItem(BOOKS_CALENDAR_STORAGE_KEY) || '';
    } catch (_error) {
      saved = '';
    }

    const latestVisibleDate = visibleBookInfo()
      .filter((book) => book.finishedDate)
      .sort((a, b) => b.finishedDate - a.finishedDate)[0]?.finishedDate;
    const latestAvailable = state.monthKeys[state.monthKeys.length - 1];
    const preferred = state.monthKeys.includes(saved)
      ? saved
      : latestVisibleDate
        ? monthKey(latestVisibleDate)
        : latestAvailable;

    state.currentMonthKey = preferred || latestAvailable || state.monthKeys[0];
    monthSelect.value = state.currentMonthKey;
  }

  function persistMonth() {
    try {
      localStorage.setItem(BOOKS_CALENDAR_STORAGE_KEY, state.currentMonthKey);
    } catch (_error) {
      // Calendar navigation still works when storage is unavailable.
    }
  }

  function createCoverLink(book, className = 'books-calendar-cover') {
    const link = document.createElement('a');
    link.className = className;
    link.href = book.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = `${book.title} — opens in a new tab`;

    const image = document.createElement('img');
    image.src = book.cover;
    image.alt = book.title;
    image.loading = 'lazy';
    image.decoding = 'async';
    link.append(image);
    return link;
  }

  function openDayDetails(dayDate, books, trigger) {
    state.lastDayTrigger = trigger || document.activeElement;
    dialogTitle.textContent = formatFullDate(dayDate);

    const totalMinutes = books.reduce((sum, book) => sum + book.lengthMinutes, 0);
    dialogSummary.textContent = `${books.length.toLocaleString('en-US')} ${books.length === 1 ? 'book' : 'books'} · ${formatDuration(totalMinutes)}`;
    dialogList.replaceChildren();

    books.forEach((book) => {
      const link = document.createElement('a');
      link.className = 'books-calendar-dialog-book';
      link.href = book.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      const image = document.createElement('img');
      image.src = book.cover;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';

      const copy = document.createElement('span');
      copy.className = 'books-calendar-dialog-copy';

      const title = document.createElement('strong');
      title.textContent = book.title;
      copy.append(title);

      if (book.author) {
        const author = document.createElement('span');
        author.textContent = book.author;
        copy.append(author);
      }

      if (book.length) {
        const length = document.createElement('small');
        length.textContent = book.length;
        copy.append(length);
      }

      const cue = document.createElement('span');
      cue.className = 'books-calendar-dialog-cue';
      cue.setAttribute('aria-hidden', 'true');
      cue.textContent = '↗';

      link.append(image, copy, cue);
      dialogList.append(link);
    });

    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function closeDayDetails() {
    if (typeof dialog.close === 'function' && dialog.open) {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
      state.lastDayTrigger?.focus?.();
    }
  }

  function renderDesktopCalendar(booksByDay, year, monthIndex, daysInMonth) {
    calendarGrid.replaceChildren();
    const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

    for (let cellIndex = 0; cellIndex < totalCells; cellIndex += 1) {
      const dayNumber = cellIndex - firstWeekday + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        const blank = document.createElement('div');
        blank.className = 'books-calendar-day books-calendar-day--blank';
        blank.setAttribute('aria-hidden', 'true');
        calendarGrid.append(blank);
        continue;
      }

      const dayDate = new Date(Date.UTC(year, monthIndex, dayNumber));
      const books = booksByDay.get(dateKey(dayDate)) || [];
      const cell = document.createElement('div');
      cell.className = 'books-calendar-day';
      cell.setAttribute('role', 'gridcell');
      cell.dataset.hasBooks = books.length ? 'true' : 'false';

      const header = document.createElement(books.length ? 'button' : 'span');
      header.className = 'books-calendar-day-number';
      header.textContent = String(dayNumber);
      if (books.length) {
        header.type = 'button';
        header.setAttribute('aria-label', `${formatFullDate(dayDate)}: ${books.length} ${books.length === 1 ? 'book' : 'books'} finished`);
        header.addEventListener('click', () => openDayDetails(dayDate, books, header));
      }
      cell.append(header);

      if (books.length) {
        const covers = document.createElement('div');
        covers.className = 'books-calendar-day-covers';
        books.slice(0, 3).forEach((book) => covers.append(createCoverLink(book)));

        if (books.length > 3) {
          const more = document.createElement('button');
          more.type = 'button';
          more.className = 'books-calendar-more';
          more.textContent = `+${books.length - 3}`;
          more.setAttribute('aria-label', `Show ${books.length - 3} more books finished on ${formatFullDate(dayDate)}`);
          more.addEventListener('click', () => openDayDetails(dayDate, books, more));
          covers.append(more);
        }

        cell.append(covers);

        const count = document.createElement('span');
        count.className = 'books-calendar-day-count';
        count.textContent = `${books.length} ${books.length === 1 ? 'book' : 'books'}`;
        cell.append(count);
      }

      calendarGrid.append(cell);
    }
  }

  function renderAgenda(booksByDay) {
    agenda.replaceChildren();
    const entries = Array.from(booksByDay.entries()).sort(([a], [b]) => a.localeCompare(b));

    entries.forEach(([key, books]) => {
      const dayDate = parseFinishedDate(key);
      if (!dayDate) return;

      const item = document.createElement('article');
      item.className = 'books-calendar-agenda-day';

      const dateButton = document.createElement('button');
      dateButton.type = 'button';
      dateButton.className = 'books-calendar-agenda-date';

      const day = document.createElement('strong');
      day.textContent = String(dayDate.getUTCDate());
      const weekday = document.createElement('span');
      weekday.textContent = new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        month: 'short',
        timeZone: 'UTC',
      }).format(dayDate);
      dateButton.append(day, weekday);
      dateButton.addEventListener('click', () => openDayDetails(dayDate, books, dateButton));

      const covers = document.createElement('div');
      covers.className = 'books-calendar-agenda-covers';
      books.slice(0, 4).forEach((book) => covers.append(createCoverLink(book, 'books-calendar-agenda-cover')));

      const copy = document.createElement('button');
      copy.type = 'button';
      copy.className = 'books-calendar-agenda-copy';

      const summary = document.createElement('strong');
      summary.textContent = `${books.length} ${books.length === 1 ? 'book' : 'books'} finished`;

      const titles = document.createElement('span');
      const names = books.slice(0, 2).map((book) => book.title).join(' · ');
      titles.textContent = books.length > 2 ? `${names} · +${books.length - 2} more` : names;

      copy.append(summary, titles);
      copy.addEventListener('click', () => openDayDetails(dayDate, books, copy));

      item.append(dateButton, covers, copy);
      agenda.append(item);
    });
  }

  function renderCalendar() {
    if (!state.currentMonthKey || !state.monthKeys.length) populateMonthSelect();

    const monthDate = monthDateFromKey(state.currentMonthKey);
    if (!monthDate) return;

    monthSelect.value = state.currentMonthKey;
    const currentIndex = state.monthKeys.indexOf(state.currentMonthKey);
    previousButton.disabled = currentIndex <= 0;
    nextButton.disabled = currentIndex === -1 || currentIndex >= state.monthKeys.length - 1;
    latestButton.disabled = state.currentMonthKey === state.monthKeys[state.monthKeys.length - 1];

    const year = monthDate.getUTCFullYear();
    const monthIndex = monthDate.getUTCMonth();
    const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    const monthBooks = visibleBookInfo()
      .filter((book) => book.finishedDate && monthKey(book.finishedDate) === state.currentMonthKey)
      .sort((a, b) => a.finishedDate - b.finishedDate || a.title.localeCompare(b.title));

    const booksByDay = new Map();
    monthBooks.forEach((book) => {
      const key = dateKey(book.finishedDate);
      if (!booksByDay.has(key)) booksByDay.set(key, []);
      booksByDay.get(key).push(book);
    });

    const totalMinutes = monthBooks.reduce((sum, book) => sum + book.lengthMinutes, 0);
    bookCount.textContent = monthBooks.length.toLocaleString('en-US');
    dayCount.textContent = booksByDay.size.toLocaleString('en-US');
    duration.textContent = formatDuration(totalMinutes);
    emptyMessage.hidden = monthBooks.length !== 0;

    renderDesktopCalendar(booksByDay, year, monthIndex, daysInMonth);
    renderAgenda(booksByDay);
  }

  function removeDateDividers() {
    grid.querySelectorAll('.books-date-divider').forEach((divider) => divider.remove());
  }

  function refreshDateDividers() {
    removeDateDividers();

    const sortMode = sortSelect?.value || 'date-desc';
    if (grid.dataset.bookView !== 'list' || !['date-desc', 'date-asc'].includes(sortMode)) return;

    const visible = cards.filter(isCardVisible);
    const counts = new Map();
    visible.forEach((card) => {
      const date = parseFinishedDate(card.dataset.dateFinished);
      const key = date ? dateKey(date) : 'unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    let previousKey = null;
    visible.forEach((card) => {
      const date = parseFinishedDate(card.dataset.dateFinished);
      const key = date ? dateKey(date) : 'unknown';
      if (key === previousKey) return;
      previousKey = key;

      const divider = document.createElement('div');
      divider.className = 'books-date-divider';
      divider.setAttribute('role', 'heading');
      divider.setAttribute('aria-level', '2');

      const label = document.createElement('span');
      label.textContent = date ? formatFullDate(date) : 'Completion date unknown';

      const count = document.createElement('small');
      const amount = counts.get(key) || 0;
      count.textContent = `${amount} ${amount === 1 ? 'book' : 'books'}`;

      divider.append(label, count);
      grid.insertBefore(divider, card);
    });
  }

  function scheduleRefresh(delay = 40) {
    window.clearTimeout(state.refreshTimer);
    state.refreshTimer = window.setTimeout(() => {
      refreshDateDividers();
      if (state.active) renderCalendar();
    }, delay);
  }

  function activateCalendar() {
    state.active = true;
    calendar.hidden = false;
    grid.hidden = true;
    if (explorer) explorer.hidden = true;
    document.body.classList.remove('books-explorer-open');
    document.body.classList.add('books-calendar-open');
    setPressedButton(calendarButton);

    if (!state.hasOpened) {
      populateMonthSelect();
      state.hasOpened = true;
    }

    renderCalendar();
    calendar.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function deactivateCalendar() {
    if (!state.active) return;
    state.active = false;
    calendar.hidden = true;
    document.body.classList.remove('books-calendar-open');
  }

  function closeCalendarToCollection() {
    const preferred = viewToggle.querySelector(`[data-book-view="${grid.dataset.bookView || 'list'}"]`)
      || viewToggle.querySelector('[data-book-view="list"]');
    if (preferred) preferred.click();
    else {
      deactivateCalendar();
      grid.hidden = false;
    }
  }

  calendarButton.addEventListener('click', activateCalendar);

  viewToggle.addEventListener('click', (event) => {
    const button = event.target.closest('.view-button');
    if (!button || button === calendarButton) return;
    deactivateCalendar();
    window.requestAnimationFrame(refreshDateDividers);
  });

  calendar.querySelector('[data-close-calendar]')?.addEventListener('click', closeCalendarToCollection);

  previousButton.addEventListener('click', () => {
    const index = state.monthKeys.indexOf(state.currentMonthKey);
    if (index <= 0) return;
    state.currentMonthKey = state.monthKeys[index - 1];
    persistMonth();
    renderCalendar();
  });

  nextButton.addEventListener('click', () => {
    const index = state.monthKeys.indexOf(state.currentMonthKey);
    if (index < 0 || index >= state.monthKeys.length - 1) return;
    state.currentMonthKey = state.monthKeys[index + 1];
    persistMonth();
    renderCalendar();
  });

  latestButton.addEventListener('click', () => {
    state.currentMonthKey = state.monthKeys[state.monthKeys.length - 1];
    persistMonth();
    renderCalendar();
  });

  monthSelect.addEventListener('change', () => {
    if (!state.monthKeys.includes(monthSelect.value)) return;
    state.currentMonthKey = monthSelect.value;
    persistMonth();
    renderCalendar();
  });

  dialog.querySelector('[data-calendar-dialog-close]')?.addEventListener('click', closeDayDetails);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDayDetails();
  });
  dialog.addEventListener('close', () => {
    state.lastDayTrigger?.focus?.();
  });

  filterControls.forEach((control) => {
    control.addEventListener('input', () => scheduleRefresh(150));
    control.addEventListener('change', () => scheduleRefresh(20));
    control.addEventListener('click', () => scheduleRefresh(40));
  });

  sortSelect?.addEventListener('change', () => scheduleRefresh(0));

  const observer = new MutationObserver(() => scheduleRefresh(45));
  observer.observe(grid, {
    attributes: true,
    subtree: true,
    attributeFilter: ['style', 'class', 'data-book-view'],
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || dialog.open || !state.active) return;
    closeCalendarToCollection();
  });

  const infoPanel = document.querySelector('#reading-info');
  if (infoPanel && !infoPanel.querySelector('.books-calendar-info')) {
    const note = document.createElement('p');
    note.className = 'books-calendar-info';
    note.textContent = 'Calendar view shows completion dates only: each cover marks the day an audiobook was finished, not every day it was in progress.';
    infoPanel.append(note);
  }

  polishCompletionRows();
  populateMonthSelect();
  refreshDateDividers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksCalendar(), { once: true });
} else {
  bootBooksCalendar();
}
