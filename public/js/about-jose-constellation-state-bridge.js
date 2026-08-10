(() => {
  const section = document.querySelector('[data-jose-constellation]');
  if (!section || section.dataset.joseStateBridgeInitialized === 'true') return;
  section.dataset.joseStateBridgeInitialized = 'true';

  const closePinned = () => {
    const pinned = section.querySelector('.jose-node.is-pinned');
    const close = section.querySelector('[data-jose-card-close]');
    if (pinned && close) close.click();
  };

  const revealPinnedIfHidden = () => {
    const pinned = section.querySelector('.jose-node.is-pinned');
    if (!pinned || !pinned.classList.contains('is-mode-hidden')) return;
    pinned.classList.remove('is-mode-hidden');
    const slotId = pinned.dataset.joseNode;
    section.querySelectorAll('[data-from][data-to]').forEach((line) => {
      if (line.dataset.from === slotId || line.dataset.to === slotId) line.classList.remove('is-mode-hidden-edge');
    });
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const control = target.closest('[data-jose-mode],[data-jose-shuffle],[data-jose-surprise]');
    if (!control || !section.contains(control)) return;
    closePinned();
    if (control.matches('[data-jose-surprise]')) window.setTimeout(revealPinnedIfHidden, 0);
  }, true);
})();
