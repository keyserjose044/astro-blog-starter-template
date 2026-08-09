(() => {
  if (typeof document === 'undefined') return;

  const VERSION = '20260808-quick-facts-v1';

  const factsByBranch = {
    dad: [
      null,
      {
        label: 'Aguascalientes quick facts',
        facts: [
          ['Area', '5,617.8 km²'],
          ['Municipalities', '11'],
          ['Region', 'North-central México'],
        ],
      },
      {
        label: 'Asientos quick facts',
        facts: [
          ['Area', '547.74 km²'],
          ['Elevation', '1,800–2,700 m'],
          ['Municipal seat', 'Real de Asientos'],
        ],
      },
      {
        label: 'Amarillas de Esparza quick facts',
        facts: [
          ['Elevation', '≈2,000 m'],
          ['Municipality', 'Asientos'],
          ['Setting', 'Aguascalientes highlands'],
        ],
      },
    ],
    mom: [
      null,
      {
        label: 'Tamaulipas quick facts',
        facts: [
          ['Area', '80,249 km²'],
          ['Municipalities', '43'],
          ['Region', 'Northeastern México'],
        ],
      },
      {
        label: 'Matamoros quick facts',
        facts: [
          ['Border', 'Across the Río Bravo from Brownsville, Texas'],
          ['Municipality area', '4,045.62 km²'],
          ['Setting', 'Río Bravo + Gulf of Mexico'],
        ],
      },
      {
        label: 'Colonia Progreso quick facts',
        facts: [
          ['Elevation', '≈5 m'],
          ['Municipality', 'Matamoros'],
          ['Region', 'Northern Tamaulipas'],
        ],
      },
    ],
  };

  const ensureStyles = () => {
    if (document.querySelector(`style[data-family-roots-facts="${VERSION}"]`)) return;

    const style = document.createElement('style');
    style.dataset.familyRootsFacts = VERSION;
    style.textContent = `
      .about-photo-where-population{
        font-size:.64rem!important;
        letter-spacing:.055em!important;
        line-height:1.15!important;
        padding:.22rem .5rem!important;
      }

      .about-photo-where-fact-row{
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:.28rem;
        margin-top:.18rem;
      }

      .about-photo-where-fact-row > .about-photo-where-population{
        margin:0!important;
      }

      .about-photo-where-facts-toggle{
        appearance:none;
        border:1px solid rgba(151,113,70,.28);
        border-radius:999px;
        background:rgba(255,252,246,.9);
        color:#72502f;
        box-shadow:0 1px 2px rgba(71,48,27,.05);
        padding:.2rem .43rem;
        font:700 .61rem/1.15 Georgia,serif;
        letter-spacing:.02em;
        cursor:pointer;
        white-space:nowrap;
        transition:background .16s ease,border-color .16s ease,transform .16s ease;
      }

      .about-photo-where-facts-toggle:hover,
      .about-photo-where-facts-toggle:focus-visible,
      .about-photo-where-facts-toggle[aria-expanded='true']{
        background:#fffaf1;
        border-color:rgba(151,113,70,.55);
      }

      .about-photo-where-facts-toggle:active{
        transform:translateY(1px);
      }

      .about-photo-where-card{
        position:relative;
      }

      .about-photo-where-facts-popover{
        position:absolute;
        z-index:12;
        top:4.65rem;
        left:.72rem;
        right:.72rem;
        padding:.68rem .72rem .62rem;
        border:1px solid rgba(151,113,70,.28);
        border-radius:12px;
        background:rgba(255,252,246,.97);
        box-shadow:0 12px 28px rgba(54,36,20,.18);
        backdrop-filter:blur(10px);
        color:#493626;
      }

      .about-photo-where-facts-popover[hidden]{
        display:none!important;
      }

      .about-photo-where-facts-title{
        display:block;
        margin:0 0 .38rem;
        color:#8a5d31;
        font:800 .64rem/1.1 system-ui,sans-serif;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .about-photo-where-facts-list{
        display:grid;
        gap:.32rem;
        margin:0;
      }

      .about-photo-where-facts-item{
        display:grid;
        grid-template-columns:minmax(4.8rem,.72fr) minmax(0,1.28fr);
        gap:.55rem;
        align-items:start;
      }

      .about-photo-where-facts-item dt,
      .about-photo-where-facts-item dd{
        margin:0;
      }

      .about-photo-where-facts-item dt{
        color:#8a6747;
        font:700 .67rem/1.25 system-ui,sans-serif;
      }

      .about-photo-where-facts-item dd{
        color:#3f3024;
        font:600 .72rem/1.3 Georgia,serif;
        text-align:right;
      }

      @media(max-width:768px){
        .about-photo-where-population{
          font-size:.68rem!important;
          padding:.24rem .52rem!important;
        }

        .about-photo-where-facts-toggle{
          min-height:28px;
          padding:.25rem .5rem;
          font-size:.65rem;
        }

        .about-photo-where-facts-popover{
          top:4.85rem;
          left:.62rem;
          right:.62rem;
          padding:.76rem;
        }

        .about-photo-where-facts-item dt{
          font-size:.7rem;
        }

        .about-photo-where-facts-item dd{
          font-size:.76rem;
        }
      }
    `;
    document.head.appendChild(style);
  };

  let openPanel = null;
  let openButton = null;

  const closeOpenFacts = ({ returnFocus = false } = {}) => {
    if (openPanel) openPanel.hidden = true;
    if (openButton) {
      openButton.setAttribute('aria-expanded', 'false');
      if (returnFocus) openButton.focus({ preventScroll: true });
    }
    openPanel = null;
    openButton = null;
  };

  const buildFacts = (card, details, key, index) => {
    if (!(card instanceof HTMLElement) || !details || card.dataset.quickFactsReady === '1') return;

    const population = card.querySelector('.about-photo-where-population');
    if (!(population instanceof HTMLElement)) return;

    card.dataset.quickFactsReady = '1';

    const row = document.createElement('span');
    row.className = 'about-photo-where-fact-row';
    population.replaceWith(row);
    row.appendChild(population);

    const panelId = `family-roots-${key}-facts-${index}`;
    const button = document.createElement('button');
    button.className = 'about-photo-where-facts-toggle';
    button.type = 'button';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', panelId);
    button.setAttribute('aria-label', `Show ${details.label}`);
    button.textContent = 'ⓘ Facts';
    row.appendChild(button);

    const panel = document.createElement('div');
    panel.className = 'about-photo-where-facts-popover';
    panel.id = panelId;
    panel.hidden = true;
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', details.label);

    const title = document.createElement('strong');
    title.className = 'about-photo-where-facts-title';
    title.textContent = 'Quick facts';

    const list = document.createElement('dl');
    list.className = 'about-photo-where-facts-list';
    details.facts.forEach(([term, value]) => {
      const item = document.createElement('div');
      item.className = 'about-photo-where-facts-item';
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = term;
      dd.textContent = value;
      item.append(dt, dd);
      list.appendChild(item);
    });

    panel.append(title, list);
    card.appendChild(panel);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const opening = panel.hidden;
      closeOpenFacts();
      if (!opening) return;
      panel.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      openPanel = panel;
      openButton = button;
    });

    panel.addEventListener('click', (event) => event.stopPropagation());
  };

  const setup = () => {
    ensureStyles();

    document.querySelectorAll('[data-where-panel]').forEach((rootsPanel) => {
      if (!(rootsPanel instanceof HTMLElement)) return;

      [
        ['dad', rootsPanel.querySelector('[aria-labelledby="family-roots-dad-title"]')],
        ['mom', rootsPanel.querySelector('[aria-labelledby="family-roots-mom-title"]')],
      ].forEach(([key, branch]) => {
        if (!(branch instanceof HTMLElement)) return;
        const cards = Array.from(branch.querySelectorAll('.about-photo-where-card')).slice(0, 4);
        cards.forEach((card, index) => {
          const details = factsByBranch[key]?.[index];
          if (details) buildFacts(card, details, key, index);
        });
      });
    });
  };

  document.addEventListener('click', () => closeOpenFacts());
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openPanel) closeOpenFacts({ returnFocus: true });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }

  document.addEventListener('astro:page-load', setup);
})();
