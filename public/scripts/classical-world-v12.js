/* LifeLoggerz Classical Music — World v12.
   Keeps World as a top-level view, restores Europe as the default map,
   and maps profiled composers from the nationality metadata already present in the cards. */

const CLASSICAL_WORLD_V12_RETRIES = 260;
const CLASSICAL_WORLD_BASE_MAP = 'https://upload.wikimedia.org/wikipedia/commons/8/8e/BlankMap_World_simple.svg';
const CLASSICAL_WORLD_SOURCE = 'https://commons.wikimedia.org/wiki/File:BlankMap_World_simple.svg';

const clean = (value) => String(value ?? '').trim();
const norm = (value) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const html = (value) => clean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const attr = html;

/* The current Raindrop profiles use these nationality strings. Compound identities are
   deliberately checked first so a German–Danish or Franco-Flemish composer does not get
   swallowed by the broader German/French rules. Coordinates are regional anchors only. */
const REGION_POINTS = [
  { keys: ['franco flemish'], label: 'Franco-Flemish', lat: 50.85, lon: 4.35, europe: true },
  { keys: ['german danish'], label: 'German–Danish', lat: 54.7, lon: 9.5, europe: true },
  { keys: ['german british'], label: 'German–British', lat: 51.5, lon: 10.0, europe: true },
  { keys: ['french italian born'], label: 'French (Italian-born)', lat: 46.3, lon: 2.2, europe: true },
  { keys: ['polish'], label: 'Polish', lat: 52.0, lon: 19.1, europe: true },
  { keys: ['austrian'], label: 'Austrian', lat: 47.6, lon: 14.1, europe: true },
  { keys: ['german'], label: 'German', lat: 51.0, lon: 10.5, europe: true },
  { keys: ['hungarian'], label: 'Hungarian', lat: 47.2, lon: 19.5, europe: true },
  { keys: ['english', 'british'], label: 'English / British', lat: 52.5, lon: -1.5, europe: true },
  { keys: ['italian'], label: 'Italian', lat: 42.8, lon: 12.5, europe: true },
  { keys: ['french'], label: 'French', lat: 46.3, lon: 2.2, europe: true },
  { keys: ['czech', 'bohemian'], label: 'Czech / Bohemian', lat: 49.8, lon: 15.5, europe: true },
  { keys: ['spanish'], label: 'Spanish', lat: 40.3, lon: -3.7, europe: true },
  { keys: ['portuguese'], label: 'Portuguese', lat: 39.5, lon: -8.0, europe: true },
  { keys: ['dutch'], label: 'Dutch', lat: 52.1, lon: 5.3, europe: true },
  { keys: ['danish'], label: 'Danish', lat: 55.7, lon: 10.0, europe: true },
  { keys: ['norwegian'], label: 'Norwegian', lat: 60.5, lon: 8.0, europe: true },
  { keys: ['swedish'], label: 'Swedish', lat: 62.0, lon: 15.0, europe: true },
  { keys: ['finnish'], label: 'Finnish', lat: 64.0, lon: 26.0, europe: true },
  { keys: ['romanian'], label: 'Romanian', lat: 45.9, lon: 25.0, europe: true },
  { keys: ['swiss'], label: 'Swiss', lat: 46.8, lon: 8.2, europe: true },
  { keys: ['greek'], label: 'Greek', lat: 39.1, lon: 21.8, europe: true },
  { keys: ['ukrainian'], label: 'Ukrainian', lat: 49.0, lon: 31.0, europe: true },
  { keys: ['croatian'], label: 'Croatian', lat: 45.2, lon: 15.5, europe: true },
  { keys: ['slovenian'], label: 'Slovenian', lat: 46.1, lon: 14.8, europe: true },
  { keys: ['serbian'], label: 'Serbian', lat: 44.0, lon: 20.8, europe: true },
  { keys: ['russian'], label: 'Russian', lat: 55.7, lon: 37.6, europe: true },
  { keys: ['american', 'united states'], label: 'American', lat: 39.8, lon: -98.6, europe: false },
  { keys: ['canadian'], label: 'Canadian', lat: 56.1, lon: -106.3, europe: false },
  { keys: ['mexican'], label: 'Mexican', lat: 23.6, lon: -102.5, europe: false },
  { keys: ['brazilian'], label: 'Brazilian', lat: -14.2, lon: -51.9, europe: false },
  { keys: ['argentine', 'argentinian'], label: 'Argentine', lat: -38.4, lon: -63.6, europe: false },
  { keys: ['chinese'], label: 'Chinese', lat: 35.9, lon: 104.2, europe: false },
  { keys: ['japanese'], label: 'Japanese', lat: 36.2, lon: 138.3, europe: false },
  { keys: ['korean'], label: 'Korean', lat: 36.5, lon: 127.9, europe: false },
];

const ROBINSON_X = [1, .9986, .9954, .99, .9822, .973, .96, .9427, .9216, .8962, .8679, .835, .7986, .7597, .7186, .6732, .6213, .5722, .5322];
const ROBINSON_Y = [0, .062, .124, .186, .248, .31, .372, .434, .4958, .5571, .6176, .6769, .7346, .7903, .8435, .8936, .9394, .9761, 1];

function project(lat, lon) {
  const absoluteLat = Math.min(90, Math.abs(Number(lat) || 0));
  const clampedLon = Math.max(-180, Math.min(180, Number(lon) || 0));
  const index = Math.min(17, Math.floor(absoluteLat / 5));
  const fraction = (absoluteLat - (index * 5)) / 5;
  const xFactor = ROBINSON_X[index] + ((ROBINSON_X[index + 1] - ROBINSON_X[index]) * fraction);
  const yFactor = ROBINSON_Y[index] + ((ROBINSON_Y[index + 1] - ROBINSON_Y[index]) * fraction);
  return {
    x: 50 + (((clampedLon / 180) * xFactor) * 50),
    y: 50 - (((lat < 0 ? -1 : 1) * yFactor) * 50),
  };
}

function pointFromCard(card) {
  /* data-search already contains the parsed Raindrop nationality even when older card
     display markup accidentally repeated the lifespan. This lets World use all profiles. */
  const haystack = norm(`${card.dataset.nationality || ''} ${card.dataset.search || ''}`);
  if (!haystack) return null;
  return REGION_POINTS.find((point) => point.keys.some((key) => haystack.includes(norm(key)))) || null;
}

function portraitMarkup(composer, className = 'classical-world12-portrait') {
  if (composer.portrait) return `<img class="${className}" src="${attr(composer.portrait)}" alt="" loading="lazy" decoding="async">`;
  return `<span class="${className} classical-world12-portrait--fallback" aria-hidden="true">${html(composer.initials)}</span>`;
}

function bootClassicalWorldV12(attempt = 0) {
  const ready = document.body.dataset.classicalWorldV11Ready === 'true';
  const worldPanel = document.querySelector('[data-page-panel="world"]');
  const worldTab = document.querySelector('[data-page-tab="world"]');
  const composerGrid = document.querySelector('#composer-grid');
  if ((!ready || !worldPanel || !worldTab || !composerGrid) && attempt < CLASSICAL_WORLD_V12_RETRIES) {
    window.setTimeout(() => bootClassicalWorldV12(attempt + 1), 75);
    return;
  }
  if (!ready || !worldPanel || !worldTab || !composerGrid || document.body.dataset.classicalWorldV12Ready) return;
  document.body.dataset.classicalWorldV12Ready = 'true';

  const cards = Array.from(composerGrid.querySelectorAll('.composer-card[data-composer-id]'));
  const profiled = cards
    .filter((card) => !card.querySelector('.profile-badge'))
    .map((card) => {
      const name = clean(card.dataset.name);
      const point = pointFromCard(card);
      return {
        id: clean(card.dataset.composerId),
        name,
        card,
        point,
        projected: point ? project(point.lat, point.lon) : null,
        portrait: card.querySelector('.portrait')?.getAttribute('src') || '',
        initials: clean(card.querySelector('.portrait-fallback')?.textContent) || name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 3),
        works: Number(card.dataset.unique || 0),
        favorites: Number(card.dataset.favorites || 0),
      };
    });

  const mapped = profiled.filter((composer) => composer.point && composer.projected);
  const unmapped = profiled.filter((composer) => !composer.point || !composer.projected);
  const europeMapped = mapped.filter((composer) => composer.point.europe);

  const clusterPattern = [
    [0, 0], [-10, -10], [10, -10], [-14, 8], [14, 8], [0, 15], [-20, -1], [20, -1], [-8, 18], [8, 18],
    [-24, -12], [24, -12], [-24, 14], [24, 14], [0, -20],
  ];

  function makePins(composers) {
    const groups = new Map();
    composers.forEach((composer) => {
      const key = composer.point.label;
      groups.set(key, [...(groups.get(key) || []), composer]);
    });
    const pins = [];
    groups.forEach((group) => {
      group.forEach((composer, index) => {
        const offset = clusterPattern[index % clusterPattern.length];
        pins.push(`
          <button type="button" class="classical-world12-pin" style="--pin-x:${composer.projected.x.toFixed(3)}%;--pin-y:${composer.projected.y.toFixed(3)}%;--pin-dx:${offset[0]}px;--pin-dy:${offset[1]}px" data-world12-composer="${attr(composer.id)}" title="${attr(`${composer.name} · ${composer.point.label}`)}" aria-label="Open ${attr(composer.name)} repertoire">
            ${portraitMarkup(composer, 'classical-world12-pin__portrait')}
          </button>`);
      });
    });
    return pins.join('');
  }

  function directoryCards(composers) {
    return [...composers]
      .sort((a, b) => a.point.label.localeCompare(b.point.label) || a.name.localeCompare(b.name))
      .map((composer) => `
        <button type="button" class="classical-world12-card" data-world12-composer="${attr(composer.id)}">
          ${portraitMarkup(composer)}
          <span><b>${html(composer.name)}</b><em>${html(composer.point.label)}</em><small>${composer.works.toLocaleString('en-US')} works · ${composer.favorites.toLocaleString('en-US')} favorites</small></span>
        </button>`).join('');
  }

  function mapMarkup(mode) {
    const isEurope = mode === 'europe';
    const selected = isEurope ? europeMapped : mapped;
    const outside = isEurope ? mapped.length - europeMapped.length : unmapped.length;
    return `
      <div class="classical-world12-map-frame" data-world12-mode="${mode}">
        <div class="classical-world12-stage ${isEurope ? 'is-europe' : 'is-world'}" aria-label="${isEurope ? 'Europe' : 'World'} map with composer portrait markers">
          <div class="classical-world12-canvas">
            <img class="classical-world12-base" src="${attr(CLASSICAL_WORLD_BASE_MAP)}" alt="Outline map of the world" loading="lazy" referrerpolicy="no-referrer">
            <div class="classical-world12-pins">${makePins(selected)}</div>
          </div>
        </div>
        <div class="classical-world12-status">
          <span><b>${selected.length.toLocaleString('en-US')}</b> profiled composer${selected.length === 1 ? '' : 's'} mapped in this view</span>
          ${outside ? `<span>${outside.toLocaleString('en-US')} ${isEurope ? 'outside Europe' : 'not yet mapped'}</span>` : ''}
          <a href="${attr(CLASSICAL_WORLD_SOURCE)}" target="_blank" rel="noopener noreferrer">Public-domain base map ↗</a>
        </div>
      </div>`;
  }

  worldPanel.innerHTML = `
    <div class="panel-heading">
      <h2>Composer World</h2>
      <p>Where the profiled classical canon comes from. Europe is the natural starting point; World reveals the wider archive as it grows.</p>
    </div>
    <div class="classical-world12-shell">
      <section class="classical-world12-intro">
        <span>CLASSICAL CANON GEOGRAPHY</span>
        <h3>First Europe. Then the world.</h3>
        <p>The current bubbles use the country and regional identity already stored in each Raindrop composer profile. They are regional anchors rather than invented career-city claims; exact city trails can come later.</p>
      </section>
      <div class="classical-world12-switch" role="group" aria-label="Composer map view">
        <button type="button" aria-pressed="true" data-world12-map="europe">Europe</button>
        <button type="button" aria-pressed="false" data-world12-map="world">World</button>
      </div>
      <div data-world12-map-host>${mapMarkup('europe')}</div>
      <section class="classical-world12-directory">
        <div><h3>Mapped Composers</h3><p>${mapped.length.toLocaleString('en-US')} of ${profiled.length.toLocaleString('en-US')} profiled composers currently resolve from stored nationality metadata.</p></div>
        <div class="classical-world12-directory__grid">${directoryCards(mapped)}</div>
        ${unmapped.length ? `<details class="classical-world12-unmapped"><summary>${unmapped.length.toLocaleString('en-US')} profile${unmapped.length === 1 ? '' : 's'} still need a regional rule</summary><p>${unmapped.map((composer) => html(composer.name)).join(' · ')}</p></details>` : ''}
      </section>
    </div>`;

  const mapHost = worldPanel.querySelector('[data-world12-map-host]');
  const buttons = Array.from(worldPanel.querySelectorAll('[data-world12-map]'));
  function setMap(mode) {
    const normalizedMode = mode === 'world' ? 'world' : 'europe';
    buttons.forEach((button) => button.setAttribute('aria-pressed', button.dataset.world12Map === normalizedMode ? 'true' : 'false'));
    if (mapHost) mapHost.innerHTML = mapMarkup(normalizedMode);
  }

  function openComposer(id) {
    const card = cards.find((candidate) => clean(candidate.dataset.composerId) === clean(id));
    const trigger = card?.querySelector('[data-composer-trigger]');
    if (!trigger) return;
    trigger.click();
    const chooseWorks = (tries = 0) => {
      const works = document.querySelector('#composer-dialog [data-detail-tab="works"]');
      if (works) { works.click(); return; }
      if (tries < 30) window.setTimeout(() => chooseWorks(tries + 1), 30);
    };
    window.setTimeout(() => chooseWorks(), 0);
  }

  worldPanel.addEventListener('click', (event) => {
    const mapButton = event.target.closest('[data-world12-map]');
    if (mapButton) { setMap(mapButton.dataset.world12Map); return; }
    const composerButton = event.target.closest('[data-world12-composer]');
    if (composerButton) openComposer(composerButton.dataset.world12Composer);
  });
}

bootClassicalWorldV12();
