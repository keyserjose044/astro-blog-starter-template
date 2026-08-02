(() => {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('[data-about-photo-feature]').forEach((feature) => {
    const toggle = feature.querySelector('[data-where-toggle]');
    const panel = feature.querySelector('[data-where-panel]');
    const close = feature.querySelector('[data-where-close]');
    if (!toggle || !panel) return;

    const setOpen = (open, { returnFocus = false } = {}) => {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      panel.dataset.open = open ? '1' : '0';

      if (open) {
        panel.setAttribute('aria-hidden', 'false');
      } else {
        panel.setAttribute('aria-hidden', 'true');
        if (returnFocus) toggle.focus({ preventScroll: true });
      }
    };

    toggle.addEventListener('click', () => {
      setOpen(panel.hidden);
    });

    close?.addEventListener('click', () => {
      setOpen(false, { returnFocus: true });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || panel.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false, { returnFocus: true });
    }, true);
  });
})();
