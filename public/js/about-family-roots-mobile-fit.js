(() => {
  if (typeof document === 'undefined') return;

  const VERSION = '20260809-mobile-fit-v4';

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
      }
    `;
    document.head.appendChild(style);
  };

  ensureStyles();
  document.addEventListener('astro:page-load', ensureStyles);
})();
