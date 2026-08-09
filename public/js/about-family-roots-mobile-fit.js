(() => {
  if (typeof document === 'undefined') return;

  const VERSION = '20260808-mobile-fit-v2';
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
          A branch switch replaces one tall stack of embedded maps with another.
          On some mobile browsers the release/synthetic click can be retargeted into
          the newly revealed Google iframe. Disable the whole map slot briefly—not
          just the iframe—so the branch tap can never become a map tap.
        */
        .about-photo-where[data-branch-touch-guard='1'] .about-photo-map-slot--google,
        .about-photo-where[data-branch-touch-guard='1'] .about-photo-map-frame{
          pointer-events:none!important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const guardBranchMaps = (panel) => {
    if (!(panel instanceof HTMLElement) || !mobileQuery.matches) return;
    const prior = guardTimers.get(panel);
    if (prior) window.clearTimeout(prior);

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

  ensureStyles();

  /* Start the guard before the branch switch can reveal the other iframe stack. */
  document.addEventListener('pointerdown', guardFromEvent, true);
  document.addEventListener('pointerup', guardFromEvent, true);
  document.addEventListener('touchstart', guardFromEvent, { capture: true, passive: true });
  document.addEventListener('touchend', guardFromEvent, { capture: true, passive: true });
  document.addEventListener('click', guardFromEvent, true);

  document.addEventListener('astro:page-load', ensureStyles);
})();
