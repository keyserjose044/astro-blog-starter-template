/* LifeLoggerz Books: turn the generic Insights dashboard into a cover-led Records view. */

const BOOKS_RECORDS_RETRIES = 140;

function bootBooksRecords(attempt = 0) {
  const grid = document.querySelector('#grid');
  const view = document.querySelector('#books-insights-view');
  const button = document.querySelector('[data-books-expansion-view="insights"]');
  const metrics = view?.querySelector('[data-insights-metrics]');
  const content = view?.querySelector('[data-insights-content]');
  const preview = document.querySelector('.books-calendar-preview');
  const sheet = document.querySelector('.books-calendar-book-sheet');

  if ((!grid || !view || !button || !metrics || !content || !preview || !sheet) && attempt < BOOKS_RECORDS_RETRIES) {
    window.setTimeout(() => bootBooksRecords(attempt + 1), 80);
    return;
  }
  if (!grid || !view || !button || !metrics || !content || !preview || !sheet || document.body.dataset.booksRecordsReady) return;
  document.body.dataset.booksRecordsReady = 'true';

  const cards = Array.from(grid.querySelectorAll('.card'));
  const desktopPreviewQuery = window.matchMedia('(min-width: 761px) and (hover: hover) and (pointer: fine)');
  let renderTimer = 0;
  let previewTimer = 0;
  let previewAnchor = null;

  const escapeHtml = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character]));

  const particles = new Set(['da', 'das', 'de', 'del', 'della', 'di', 'dos', 'du', 'la', 'le', 'van', 'von', 'y', 'e', 'of', 'the']);

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
    const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
    if (numeric) {
      const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
      const date = new Date(Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2])));
      return Number.isNaN(date.getTime()) ? null : date;
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

  function parsePublicationYear(card, fallback) {
    const exact = String(card.dataset.publicationYear || '').trim();
    if (exact !== '' && Number.isFinite(Number(exact))) return Number(exact);
    const raw = String(fallback || '').toLowerCase().replace(/,/g, '').trim();
    const bce = raw.match(/\b(\d{1,4})\s*(?:bc|bce)\b/);
    if (bce) return -Number(bce[1]);
    const signed = raw.match(/(?:^|\s)(-?\d{1,4})(?=\s|$)/);
    return signed && Number.isFinite(Number(signed[1])) ? Number(signed[1]) : null;
  }

  function formatDuration(minutes) {
    const rounded = Math.round(Number(minutes || 0));
    const hours = Math.floor(rounded / 60);
    const remainder = rounded % 60;
    if (!hours) return `${remainder} min`;
    return remainder ? `${hours.toLocaleString('en-US')} hr ${remainder} min` : `${hours.toLocaleString('en-US')} hr`;
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
  }

  function formatMonthKey(key) {
    const [year, month] = key.split('-').map(Number);
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1)));
  }

  function formatPublicationYear(year) {
    if (!Number.isFinite(year)) return 'Unknown date';
    return year < 0 ? `${Math.abs(year).toLocaleString('en-US')} BCE` : String(year);
  }

  function dayKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function monthKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function getBook(card) {
    const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
    const finishedDate = parseDate(card.dataset.dateFinished || parts[0]);
    return {
      card,
      index: String(card.dataset.originalIndex || ''),
      href: card.getAttribute('href') || '#',
      title: cleanTitle(card.querySelector('.title')?.textContent || card.dataset.title || 'Untitled'),
      author: titleCaseName(card.dataset.author || parts[2] || ''),
      cover: card.querySelector('.thumb')?.getAttribute('src') || '',
      finishedDate,
      publicationRaw: String(parts[3] || '').trim(),
      publicationYear: parsePublicationYear(card, parts[3]),
      genre: String(card.dataset.genre || parts[4] || '').trim(),
      subgenre: String(card.dataset.subgenre || parts[5] || '').trim(),
      form: String(parts[6] || '').trim(),
      language: String(card.dataset.language || parts[7] || '').trim(),
      country: String(card.dataset.country || parts[8] || '').trim(),
      length: String(card.dataset.length || parts[9] || '').trim(),
      lengthMinutes: parseMinutes(card.dataset.length || parts[9]),
    };
  }

  const allBooks = () => cards.map(getBook).filter((book) => book.finishedDate);
  const visibleBooks = () => cards
    .filter((card) => card.style.display !== 'none' && !card.hidden && !card.classList.contains('atlas-country-hidden'))
    .map(getBook)
    .filter((book) => book.finishedDate);

  function detailRows(book) {
    return [
      ['Length', book.length],
      ['Published', book.publicationRaw || formatPublicationYear(book.publicationYear)],
      ['Genre', book.genre],
      ['Subgenre', book.subgenre],
      ['Form', book.form],
      ['Language', book.language],
      ['Country', book.country],
    ].filter(([, value]) => value && !/^unknown$/i.test(value));
  }

  function fillPanel(root, prefix, book) {
    const set = (selector, value) => {
      const element = root.querySelector(selector);
      if (element) element.textContent = value;
    };
    set(`[data-${prefix}-date]`, `Finished ${formatDate(book.finishedDate)}`);
    set(`[data-${prefix}-title]`, book.title);
    set(`[data-${prefix}-author]`, book.author || 'Author not recorded');
    const image = root.querySelector(`[data-${prefix}-image]`);
    if (image) { image.src = book.cover; image.alt = book.title; }
    const details = root.querySelector(`[data-${prefix}-details]`);
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
    const link = root.querySelector(`[data-${prefix}-link]`);
    if (link) { link.href = book.href; link.setAttribute('aria-label', `Open ${book.title} on Goodreads`); }
  }

  function openSheet(book, trigger) {
    fillPanel(sheet, 'rich-sheet', book);
    sheet._booksRecordsTrigger = trigger;
    if (typeof sheet.showModal === 'function' && !sheet.open) sheet.showModal();
    else sheet.setAttribute('open', '');
  }

  function positionPreview(anchor) {
    if (preview.hidden || !anchor?.isConnected) return;
    const anchorRect = anchor.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const gap = 16;
    const margin = 14;
    let side = 'right';
    let left = anchorRect.right + gap;
    if (left + previewRect.width > window.innerWidth - margin) {
      side = 'left';
      left = anchorRect.left - previewRect.width - gap;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - previewRect.width - margin));
    let top = anchorRect.top + (anchorRect.height - previewRect.height) / 2;
    top = Math.max(margin, Math.min(top, window.innerHeight - previewRect.height - margin));
    preview.dataset.side = side;
    preview.style.left = `${Math.round(left)}px`;
    preview.style.top = `${Math.round(top)}px`;
  }

  function showPreview(book, anchor) {
    if (!desktopPreviewQuery.matches) return;
    window.clearTimeout(previewTimer);
    previewAnchor = anchor;
    fillPanel(preview, 'rich-preview', book);
    preview.hidden = false;
    requestAnimationFrame(() => {
      positionPreview(anchor);
      preview.classList.add('is-visible');
    });
  }

  function hidePreview(immediate = false) {
    window.clearTimeout(previewTimer);
    const hide = () => {
      preview.classList.remove('is-visible');
      window.setTimeout(() => {
        if (!preview.classList.contains('is-visible')) preview.hidden = true;
      }, 130);
      previewAnchor = null;
    };
    if (immediate) hide();
    else previewTimer = window.setTimeout(hide, 140);
  }

  preview.addEventListener('pointerenter', () => window.clearTimeout(previewTimer));
  preview.addEventListener('pointerleave', () => hidePreview(false));
  window.addEventListener('resize', () => { if (previewAnchor) positionPreview(previewAnchor); });
  window.addEventListener('scroll', () => { if (previewAnchor) positionPreview(previewAnchor); }, true);

  function metric(label, value, note = '') {
    return `<div class="books-atlas-metric books-record-metric"><span class="books-atlas-metric-label">${escapeHtml(label)}</span><strong class="books-atlas-metric-value">${escapeHtml(value)}</strong>${note ? `<span class="books-atlas-metric-note">${escapeHtml(note)}</span>` : ''}</div>`;
  }

  function externalLink(book) {
    return `<a class="books-record-external" href="${escapeHtml(book.href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escapeHtml(book.title)} on Goodreads">↗</a>`;
  }

  function coverButton(book, badge = '', value = '', className = '') {
    return `<article class="books-record-book-card ${className}">
      <button type="button" class="books-record-book-main" data-record-book="${escapeHtml(book.index)}">
        <span class="books-record-cover-wrap"><img src="${escapeHtml(book.cover)}" alt="" loading="lazy">${badge ? `<b>${escapeHtml(badge)}</b>` : ''}</span>
        <span class="books-record-book-copy"><strong>${escapeHtml(book.title)}</strong><small>${escapeHtml(book.author || 'Author not recorded')}</small>${value ? `<em>${escapeHtml(value)}</em>` : ''}</span>
      </button>${externalLink(book)}
    </article>`;
  }

  function stackedCovers(group, limit = 5) {
    return `<span class="books-record-stack" aria-hidden="true">${group.books.slice(0, limit).map((book, index) => `<img src="${escapeHtml(book.cover)}" alt="" loading="lazy" style="--record-stack-index:${index}">`).join('')}</span>`;
  }

  function groupBy(books, keyForBook) {
    const groups = new Map();
    books.forEach((book) => {
      const key = keyForBook(book);
      if (!groups.has(key)) groups.set(key, { key, books: [] });
      groups.get(key).books.push(book);
    });
    return [...groups.values()];
  }

  function dayRecords(books) {
    return groupBy(books, (book) => dayKey(book.finishedDate))
      .sort((a, b) => b.books.length - a.books.length || b.key.localeCompare(a.key));
  }

  function monthRecords(books) {
    return groupBy(books, (book) => monthKey(book.finishedDate))
      .sort((a, b) => b.books.length - a.books.length || b.key.localeCompare(a.key));
  }

  function longestGap(books) {
    const days = dayRecords(books).sort((a, b) => a.key.localeCompare(b.key));
    let record = null;
    for (let index = 1; index < days.length; index += 1) {
      const previousDate = new Date(`${days[index - 1].key}T00:00:00Z`);
      const nextDate = new Date(`${days[index].key}T00:00:00Z`);
      const difference = Math.round((nextDate - previousDate) / 86400000);
      if (!record || difference > record.days) record = { days: difference, before: days[index - 1], after: days[index] };
    }
    return record;
  }

  function milestones(books) {
    const ordered = [...books].sort((a, b) => a.finishedDate - b.finishedDate || Number(a.index) - Number(b.index));
    if (!ordered.length) return [];
    const targets = [1];
    for (let value = 50; value <= ordered.length; value += 50) targets.push(value);
    if (!targets.includes(ordered.length)) targets.push(ordered.length);
    const selected = targets.length > 8
      ? [targets[0], ...targets.slice(1, 7), targets.at(-1)]
      : targets;
    return [...new Set(selected)].map((position) => ({ position, book: ordered[position - 1] })).filter((entry) => entry.book);
  }

  function authorMarathons(books) {
    const groups = new Map();
    books.forEach((book) => {
      const author = book.author || 'Author not recorded';
      if (!groups.has(author)) groups.set(author, { author, books: [], minutes: 0 });
      const entry = groups.get(author);
      entry.books.push(book);
      entry.minutes += book.lengthMinutes;
    });
    return [...groups.values()]
      .filter((entry) => entry.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes || b.books.length - a.books.length || a.author.localeCompare(b.author));
  }

  function burstCard(group, label, note) {
    return `<article class="books-record-burst-card">
      <button type="button" data-record-group="${escapeHtml(group.key)}" data-record-group-kind="${label === 'DAY' ? 'day' : 'month'}">
        ${stackedCovers(group)}
        <span><small>${label}</small><strong>${escapeHtml(note)}</strong><em>${group.books.length} ${group.books.length === 1 ? 'book' : 'books'} finished</em></span>
      </button>
    </article>`;
  }

  function renderRecords() {
    if (view.hidden || button.getAttribute('aria-pressed') !== 'true') return;
    observer.disconnect();

    const books = visibleBooks();
    const withLength = books.filter((book) => book.lengthMinutes > 0);
    const longest = [...withLength].sort((a, b) => b.lengthMinutes - a.lengthMinutes || a.title.localeCompare(b.title));
    const shortest = [...withLength].sort((a, b) => a.lengthMinutes - b.lengthMinutes || a.title.localeCompare(b.title));
    const datedPublication = books.filter((book) => Number.isFinite(book.publicationYear));
    const oldest = [...datedPublication].sort((a, b) => a.publicationYear - b.publicationYear || a.title.localeCompare(b.title));
    const newest = [...datedPublication].sort((a, b) => b.publicationYear - a.publicationYear || a.title.localeCompare(b.title));
    const days = dayRecords(books);
    const months = monthRecords(books);
    const gap = longestGap(books);
    const milestoneShelf = milestones(books);
    const marathons = authorMarathons(books);
    const recordDay = days[0];
    const recordMonth = months[0];

    metrics.innerHTML = [
      metric('Books in the record book', books.length.toLocaleString('en-US'), 'Responds to search and filters'),
      metric('Longest audiobook', longest[0] ? formatDuration(longest[0].lengthMinutes) : '—', longest[0]?.title || 'No length metadata'),
      metric('Biggest completion day', recordDay ? `${recordDay.books.length} books` : '—', recordDay ? formatDate(new Date(`${recordDay.key}T00:00:00Z`)) : 'No completion dates'),
      metric('Longest completion gap', gap ? `${gap.days} days` : '—', gap ? `${formatDate(new Date(`${gap.before.key}T00:00:00Z`))} → ${formatDate(new Date(`${gap.after.key}T00:00:00Z`))}` : 'Not enough dated entries'),
    ].join('');

    if (!books.length) {
      content.className = 'books-records-dashboard';
      content.innerHTML = '<div class="books-records-empty">No books match the active filters.</div>';
      observer.observe(view, observerOptions);
      return;
    }

    const longestChampion = longest[0];
    const shortestChampion = shortest[0];
    const oldestChampion = oldest[0];
    const newestChampion = newest[0];

    content.className = 'books-records-dashboard';
    content.innerHTML = `
      <section class="books-record-panel books-record-panel--hall">
        <div class="books-record-section-heading"><div><p>Length hall of fame</p><h3>The marathons and the miniatures</h3></div><span>Audiobook length, not daily listening time</span></div>
        <div class="books-record-duel">
          <div class="books-record-champion books-record-champion--long">
            <div class="books-record-champion-label"><span>🏆</span><small>LONGEST</small></div>
            ${longestChampion ? coverButton(longestChampion, '#1', formatDuration(longestChampion.lengthMinutes), 'books-record-book-card--champion') : '<p>No length metadata.</p>'}
            <div class="books-record-runner-grid">${longest.slice(1, 5).map((book, index) => coverButton(book, `#${index + 2}`, formatDuration(book.lengthMinutes))).join('')}</div>
          </div>
          <div class="books-record-champion books-record-champion--short">
            <div class="books-record-champion-label"><span>⚡</span><small>SHORTEST</small></div>
            ${shortestChampion ? coverButton(shortestChampion, '#1', formatDuration(shortestChampion.lengthMinutes), 'books-record-book-card--champion') : '<p>No length metadata.</p>'}
            <div class="books-record-runner-grid">${shortest.slice(1, 5).map((book, index) => coverButton(book, `#${index + 2}`, formatDuration(book.lengthMinutes))).join('')}</div>
          </div>
        </div>
      </section>

      <section class="books-record-panel books-record-panel--time-machine">
        <div class="books-record-section-heading"><div><p>Publication time machine</p><h3>The oldest and newest works</h3></div><span>Based on recorded publication years</span></div>
        <div class="books-record-time-grid">
          <div><h4>Farthest back</h4>${oldestChampion ? coverButton(oldestChampion, 'OLDEST', formatPublicationYear(oldestChampion.publicationYear), 'books-record-book-card--time-hero') : ''}<div class="books-record-time-list">${oldest.slice(1, 6).map((book) => coverButton(book, '', formatPublicationYear(book.publicationYear))).join('')}</div></div>
          <div><h4>Closest to today</h4>${newestChampion ? coverButton(newestChampion, 'NEWEST', formatPublicationYear(newestChampion.publicationYear), 'books-record-book-card--time-hero') : ''}<div class="books-record-time-list">${newest.slice(1, 6).map((book) => coverButton(book, '', formatPublicationYear(book.publicationYear))).join('')}</div></div>
        </div>
      </section>

      <section class="books-record-panel books-record-panel--bursts">
        <div class="books-record-section-heading"><div><p>Completion bursts</p><h3>The busiest days and months</h3></div><span>Cover stacks reveal clustered finishes</span></div>
        <div class="books-record-burst-columns">
          <div><h4>Biggest days</h4><div class="books-record-burst-list">${days.slice(0, 5).map((group) => burstCard(group, 'DAY', formatDate(new Date(`${group.key}T00:00:00Z`)))).join('')}</div></div>
          <div><h4>Biggest months</h4><div class="books-record-burst-list">${months.slice(0, 5).map((group) => burstCard(group, 'MONTH', formatMonthKey(group.key))).join('')}</div></div>
        </div>
      </section>

      <section class="books-record-panel books-record-panel--gap">
        <div class="books-record-section-heading"><div><p>Pace record</p><h3>The longest space between completion dates</h3></div><span>Measured between distinct finish dates</span></div>
        ${gap ? `<div class="books-record-gap-feature">
          <div>${stackedCovers(gap.before, 3)}<strong>${escapeHtml(formatDate(new Date(`${gap.before.key}T00:00:00Z`)))}</strong><small>${gap.before.books.length} ${gap.before.books.length === 1 ? 'book' : 'books'} completed</small></div>
          <span class="books-record-gap-number"><strong>${gap.days}</strong><small>DAYS</small><i></i></span>
          <div>${stackedCovers(gap.after, 3)}<strong>${escapeHtml(formatDate(new Date(`${gap.after.key}T00:00:00Z`)))}</strong><small>${gap.after.books.length} ${gap.after.books.length === 1 ? 'book' : 'books'} completed</small></div>
        </div>` : '<p class="books-records-empty">Not enough distinct completion dates to calculate a gap.</p>'}
      </section>

      <section class="books-record-panel books-record-panel--milestones">
        <div class="books-record-section-heading"><div><p>Milestone shelf</p><h3>The books that marked the count</h3></div><span>Chronological completion order</span></div>
        <div class="books-record-milestone-track">${milestoneShelf.map(({ position, book }, index) => `<div class="books-record-milestone"><span>${position === 1 ? 'FIRST' : position === books.length ? 'LATEST' : `#${position}`}</span>${coverButton(book, '', formatDate(book.finishedDate))}<i ${index === milestoneShelf.length - 1 ? 'hidden' : ''}></i></div>`).join('')}</div>
      </section>

      <section class="books-record-panel books-record-panel--authors">
        <div class="books-record-section-heading"><div><p>Author marathons</p><h3>The longest combined catalogs</h3></div><span>Ranked by total audiobook length completed</span></div>
        <div class="books-record-author-grid">${marathons.slice(0, 6).map((entry, index) => `<article class="books-record-author-card"><div class="books-record-author-rank">${index + 1}</div>${stackedCovers({ books: entry.books }, 4)}<div><strong>${escapeHtml(entry.author)}</strong><span>${entry.books.length} ${entry.books.length === 1 ? 'book' : 'books'}</span><em>${escapeHtml(formatDuration(entry.minutes))}</em></div></article>`).join('')}</div>
      </section>
    `;

    bindRecordInteractions(books, days, months);
    observer.observe(view, observerOptions);
  }

  function bindRecordInteractions(books, days, months) {
    content.querySelectorAll('[data-record-book]').forEach((element) => {
      const book = books.find((candidate) => candidate.index === element.dataset.recordBook) || allBooks().find((candidate) => candidate.index === element.dataset.recordBook);
      if (!book) return;
      element.addEventListener('pointerenter', () => showPreview(book, element));
      element.addEventListener('pointerleave', () => hidePreview(false));
      element.addEventListener('focus', () => showPreview(book, element));
      element.addEventListener('blur', () => hidePreview(false));
      element.addEventListener('click', () => {
        hidePreview(true);
        openSheet(book, element);
      });
    });

    content.querySelectorAll('[data-record-group]').forEach((element) => {
      const groups = element.dataset.recordGroupKind === 'day' ? days : months;
      const group = groups.find((candidate) => candidate.key === element.dataset.recordGroup);
      if (!group?.books.length) return;
      element.addEventListener('click', () => openSheet(group.books[0], element));
    });
  }

  function scheduleRender(delay = 40) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderRecords, delay);
  }

  const observerOptions = { childList: true, subtree: true };
  const observer = new MutationObserver(() => {
    if (!view.hidden && button.getAttribute('aria-pressed') === 'true' && !content.classList.contains('books-records-dashboard')) scheduleRender(0);
  });
  observer.observe(view, observerOptions);

  const buttonLabel = button.querySelector('span:last-child');
  if (buttonLabel) buttonLabel.textContent = 'Records';
  const buttonIcon = button.querySelector('span:first-child');
  if (buttonIcon) buttonIcon.textContent = '★';
  button.setAttribute('aria-label', 'Reading records');

  const eyebrow = view.querySelector('.books-explorer-eyebrow');
  const heading = view.querySelector('.books-explorer-title');
  const description = view.querySelector('.books-explorer-description');
  const close = view.querySelector('[data-close-books-expansion]');
  if (eyebrow) eyebrow.textContent = 'Reading records';
  if (heading) heading.textContent = 'Extremes, milestones, and curiosities';
  if (description) description.textContent = 'A cover-led record book for the longest, shortest, oldest, newest, busiest, and most memorable corners of the collection. Every record responds to the active Books filters.';
  if (close) close.setAttribute('aria-label', 'Close reading records');

  button.addEventListener('click', () => scheduleRender(0));
  ['#q', '#genre-filter', '#year-filter', '#period-filter', '#language-filter', '#country-filter', '#clear-filters']
    .forEach((selector) => {
      const control = document.querySelector(selector);
      control?.addEventListener('input', () => scheduleRender(150));
      control?.addEventListener('change', () => scheduleRender(70));
      control?.addEventListener('click', () => scheduleRender(80));
    });

  if (!view.hidden && button.getAttribute('aria-pressed') === 'true') scheduleRender(0);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksRecords(), { once: true });
} else {
  bootBooksRecords();
}
