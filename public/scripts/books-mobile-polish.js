/* Books mobile QA interaction cleanup — August 1, 2026. */

function startBooksMobilePolish() {
  const grid = document.querySelector('#grid');
  const viewToggle = document.querySelector('#book-view-toggle');
  if (!grid || !viewToggle || document.body.dataset.booksMobilePolishReady) return;
  document.body.dataset.booksMobilePolishReady = 'true';

  const mobileQuery = window.matchMedia('(max-width: 900px), (hover: none), (pointer: coarse)');
  const cards = Array.from(grid.querySelectorAll('.card'));

  /* The old Quilt interaction still adds `show-note` before the newer rich-sheet
     handler runs. The note itself is hidden now, so remove the stale state and
     leave the rich detail sheet as the one mobile interaction model. */
  document.addEventListener('click', (event) => {
    if (!mobileQuery.matches || grid.dataset.bookView !== 'quilt') return;
    const card = event.target.closest('.card');
    if (!card || !grid.contains(card)) return;
    queueMicrotask(() => card.classList.remove('show-note'));
  }, true);

  function cleanTitle(card) {
    return card.querySelector('.title')?.textContent
      ?.replace(/↗/g, '')
      .replace(/\s*\(?\s*opens in (?:a )?new tab\s*\)?/gi, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Book';
  }

  function syncCardSemantics() {
    const mobileQuilt = mobileQuery.matches && grid.dataset.bookView === 'quilt';

    cards.forEach((card) => {
      if (!card.dataset.mobilePolishOriginalTitle) {
        card.dataset.mobilePolishOriginalTitle = card.getAttribute('title') || `${cleanTitle(card)} — opens in a new tab`;
      }

      const screenReaderCue = card.querySelector('.sr-only');
      if (mobileQuilt) {
        card.setAttribute('title', `${cleanTitle(card)} — opens book details`);
        if (screenReaderCue) screenReaderCue.textContent = ' (opens book details)';
      } else {
        card.setAttribute('title', card.dataset.mobilePolishOriginalTitle);
        if (screenReaderCue) screenReaderCue.textContent = ' (opens in a new tab)';
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
    if (!mobileQuery.matches) {
      hint.hidden = true;
      return;
    }

    const overflows = viewToggle.scrollWidth > viewToggle.clientWidth + 4;
    hint.hidden = !overflows;
  }

  function centerActiveView() {
    if (!mobileQuery.matches) return;
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

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', handleViewportChange);
  } else {
    mobileQuery.addListener(handleViewportChange);
  }

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
