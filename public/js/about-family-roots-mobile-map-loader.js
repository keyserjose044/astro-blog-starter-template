(() => {
  if (typeof document === 'undefined') return;

  const VERSION = '20260809-mobile-map-loader-v2';
  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const loadTimers = new WeakMap();

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

  const cancelPendingLoad = (slot) => {
    if (!(slot instanceof HTMLElement)) return;
    const timer = loadTimers.get(slot);
    if (timer) window.clearTimeout(timer);
    loadTimers.delete(slot);
    delete slot.dataset.mobileMapArming;
  };

  const rememberFrame = (slot, frame) => {
    const source = frame.dataset.mapSrc || frame.getAttribute('src') || '';
    if (source && source !== 'about:blank') slot.dataset.mobileMapSrc = source;
    if (frame.title) slot.dataset.mobileMapTitle = frame.title;
  };

  const ensureLoader = (slot) => {
    if (!(slot instanceof HTMLElement) || !mobileQuery.matches) return;
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

  const neutralizeFrame = (frame) => {
    if (!(frame instanceof HTMLIFrameElement) || !mobileQuery.matches) return;
    const slot = frame.closest('.about-photo-map-slot--google');
    if (!(slot instanceof HTMLElement)) return;
    if (slot.dataset.mobileMapActive === '1') return;

    rememberFrame(slot, frame);
    frame.remove();
    ensureLoader(slot);
  };

  const neutralizeMaps = (root = document) => {
    if (!mobileQuery.matches) return;
    root.querySelectorAll?.('.about-photo-map-frame').forEach(neutralizeFrame);
    root.querySelectorAll?.('.about-photo-map-slot--google').forEach(ensureLoader);
  };

  const deactivateSlot = (slot) => {
    if (!(slot instanceof HTMLElement)) return;
    cancelPendingLoad(slot);
    slot.querySelectorAll('.about-photo-map-frame').forEach((frame) => {
      if (frame instanceof HTMLIFrameElement) rememberFrame(slot, frame);
      frame.remove();
    });
    slot.dataset.mobileMapActive = '0';
    ensureLoader(slot);

    const loader = slot.querySelector(':scope > .about-photo-map-mobile-loader');
    if (loader instanceof HTMLButtonElement) {
      loader.disabled = false;
      loader.querySelector('span')?.replaceChildren('Load interactive map');
    }
  };

  const deactivatePanelMaps = (panel) => {
    if (!(panel instanceof HTMLElement) || !mobileQuery.matches) return;
    panel.querySelectorAll('.about-photo-map-slot--google').forEach(deactivateSlot);
  };

  const createInteractiveFrame = (slot) => {
    if (!(slot instanceof HTMLElement) || !mobileQuery.matches) return;
    const source = slot.dataset.mobileMapSrc;
    if (!source) return;

    cancelPendingLoad(slot);
    slot.dataset.mobileMapActive = '1';
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

  const armInteractiveFrame = (slot, button) => {
    if (!(slot instanceof HTMLElement) || !(button instanceof HTMLButtonElement)) return;
    if (slot.dataset.mobileMapArming === '1') return;

    slot.dataset.mobileMapArming = '1';
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.querySelector('span')?.replaceChildren('Loading map…');

    /*
      Critical mobile safeguard: do NOT insert the cross-origin iframe during the
      gesture that pressed this button. Some mobile browsers can retarget the tail
      end of that same tap into a newly created Google Maps iframe. Wait until the
      entire pointer/touch/click sequence is unquestionably over, then create it.
    */
    const timer = window.setTimeout(() => {
      if (!slot.isConnected || !mobileQuery.matches) {
        cancelPendingLoad(slot);
        return;
      }
      createInteractiveFrame(slot);
    }, 850);
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
    armInteractiveFrame(slot, button);
  };

  const handleNavigationGesture = (event) => {
    if (!mobileQuery.matches) return;
    const target = event.target;
    if (!(target instanceof Element)) return;

    const branchButton = target.closest('[data-roots-tab]');
    const panelToggle = target.closest('[data-where-toggle]');
    const panelClose = target.closest('[data-where-close]');
    const control = branchButton || panelToggle || panelClose;
    if (!(control instanceof Element)) return;

    const feature = control.closest('[data-about-photo-feature]');
    const panel = feature?.querySelector('[data-where-panel]');
    deactivatePanelMaps(panel);
  };

  const observePanel = (panel) => {
    if (!(panel instanceof HTMLElement) || panel.dataset.mobileMapLoaderReady === VERSION) return;
    panel.dataset.mobileMapLoaderReady = VERSION;

    const observer = new MutationObserver(() => neutralizeMaps(panel));
    observer.observe(panel, { childList: true, subtree: true });
    neutralizeMaps(panel);
  };

  const setup = () => {
    ensureStyles();
    document.querySelectorAll('[data-where-panel]').forEach(observePanel);
    neutralizeMaps();
  };

  setup();

  document.addEventListener('pointerdown', handleNavigationGesture, true);
  document.addEventListener('touchstart', handleNavigationGesture, { capture: true, passive: true });
  document.addEventListener('mousedown', handleNavigationGesture, true);
  document.addEventListener('click', handleLoaderClick, true);

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', () => {
      if (!mobileQuery.matches) return;
      document.querySelectorAll('[data-where-panel]').forEach(deactivatePanelMaps);
      setup();
    });
  }

  document.addEventListener('astro:page-load', () => {
    if (mobileQuery.matches) {
      document.querySelectorAll('[data-where-panel]').forEach(deactivatePanelMaps);
    }
    setup();
  });
})();
