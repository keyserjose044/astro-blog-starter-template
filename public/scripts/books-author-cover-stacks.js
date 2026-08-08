/* Books Authors — archive-first cover stacks.
 * Keeps Authors tied to the books in the LifeLoggerz archive instead of
 * introducing a separate portrait-maintenance layer. The existing Authors
 * renderers remain the source of truth; this module only upgrades their
 * representative image into a small stack of up to three recorded covers.
 */

const BOOKS_AUTHOR_STACK_RETRIES = 160;

function bootBooksAuthorCoverStacks(attempt = 0) {
  const grid = document.querySelector('#grid');
  const authorsView = document.querySelector('#books-authors-view');

  if ((!grid || !authorsView) && attempt < BOOKS_AUTHOR_STACK_RETRIES) {
    window.setTimeout(() => bootBooksAuthorCoverStacks(attempt + 1), 80);
    return;
  }
  if (!grid || !authorsView || document.body.dataset.booksAuthorCoverStacksReady) return;
  document.body.dataset.booksAuthorCoverStacksReady = 'true';

  const cards = Array.from(grid.querySelectorAll('.card'));
  let scheduled = false;

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  function authorKeys(card) {
    const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
    const keys = new Set([
      normalize(parts[2]),
      normalize(card.dataset.author),
    ].filter(Boolean));
    if (!keys.size) keys.add(normalize('Author not recorded'));
    return keys;
  }

  function finishedTime(card) {
    const parts = String(card.dataset.noteRaw || '').split('·').map((part) => part.trim());
    const raw = String(card.dataset.dateFinished || parts[0] || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
    const parsed = raw ? new Date(raw) : null;
    if (parsed && !Number.isNaN(parsed.getTime())) return parsed.getTime();
    return Number(card.dataset.originalIndex || 0);
  }

  function isVisible(card) {
    return card.style.display !== 'none'
      && !card.hidden
      && !card.classList.contains('atlas-country-hidden');
  }

  function groupedCards() {
    const groups = new Map();
    cards.filter(isVisible).forEach((card) => {
      authorKeys(card).forEach((key) => {
        if (!groups.has(key)) groups.set(key, []);
        const group = groups.get(key);
        if (!group.includes(card)) group.push(card);
      });
    });
    groups.forEach((group) => group.sort((a, b) => finishedTime(b) - finishedTime(a)));
    return groups;
  }

  function coversFor(group) {
    const seen = new Set();
    const covers = [];
    group.forEach((card) => {
      const src = card.querySelector('.thumb')?.getAttribute('src') || '';
      if (!src || seen.has(src)) return;
      seen.add(src);
      covers.push(src);
    });
    return covers.slice(0, 3);
  }

  function upgrade() {
    scheduled = false;
    const groups = groupedCards();

    authorsView.querySelectorAll('.books-author-card summary').forEach((summary) => {
      if (summary.querySelector('.books-author-cover-stack')) return;

      const heading = summary.querySelector('h3');
      const authorKey = normalize(heading?.textContent || 'Author not recorded');
      const group = groups.get(authorKey) || [];
      const covers = coversFor(group);
      if (!covers.length) return;

      const representative = Array.from(summary.children).find((child) => child.tagName === 'IMG');
      if (!representative) return;

      const stack = document.createElement('span');
      stack.className = 'books-author-cover-stack';
      stack.dataset.coverCount = String(covers.length);
      stack.setAttribute('aria-hidden', 'true');

      /* Oldest of the selected covers goes down first; the newest/representative
       * cover is appended last so it remains visually in front. */
      [...covers].reverse().forEach((src) => {
        const image = document.createElement('img');
        image.src = src;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        stack.append(image);
      });

      representative.replaceWith(stack);
    });
  }

  function scheduleUpgrade() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(upgrade);
  }

  const observer = new MutationObserver(scheduleUpgrade);
  observer.observe(authorsView, { childList: true, subtree: true });

  scheduleUpgrade();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootBooksAuthorCoverStacks(), { once: true });
} else {
  bootBooksAuthorCoverStacks();
}
