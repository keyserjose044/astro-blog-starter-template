(() => {
  const section = document.querySelector('[data-jose-constellation]');
  if (!section || section.dataset.joseStateBridgeInitialized === 'true') return;
  section.dataset.joseStateBridgeInitialized = 'true';

  const closePinned = () => {
    const pinned = section.querySelector('.jose-node.is-pinned');
    const close = section.querySelector('[data-jose-card-close]');
    if (pinned && close) close.click();
  };

  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;
    const control = target.closest('[data-jose-mode],[data-jose-shuffle],[data-jose-surprise]');
    if (!control || !section.contains(control)) return;
    closePinned();
  }, true);
})();
