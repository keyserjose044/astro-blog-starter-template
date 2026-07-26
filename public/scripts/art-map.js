const MODULES = {
  d3: 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm',
  topojson: 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm',
  world: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json/+esm',
  countries: 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/+esm',
};

let ready = false;
let loadPromise = null;
let d3;
let topojson;
let world;
const countryById = new Map();
const aliasToIds = new Map();
const mapPaths = new Map();

const fmt = (value) => Number(value || 0).toLocaleString('en-US');
const esc = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));
const normalize = (value) => String(value || '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

const metric = (label, value, note = '') => `
  <div class="art-metric"><span class="art-metric-label">${esc(label)}</span><strong class="art-metric-value">${esc(value)}</strong>${note ? `<small class="art-metric-note">${esc(note)}</small>` : ''}</div>
`;

function addAlias(alias, ids) {
  const key = normalize(alias);
  if (!key) return;
  const next = Array.isArray(ids) ? ids : [ids];
  const existing = aliasToIds.get(key) || [];
  aliasToIds.set(key, [...new Set([...existing, ...next.map((id) => String(id).padStart(3, '0'))])]);
}

function buildCountryIndex(rows) {
  rows.forEach((country) => {
    if (!country?.ccn3) return;
    const id = String(country.ccn3).padStart(3, '0');
    const name = country.name?.common || country.name?.official || id;
    countryById.set(id, { id, name, flag: country.flag || '' });
    addAlias(country.name?.common, id);
    addAlias(country.name?.official, id);
    addAlias(country.cca2, id);
    addAlias(country.cca3, id);
    (country.altSpellings || []).forEach((alias) => addAlias(alias, id));
    Object.values(country.translations || {}).forEach((translation) => {
      addAlias(translation?.common, id);
      addAlias(translation?.official, id);
    });
    addAlias(country.demonyms?.eng?.m, id);
    addAlias(country.demonyms?.eng?.f, id);
  });

  const manual = {
    usa: '840', us: '840', america: '840', american: '840',
    uk: '826', britain: '826', british: '826', english: '826', scottish: '826', welsh: '826',
    dutch: '528', flemish: '056',
    soviet: '643', ussr: '643', russian: '643',
    persian: '364', czech: '203', korean: '410',
  };
  Object.entries(manual).forEach(([alias, id]) => addAlias(alias, id));
}

function resolveCountryIds(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return [];
  const exact = aliasToIds.get(normalize(raw));
  if (exact?.length) return exact;
  const pieces = raw.split(/\s*(?:\/|;|\||\+|&)\s*|\s*,\s*/).map((piece) => piece.trim()).filter(Boolean);
  const ids = [];
  pieces.forEach((piece) => {
    const match = aliasToIds.get(normalize(piece));
    if (match) ids.push(...match);
  });
  return [...new Set(ids)];
}

function assignIds(cards) {
  cards.forEach((card) => {
    const ids = resolveCountryIds(card.dataset.country);
    card.dataset.artCountryIds = ids.join(' ');
  });
}

function buildSvg(api) {
  if (!d3 || !topojson || !world?.objects?.countries || mapPaths.size) return;
  const featureCollection = topojson.feature(world, world.objects.countries);
  const visible = {
    type: 'FeatureCollection',
    features: featureCollection.features.filter((feature) => String(feature.id).padStart(3, '0') !== '010'),
  };
  api.controls.mapStatus?.remove();

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('art-map-svg');
  svg.setAttribute('viewBox', '0 0 960 540');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'World map showing recorded country or nationality labels in the art archive');
  const projection = d3.geoNaturalEarth1().fitExtent([[14, 14], [946, 514]], visible);
  const path = d3.geoPath(projection);
  const ocean = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  ocean.classList.add('art-map-ocean');
  ocean.setAttribute('d', path({ type: 'Sphere' }));
  svg.appendChild(ocean);

  visible.features.forEach((feature) => {
    const id = String(feature.id).padStart(3, '0');
    const country = countryById.get(id);
    const name = country?.name || feature.properties?.name || id;
    const countryPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    countryPath.classList.add('art-map-country');
    countryPath.dataset.countryId = id;
    countryPath.dataset.countryName = name;
    countryPath.dataset.level = '0';
    countryPath.dataset.hasArt = 'false';
    countryPath.setAttribute('d', path(feature));
    title.textContent = `${name}: no mapped works`;
    countryPath.appendChild(title);

    const showTooltip = (event) => {
      const count = Number(countryPath.dataset.count || 0);
      api.controls.mapTooltip.innerHTML = `<strong>${esc(name)}</strong><span>${fmt(count)} ${count === 1 ? 'work' : 'works'}</span>`;
      api.controls.mapTooltip.hidden = false;
      moveTooltip(event, api);
    };
    countryPath.addEventListener('pointerenter', showTooltip);
    countryPath.addEventListener('pointermove', (event) => moveTooltip(event, api));
    countryPath.addEventListener('pointerleave', () => { api.controls.mapTooltip.hidden = true; });
    countryPath.addEventListener('click', () => {
      if (Number(countryPath.dataset.count || 0) > 0) api.setMapCountryId(id);
    });
    countryPath.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && Number(countryPath.dataset.count || 0) > 0) {
        event.preventDefault();
        api.setMapCountryId(id);
      }
    });
    mapPaths.set(id, countryPath);
    svg.appendChild(countryPath);
  });

  const footer = document.createElement('div');
  footer.className = 'art-map-footer';
  footer.innerHTML = '<span>Click a colored country to narrow the archive.</span><span class="art-map-legend"><span>Fewer</span><i></i><i></i><i></i><i></i><i></i><span>More</span></span>';
  api.controls.mapStage.insertBefore(svg, api.controls.mapTooltip);
  api.controls.mapStage.appendChild(footer);
}

function moveTooltip(event, api) {
  const bounds = api.controls.mapStage.getBoundingClientRect();
  const x = Math.min(Math.max(event.clientX - bounds.left, 8), Math.max(bounds.width - 220, 8));
  const y = Math.min(Math.max(event.clientY - bounds.top, 8), Math.max(bounds.height - 80, 8));
  api.controls.mapTooltip.style.left = `${x}px`;
  api.controls.mapTooltip.style.top = `${y}px`;
}

async function ensureMap(api) {
  if (ready) return;
  if (loadPromise) return loadPromise;
  loadPromise = Promise.all([
    import(MODULES.d3), import(MODULES.topojson), import(MODULES.world), import(MODULES.countries),
  ]).then(([d3Module, topojsonModule, worldModule, countriesModule]) => {
    d3 = d3Module;
    topojson = topojsonModule;
    world = worldModule.default || worldModule;
    buildCountryIndex(countriesModule.default || countriesModule);
    assignIds(api.cards);
    buildSvg(api);
    ready = true;
  }).catch((error) => {
    console.error('Art map modules could not load.', error);
    api.controls.mapStatus.innerHTML = '<strong>The interactive map could not load.</strong><span>The Artists and Timeline views still work normally.</span>';
  });
  return loadPromise;
}

function countCountries(cards) {
  const counts = new Map();
  cards.forEach((card) => {
    String(card.dataset.artCountryIds || '').split(' ').filter(Boolean).forEach((id) => counts.set(id, (counts.get(id) || 0) + 1));
  });
  return counts;
}

function updatePaths(counts, selectedId) {
  const maximum = Math.max(0, ...counts.values());
  mapPaths.forEach((path, id) => {
    const count = counts.get(id) || 0;
    const level = count > 0 && maximum > 0 ? Math.max(1, Math.min(5, Math.ceil(Math.sqrt(count / maximum) * 5))) : 0;
    const name = countryById.get(id)?.name || path.dataset.countryName || id;
    const label = `${name}: ${fmt(count)} ${count === 1 ? 'work' : 'works'}`;
    path.dataset.count = String(count);
    path.dataset.level = String(level);
    path.dataset.hasArt = count > 0 ? 'true' : 'false';
    path.dataset.selected = selectedId === id ? 'true' : 'false';
    path.setAttribute('aria-label', label);
    if (count > 0) path.setAttribute('tabindex', '0'); else path.removeAttribute('tabindex');
    const title = path.querySelector('title');
    if (title) title.textContent = label;
  });
}

function renderPanel(api, counts, cards) {
  const ranking = [...counts.entries()].map(([id, count]) => ({ id, count, country: countryById.get(id) || { name: id, flag: '' } }))
    .sort((a, b) => b.count - a.count || a.country.name.localeCompare(b.country.name));
  if (!ranking.length) {
    api.controls.countryPanel.innerHTML = '<p>No confidently matched country labels appear in the current filters.</p>';
    return;
  }
  const selected = api.state.selectedMapCountryId ? ranking.find((entry) => entry.id === api.state.selectedMapCountryId) : null;
  const maximum = ranking[0].count;
  const selectedCards = selected ? cards.filter((card) => String(card.dataset.artCountryIds || '').split(' ').includes(selected.id)).slice(0, 9) : [];

  api.controls.countryPanel.innerHTML = `
    <div class="art-country-panel-header"><div><h3>${selected ? `${selected.country.flag || '◎'} ${esc(selected.country.name)}` : 'Top recorded origins'}</h3><p>${selected ? `${fmt(selected.count)} works in the current view` : 'Select a country on the map or below.'}</p></div>${selected ? '<button type="button" class="art-country-clear">Clear</button>' : ''}</div>
    <div class="art-country-ranking">
      ${ranking.slice(0, selected ? 7 : 12).map((entry) => `
        <button type="button" class="art-country-rank" data-country-id="${entry.id}" aria-pressed="${api.state.selectedMapCountryId === entry.id}">
          <span class="art-country-rank-name">${entry.country.flag || ''} ${esc(entry.country.name)}</span><span class="art-country-rank-count">${fmt(entry.count)}</span>
          <span class="art-country-track"><i style="width:${Math.max(7, entry.count / maximum * 100)}%"></i></span>
        </button>
      `).join('')}
    </div>
    ${selected ? `<div class="art-country-works">${selectedCards.map((card) => `<button type="button" class="art-country-work" data-art-card-index="${esc(card.dataset.originalIndex)}" title="Open ${esc(card.dataset.title)}"><img src="${esc(card.dataset.cover || '')}" alt="" loading="lazy"></button>`).join('')}</div>` : ''}
  `;
  api.controls.countryPanel.querySelectorAll('[data-country-id]').forEach((button) => button.addEventListener('click', () => api.setMapCountryId(button.dataset.countryId)));
  api.controls.countryPanel.querySelector('.art-country-clear')?.addEventListener('click', () => api.setMapCountryId(api.state.selectedMapCountryId));
  api.controls.countryPanel.querySelectorAll('[data-art-card-index]').forEach((button) => button.addEventListener('click', () => {
    const card = api.cards.find((candidate) => candidate.dataset.originalIndex === button.dataset.artCardIndex);
    if (card) api.openViewer(card);
  }));
}

export async function renderArtMap(api) {
  await ensureMap(api);
  if (!ready) return;
  const baseCards = api.getBaseCards();
  const counts = countCountries(baseCards);
  const mapped = baseCards.filter((card) => String(card.dataset.artCountryIds || '').trim());
  const unmapped = baseCards.filter((card) => String(card.dataset.country || '').trim() && !String(card.dataset.artCountryIds || '').trim());
  const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranking[0];
  const topCountry = top ? countryById.get(top[0]) : null;
  const mappedArtists = new Set(mapped.map((card) => normalize(card.dataset.artist)).filter(Boolean));

  api.controls.mapMetrics.innerHTML = [
    metric('Countries represented', fmt(counts.size), `${fmt(baseCards.length)} works in the base view`),
    metric('Works mapped', fmt(mapped.length), `${Math.round(mapped.length / Math.max(baseCards.length, 1) * 100)}% of this view`),
    metric('Artists mapped', fmt(mappedArtists.size), 'Unique recorded artists'),
    metric('Most represented', topCountry ? `${topCountry.flag || ''} ${topCountry.name}` : '—', top ? `${fmt(top[1])} works` : 'No mapped works'),
  ].join('');

  updatePaths(counts, api.state.selectedMapCountryId);
  renderPanel(api, counts, baseCards);
  if (unmapped.length) {
    const labels = [...new Set(unmapped.map((card) => card.dataset.country).filter(Boolean))].slice(0, 5);
    api.controls.mapNote.textContent = `${fmt(unmapped.length)} works have country or nationality labels the atlas could not confidently place${labels.length ? ` (${labels.join(', ')}${unmapped.length > labels.length ? ', …' : ''})` : ''}. They remain available in the other views.`;
  } else {
    api.controls.mapNote.textContent = 'The map reflects the archive’s recorded country or nationality field. Historical and ambiguous identities are left unmapped rather than forced into a modern country.';
  }
}