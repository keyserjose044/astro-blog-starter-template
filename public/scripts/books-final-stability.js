/* Final Books interaction stability pass — August 1, 2026. */

const BOOKS_FINAL_STABILITY_RETRIES = 180;

function bootBooksFinalStability(attempt = 0) {
  const grid = document.querySelector('#grid');
  const calendar = document.querySelector('#books-calendar-view');
  const calendarGrid = calendar?.querySelector('[data-calendar-grid]');
  const dayDialog = document.querySelector('.books-calendar-dialog');
  const richSheet = document.querySelector('.books-calendar-book-sheet');
  const timelineView = document.querySelector('#books-timeline-view');
  const timelineContent = timelineView?.querySelector('#books-timeline-content');

  const ready = grid && calendar && calendarGrid && dayDialog && richSheet && timelineView && timelineContent;
  if (!ready && attempt < BOOKS_FINAL_STABILITY_RETRIES) {
    window.setTimeout(() => bootBooksFinalStability(attempt + 1), 80);
    return;
  }
  if (!ready || document.body.dataset.booksFinalStabilityReady) return;
  document.body.dataset.booksFinalStabilityReady = 'true';

  const mobileQuery = window.matchMedia('(max-width: 900px), (hover: none), (pointer: coarse)');
  const cards = Array.from(grid.querySelectorAll('.card'));
  const particles = new Set(['da', 'das', 'de', 'del', 'della', 'di', 'dos', 'du', 'la', 'le', 'van', 'von', 'y', 'e', 'of', 'the']);

  const stripActionCue = (value) => String(value || '')
    .replace(/↗/g, '')
    .replace(/\s*\(?\s*opens in (?:a )?new tab\s*\)?/gi, '')
    .replace(/\s*\(?\s*opens? book details\s*\)?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

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

  function formatDate(date) {
    return date ? new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC',
    }).format(date) : '';
  }

  function bookFromCard(card) {
    const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
    return {
      card,
      href: card.getAttribute('href') || '#',
      title: stripActionCue(card.querySelector('.title')?.textContent || card.dataset.title || 'Untitled'),
      author: titleCaseName(card.dataset.author || parts[2] || ''),
      cover: card.querySelector('.thumb')?.getAttribute('src') || '',
      finishedDate: parseDate(card.dataset.dateFinished || parts[0]),
      publicationYear: String(parts[3] || card.dataset.publicationYear || '').trim(),
      genre: String(card.dataset.genre || parts[4] || '').trim(),
      subgenre: String(card.dataset.subgenre || parts[5] || '').trim(),
      form: String(parts[6] || '').trim(),
      language: String(card.dataset.language || parts[7] || '').trim(),
      country: String(card.dataset.country || parts[8] || '').trim(),
      length: String(card.dataset.length || parts[9] || '').trim(),
    };
  }

  const books = cards.map(bookFromCard);

  function bookFromLink(link) {
    if (!link) return null;
    const href = link.getAttribute('href') || '';
    const alt = stripActionCue(link.querySelector('img')?.alt || '');
    return books.find((book) => href && book.href === href)
      || books.find((book) => alt && book.title === alt)
      || null;
  }

  function fillRichSheet(book, trigger) {
    if (!book) return;
    const image = richSheet.querySelector('[data-rich-sheet-image]');
    if (image) {
      image.src = book.cover;
      image.alt = book.title;
    }
    const setText = (selector, value) => {
      const element = richSheet.querySelector(selector);
      if (element) element.textContent = value;
    };
    setText('[data-rich-sheet-date]', book.finishedDate ? `Finished ${formatDate(book.finishedDate)}` : 'Book details');
    setText('[data-rich-sheet-title]', book.title);
    setText('[data-rich-sheet-author]', book.author || 'Author not recorded');

    const details = richSheet.querySelector('[data-rich-sheet-details]');
    if (details) {
      details.replaceChildren();
      [
        ['Length', book.length],
        ['Published', book.publicationYear],
        ['Genre', [book.genre, book.subgenre].filter(Boolean).join(' · ')],
        ['Form', book.form],
        ['Language', book.language],
        ['Country', book.country],
      ].filter(([, value]) => value && !/^unknown$/i.test(value)).forEach(([label, value]) => {
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = label;
        dd.textContent = value;
        details.append(dt, dd);
      });
    }

    const goodreads = richSheet.querySelector('[data-rich-sheet-link]');
    if (goodreads) {
      goodreads.href = book.href;
      goodreads.setAttribute('aria-label', `Open ${book.title} on Goodreads in a new tab`);
    }

    richSheet._booksFinalStabilityTrigger = trigger;
    if (typeof richSheet.showModal === 'function' && !richSheet.open) richSheet.showModal();
    else richSheet.setAttribute('open', '');
  }

  /* Multiple books in a phone-sized calendar cell are a day-level choice, not
     several tiny link targets. Open the existing day chooser before metadata. */
  calendar.addEventListener('click', (event) => {
    if (!mobileQuery.matches) return;
    const stack = event.target.closest('.books-calendar-day-covers.is-stack');
    if (!stack || !calendarGrid.contains(stack)) return;
    const cell = stack.closest('.books-calendar-day');
    const dayButton = cell?.querySelector('button.books-calendar-day-number');
    if (!dayButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();
    dayButton.click();
  }, true);

  /* On phones the day chooser is an internal LifeLoggerz selector. Choosing a
     cover opens the same metadata sheet used by Quilt/Authors/Records. */
  dayDialog.addEventListener('click', (event) => {
    if (!mobileQuery.matches) return;
    const link = event.target.closest('.books-calendar-dialog-book');
    if (!link) return;
    const book = bookFromLink(link);
    if (!book) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    event.stopPropagation();

    if (typeof dayDialog.close === 'function' && dayDialog.open) dayDialog.close();
    else dayDialog.removeAttribute('open');
    requestAnimationFrame(() => fillRichSheet(book, link));
  }, true);

  function updateCalendarInstruction() {
    const description = calendar.querySelector('.books-calendar-description');
    if (!description) return;
    description.textContent = mobileQuery.matches
      ? 'Each cover marks a finished audiobook. Tap one book for details; on multi-book days, tap the stack or date to choose from larger covers.'
      : 'Covers mark the day each audiobook was finished. Hover a stack to fan its books out.';
  }

  /* Timeline insights used to live inside #books-timeline-content, the same node
     that Year Overview / Month Detail replaces with innerHTML. Keep the rich
     heatmap/insights in a stable sibling. A hidden marker remains in the legacy
     container so the older insight renderer knows its current signature is still
     represented and does not enter a self-rebuilding loop. */
  const insightsHost = document.createElement('div');
  insightsHost.className = 'books-timeline-insights-stable-host';
  timelineContent.before(insightsHost);

  let timelineStabilizeFrame = 0;
  function ensureTimelineMarker() {
    if (timelineContent.querySelector('[data-books-timeline-insights-placeholder]')) return;
    const marker = document.createElement('span');
    marker.hidden = true;
    marker.dataset.booksTimelineInsights = 'placeholder';
    marker.dataset.booksTimelineInsightsPlaceholder = '';
    marker.setAttribute('aria-hidden', 'true');
    timelineContent.prepend(marker);
  }

  function nudgeTimelineProxy() {
    window.setTimeout(() => {
      timelineView.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: false }));
    }, 0);
  }

  function comparableInsightMarkup(node) {
    if (!node) return '';
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.books-timeline-zoom-proxy').forEach((proxy) => proxy.remove());
    return clone.outerHTML;
  }

  function stabilizeTimelineInsights() {
    cancelAnimationFrame(timelineStabilizeFrame);
    timelineStabilizeFrame = requestAnimationFrame(() => {
      const incoming = timelineContent.querySelector('[data-books-timeline-insights]:not([data-books-timeline-insights-placeholder])');
      if (incoming) {
        const current = insightsHost.querySelector('[data-books-timeline-insights]');
        if (current && comparableInsightMarkup(current) === comparableInsightMarkup(incoming)) {
          incoming.remove();
        } else {
          insightsHost.replaceChildren(incoming);
          nudgeTimelineProxy();
        }
      }
      ensureTimelineMarker();
    });
  }

  const timelineObserver = new MutationObserver(stabilizeTimelineInsights);
  timelineObserver.observe(timelineContent, { childList: true, subtree: false });
  timelineView.addEventListener('click', (event) => {
    if (event.target.closest('[data-timeline-mode], [data-reading-zoom], [data-zoom-proxy], [data-reading-year], [data-reading-month]')) {
      window.setTimeout(stabilizeTimelineInsights, 0);
    }
  });

  function cleanRenderedBookTitles(root = document) {
    root.querySelectorAll([
      '.books-record-book-copy strong',
      '.books-author-work span',
      '.books-explorer-bottom-main strong',
      '.books-period-samples span',
      '.books-calendar-dialog-copy strong',
      '.books-calendar-month-book-copy strong',
    ].join(',')).forEach((element) => {
      const clean = stripActionCue(element.textContent);
      if (element.textContent !== clean) element.textContent = clean;
    });
  }

  const explorer = document.querySelector('#books-explorer');
  const records = document.querySelector('#books-insights-view');
  const titleObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) cleanRenderedBookTitles(node);
      });
    });
  });
  if (explorer) titleObserver.observe(explorer, { childList: true, subtree: true });
  if (records && records !== explorer) titleObserver.observe(records, { childList: true, subtree: true });

  const handleViewport = () => updateCalendarInstruction();
  if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', handleViewport);
  else mobileQuery.addListener(handleViewport);

  updateCalendarInstruction();
  cleanRenderedBookTitles();
  stabilizeTimelineInsights();
  window.setTimeout(stabilizeTimelineInsights, 120);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksFinalStability(), { once: true });
} else {
  bootBooksFinalStability();
}
