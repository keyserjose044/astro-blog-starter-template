/* LifeLoggerz Classical Music — World v13.
   Makes Europe the polished primary geography view, uses the exact nationality metadata
   currently stored for profiled composers, and fans same-region portraits around their
   true regional anchor instead of letting clusters obscure geography. */

const WORLD13_RETRIES = 260;
const WORLD13_MAP = 'https://upload.wikimedia.org/wikipedia/commons/8/8e/BlankMap_World_simple.svg';
const WORLD13_SOURCE = 'https://commons.wikimedia.org/wiki/File:BlankMap_World_simple.svg';

const w13Clean = (value) => String(value ?? '').trim();
const w13Norm = (value) => w13Clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const w13Esc = (value) => w13Clean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/* These values come directly from the current Raindrop composer-profile metadata.
   Keeping the known set explicit prevents unrelated words in listening metadata from
   accidentally turning a Spanish composer into an Italian one, etc. Future profiles
   still fall back to nationality-key matching below. */
const PROFILE_REGION_BY_NAME = new Map(Object.entries({
  'frederic chopin': 'polish',
  'johann nepomuk hummel': 'austrian',
  'robert schumann': 'german',
  'franz liszt': 'hungarian',
  'johannes brahms': 'german',
  'henry purcell': 'english',
  'francesco antonio bonporti': 'italian',
  'tomaso albinoni': 'italian',
  'dieterich buxtehude': 'german danish',
  'alessandro scarlatti': 'italian',
  'domenico scarlatti': 'italian',
  'francois couperin': 'french',
  'george frideric handel': 'german british',
  'jean baptiste lully': 'french italian born',
  'jean philippe rameau': 'french',
  'jan dismas zelenka': 'czech',
  'carlo tessarini': 'italian',
  'claudio monteverdi': 'italian',
  'luigi boccherini': 'italian',
  'salvatore lanzetti': 'italian',
  'giovanni gabrieli': 'italian',
  'william byrd': 'english',
  'thomas tallis': 'english',
  'tomas luis de victoria': 'spanish',
  'john dowland': 'english',
  'josquin des prez': 'franco flemish',
  'giovanni pierluigi da palestrina': 'italian',
  'arcangelo corelli': 'italian',
  'wilhelm friedemann bach': 'german',
  'johann christian bach': 'german',
  'carl philipp emanuel bach': 'german',
  'georg philipp telemann': 'german',
  'antonio vivaldi': 'italian',
  'johann sebastian bach': 'german',
  'felix mendelssohn': 'german',
  'franz schubert': 'austrian',
  'ludwig van beethoven': 'german',
  'wolfgang amadeus mozart': 'austrian',
  'joseph haydn': 'austrian',
}));

const WORLD13_REGIONS = [
  { key: 'franco flemish', label: 'Franco-Flemish', lat: 50.85, lon: 4.35, europe: true },
  { key: 'german danish', label: 'German–Danish', lat: 54.70, lon: 9.50, europe: true },
  { key: 'german british', label: 'German–British', lat: 52.30, lon: 4.50, europe: true },
  { key: 'french italian born', label: 'French (Italian-born)', lat: 48.86, lon: 2.35, europe: true },
  { key: 'polish', label: 'Poland', lat: 52.00, lon: 19.10, europe: true },
  { key: 'austrian', label: 'Austria', lat: 48.20, lon: 16.37, europe: true },
  { key: 'german', label: 'Germany', lat: 51.00, lon: 10.50, europe: true },
  { key: 'hungarian', label: 'Hungary', lat: 47.50, lon: 19.05, europe: true },
  { key: 'english', label: 'England', lat: 52.30, lon: -1.80, europe: true },
  { key: 'british', label: 'Britain', lat: 52.30, lon: -1.80, europe: true },
  { key: 'italian', label: 'Italy', lat: 42.80, lon: 12.50, europe: true },
  { key: 'french', label: 'France', lat: 46.50, lon: 2.20, europe: true },
  { key: 'czech', label: 'Czechia', lat: 49.82, lon: 15.47, europe: true },
  { key: 'bohemian', label: 'Bohemia', lat: 49.82, lon: 15.47, europe: true },
  { key: 'spanish', label: 'Spain', lat: 40.42, lon: -4.20, europe: true },
  { key: 'portuguese', label: 'Portugal', lat: 39.50, lon: -8.00, europe: true },
  { key: 'dutch', label: 'Netherlands', lat: 52.10, lon: 5.30, europe: true },
  { key: 'danish', label: 'Denmark', lat: 55.70, lon: 10.00, europe: true },
  { key: 'norwegian', label: 'Norway', lat: 60.50, lon: 8.00, europe: true },
  { key: 'swedish', label: 'Sweden', lat: 62.00, lon: 15.00, europe: true },
  { key: 'finnish', label: 'Finland', lat: 64.00, lon: 26.00, europe: true },
  { key: 'romanian', label: 'Romania', lat: 45.90, lon: 25.00, europe: true },
  { key: 'swiss', label: 'Switzerland', lat: 46.80, lon: 8.20, europe: true },
  { key: 'greek', label: 'Greece', lat: 39.10, lon: 21.80, europe: true },
  { key: 'ukrainian', label: 'Ukraine', lat: 49.00, lon: 31.00, europe: true },
  { key: 'russian', label: 'Russia', lat: 55.70, lon: 37.60, europe: true },
  { key: 'american', label: 'United States', lat: 39.80, lon: -98.60, europe: false },
  { key: 'united states', label: 'United States', lat: 39.80, lon: -98.60, europe: false },
  { key: 'chinese', label: 'China', lat: 35.90, lon: 104.20, europe: false },
];

const RX = [1,.9986,.9954,.99,.9822,.973,.96,.9427,.9216,.8962,.8679,.835,.7986,.7597,.7186,.6732,.6213,.5722,.5322];
const RY = [0,.062,.124,.186,.248,.31,.372,.434,.4958,.5571,.6176,.6769,.7346,.7903,.8435,.8936,.9394,.9761,1];

function w13Project(lat, lon) {
  const a = Math.min(90, Math.abs(Number(lat) || 0));
  const l = Math.max(-180, Math.min(180, Number(lon) || 0));
  const i = Math.min(17, Math.floor(a / 5));
  const f = (a - (i * 5)) / 5;
  const xf = RX[i] + ((RX[i + 1] - RX[i]) * f);
  const yf = RY[i] + ((RY[i + 1] - RY[i]) * f);
  return { x: 50 + (((l / 180) * xf) * 50), y: 50 - (((lat < 0 ? -1 : 1) * yf) * 50) };
}

function w13RegionFor(card) {
  const exact = PROFILE_REGION_BY_NAME.get(w13Norm(card.dataset.name));
  if (exact) return WORLD13_REGIONS.find((region) => region.key === exact) || null;
  const haystack = w13Norm(card.dataset.search || '');
  return WORLD13_REGIONS.find((region) => haystack.includes(region.key)) || null;
}

function w13Portrait(composer, className = 'world13-portrait') {
  if (composer.portrait) return `<img class="${className}" src="${w13Esc(composer.portrait)}" alt="" loading="lazy" decoding="async">`;
  return `<span class="${className} world13-portrait--fallback" aria-hidden="true">${w13Esc(composer.initials)}</span>`;
}

function w13Offsets(count, mode) {
  if (count <= 1) return [[0, 0]];
  const result = [];
  const baseRadius = mode === 'europe' ? 27 : 25;
  for (let index = 0; index < count; index += 1) {
    if (index === 0) { result.push([0, 0]); continue; }
    const ring = index <= 6 ? 1 : index <= 14 ? 2 : 3;
    const ringStart = ring === 1 ? 1 : ring === 2 ? 7 : 15;
    const ringCount = ring === 1 ? Math.min(6, count - 1) : ring === 2 ? Math.min(8, Math.max(0, count - 7)) : Math.max(1, count - 15);
    const pos = index - ringStart;
    const angle = (-Math.PI / 2) + ((Math.PI * 2 * pos) / Math.max(1, ringCount));
    const radius = baseRadius * ring;
    result.push([Math.round(Math.cos(angle) * radius), Math.round(Math.sin(angle) * radius)]);
  }
  return result;
}

function bootWorld13(attempt = 0) {
  const ready = document.body.dataset.classicalWorldV12Ready === 'true';
  const panel = document.querySelector('[data-page-panel="world"]');
  const grid = document.querySelector('#composer-grid');
  if ((!ready || !panel || !grid) && attempt < WORLD13_RETRIES) {
    window.setTimeout(() => bootWorld13(attempt + 1), 75);
    return;
  }
  if (!ready || !panel || !grid || document.body.dataset.classicalWorldV13Ready) return;
  document.body.dataset.classicalWorldV13Ready = 'true';

  const profiled = Array.from(grid.querySelectorAll('.composer-card[data-composer-id]'))
    .filter((card) => !card.querySelector('.profile-badge'))
    .map((card) => {
      const name = w13Clean(card.dataset.name);
      const region = w13RegionFor(card);
      return {
        id: w13Clean(card.dataset.composerId),
        name,
        region,
        projected: region ? w13Project(region.lat, region.lon) : null,
        portrait: card.querySelector('.portrait')?.getAttribute('src') || '',
        initials: w13Clean(card.querySelector('.portrait-fallback')?.textContent) || name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0,3),
        works: Number(card.dataset.unique || 0),
        favorites: Number(card.dataset.favorites || 0),
      };
    });

  const mapped = profiled.filter((composer) => composer.region && composer.projected);
  const europe = mapped.filter((composer) => composer.region.europe);
  const unmapped = profiled.filter((composer) => !composer.region || !composer.projected);

  function pinsFor(list, mode) {
    const groups = new Map();
    list.forEach((composer) => {
      const key = composer.region.label;
      groups.set(key, [...(groups.get(key) || []), composer]);
    });
    const output = [];
    groups.forEach((group, label) => {
      group.sort((a,b) => a.name.localeCompare(b.name));
      const offsets = w13Offsets(group.length, mode);
      group.forEach((composer, index) => {
        const [dx, dy] = offsets[index] || [0,0];
        output.push(`<button type="button" class="world13-pin" style="--pin-x:${composer.projected.x.toFixed(3)}%;--pin-y:${composer.projected.y.toFixed(3)}%;--pin-dx:${dx}px;--pin-dy:${dy}px" data-world13-composer="${w13Esc(composer.id)}" aria-label="Open ${w13Esc(composer.name)} repertoire" title="${w13Esc(`${composer.name} · ${label}`)}">${w13Portrait(composer,'world13-pin__portrait')}<span class="world13-tooltip"><b>${w13Esc(composer.name)}</b><small>${w13Esc(label)}</small></span></button>`);
      });
      if (mode === 'europe') {
        const anchor = group[0].projected;
        output.push(`<span class="world13-region-label" style="--pin-x:${anchor.x.toFixed(3)}%;--pin-y:${anchor.y.toFixed(3)}%">${w13Esc(label)} · ${group.length}</span>`);
      }
    });
    return output.join('');
  }

  function directory(list) {
    return [...list].sort((a,b) => a.region.label.localeCompare(b.region.label) || a.name.localeCompare(b.name)).map((composer) => `<button type="button" class="world13-card" data-world13-composer="${w13Esc(composer.id)}">${w13Portrait(composer)}<span><b>${w13Esc(composer.name)}</b><em>${w13Esc(composer.region.label)}</em><small>${composer.works.toLocaleString('en-US')} works · ${composer.favorites.toLocaleString('en-US')} favorites</small></span></button>`).join('');
  }

  function map(mode) {
    const isEurope = mode === 'europe';
    const list = isEurope ? europe : mapped;
    return `<div class="world13-map-frame" data-world13-mode="${mode}"><div class="world13-stage ${isEurope ? 'is-europe' : 'is-world'}"><div class="world13-canvas"><img class="world13-base" src="${WORLD13_MAP}" alt="${isEurope ? 'Europe' : 'World'} map" loading="lazy" referrerpolicy="no-referrer"><div class="world13-pins">${pinsFor(list, mode)}</div></div></div><div class="world13-status"><span><b>${list.length}</b> profiled composers mapped in this view</span>${isEurope && mapped.length > europe.length ? `<span>${mapped.length - europe.length} outside Europe</span>` : ''}${unmapped.length ? `<span>${unmapped.length} not yet resolved</span>` : ''}<a href="${WORLD13_SOURCE}" target="_blank" rel="noopener noreferrer">Public-domain base map ↗</a></div></div>`;
  }

  panel.innerHTML = `<div class="panel-heading"><h2>Composer World</h2><p>Where the profiled classical canon comes from. Europe is the natural starting point; World reveals the wider archive as it grows.</p></div><div class="world13-shell"><section class="world13-intro"><span>CLASSICAL CANON GEOGRAPHY</span><h3>First Europe. Then the world.</h3><p>Portraits are anchored to the country or regional identity stored in each composer profile. Shared regions fan outward around one geographic anchor so the map stays readable without pretending that every composer came from the same city.</p></section><div class="world13-switch" role="group" aria-label="Composer map view"><button type="button" aria-pressed="true" data-world13-map="europe">Europe</button><button type="button" aria-pressed="false" data-world13-map="world">World</button></div><div data-world13-host>${map('europe')}</div><section class="world13-directory"><div><h3>Mapped Composers</h3><p>${mapped.length} of ${profiled.length} profiled composers resolve from the current profile metadata.</p></div><div class="world13-directory__grid">${directory(mapped)}</div></section></div>`;

  let mode = 'europe';
  const host = panel.querySelector('[data-world13-host]');
  const switches = Array.from(panel.querySelectorAll('[data-world13-map]'));
  const setMode = (next) => {
    mode = next === 'world' ? 'world' : 'europe';
    switches.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.world13Map === mode)));
    host.innerHTML = map(mode);
  };
  switches.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.world13Map)));

  const openComposer = (id) => {
    const trigger = document.querySelector(`[data-composer-trigger="${CSS.escape(id)}"]`);
    if (!trigger) return;
    trigger.click();
    window.setTimeout(() => document.querySelector('#composer-dialog [data-detail-tab="works"]')?.click(), 70);
  };
  panel.addEventListener('click', (event) => {
    const target = event.target.closest('[data-world13-composer]');
    if (target) openComposer(target.dataset.world13Composer);
  });
}

bootWorld13();
