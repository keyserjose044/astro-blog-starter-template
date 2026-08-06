/* LifeLoggerz Classical Music — World v14.
   Replaces free-floating latitude/longitude portrait pins with the same vector-country
   map architecture used by Albums. Europe is a dedicated projection of the country
   geometry; composer placement is therefore tied to actual country shapes. */

const WORLD14_RETRIES = 260;
const MODULES = {
  d3: 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm',
  topo: 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm',
  world: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json/+esm',
  countries: 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/+esm',
};

const clean = (value) => String(value ?? '').trim();
const norm = (value) => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();
const esc = (value) => clean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

/* Current profiled canon. The profile note is the source of truth; these IDs simply
   bind that country-level metadata to the same ISO/numeric geometry used by Albums.
   Compound identities use the first/profile nationality as the primary map anchor;
   the original profile wording remains visible in the directory. */
const PROFILE_COUNTRY = new Map(Object.entries({
  'frederic chopin': '616',
  'johann nepomuk hummel': '040',
  'robert schumann': '276',
  'franz liszt': '348',
  'johannes brahms': '276',
  'henry purcell': '826',
  'francesco antonio bonporti': '380',
  'tomaso albinoni': '380',
  'dieterich buxtehude': '276',
  'alessandro scarlatti': '380',
  'domenico scarlatti': '380',
  'francois couperin': '250',
  'george frideric handel': '276',
  'jean baptiste lully': '250',
  'jean philippe rameau': '250',
  'jan dismas zelenka': '203',
  'carlo tessarini': '380',
  'claudio monteverdi': '380',
  'luigi boccherini': '380',
  'salvatore lanzetti': '380',
  'giovanni gabrieli': '380',
  'william byrd': '826',
  'thomas tallis': '826',
  'tomas luis de victoria': '724',
  'john dowland': '826',
  'josquin des prez': '056',
  'giovanni pierluigi da palestrina': '380',
  'arcangelo corelli': '380',
  'wilhelm friedemann bach': '276',
  'johann christian bach': '276',
  'carl philipp emanuel bach': '276',
  'georg philipp telemann': '276',
  'antonio vivaldi': '380',
  'johann sebastian bach': '276',
  'felix mendelssohn': '276',
  'franz schubert': '040',
  'ludwig van beethoven': '276',
  'wolfgang amadeus mozart': '040',
  'joseph haydn': '040',
}));

const NATIONALITY_COUNTRY = [
  [['franco flemish', 'flemish', 'belgian'], '056'],
  [['german danish'], '276'],
  [['german british'], '276'],
  [['french italian born'], '250'],
  [['polish'], '616'], [['austrian'], '040'], [['german'], '276'], [['hungarian'], '348'],
  [['english', 'british'], '826'], [['italian'], '380'], [['french'], '250'], [['czech', 'bohemian'], '203'],
  [['spanish'], '724'], [['portuguese'], '620'], [['dutch'], '528'], [['danish'], '208'],
  [['norwegian'], '578'], [['swedish'], '752'], [['finnish'], '246'], [['romanian'], '642'],
  [['swiss'], '756'], [['greek'], '300'], [['ukrainian'], '804'], [['croatian'], '191'],
  [['slovenian'], '705'], [['serbian'], '688'], [['russian'], '643'],
  [['american', 'united states'], '840'], [['canadian'], '124'], [['mexican'], '484'],
  [['brazilian'], '076'], [['argentine', 'argentinian'], '032'], [['chinese'], '156'],
  [['japanese'], '392'], [['korean'], '410'],
];

/* Europe-only projection set. Russia is intentionally omitted because its full Asian
   geometry would make a fitted Europe map tiny. The World view still renders Russia. */
const EUROPE_IDS = new Set([
  '008','020','040','056','070','100','112','191','196','203','208','233','246','250','276','300','348','352',
  '372','380','428','438','440','442','470','492','498','499','528','578','616','620','642','674','688','703',
  '705','724','752','756','792','804','807','826','336',
]);

function nationalityFromCard(card) {
  const meta = clean(card.querySelector('.composer-meta')?.textContent);
  const bits = meta.split(/\s*·\s*/).map(clean).filter(Boolean);
  return bits.find((part) => /(?:polish|austrian|german|hungarian|english|british|italian|french|czech|bohemian|spanish|portuguese|dutch|danish|norwegian|swedish|finnish|romanian|swiss|greek|ukrainian|croatian|slovenian|serbian|russian|american|canadian|mexican|brazilian|argentine|argentinian|chinese|japanese|korean|franco|flemish)/i.test(part)) || '';
}

function countryIdFor(card) {
  const exact = PROFILE_COUNTRY.get(norm(card.dataset.name));
  if (exact) return exact;
  const haystack = norm(`${card.dataset.nationality || ''} ${nationalityFromCard(card)}`);
  const rule = NATIONALITY_COUNTRY.find(([keys]) => keys.some((key) => haystack.includes(norm(key))));
  return rule?.[1] || '';
}

function portrait(composer, className = 'classical-world14-portrait') {
  if (composer.portrait) return `<img class="${className}" src="${esc(composer.portrait)}" alt="" loading="lazy" decoding="async">`;
  return `<span class="${className} is-fallback" aria-hidden="true">${esc(composer.initials)}</span>`;
}

function openComposer(composer) {
  const trigger = composer.card.querySelector('[data-composer-trigger]');
  trigger?.click();
  window.setTimeout(() => {
    const dialog = document.querySelector('#composer-dialog');
    const works = dialog?.querySelector('[data-detail-tab="works"]');
    if (works && works.getAttribute('aria-selected') !== 'true') works.click();
  }, 70);
}

async function bootWorld14(attempt = 0) {
  const worldPanel = document.querySelector('[data-page-panel="world"]');
  const worldTab = document.querySelector('[data-page-tab="world"]');
  const composerGrid = document.querySelector('#composer-grid');
  const v11Ready = document.body.dataset.classicalWorldV11Ready === 'true';
  if ((!v11Ready || !worldPanel || !worldTab || !composerGrid) && attempt < WORLD14_RETRIES) {
    window.setTimeout(() => bootWorld14(attempt + 1), 75);
    return;
  }
  if (!v11Ready || !worldPanel || !worldTab || !composerGrid || document.body.dataset.classicalWorldV14Ready) return;
  document.body.dataset.classicalWorldV14Ready = 'true';

  worldPanel.innerHTML = `
    <div class="panel-heading">
      <h2>Composer World</h2>
      <p>Explore the profiled classical canon geographically, using the country and regional identity stored with each composer profile.</p>
    </div>
    <div class="classical-world14-shell">
      <section class="classical-world14-intro">
        <span>CLASSICAL CANON GEOGRAPHY</span>
        <h3>First Europe. Then the world.</h3>
        <p>Country shapes now do the geographic work. That matches the metadata I actually store and avoids pretending a regional profile identifies one exact career city. Exact city trails can come later.</p>
      </section>
      <div class="classical-world14-switch" role="group" aria-label="Composer map view">
        <button type="button" aria-pressed="true" data-world14-mode="europe">Europe</button>
        <button type="button" aria-pressed="false" data-world14-mode="world">World</button>
      </div>
      <div class="classical-world14-layout">
        <section class="classical-world14-map-card">
          <div class="classical-world14-stage" data-world14-stage>
            <div class="classical-world14-loading"><strong>Building the map…</strong><span>Using the same vector-country system as Albums.</span></div>
            <div class="classical-world14-tooltip" data-world14-tooltip hidden></div>
          </div>
          <div class="classical-world14-footer"><span data-world14-status></span><span class="classical-world14-legend"><span>Fewer</span><i></i><i></i><i></i><i></i><i></i><span>More</span></span></div>
        </section>
        <aside class="classical-world14-country-panel" data-world14-country-panel></aside>
      </div>
      <section class="classical-world14-directory">
        <div><h3>Mapped Composers</h3><p data-world14-directory-copy></p></div>
        <div class="classical-world14-directory-grid" data-world14-directory></div>
      </section>
    </div>`;

  let d3, topo, atlas, countryRows;
  try {
    const [d3Module, topoModule, worldModule, countriesModule] = await Promise.all([
      import(MODULES.d3), import(MODULES.topo), import(MODULES.world), import(MODULES.countries),
    ]);
    d3 = d3Module;
    topo = topoModule;
    atlas = worldModule.default || worldModule;
    countryRows = countriesModule.default || countriesModule;
  } catch (error) {
    console.error('Classical World vector map failed to load.', error);
    const loading = worldPanel.querySelector('.classical-world14-loading');
    if (loading) loading.innerHTML = '<strong>The map could not load.</strong><span>The mapped-composer directory remains available below.</span>';
    return;
  }

  const countryById = new Map();
  countryRows.forEach((country) => {
    if (!country?.ccn3) return;
    const id = String(country.ccn3).padStart(3, '0');
    countryById.set(id, { id, name: country.name?.common || country.name?.official || id, flag: country.flag || '' });
  });

  const collection = topo.feature(atlas, atlas.objects.countries);
  const features = collection.features.filter((feature) => String(feature.id).padStart(3, '0') !== '010');
  const featureById = new Map(features.map((feature) => [String(feature.id).padStart(3, '0'), feature]));

  const cards = Array.from(composerGrid.querySelectorAll('.composer-card[data-composer-id]'))
    .filter((card) => !card.querySelector('.profile-badge'));
  const composers = cards.map((card) => {
    const name = clean(card.dataset.name);
    const countryId = countryIdFor(card);
    return {
      id: clean(card.dataset.composerId),
      name,
      card,
      countryId,
      nationality: nationalityFromCard(card),
      portrait: card.querySelector('.portrait')?.getAttribute('src') || '',
      initials: clean(card.querySelector('.portrait-fallback')?.textContent) || name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 3),
      works: Number(card.dataset.unique || 0),
      favorites: Number(card.dataset.favorites || 0),
      minutes: Number(card.dataset.minutes || 0),
    };
  });
  const mapped = composers.filter((composer) => composer.countryId && featureById.has(composer.countryId));
  const unmapped = composers.filter((composer) => !composer.countryId || !featureById.has(composer.countryId));
  const byCountry = new Map();
  mapped.forEach((composer) => byCountry.set(composer.countryId, [...(byCountry.get(composer.countryId) || []), composer]));

  const stage = worldPanel.querySelector('[data-world14-stage]');
  const tooltip = worldPanel.querySelector('[data-world14-tooltip]');
  const panel = worldPanel.querySelector('[data-world14-country-panel]');
  const status = worldPanel.querySelector('[data-world14-status]');
  const directory = worldPanel.querySelector('[data-world14-directory]');
  const directoryCopy = worldPanel.querySelector('[data-world14-directory-copy]');
  const modeButtons = Array.from(worldPanel.querySelectorAll('[data-world14-mode]'));
  let mode = 'europe';
  let selectedCountryId = '';

  function countryName(id) { return countryById.get(id)?.name || id; }
  function countryFlag(id) { return countryById.get(id)?.flag || ''; }
  function visibleFeatures() {
    return mode === 'europe' ? features.filter((feature) => EUROPE_IDS.has(String(feature.id).padStart(3, '0'))) : features;
  }
  function visibleCountryIds() {
    return new Set(visibleFeatures().map((feature) => String(feature.id).padStart(3, '0')));
  }

  function composerCard(composer, compact = false) {
    return `<button type="button" class="classical-world14-composer ${compact ? 'is-compact' : ''}" data-world14-composer="${esc(composer.id)}">
      ${portrait(composer)}
      <span><b>${esc(composer.name)}</b><em>${esc(composer.nationality || countryName(composer.countryId))}</em><small>${composer.works.toLocaleString('en-US')} works · ${composer.favorites.toLocaleString('en-US')} favorites</small></span>
    </button>`;
  }

  function renderDirectory() {
    const sorted = [...mapped].sort((a, b) => countryName(a.countryId).localeCompare(countryName(b.countryId)) || a.name.localeCompare(b.name));
    directoryCopy.textContent = `${mapped.length.toLocaleString('en-US')} of ${composers.length.toLocaleString('en-US')} profiled composers resolve to the current country map.`;
    directory.innerHTML = sorted.map((composer) => composerCard(composer, true)).join('');
    directory.querySelectorAll('[data-world14-composer]').forEach((button) => {
      const composer = mapped.find((item) => item.id === button.dataset.world14Composer);
      if (composer) button.addEventListener('click', () => openComposer(composer));
    });
  }

  function countsForView() {
    const visible = visibleCountryIds();
    const counts = new Map();
    byCountry.forEach((group, id) => {
      if (visible.has(id)) counts.set(id, group.length);
    });
    return counts;
  }

  function renderCountryPanel(counts) {
    const ranking = [...counts].map(([id, count]) => ({ id, count, name: countryName(id), flag: countryFlag(id) }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const selected = selectedCountryId && counts.has(selectedCountryId) ? selectedCountryId : '';
    if (selected) {
      const group = [...(byCountry.get(selected) || [])].sort((a, b) => a.name.localeCompare(b.name));
      panel.innerHTML = `<div class="classical-world14-panel-head"><div><h3>${esc(countryFlag(selected))} ${esc(countryName(selected))}</h3><p>${group.length} profiled composer${group.length === 1 ? '' : 's'} anchored here.</p></div><button type="button" data-world14-clear>Clear</button></div><div class="classical-world14-selected-composers">${group.map((composer) => composerCard(composer)).join('')}</div>`;
      panel.querySelector('[data-world14-clear]')?.addEventListener('click', () => { selectedCountryId = ''; render(); });
      panel.querySelectorAll('[data-world14-composer]').forEach((button) => {
        const composer = group.find((item) => item.id === button.dataset.world14Composer);
        if (composer) button.addEventListener('click', () => openComposer(composer));
      });
      return;
    }
    const max = ranking[0]?.count || 1;
    panel.innerHTML = `<div class="classical-world14-panel-head"><div><h3>${mode === 'europe' ? 'Composer countries in Europe' : 'Composer countries'}</h3><p>Select a colored country on the map or choose one below.</p></div></div><div class="classical-world14-ranking">${ranking.map((item) => `<button type="button" data-world14-country="${item.id}"><span>${esc(item.flag)} ${esc(item.name)}</span><b>${item.count}</b><i><span style="width:${Math.max(8, item.count / max * 100)}%"></span></i></button>`).join('')}</div>`;
    panel.querySelectorAll('[data-world14-country]').forEach((button) => button.addEventListener('click', () => { selectedCountryId = button.dataset.world14Country; render(); }));
  }

  function renderMap(counts) {
    stage.querySelector('svg')?.remove();
    const loading = stage.querySelector('.classical-world14-loading');
    if (loading) loading.remove();
    tooltip.hidden = true;

    const shown = visibleFeatures();
    const shownCollection = { type: 'FeatureCollection', features: shown };
    const projection = mode === 'europe'
      ? d3.geoMercator().fitExtent([[18, 18], [942, 512]], shownCollection)
      : d3.geoNaturalEarth1().fitExtent([[16, 16], [944, 516]], shownCollection);
    const path = d3.geoPath(projection);
    const max = Math.max(1, ...counts.values());

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('classical-world14-svg');
    svg.setAttribute('viewBox', '0 0 960 540');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${mode === 'europe' ? 'Europe' : 'World'} map showing profiled composer counts by country`);

    if (mode === 'world') {
      const ocean = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      ocean.classList.add('classical-world14-ocean');
      ocean.setAttribute('d', path({ type: 'Sphere' }));
      svg.append(ocean);
    }

    shown.forEach((feature) => {
      const id = String(feature.id).padStart(3, '0');
      const count = counts.get(id) || 0;
      const level = count ? Math.max(1, Math.min(5, Math.ceil(Math.sqrt(count / max) * 5))) : 0;
      const name = countryName(id);
      const countryPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      countryPath.classList.add('classical-world14-country');
      countryPath.dataset.countryId = id;
      countryPath.dataset.level = String(level);
      countryPath.dataset.active = String(count > 0);
      countryPath.dataset.selected = String(selectedCountryId === id);
      countryPath.setAttribute('d', path(feature) || '');
      const label = `${name}: ${count} profiled composer${count === 1 ? '' : 's'}`;
      title.textContent = label;
      countryPath.append(title);
      if (count) {
        countryPath.setAttribute('tabindex', '0');
        countryPath.setAttribute('role', 'button');
        countryPath.setAttribute('aria-label', label);
        const move = (event) => {
          const box = stage.getBoundingClientRect();
          const x = Number.isFinite(event?.clientX) ? event.clientX - box.left : box.width / 2;
          const y = Number.isFinite(event?.clientY) ? event.clientY - box.top : box.height / 2;
          tooltip.style.left = `${Math.min(Math.max(x + 10, 8), Math.max(box.width - 220, 8))}px`;
          tooltip.style.top = `${Math.min(Math.max(y + 10, 8), Math.max(box.height - 82, 8))}px`;
        };
        const show = (event) => {
          const group = byCountry.get(id) || [];
          tooltip.innerHTML = `<strong>${esc(countryFlag(id))} ${esc(name)}</strong><span>${count} composer${count === 1 ? '' : 's'}</span><small>${group.slice(0, 4).map((composer) => esc(composer.name)).join(' · ')}${group.length > 4 ? ` · +${group.length - 4}` : ''}</small>`;
          tooltip.hidden = false;
          move(event);
        };
        const select = () => { selectedCountryId = id; render(); };
        countryPath.addEventListener('pointerenter', show);
        countryPath.addEventListener('pointermove', move);
        countryPath.addEventListener('pointerleave', () => { tooltip.hidden = true; });
        countryPath.addEventListener('focus', show);
        countryPath.addEventListener('blur', () => { tooltip.hidden = true; });
        countryPath.addEventListener('click', select);
        countryPath.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
        });
      }
      svg.append(countryPath);
    });

    stage.insertBefore(svg, tooltip);
    const visibleComposerCount = [...counts.values()].reduce((sum, value) => sum + value, 0);
    status.textContent = `${visibleComposerCount.toLocaleString('en-US')} profiled composers · ${counts.size.toLocaleString('en-US')} mapped countries${mode === 'europe' ? ' · Europe view' : ' · World view'}`;
  }

  function render() {
    const counts = countsForView();
    if (selectedCountryId && !counts.has(selectedCountryId)) selectedCountryId = '';
    renderMap(counts);
    renderCountryPanel(counts);
    modeButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.world14Mode === mode)));
  }

  modeButtons.forEach((button) => button.addEventListener('click', () => {
    const next = button.dataset.world14Mode === 'world' ? 'world' : 'europe';
    if (next === mode) return;
    mode = next;
    selectedCountryId = '';
    render();
  }));

  renderDirectory();
  render();

  if (unmapped.length) {
    console.warn('[Classical World] Unmapped profiled composers:', unmapped.map((composer) => composer.name));
  }
}

bootWorld14();
