/* Books mobile QA interaction cleanup — August 1, 2026. */

function startBooksMobilePolish() {
  const grid = document.querySelector('#grid');
  const viewToggle = document.querySelector('#book-view-toggle');
  if (!grid || !viewToggle || document.body.dataset.booksMobilePolishReady) return;
  document.body.dataset.booksMobilePolishReady = 'true';

  const layoutQuery = window.matchMedia('(max-width: 900px)');
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

  /* The filter dataset was intentionally lower-cased. Recover the author's
     original display casing from the structured note when it is available;
     only fall back to title-casing the normalized dataset. */
  cards.forEach((card) => {
    const noteAuthor = String(card.dataset.noteRaw || '').split('·')[2]?.trim() || '';
    if (noteAuthor) card.dataset.author = noteAuthor;
    else if (card.dataset.author) card.dataset.author = titleCaseName(card.dataset.author);
  });

  /* The old Quilt interaction still adds `show-note` at <=900px before the newer
     rich-sheet handler runs. The note is hidden now, so remove that stale state.
     At 761–900px with a fine pointer, where the rich sheet is not used, open the
     original book directly instead of requiring an invisible first tap. */
  document.addEventListener('click', (event) => {
    if (!layoutQuery.matches || grid.dataset.bookView !== 'quilt') return;
    const card = event.target.closest('.card');
    if (!card || !grid.contains(card)) return;

    if (!sheetQuery.matches) {
      const href = card.getAttribute('href');
      if (href) window.open(href, '_blank', 'noopener,noreferrer');
    }

    queueMicrotask(() => card.classList.remove('show-note'));
  }, true);

  function cleanTitle(card) {
    return card.querySelector('.title')?.textContent
      ?.replace(/↗/g, '')
      .replace(/\s*\(?\s*opens in (?:a )?new tab\s*\)?/gi, '')
      .replace(/\s*\(?\s*opens? book details\s*\)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Book';
  }

  function syncCardSemantics() {
    const opensDetails = sheetQuery.matches && grid.dataset.bookView === 'quilt';

    cards.forEach((card) => {
      if (!card.dataset.mobilePolishOriginalTitle) {
        card.dataset.mobilePolishOriginalTitle = card.getAttribute('title') || `${cleanTitle(card)} — opens in a new tab`;
      }

      const title = cleanTitle(card);
      const screenReaderCue = card.querySelector('.sr-only');
      if (screenReaderCue) screenReaderCue.remove();

      if (opensDetails) {
        card.setAttribute('title', `${title} — open book details`);
        card.setAttribute('aria-label', `${title} — open book details`);
      } else {
        card.setAttribute('title', card.dataset.mobilePolishOriginalTitle);
        card.setAttribute('aria-label', `${title} — open Goodreads in a new tab`);
      }
    });
  }

  function updateHelpCopy() {
    const infoPanel = document.querySelector('#reading-info');
    if (!infoPanel) return;

    Array.from(infoPanel.querySelectorAll('p')).forEach((paragraph) => {
      if (!paragraph.textContent.includes('In Quilt view on a phone')) return;
      paragraph.textContent = 'In Quilt view on a phone, tap a cover to open LifeLoggerz book details; use the Goodreads button there when you want the original page. In List view, the key details are already visible and one tap opens the book.';
    });
  }

  const hint = document.createElement('p');
  hint.className = 'books-mobile-view-hint';
  hint.textContent = 'Swipe views →';
  hint.hidden = true;
  viewToggle.insertAdjacentElement('afterend', hint);

  function updateViewHint() {
    if (!layoutQuery.matches) {
      hint.hidden = true;
      return;
    }

    const overflows = viewToggle.scrollWidth > viewToggle.clientWidth + 4;
    hint.hidden = !overflows;
  }

  function centerActiveView() {
    if (!layoutQuery.matches || viewToggle.scrollWidth <= viewToggle.clientWidth + 4) return;
    const active = viewToggle.querySelector('.view-button[aria-pressed="true"]');
    if (!active) return;
    active.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  function labelSurpriseControl() {
    const trigger = document.querySelector('.books-surprise-trigger');
    if (!trigger) return;
    trigger.setAttribute('aria-label', 'Surprise me');
    trigger.setAttribute('title', 'Surprise me');
  }

  viewToggle.addEventListener('click', (event) => {
    const button = event.target.closest('.view-button');
    if (!button) return;
    hint.classList.add('is-used');
    window.setTimeout(() => {
      syncCardSemantics();
      updateViewHint();
      centerActiveView();
    }, 60);
  });

  viewToggle.addEventListener('scroll', () => {
    if (Math.abs(viewToggle.scrollLeft) > 6) hint.classList.add('is-used');
  }, { passive: true });

  const viewObserver = new MutationObserver(() => {
    labelSurpriseControl();
    updateViewHint();
    window.setTimeout(updateViewHint, 80);
  });
  viewObserver.observe(viewToggle, { childList: true, subtree: true });

  const gridObserver = new MutationObserver(syncCardSemantics);
  gridObserver.observe(grid, { attributes: true, attributeFilter: ['data-book-view'] });

  const toolbar = document.querySelector('.toolbar');
  if (toolbar) {
    const toolbarObserver = new MutationObserver(labelSurpriseControl);
    toolbarObserver.observe(toolbar, { childList: true, subtree: true });
  }

  const handleViewportChange = () => {
    syncCardSemantics();
    updateViewHint();
    window.setTimeout(updateViewHint, 120);
  };

  [layoutQuery, sheetQuery].forEach((query) => {
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleViewportChange);
    } else {
      query.addListener(handleViewportChange);
    }
  });

  window.addEventListener('resize', handleViewportChange, { passive: true });

  updateHelpCopy();
  labelSurpriseControl();
  syncCardSemantics();
  updateViewHint();
  window.setTimeout(() => {
    labelSurpriseControl();
    updateViewHint();
  }, 350);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBooksMobilePolish, { once: true });
} else {
  startBooksMobilePolish();
}
