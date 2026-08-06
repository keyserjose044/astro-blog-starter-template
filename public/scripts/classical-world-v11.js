/* LifeLoggerz Classical Music — World v11.
   Promotes composer geography out of Journey into its own top-level World view,
   and replaces guessed percentage placement with Robinson-projected regional anchors. */

const CLASSICAL_WORLD_V11_RETRIES = 260;
const CLASSICAL_WORLD_MAP_URL = 'https://upload.wikimedia.org/wikipedia/commons/8/8e/BlankMap_World_simple.svg';
const CLASSICAL_WORLD_MAP_SOURCE = 'https://commons.wikimedia.org/wiki/File:BlankMap_World_simple.svg';

const worldClean = (value) => String(value ?? '').trim();
const worldNorm = (value) => worldClean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const worldHtml = (value) => worldClean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const worldAttr = worldHtml;

const CLASSICAL_PERIODS = new Set([
  'medieval', 'renaissance', 'baroque', 'galant', 'classical', 'romantic',
  'late romantic', 'impressionist', 'modern', 'contemporary',
]);

/* Nationality/region anchors. These are deliberately regional rather than claims about
   a composer's exact birthplace or career city. Exact city trails can replace them later. */
const WORLD_REGION_POINTS = [
  { keys: ['franco flemish', 'flemish', 'belgian', 'belgium'], label: 'Franco-Flemish / Belgium', lat: 50.85, lon: 4.35 },
  { keys: ['english', 'british', 'scottish', 'united kingdom', 'uk'], label: 'United Kingdom', lat: 52.5, lon: -1.5 },
  { keys: ['italian', 'italy'], label: 'Italy', lat: 42.8, lon: 12.5 },
  { keys: ['german', 'germany'], label: 'Germany', lat: 51.0, lon: 10.5 },
  { keys: ['austrian', 'austria'], label: 'Austria', lat: 47.6, lon: 14.1 },
  { keys: ['french', 'france'], label: 'France', lat: 46.3, lon: 2.2 },
  { keys: ['polish', 'poland'], label: 'Poland', lat: 52.0, lon: 19.1 },
  { keys: ['czech', 'bohemian', 'czechia'], label: 'Czechia / Bohemia', lat: 49.8, lon: 15.5 },
  { keys: ['spanish', 'spain'], label: 'Spain', lat: 40.3, lon: -3.7 },
  { keys: ['portuguese', 'portugal'], label: 'Portugal', lat: 39.5, lon: -8.0 },
  { keys: ['dutch', 'netherlands'], label: 'Netherlands', lat: 52.1, lon: 5.3 },
  { keys: ['danish', 'denmark'], label: 'Denmark', lat: 55.7, lon: 10.0 },
  { keys: ['norwegian', 'norway'], label: 'Norway', lat: 60.5, lon: 8.0 },
  { keys: ['swedish', 'sweden'], label: 'Sweden', lat: 62.0, lon: 15.0 },
  { keys: ['finnish', 'finland'], label: 'Finland', lat: 64.0, lon: 26.0 },
  { keys: ['hungarian', 'hungary'], label: 'Hungary', lat: 47.2, lon: 19.5 },
  { keys: ['romanian', 'romania'], label: 'Romania', lat: 45.9, lon: 25.0 },
  { keys: ['swiss', 'switzerland'], label: 'Switzerland', lat: 46.8, lon: 8.2 },
  { keys: ['greek', 'greece'], label: 'Greece', lat: 39.1, lon: 21.8 },
  { keys: ['ukrainian', 'ukraine'], label: 'Ukraine', lat: 49.0, lon: 31.0 },
  { keys: ['croatian', 'croatia'], label: 'Croatia', lat: 45.2, lon: 15.5 },
  { keys: ['slovenian', 'slovenia'], label: 'Slovenia', lat: 46.1, lon: 14.8 },
  { keys: ['serbian', 'serbia'], label: 'Serbia', lat: 44.0, lon: 20.8 },
  { keys: ['russian', 'russia'], label: 'Russia (western)', lat: 55.7, lon: 37.6 },
  { keys: ['american', 'united states', 'usa', 'u s'], label: 'United States', lat: 39.8, lon: -98.6 },
  { keys: ['canadian', 'canada'], label: 'Canada', lat: 56.1, lon: -106.3 },
  { keys: ['mexican', 'mexico'], label: 'Mexico', lat: 23.6, lon: -102.5 },
  { keys: ['brazilian', 'brazil'], label: 'Brazil', lat: -14.2, lon: -51.9 },
  { keys: ['argentine', 'argentinian', 'argentina'], label: 'Argentina', lat: -38.4, lon: -63.6 },
  { keys: ['chinese', 'china'], label: 'China', lat: 35.9, lon: 104.2 },
  { keys: ['japanese', 'japan'], label: 'Japan', lat: 36.2, lon: 138.3 },
  { keys: ['korean', 'korea'], label: 'Korea', lat: 36.5, lon: 127.9 },
];

/* Standard Robinson projection interpolation tables, 0°–90° in 5° steps. */
const ROBINSON_X = [1, .9986, .9954, .99, .9822, .973, .96, .9427, .9216, .8962, .8679, .835, .7986, .7597, .7186, .6732, .6213, .5722, .5322];
const ROBINSON_Y = [0, .062, .124, .186, .248, .31, .372, .434, .4958, .5571, .6176, .6769, .7346, .7903, .8435, .8936, .9394, .9761, 1];

function worldProject(lat, lon) {
  const absoluteLat = Math.min(90, Math.abs(Number(lat) || 0));
  const clampedLon = Math.max(-180, Math.min(180, Number(lon) || 0));
  const index = Math.min(17, Math.floor(absoluteLat / 5));
  const fraction = (absoluteLat - (index * 5)) / 5;
  const xFactor = ROBINSON_X[index] + ((ROBINSON_X[index + 1] - ROBINSON_X[index]) * fraction);
  const yFactor = ROBINSON_Y[index] + ((ROBINSON_Y[index + 1] - ROBINSON_Y[index]) * fraction);
  const normalizedX = (clampedLon / 180) * xFactor;
  const normalizedY = (lat < 0 ? -1 : 1) * yFactor;
  return {
    x: 50 + (normalizedX * 50),
    y: 50 - (normalizedY * 50),
  };
}

function worldLifePart(value) {
  return /\b(?:c\.?\s*)?\d{3,4}\s*[–—-]\s*(?:c\.?\s*)?(?:\d{3,4}|present)\b/i.test(worldClean(value));
}

function worldNationalityFromCard(card) {
  const period = worldNorm(card.dataset.period);
  const parts = worldClean(card.querySelector('.composer-meta')?.textContent)
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.find((part) => {
    const normalized = worldNorm(part);
    return normalized && !worldLifePart(part) && normalized !== period && !CLASSICAL_PERIODS.has(normalized);
  }) || '';
}

function worldPointFor(nationality) {
  const normalized = worldNorm(nationality);
  if (!normalized) return null;
  return WORLD_REGION_POINTS.find((point) => point.keys.some((key) => normalized.includes(worldNorm(key)))) || null;
}

function composerVisual(composer) {
  if (composer.portrait) {
    return `<img class="classical-world-pin__portrait" src="${worldAttr(composer.portrait)}" alt="" loading="lazy" decoding="async">`;
  }
  return `<span class="classical-world-pin__portrait classical-world-pin__portrait--fallback" aria-hidden="true">${worldHtml(composer.initials)}</span>`;
}

function bootClassicalWorldV11(attempt = 0) {
  const journeyReady = document.body.dataset.classicalJourneyV10Ready === 'true';
  const tabs = document.querySelector('.page-tabs');
  const journeyPanel = document.querySelector('[data-page-panel="journey"]');
  const recordsTab = tabs?.querySelector('[data-page-tab="records"]');
  const composerGrid = document.querySelector('#composer-grid');

  if ((!journeyReady || !tabs || !journeyPanel || !recordsTab || !composerGrid) && attempt < CLASSICAL_WORLD_V11_RETRIES) {
    window.setTimeout(() => bootClassicalWorldV11(attempt + 1), 75);
    return;
  }
  if (!journeyReady || !tabs || !journeyPanel || !recordsTab || !composerGrid || document.body.dataset.classicalWorldV11Ready) return;
  document.body.dataset.classicalWorldV11Ready = 'true';

  /* Journey should stay about chronology and the canon trail. */
  const journeyHost = journeyPanel.querySelector('[data-classical-panel-content]');
  const geographySwitch = journeyHost?.querySelector('[data-canon-view="geography"]');
  const geographyView = journeyHost?.querySelector('[data-journey-view="geography"]');
  const canonSwitch = journeyHost?.querySelector('[data-canon-view="canon"]');
  if (geographySwitch?.getAttribute('aria-pressed') === 'true') canonSwitch?.click();
  geographySwitch?.remove();
  geographyView?.remove();
  const journeyCopy = journeyPanel.querySelector('.panel-heading p');
  if (journeyCopy) journeyCopy.textContent = 'Follow the composer-by-composer Canon Trail or retrace the order in which the music entered my own listening life.';

  let worldTab = tabs.querySelector('[data-page-tab="world"]');
  if (!worldTab) {
    worldTab = document.createElement('button');
    worldTab.type = 'button';
    worldTab.className = 'page-tab';
    worldTab.setAttribute('role', 'tab');
    worldTab.setAttribute('aria-selected', 'false');
    worldTab.dataset.pageTab = 'world';
    worldTab.textContent = 'World';
    recordsTab.before(worldTab);
  }

  let worldPanel = document.querySelector('[data-page-panel="world"]');
  if (!worldPanel) {
    worldPanel = document.createElement('section');
    worldPanel.className = 'page-panel classical-expansion-panel classical-world-panel';
    worldPanel.dataset.pagePanel = 'world';
    worldPanel.setAttribute('role', 'tabpanel');
    worldPanel.hidden = true;
    journeyPanel.insertAdjacentElement('afterend', worldPanel);
  }

  const cards = Array.from(composerGrid.querySelectorAll('.composer-card[data-composer-id]'));
  const composers = cards.map((card) => {
    const name = worldClean(card.dataset.name);
    const initials = worldClean(card.querySelector('.portrait-fallback')?.textContent)
      || name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 3);
    const nationality = worldNationalityFromCard(card);
    return {
      id: worldClean(card.dataset.composerId),
      name,
      card,
      profiled: !card.querySelector('.profile-badge'),
      portrait: card.querySelector('.portrait')?.getAttribute('src') || '',
      initials,
      nationality,
      works: Number(card.dataset.unique || 0),
      minutes: Number(card.dataset.minutes || 0),
      favorites: Number(card.dataset.favorites || 0),
    };
  }).filter((composer) => composer.profiled);

  const mapped = [];
  const unmapped = [];
  composers.forEach((composer) => {
    const point = worldPointFor(composer.nationality);
    if (!point) unmapped.push(composer);
    else mapped.push({ composer, point, projected: worldProject(point.lat, point.lon) });
  });

  const clusterPatterns = [
    [0, 0], [-14, -12], [14, -12], [-18, 10], [18, 10], [0, 20], [-25, -3], [25, -3],
  ];
  const byLocation = new Map();
  mapped.forEach((record) => {
    const key = record.point.label;
    byLocation.set(key, [...(byLocation.get(key) || []), record]);
  });

  const pins = [];
  byLocation.forEach((records) => {
    records.forEach((record, index) => {
      const offset = clusterPatterns[index % clusterPatterns.length];
      pins.push(`
        <button type="button" class="classical-world-pin" style="--pin-x:${record.projected.x.toFixed(3)}%;--pin-y:${record.projected.y.toFixed(3)}%;--pin-dx:${offset[0]}px;--pin-dy:${offset[1]}px" data-world-composer="${worldAttr(record.composer.id)}" title="${worldAttr(`${record.composer.name} · ${record.point.label}`)}" aria-label="Open ${worldAttr(record.composer.name)} repertoire">
          ${composerVisual(record.composer)}
          <span class="classical-world-pin__ring" aria-hidden="true"></span>
        </button>`);
    });
  });

  const mappedCards = mapped
    .sort((a, b) => a.point.label.localeCompare(b.point.label) || a.composer.name.localeCompare(b.composer.name))
    .map(({ composer, point }) => `
      <button type="button" class="classical-world-list-card" data-world-composer="${worldAttr(composer.id)}">
        ${composerVisual(composer)}
        <span><b>${worldHtml(composer.name)}</b><em>${worldHtml(point.label)}</em><small>${composer.works.toLocaleString('en-US')} works · ${composer.favorites.toLocaleString('en-US')} favorites</small></span>
      </button>`).join('');

  worldPanel.innerHTML = `
    <div class="panel-heading">
      <h2>Composer World</h2>
      <p>Where the profiled classical canon comes from, using the reliable nationality and regional metadata already stored in the archive.</p>
    </div>
    <div class="classical-world-shell">
      <section class="classical-world-intro">
        <span>CLASSICAL CANON GEOGRAPHY</span>
        <h3>The canon is also a world.</h3>
        <p>This layer is intentionally conservative: the bubbles mark regional anchors from composer-profile metadata, not invented claims about one definitive city. Later, exact city trails can show places such as Vienna, Leipzig, Venice, Paris, London, New York, or Beijing as that metadata is added.</p>
      </section>

      <div class="classical-world-map-frame">
        <div class="classical-world-stage" aria-label="World map with composer portrait markers">
          <img class="classical-world-stage__base" src="${worldAttr(CLASSICAL_WORLD_MAP_URL)}" alt="Outline map of the world" loading="lazy" referrerpolicy="no-referrer">
          <div class="classical-world-stage__pins">${pins.join('')}</div>
        </div>
      </div>

      <div class="classical-world-status">
        <span><b>${mapped.length.toLocaleString('en-US')}</b> profiled composers mapped</span>
        <span><b>${unmapped.length.toLocaleString('en-US')}</b> awaiting usable location metadata</span>
        <a href="${worldAttr(CLASSICAL_WORLD_MAP_SOURCE)}" target="_blank" rel="noopener noreferrer">Public-domain Robinson base map ↗</a>
      </div>

      ${mapped.length ? `
        <section class="classical-world-directory">
          <div><h3>Mapped composers</h3><p>The same locations as a readable directory; click any composer to open the repertoire.</p></div>
          <div class="classical-world-directory__grid">${mappedCards}</div>
        </section>` : ''}
    </div>`;

  function openComposerWorks(composerId) {
    const composer = composers.find((candidate) => candidate.id === composerId);
    const trigger = composer?.card.querySelector('[data-composer-trigger]');
    if (!trigger) return;
    trigger.click();
    const selectWorks = (tries = 0) => {
      const dialog = document.querySelector('#composer-dialog');
      const worksTab = dialog?.querySelector('[data-detail-tab="works"]');
      if (worksTab) {
        worksTab.click();
        return;
      }
      if (tries < 30) window.setTimeout(() => selectWorks(tries + 1), 30);
    };
    window.setTimeout(() => selectWorks(), 0);
  }

  function activateWorld(updateUrl = true) {
    document.querySelectorAll('[data-page-tab]').forEach((tab) => tab.setAttribute('aria-selected', tab.dataset.pageTab === 'world' ? 'true' : 'false'));
    document.querySelectorAll('[data-page-panel]').forEach((panel) => { panel.hidden = panel.dataset.pagePanel !== 'world'; });
    if (updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('view', 'world');
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  worldTab.addEventListener('click', () => activateWorld(true));
  worldPanel.addEventListener('click', (event) => {
    const target = event.target.closest('[data-world-composer]');
    if (target) openComposerWorks(target.dataset.worldComposer || '');
  });

  if (new URL(window.location.href).searchParams.get('view') === 'world') activateWorld(false);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalWorldV11(), { once: true });
} else {
  bootClassicalWorldV11();
}
