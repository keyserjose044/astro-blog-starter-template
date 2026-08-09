(() => {
  if (typeof document === 'undefined') return;

  const VERSION = '20260808-mobile-fit-v3';
  const mobileQuery = window.matchMedia('(max-width: 768px)');
  const guardTimers = new WeakMap();

  const ensureStyles = () => {
    if (document.querySelector(`style[data-family-roots-mobile-fit="${VERSION}"]`)) return;

    const style = document.createElement('style');
    style.dataset.familyRootsMobileFit = VERSION;
    style.textContent = `
      @media(max-width:768px){
        .about-photo-where-card-head > span:last-child{
          flex:1 1 auto;
          min-width:0;
        }

        .about-photo-where-name{
          width:100%;
          min-width:0;
        }

        .about-photo-where-name > .about-photo-where-place-link{
          min-width:0;
          overflow-wrap:anywhere;
        }

        /* Keep the control accessible, but reclaim the word “Facts” on narrow cards. */
        .about-photo-where-facts-toggle{
          box-sizing:border-box;
          width:26px!important;
          min-width:26px!important;
          height:26px!important;
          min-height:26px!important;
          display:inline-grid!important;
          place-items:center;
          padding:0!important;
          overflow:hidden;
          font-size:0!important;
          line-height:1!important;
        }

        .about-photo-where-facts-toggle::before{
          content:'ⓘ';
          font:700 .82rem/1 Georgia,serif;
        }

        /* México's national total is uniquely long; leave all narrower-place pills alone. */
        .about-photo-where-step:first-child .about-photo-where-population{
          max-width:100%;
          padding:.2rem .42rem!important;
          font-size:.62rem!important;
          letter-spacing:.025em!important;
          white-space:nowrap;
        }

        .about-photo-roots-tab{
          touch-action:manipulation;
        }

        /*
          Mobile map embeds are inert until the visitor deliberately activates one.
          This removes the browser hit-testing race that could turn the Mom's-side
          branch tap into a Google Maps tap when the newly revealed iframe appeared.
        */
        .about-photo-map-slot--google:not([data-map-interactive='1']) .about-photo-map-frame{
          pointer-events:none!important;
        }

        .about-photo-map-mobile-guard{
          appearance:none;
          position:absolute;
          z-index:5;
          inset:0;
          width:100%;
          height:100%;
          display:flex;
          align-items:flex-end;
          justify-content:center;
          padding:.7rem;
          border:0;
          border-radius:inherit;
          background:linear-gradient(to top,rgba(35,28,21,.3),rgba(35,28,21,0) 42%);
          color:#fff;
          cursor:pointer;
          touch-action:manipulation;
        }

        .about-photo-map-mobile-guard > span{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          min-height:34px;
          padding:.42rem .7rem;
          border:1px solid rgba(255,255,255,.72);
          border-radius:999px;
          background:rgba(44,35,27,.82);
          box-shadow:0 3px 10px rgba(0,0,0,.2);
          font:800 .68rem/1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
          letter-spacing:.01em;
        }

        .about-photo-map-slot--google[data-map-interactive='1'] .about-photo-map-mobile-guard{
          display:none!important;
        }

        /* Extra defense while a branch-changing gesture is still finishing. */
        .about-photo-where[data-branch-touch-guard='1'] .about-photo-map-slot--google,
        .about-photo-where[data-branch-touch-guard='1'] .about-photo-map-frame{
          pointer-events:none!important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const lockMaps = (root = document) => {
    if (!mobileQuery.matches) return;
    root.querySelectorAll?.('.about-photo-map-slot--google').forEach((slot) => {
      if (!(slot instanceof HTMLElement)) return;
      slot.dataset.mapInteractive = '0';
    });
  };

  const decorateMap = (slot) => {
    if (!(slot instanceof HTMLElement) || !mobileQuery.matches) return;
    if (!slot.classList.contains('about-photo-map-slot--google')) return;

    slot.dataset.mapInteractive = slot.dataset.mapInteractive === '1' ? '1' : '0';
    if (slot.querySelector(':scope > .about-photo-map-mobile-guard')) return;

    const frame = slot.querySelector('.about-photo-map-frame');
    const guard = document.createElement('button');
    guard.type = 'button';
    guard.className = 'about-photo-map-mobile-guard';
    guard.setAttribute('aria-label', frame?.title ? `Activate ${frame.title}` : 'Activate interactive Google map');

    const label = document.createElement('span');
    label.textContent = 'Tap to interact with map';
    guard.appendChild(label);
    slot.appendChild(guard);
  };

  const decorateMaps = (root = document) => {
    if (!mobileQuery.matches) return;
    root.querySelectorAll?.('.about-photo-map-slot--google').forEach(decorateMap);
  };

  const observeMaps = () => {
    document.querySelectorAll('[data-where-panel]').forEach((panel) => {
      if (!(panel instanceof HTMLElement) || panel.dataset.mobileMapObserverReady === VERSION) return;
      panel.dataset.mobileMapObserverReady = VERSION;

      const observer = new MutationObserver(() => decorateMaps(panel));
      observer.observe(panel, { childList: true, subtree: true });
      decorateMaps(panel);
    });
  };

  const guardBranchMaps = (panel) => {
    if (!(panel instanceof HTMLElement) || !mobileQuery.matches) return;
    const prior = guardTimers.get(panel);
    if (prior) window.clearTimeout(prior);

    lockMaps(panel);
    panel.dataset.branchTouchGuard = '1';
    const timer = window.setTimeout(() => {
      delete panel.dataset.branchTouchGuard;
      guardTimers.delete(panel);
    }, 1250);
    guardTimers.set(panel, timer);
  };

  const guardFromEvent = (event) => {
    if (!mobileQuery.matches) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('[data-roots-tab]');
    if (!(button instanceof HTMLButtonElement)) return;
    const panel = button.closest('[data-where-panel]');
    guardBranchMaps(panel);
  };

  const activateMapFromClick = (event) => {
    if (!mobileQuery.matches) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const guard = target.closest('.about-photo-map-mobile-guard');
    if (!(guard instanceof HTMLButtonElement)) return;

    const slot = guard.closest('.about-photo-map-slot--google');
    if (!(slot instanceof HTMLElement)) return;

    /* Unlock only after the synthetic click has landed on our button. */
    event.preventDefault();
    event.stopPropagation();
    slot.dataset.mapInteractive = '1';
  };

  const setup = () => {
    ensureStyles();
    observeMaps();
    decorateMaps();
  };

  setup();

  /* Start the guard before the branch switch can reveal the other iframe stack. */
  document.addEventListener('pointerdown', guardFromEvent, true);
  document.addEventListener('pointerup', guardFromEvent, true);
  document.addEventListener('touchstart', guardFromEvent, { capture: true, passive: true });
  document.addEventListener('touchend', guardFromEvent, { capture: true, passive: true });
  document.addEventListener('click', guardFromEvent, true);
  document.addEventListener('click', activateMapFromClick, true);

  if (typeof mobileQuery.addEventListener === 'function') {
    mobileQuery.addEventListener('change', () => {
      if (mobileQuery.matches) {
        lockMaps();
        setup();
      }
    });
  }

  document.addEventListener('astro:page-load', () => {
    if (mobileQuery.matches) lockMaps();
    setup();
  });
})();
