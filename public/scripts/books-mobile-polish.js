/* Books responsive semantics cleanup — August 1, 2026.
 * The rich details sheet and 4×2 mobile navigator are now the canonical Books
 * behavior. Remove artifacts left by the older tooltip/swipe implementation and
 * keep only the small responsive/accessibility normalization still required.
 */

function startBooksMobilePolish() {
  const grid = document.querySelector('#grid');
  const viewToggle = document.querySelector('#book-view-toggle');
  if (!grid || !viewToggle || document.body.dataset.booksMobilePolishReady) return;
  document.body.dataset.booksMobilePolishReady = 'true';

  const sheetQuery = window.matchMedia('(max-width: 760px), (hover: none), (pointer: coarse)');
  const cards = Array.from(grid.querySelectorAll('.card'));
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

  function cleanTitle(card) {
    return String(card.dataset.title || card.querySelector('.title')?.textContent || 'Book')
      .replace(/↗/g, '')
      .replace(/\s*\(?\s*opens in (?:a )?new tab\s*\)?/gi, '')
      .replace(/\s*\(?\s*opens? book details\s*\)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  cards.forEach((card) => {
    const noteAuthor = String(card.dataset.noteRaw || '').split('·')[2]?.trim() || '';
    if (noteAuthor) card.dataset.author = noteAuthor;
    else if (card.dataset.author) card.dataset.author = titleCaseName(card.dataset.author);
  });

  cards.forEach((card) => {
    card.classList.remove('show-note');
    card.querySelector('.note-bubble')?.remove();
    card.querySelector('.title .sr-only')?.remove();
  });

  function syncCardSemantics() {
    const opensDetails = sheetQuery.matches && grid.dataset.bookView === 'quilt';
    cards.forEach((card) => {
      const title = cleanTitle(card);
      if (opensDetails) {
        card.setAttribute('title', `${title} — open book details`);
        card.setAttribute('aria-label', `${title} — open book details`);
      } else {
        card.setAttribute('title', title);
        card.setAttribute('aria-label', `${title} — open Goodreads in a new tab`);
      }
    });
  }

  function updateHelpCopy() {
    const infoPanel = document.querySelector('#reading-info');
    if (!infoPanel) return;
    Array.from(infoPanel.querySelectorAll('p')).forEach((paragraph) => {
      if (!paragraph.textContent.includes('In Quilt view on a phone')) return;
      paragraph.textContent = 'In Quilt view on a phone, tap a cover to open LifeLoggerz book details; use the Goodreads button there when you want the original page. In List view, the key details are already visible and one tap opens Goodreads.';
    });
  }

  function labelSurpriseControl() {
    const trigger = document.querySelector('.books-surprise-trigger');
    if (!trigger) return;
    trigger.setAttribute('aria-label', 'Surprise me');
    trigger.setAttribute('title', 'Surprise me');
  }

  viewToggle.addEventListener('click', (event) => {
    if (!event.target.closest('.view-button')) return;
    window.setTimeout(syncCardSemantics, 60);
  });

  const gridObserver = new MutationObserver(syncCardSemantics);
  gridObserver.observe(grid, { attributes: true, attributeFilter: ['data-book-view'] });

  const toolbar = document.querySelector('.toolbar');
  if (toolbar) {
    const toolbarObserver = new MutationObserver(labelSurpriseControl);
    toolbarObserver.observe(toolbar, { childList: true, subtree: true });
  }

  if (typeof sheetQuery.addEventListener === 'function') sheetQuery.addEventListener('change', syncCardSemantics);
  else sheetQuery.addListener(syncCardSemantics);

  updateHelpCopy();
  labelSurpriseControl();
  syncCardSemantics();
  window.setTimeout(labelSurpriseControl, 350);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBooksMobilePolish, { once: true });
} else {
  startBooksMobilePolish();
}
