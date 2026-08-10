(() => {
  if (typeof document === 'undefined') return;

  const VERSION = '20260809-mobile-map-loader-v3';
  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const loadTimers = new WeakMap();

  const STATE = {
    UNLOADED: 'unloaded',
    LOADING: 'loading',
    INTERACTIVE: 'interactive',
  };

  const ensureStyles = () => {
    if (document.querySelector(`style[data-family-roots-mobile-map-loader="${VERSION}"]`)) return;

    const style = document.createElement('style');
    style.dataset.familyRootsMobileMapLoader = VERSION;
    style.textContent = `
      @media(max-width:768px){
        .about-photo-map-slot--google{
          position:relative;
        }

        .about-photo-map-mobile-loader{
          appearance:none;
          position:absolute;
          z-index:6;
          inset:0;
          width:100%;
          height:100%;
          display:grid;
          place-items:center;
          padding:1rem;
          border:0;
          border-radius:inherit;
          background:
            radial-gradient(circle at 50% 40%,rgba(255,255,255,.3),transparent 45%),
            linear-gradient(145deg,rgba(234,226,214,.98),rgba(245,240,232,.98));
          color:#4a3a2d;
          cursor:pointer;
          touch-action:manipulation;
        }

        .about-photo-map-mobile-loader[disabled]{
          cursor:progress;
        }

        .about-photo-map-mobile-loader > span{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:40px;
          padding:.52rem .82rem;
          border:1px solid rgba(110,84,58,.32);
          border-radius:999px;
          background:rgba(255,250,242,.96);
          box-shadow:0 4px 12px rgba(62,45,29,.12);
          font:800 .72rem/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        }

        .about-photo-map-mobile-loader:focus-visible{
          outline:2px solid rgba(44,91,71,.72);
          outline-offset:-4px;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const getState = (slot) => slot.dataset.mobileMapState || '';
  const setState = (slot, state) => {
    slot.dataset.mobileMapState = state;
  };

  const cancelPendingLoad = (slot) => {
    if (!(slot instanceof HTMLElement)) return;
    const timer = loadTimers.get(slot);
    if (timer) window.clearTimeout(timer);
    loadTimers.delete(slot);
  };

  const rememberFrame = (slot, frame) => {
    const source = frame.dataset.mapSrc || frame.getAttribute('src') || '';
    if (source && source !== 'about:blank') slot.dataset.mobileMapSrc = source;
    if (frame.title) slot.dataset.mobileMapTitle = frame.title;
  };

  const ensureLoader = (slot) => {
    if (!(slot instanceof HTMLElement) || !mobileQuery.matches) return;
    if (getState(slot) !== STATE.UNLOADED) return;
    if (slot.querySelector(':scope > .about-photo-map-mobile-loader')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'about-photo-map-mobile-loader';
    button.setAttribute('aria-label', slot.dataset.mobileMapTitle
      ? `Load ${slot.dataset.mobileMapTitle}`
      : 'Load interactive Google map');

    const label = document.createElement('span');
    label.textContent = 'Load interactive map';
    button.appendChild(label);
    slot.appendChild(button);
  };

  /*
    The legacy Family Roots script eagerly inserts Google iframes when the panel
    opens. On mobile, intercept only those externally-created frames while the
    slot has not entered our lifecycle yet. Once loading/interactive, this
    observer is not allowed to reset the slot or recreate its loader.
  */
  const interceptExternalFrame = (frame) => {
    if (!(frame instanceof HTMLIFrameElement) || !mobileQuery.matches) return;
    const slot = frame.closest('.about-photo-map-slot--google');
    if (!(slot instanceof HTMLElement)) return;

    const state = getState(slot);
    if (state === STATE.LOADING || state === STATE.INTERACTIVE) return;

    rememberFrame(slot, frame);
    frame.remove();
    setState(slot, STATE.UNLOADED);
    ensureLoader(slot);
  };

  const reconcileSlots = (root = document) => {
    if (!mobileQuery.matches) return;

    root.querySelectorAll?.('.about-photo-map-frame').forEach(interceptExternalFrame);
    root.querySelectorAll?.('.about-photo-map-slot--google').forEach((slot) => {
      if (!(slot instanceof HTMLElement)) return;
      if (!getState(slot)) setState(slot, STATE.UNLOADED);
      ensureLoader(slot);
    });
  };

  const unloadSlot = (slot) => {
    if (!(slot instanceof HTMLElement)) return;

    cancelPendingLoad(slot);
    slot.querySelectorAll('.about-photo-map-frame').forEach((frame) => {
      if (frame instanceof HTMLIFrameElement) rememberFrame(slot, frame);
      frame.remove();
    });

    slot.querySelector(':scope > .about-photo-map-mobile-loader')?.remove();
    setState(slot, STATE.UNLOADED);
    ensureLoader(slot);
  };

  const unloadPanelMaps = (panel) => {
    if (!(panel instanceof HTMLElement) || !mobileQuery.matches) return;
    panel.querySelectorAll('.about-photo-map-slot--google').forEach(unloadSlot);
  };

  const createInteractiveFrame = (slot) => {
    if (!(slot instanceof HTMLElement) || !mobileQuery.matches) return;
    if (getState(slot) !== STATE.LOADING) return;

    const source = slot.dataset.mobileMapSrc;
    if (!source) {
      setState(slot, STATE.UNLOADED);
      const loader = slot.querySelector(':scope > .about-photo-map-mobile-loader');
      if (loader instanceof HTMLButtonElement) {
        loader.disabled = false;
        loader.removeAttribute('aria-busy');
        loader.querySelector('span')?.replaceChildren('Load interactive map');
      }
      ensureLoader(slot);
      return;
    }

    cancelPendingLoad(slot);
    setState(slot, STATE.INTERACTIVE);
    slot.querySelector(':scope > .about-photo-map-mobile-loader')?.remove();

    const frame = document.createElement('iframe');
    frame.className = 'about-photo-map-frame';
    frame.src = source;
    frame.dataset.mapSrc = source;
    frame.title = slot.dataset.mobileMapTitle || 'Interactive Google map';
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer-when-downgrade';
    frame.setAttribute('allowfullscreen', '');
    slot.appendChild(frame);
  };

  const startLoading = (slot, button) => {
    if (!(slot instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return;
    if (getState(slot) !== STATE.UNLOADED) return;

    setState(slot, STATE.LOADING);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.querySelector('span')?.replaceChildren('Loading map…');

    /*
      Let the loader tap finish before the cross-origin iframe exists. The timer
      is only a gesture boundary; state, not elapsed time, controls the lifecycle.
    */
    const timer = window.setTimeout(() => {
      if (!slot.isConnected || !mobileQuery.matches || getState(slot) !== STATE.LOADING) {
        cancelPendingLoad(slot);
        return;
      }
      createInteractiveFrame(slot);
    }, 500);
    loadTimers.set(slot, timer);
  };

  const handleLoaderClick = (event) => {
    if (!mobileQuery.matches) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('.about-photo-map-mobile-loader');
    if (!(button instanceof HTMLButtonElement)) return;
    const slot = button.closest('.about-photo-map-slot--google');
    if (!(slot instanceof HTMLElement)) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    startLoading(slot, button);
  };

  const handleNavigationGesture = (event) => {
    if (!mobileQuery.matches) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const control =
      target.closest('[data-roots-tab]') ||
      target.closest('[data-where-toggle]') ||
      target.closest('[data-where-close]');
    if (!(control instanceof Element)) return;

    const feature = control.closest('[data-about-photo-feature]');
    const panel = feature?.querySelector('[data-where-panel]');
    unloadPanelMaps(panel);
  };

  const observePanel = (panel) => {
    if (!(panel instanceof HTMLElement) || panel.dataset.mobileMapLoaderReady === VERSION) return;
    panel.dataset.mobileMapLoaderReady = VERSION;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches('.about-photo-map-frame')) interceptExternalFrame(node);
          node.querySelectorAll?.('.about-photo-map-frame').forEach(interceptExternalFrame);
        });
      });
    });
    observer.observe(panel, { childList: true, subtree: true });
    reconcileSlots(panel);
  };

  const setup = () => {
    ensureStyles();
    document.querySelectorAll('[data-where-panel]').forEach(observePanel);
    reconcileSlots();
  };

  setup();

  document.addEventListener('pointerdown', handleNavigationGesture, true);
  document.addEventListener('touchstart', handleNavigationGesture, { capture: true, passive: true });
  document.addEventListener('mousedown', handleNavigationGesture, true);
  document.addEventListener('click', handleLoaderClick, true);

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', () => {
      if (!mobileQuery.matches) return;
      document.querySelectorAll('[data-where-panel]').forEach(unloadPanelMaps);
      setup();
    });
  }

  document.addEventListener('astro:page-load', () => {
    if (mobileQuery.matches) {
      document.querySelectorAll('[data-where-panel]').forEach(unloadPanelMaps);
    }
    setup();
  });
})();
