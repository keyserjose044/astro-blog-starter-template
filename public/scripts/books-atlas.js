/*
 * LifeLoggerz Books cultural atlas and timeline.
 * Enhances the existing Books page without changing its Raindrop data pipeline.
 */

const BOOKS_ATLAS_MODULES = {
  d3: 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm',
  topojson: 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm',
  world: 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json/+esm',
  countries: 'https://cdn.jsdelivr.net/npm/world-countries@5.1.0/+esm',
};

function startBooksAtlas() {
  const grid = document.querySelector('#grid');
  const viewToggle = document.querySelector('#book-view-toggle');
  const resultsCount = document.querySelector('#results-count');
  const clearFiltersButton = document.querySelector('#clear-filters');
  const filtersButton = document.querySelector('#filters-toggle');
  const filtersCount = document.querySelector('#filters-count');
  const filterEmpty = document.querySelector('#filter-empty');
  const searchInput = document.querySelector('#q');
  const countrySelect = document.querySelector('#country-filter');
  const yearSelect = document.querySelector('#year-filter');
  const periodSelect = document.querySelector('#period-filter');

  if (!grid || !viewToggle) return;

  const cards = Array.from(grid.querySelectorAll('.card'));
  if (!cards.length) return;

  const state = {
    activeView: 'collection',
    timelineMode: 'publication',
    selectedCountryId: null,
    geographyReady: false,
    geographyError: null,
    countryById: new Map(),
    aliasToIds: new Map(),
    mapPaths: new Map(),
    mapFeatures: [],
    d3: null,
    topojson: null,
    world: null,
    geoPromise: null,
  };

  const normalize = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');

  const formatNumber = (value) => Number(value || 0).toLocaleString('en-US');

  const getCardTitle = (card) => {
    const title = card.querySelector('.title');
    return title ? title.textContent.replace('↗', '').trim() : card.dataset.title || 'Untitled';
  };

  const getCardCover = (card) => card.querySelector('.thumb')?.getAttribute('src') || '';
  const getCardHref = (card) => card.getAttribute('href') || '#';

  const parseFinishedDate = (value) => {
    const raw = String(value || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
    const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
    if (numeric) {
      const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
      const date = new Date(Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2])));
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getBaseCards = () => cards.filter((card) => card.style.display !== 'none');

  const getVisibleCards = () => getBaseCards().filter((card) => {
    if (!state.selectedCountryId) return true;
    return (card._atlasCountryIds || []).includes(state.selectedCountryId);
  });

  function createViewButton(view, icon, label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'view-button';
    button.dataset.atlasView = view;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<span class="books-atlas-button-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
    return button;
  }

  const mapButton = createViewButton('map', '◎', 'World');
  const timelineButton = createViewButton('timeline', '↝', 'Timeline');
  viewToggle.append(mapButton, timelineButton);

  const explorer = document.createElement('section');
  explorer.id = 'books-explorer';
  explorer.className = 'books-explorer';
  explorer.hidden = true;
  explorer.setAttribute('aria-live', 'polite');
  explorer.innerHTML = `
    <div class="books-explorer-shell">
      <div id="books-map-view" class="books-explorer-view" hidden>
        <div class="books-explorer-heading">
          <div class="books-explorer-heading-copy">
            <p class="books-explorer-eyebrow">Cultural atlas</p>
            <h2 class="books-explorer-title">Where my books come from</h2>
            <p class="books-explorer-description">Author origins across the world. The map responds to every Books filter; select a country to narrow the collection.</p>
          </div>
          <button type="button" class="books-explorer-close" data-close-explorer aria-label="Close world view">×</button>
        </div>
        <div id="books-map-metrics" class="books-atlas-metrics"></div>
        <div class="books-map-layout">
          <div class="books-map-stage" id="books-map-stage">
            <div id="books-map-status" class="books-map-status">
              <div><strong>Preparing the cultural map…</strong><span>Matching your country labels to the world atlas.</span></div>
            </div>
            <div id="books-map-tooltip" class="books-map-tooltip" hidden></div>
          </div>
          <aside id="books-country-panel" class="books-country-panel" aria-label="Country details"></aside>
        </div>
        <p id="books-map-note" class="books-atlas-note"></p>
      </div>

      <div id="books-timeline-view" class="books-explorer-view" hidden>
        <div class="books-explorer-heading">
          <div class="books-explorer-heading-copy">
            <p class="books-explorer-eyebrow">Reading through time</p>
            <h2 class="books-explorer-title">The collection as a timeline</h2>
            <p class="books-explorer-description">Move between the history of the works themselves and the years when they entered my life.</p>
          </div>
          <button type="button" class="books-explorer-close" data-close-explorer aria-label="Close timeline view">×</button>
        </div>
        <div id="books-timeline-metrics" class="books-atlas-metrics"></div>
        <div class="books-timeline-controls">
          <div class="books-timeline-mode" role="group" aria-label="Timeline type">
            <button type="button" data-timeline-mode="publication" aria-pressed="true">Publication history</button>
            <button type="button" data-timeline-mode="reading" aria-pressed="false">My reading journey</button>
          </div>
          <p id="books-timeline-help" class="books-timeline-help">Select a period to apply it as a filter.</p>
        </div>
        <div id="books-timeline-content"></div>
      </div>
    </div>
  `;

  grid.parentElement.insertBefore(explorer, grid);

  const mapView = explorer.querySelector('#books-map-view');
  const timelineView = explorer.querySelector('#books-timeline-view');
  const mapMetrics = explorer.querySelector('#books-map-metrics');
  const timelineMetrics = explorer.querySelector('#books-timeline-metrics');
  const mapStage = explorer.querySelector('#books-map-stage');
  const mapStatus = explorer.querySelector('#books-map-status');
  const mapTooltip = explorer.querySelector('#books-map-tooltip');
  const countryPanel = explorer.querySelector('#books-country-panel');
  const mapNote = explorer.querySelector('#books-map-note');
  const timelineContent = explorer.querySelector('#books-timeline-content');
  const timelineHelp = explorer.querySelector('#books-timeline-help');
  const collectionViewButtons = Array.from(viewToggle.querySelectorAll('[data-book-view]'));

  function metricMarkup(label, value, note = '') {
    return `
      <div class="books-atlas-metric">
        <span class="books-atlas-metric-label">${label}</span>
        <strong class="books-atlas-metric-value">${value}</strong>
        ${note ? `<span class="books-atlas-metric-note">${note}</span>` : ''}
      </div>
    `;
  }

  function setPressedView(activeButton) {
    Array.from(viewToggle.querySelectorAll('.view-button')).forEach((button) => {
      button.setAttribute('aria-pressed', button === activeButton ? 'true' : 'false');
    });
  }

  function showCollectionView() {
    state.activeView = 'collection';
    explorer.hidden = true;
    mapView.hidden = true;
    timelineView.hidden = true;
    grid.hidden = false;
    document.body.classList.remove('books-explorer-open');
    mapButton.setAttribute('aria-pressed', 'false');
    timelineButton.setAttribute('aria-pressed', 'false');
    refreshResultsState();
  }

  function showExplorerView(view) {
    state.activeView = view;
    explorer.hidden = false;
    grid.hidden = true;
    document.body.classList.add('books-explorer-open');

    const isMap = view === 'map';
    mapView.hidden = !isMap;
    timelineView.hidden = isMap;
    setPressedView(isMap ? mapButton : timelineButton);

    if (isMap) {
      ensureGeography();
      renderMapView();
    } else {
      renderTimeline();
    }

    explorer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  collectionViewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      showCollectionView();
      requestAnimationFrame(() => setPressedView(button));
    });
  });

  mapButton.addEventListener('click', () => showExplorerView('map'));
  timelineButton.addEventListener('click', () => showExplorerView('timeline'));

  explorer.querySelectorAll('[data-close-explorer]').forEach((button) => {
    button.addEventListener('click', () => {
      const preferred = collectionViewButtons.find((candidate) => candidate.dataset.bookView === grid.dataset.bookView)
        || collectionViewButtons[0];
      preferred?.click();
    });
  });

  explorer.querySelectorAll('[data-timeline-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      state.timelineMode = button.dataset.timelineMode;
      explorer.querySelectorAll('[data-timeline-mode]').forEach((candidate) => {
        candidate.setAttribute('aria-pressed', candidate === button ? 'true' : 'false');
      });
      renderTimeline();
    });
  });

  function addAlias(alias, ids) {
    const key = normalize(alias);
    if (!key) return;
    const nextIds = Array.isArray(ids) ? ids : [ids];
    const existing = state.aliasToIds.get(key) || [];
    state.aliasToIds.set(key, [...new Set([...existing, ...nextIds.map((id) => String(id).padStart(3, '0'))])]);
  }

  function buildCountryIndex(countryRows) {
    countryRows.forEach((country) => {
      if (!country?.ccn3) return;
      const id = String(country.ccn3).padStart(3, '0');
      const name = country.name?.common || country.name?.official || id;
      state.countryById.set(id, {
        id,
        name,
        flag: country.flag || '',
        cca2: country.cca2 || '',
      });

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

    const manualAliases = {
      'usa': '840',
      'u s a': '840',
      'us': '840',
      'u s': '840',
      'america': '840',
      'united states of america': '840',
      'uk': '826',
      'u k': '826',
      'britain': '826',
      'great britain': '826',
      'england': '826',
      'scotland': '826',
      'wales': '826',
      'northern ireland': '826',
      'holland': '528',
      'the netherlands': '528',
      'russia': '643',
      'soviet union': '643',
      'ussr': '643',
      'ancient greece': '300',
      'hellas': '300',
      'ancient rome': '380',
      'roman empire': '380',
      'rome': '380',
      'persia': '364',
      'ottoman empire': '792',
      'prussia': '276',
      'east germany': '276',
      'west germany': '276',
      'czech republic': '203',
      'burma': '104',
      'ivory coast': '384',
      'cape verde': '132',
      'swaziland': '748',
      'macedonia': '807',
      'south korea': '410',
      'north korea': '408',
      'viet nam': '704',
      'palestine': '275',
      'taiwan': '158',
      'hong kong': '344',
      'congo': '178',
    };

    Object.entries(manualAliases).forEach(([alias, id]) => addAlias(alias, id));
    addAlias('czechoslovakia', ['203', '703']);
  }

  function resolveCountryIds(rawValue) {
    const raw = String(rawValue || '').trim();
    if (!raw) return [];

    const exact = state.aliasToIds.get(normalize(raw));
    if (exact?.length) return exact;

    const pieces = raw
      .split(/\s*(?:\/|;|\||\+|&)\s*|\s*,\s*/)
      .map((piece) => piece.trim())
      .filter(Boolean);

    const ids = [];
    pieces.forEach((piece) => {
      const match = state.aliasToIds.get(normalize(piece));
      if (match) ids.push(...match);
    });

    return [...new Set(ids)];
  }

  function assignCountryIdsToCards() {
    cards.forEach((card) => {
      card._atlasCountryIds = resolveCountryIds(card.dataset.country);
    });
  }

  async function ensureGeography() {
    if (state.geographyReady) return;
    if (state.geoPromise) return state.geoPromise;

    state.geoPromise = Promise.all([
      import(BOOKS_ATLAS_MODULES.d3),
      import(BOOKS_ATLAS_MODULES.topojson),
      import(BOOKS_ATLAS_MODULES.world),
      import(BOOKS_ATLAS_MODULES.countries),
    ])
      .then(([d3Module, topojsonModule, worldModule, countriesModule]) => {
        state.d3 = d3Module;
        state.topojson = topojsonModule;
        state.world = worldModule.default || worldModule;
        const countryRows = countriesModule.default || countriesModule;
        buildCountryIndex(countryRows);
        assignCountryIdsToCards();
        buildMapSvg();
        state.geographyReady = true;
        state.geographyError = null;
        refreshUI();
      })
      .catch((error) => {
        console.error('Books cultural atlas could not load its map modules.', error);
        state.geographyError = error;
        mapStatus.innerHTML = `
          <div>
            <strong>The interactive map could not load.</strong>
            <span>The country ranking and timeline still work; try refreshing to load the geographic layer.</span>
          </div>
        `;
        renderRawCountryFallback();
      });

    return state.geoPromise;
  }

  function buildMapSvg() {
    const { d3, topojson, world } = state;
    if (!d3 || !topojson || !world?.objects?.countries) return;

    const featureCollection = topojson.feature(world, world.objects.countries);
    const visibleCollection = {
      type: 'FeatureCollection',
      features: featureCollection.features.filter((feature) => String(feature.id).padStart(3, '0') !== '010'),
    };

    state.mapFeatures = visibleCollection.features;
    mapStatus.remove();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('books-map-svg');
    svg.setAttribute('viewBox', '0 0 960 540');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'World map showing the number of books by author country of origin');

    const projection = d3.geoNaturalEarth1().fitExtent([[14, 14], [946, 514]], visibleCollection);
    const path = d3.geoPath(projection);

    const ocean = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ocean.classList.add('books-map-ocean');
    ocean.setAttribute('d', path({ type: 'Sphere' }));
    svg.appendChild(ocean);

    visibleCollection.features.forEach((feature) => {
      const id = String(feature.id).padStart(3, '0');
      const country = state.countryById.get(id);
      const name = country?.name || feature.properties?.name || `Country ${id}`;
      const countryPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');

      countryPath.classList.add('books-map-country');
      countryPath.dataset.countryId = id;
      countryPath.dataset.countryName = name;
      countryPath.dataset.level = '0';
      countryPath.dataset.hasBooks = 'false';
      countryPath.setAttribute('d', path(feature));
      countryPath.setAttribute('aria-label', `${name}: no mapped books`);
      title.textContent = `${name}: no mapped books`;
      countryPath.appendChild(title);

      const showTooltip = (event) => {
        const count = Number(countryPath.dataset.count || 0);
        mapTooltip.innerHTML = `<strong>${name}</strong><span>${formatNumber(count)} ${count === 1 ? 'book' : 'books'}</span>`;
        mapTooltip.hidden = false;
        moveTooltip(event);
      };

      const moveTooltip = (event) => {
        const bounds = mapStage.getBoundingClientRect();
        const x = Math.min(Math.max(event.clientX - bounds.left, 8), Math.max(bounds.width - 220, 8));
        const y = Math.min(Math.max(event.clientY - bounds.top, 8), Math.max(bounds.height - 80, 8));
        mapTooltip.style.left = `${x}px`;
        mapTooltip.style.top = `${y}px`;
      };

      const hideTooltip = () => {
        mapTooltip.hidden = true;
      };

      const selectCountry = () => {
        if (Number(countryPath.dataset.count || 0) > 0) setMapCountry(id);
      };

      countryPath.addEventListener('pointerenter', showTooltip);
      countryPath.addEventListener('pointermove', moveTooltip);
      countryPath.addEventListener('pointerleave', hideTooltip);
      countryPath.addEventListener('focus', (event) => showTooltip(event));
      countryPath.addEventListener('blur', hideTooltip);
      countryPath.addEventListener('click', selectCountry);
      countryPath.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectCountry();
        }
      });

      state.mapPaths.set(id, countryPath);
      svg.appendChild(countryPath);
    });

    const footer = document.createElement('div');
    footer.className = 'books-map-footer';
    footer.innerHTML = `
      <span>Click a colored country to filter the collection.</span>
      <span class="books-map-legend" aria-label="Fewer to more books">
        <span>Fewer</span>
        <i class="books-map-legend-swatch"></i><i class="books-map-legend-swatch"></i>
        <i class="books-map-legend-swatch"></i><i class="books-map-legend-swatch"></i>
        <i class="books-map-legend-swatch"></i>
        <span>More</span>
      </span>
    `;

    mapStage.insertBefore(svg, mapTooltip);
    mapStage.appendChild(footer);
  }

  function countCountries(sourceCards) {
    const counts = new Map();
    sourceCards.forEach((card) => {
      (card._atlasCountryIds || []).forEach((id) => {
        counts.set(id, (counts.get(id) || 0) + 1);
      });
    });
    return counts;
  }

  function latestCountryAddition(sourceCards) {
    const firstSeen = new Map();
    sourceCards.forEach((card) => {
      const date = parseFinishedDate(card.dataset.dateFinished);
      if (!date) return;
      (card._atlasCountryIds || []).forEach((id) => {
        const existing = firstSeen.get(id);
        if (!existing || date < existing) firstSeen.set(id, date);
      });
    });

    return [...firstSeen.entries()].sort((a, b) => b[1] - a[1])[0] || null;
  }

  function updateMapPaths(counts) {
    const maximum = Math.max(0, ...counts.values());
    state.mapPaths.forEach((path, id) => {
      const count = counts.get(id) || 0;
      const level = count > 0 && maximum > 0
        ? Math.max(1, Math.min(5, Math.ceil(Math.sqrt(count / maximum) * 5)))
        : 0;
      const countryName = state.countryById.get(id)?.name || path.dataset.countryName || id;
      const label = `${countryName}: ${formatNumber(count)} ${count === 1 ? 'book' : 'books'}`;

      path.dataset.count = String(count);
      path.dataset.level = String(level);
      path.dataset.hasBooks = count > 0 ? 'true' : 'false';
      path.dataset.selected = state.selectedCountryId === id ? 'true' : 'false';
      path.setAttribute('aria-label', label);

      if (count > 0) path.setAttribute('tabindex', '0');
      else path.removeAttribute('tabindex');

      const title = path.querySelector('title');
      if (title) title.textContent = label;
    });
  }

  function setMapCountry(id) {
    state.selectedCountryId = state.selectedCountryId === id ? null : id;

    if (state.selectedCountryId && countrySelect?.value) {
      countrySelect.value = '';
      countrySelect.dispatchEvent(new Event('change', { bubbles: true }));
    }

    refreshUI();
  }

  function renderCountryPanel(counts, sourceCards) {
    const ranking = [...counts.entries()]
      .map(([id, count]) => ({
        id,
        count,
        country: state.countryById.get(id) || { name: id, flag: '' },
      }))
      .sort((a, b) => b.count - a.count || a.country.name.localeCompare(b.country.name));

    if (!ranking.length) {
      countryPanel.innerHTML = '<p class="books-country-empty">No country metadata is represented by the current filters.</p>';
      return;
    }

    const selected = state.selectedCountryId
      ? ranking.find((entry) => entry.id === state.selectedCountryId)
      : null;
    const maximum = ranking[0].count;
    const heading = selected ? `${selected.country.flag || '◎'} ${selected.country.name}` : 'Top countries';
    const subtitle = selected
      ? `${formatNumber(selected.count)} ${selected.count === 1 ? 'book' : 'books'} in the current view`
      : 'Select a country on the map or in this ranking.';

    const rankingMarkup = ranking.slice(0, selected ? 6 : 10).map((entry) => `
      <button type="button" class="books-country-rank-button" data-country-rank-id="${entry.id}" aria-pressed="${state.selectedCountryId === entry.id}">
        <span class="books-country-rank-name">${entry.country.flag || ''} ${entry.country.name}</span>
        <span class="books-country-rank-count">${formatNumber(entry.count)}</span>
        <span class="books-country-rank-track"><i class="books-country-rank-bar" style="width:${Math.max(7, (entry.count / maximum) * 100)}%"></i></span>
      </button>
    `).join('');

    let booksMarkup = '';
    if (selected) {
      const selectedBooks = sourceCards
        .filter((card) => (card._atlasCountryIds || []).includes(selected.id))
        .slice(0, 6);
      booksMarkup = `
        <div class="books-country-books" aria-label="Books from ${selected.country.name}">
          ${selectedBooks.map((card) => `
            <a class="books-country-book" href="${getCardHref(card)}" target="_blank" rel="noopener noreferrer" title="${getCardTitle(card).replace(/"/g, '&quot;')}">
              <img src="${getCardCover(card)}" alt="" loading="lazy" />
              <span>${getCardTitle(card)}</span>
            </a>
          `).join('')}
        </div>
      `;
    }

    countryPanel.innerHTML = `
      <div class="books-country-panel-header">
        <div>
          <h3 class="books-country-panel-title">${heading}</h3>
          <p class="books-country-panel-subtitle">${subtitle}</p>
        </div>
        ${selected ? '<button type="button" class="books-country-clear" data-clear-map-country>Clear</button>' : ''}
      </div>
      <div class="books-country-ranking">${rankingMarkup}</div>
      ${booksMarkup}
    `;

    countryPanel.querySelectorAll('[data-country-rank-id]').forEach((button) => {
      button.addEventListener('click', () => setMapCountry(button.dataset.countryRankId));
    });
    countryPanel.querySelector('[data-clear-map-country]')?.addEventListener('click', () => setMapCountry(state.selectedCountryId));
  }

  function renderRawCountryFallback() {
    const rawCounts = new Map();
    getBaseCards().forEach((card) => {
      const name = String(card.dataset.country || '').trim();
      if (name) rawCounts.set(name, (rawCounts.get(name) || 0) + 1);
    });
    const ranking = [...rawCounts.entries()].sort((a, b) => b[1] - a[1]);
    countryPanel.innerHTML = `
      <div class="books-country-panel-header">
        <div><h3 class="books-country-panel-title">Country ranking</h3><p class="books-country-panel-subtitle">Based on the labels in Raindrop.</p></div>
      </div>
      <div class="books-country-ranking">
        ${ranking.slice(0, 12).map(([name, count]) => `
          <div class="books-country-rank-button">
            <span class="books-country-rank-name">${name}</span>
            <span class="books-country-rank-count">${formatNumber(count)}</span>
          </div>
        `).join('') || '<p class="books-country-empty">No country labels are available.</p>'}
      </div>
    `;
  }

  function renderMapView() {
    const baseCards = getBaseCards();

    if (!state.geographyReady) {
      if (!state.geographyError) {
        mapMetrics.innerHTML = [
          metricMarkup('Books in view', formatNumber(getVisibleCards().length), 'Responds to the filters above'),
          metricMarkup('Atlas status', 'Loading', 'Country matching in progress'),
          metricMarkup('Map layer', 'World', 'Author country of origin'),
          metricMarkup('Interaction', 'Click', 'Country drill-down'),
        ].join('');
      }
      return;
    }

    const counts = countCountries(baseCards);
    const ranking = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const mappedBooks = baseCards.filter((card) => (card._atlasCountryIds || []).length > 0);
    const unmappedBooks = baseCards.filter((card) => String(card.dataset.country || '').trim() && !(card._atlasCountryIds || []).length);
    const top = ranking[0];
    const latest = latestCountryAddition(baseCards);
    const topCountry = top ? state.countryById.get(top[0]) : null;
    const latestCountry = latest ? state.countryById.get(latest[0]) : null;

    mapMetrics.innerHTML = [
      metricMarkup('Countries represented', formatNumber(counts.size), `${formatNumber(baseCards.length)} books in the base view`),
      metricMarkup('Books mapped', formatNumber(mappedBooks.length), `${Math.round((mappedBooks.length / Math.max(baseCards.length, 1)) * 100)}% of this view`),
      metricMarkup('Most represented', topCountry ? `${topCountry.flag || ''} ${topCountry.name}` : '—', top ? `${formatNumber(top[1])} books` : 'No mapped books'),
      metricMarkup('Latest country added', latestCountry ? `${latestCountry.flag || ''} ${latestCountry.name}` : '—', latest ? latest[1].toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : 'No finish date'),
    ].join('');

    updateMapPaths(counts);
    renderCountryPanel(counts, baseCards);

    if (unmappedBooks.length) {
      const labels = [...new Set(unmappedBooks.map((card) => card.dataset.country).filter(Boolean))].slice(0, 4);
      mapNote.textContent = `${formatNumber(unmappedBooks.length)} books have country labels the atlas could not confidently place${labels.length ? ` (${labels.join(', ')}${unmappedBooks.length > labels.length ? ', …' : ''})` : ''}. These remain visible in List and Quilt views.`;
    } else {
      mapNote.textContent = 'Countries reflect the author-origin field in the Books metadata. Historical labels are matched to a present-day geographic reference when possible.';
    }
  }

  function publicationGroup(card) {
    const yearRaw = card.dataset.publicationYear;
    const year = yearRaw === '' || yearRaw == null ? null : Number(yearRaw);
    if (!Number.isFinite(year)) {
      return { key: 'unknown', label: 'Unknown date', order: 100000, year: null };
    }
    if (year < 500) return { key: 'ancient', label: 'Ancient', order: -10000, year };
    if (year <= 1400) return { key: 'medieval', label: 'Medieval', order: 500, year };
    const century = Math.ceil(year / 100);
    const suffix = century % 100 >= 11 && century % 100 <= 13
      ? 'th'
      : century % 10 === 1 ? 'st' : century % 10 === 2 ? 'nd' : century % 10 === 3 ? 'rd' : 'th';
    return { key: `century-${century}`, label: `${century}${suffix} century`, order: century * 100, year };
  }

  function buildPublicationGroups(sourceCards) {
    const groups = new Map();
    sourceCards.forEach((card) => {
      const group = publicationGroup(card);
      if (!groups.has(group.key)) groups.set(group.key, { ...group, cards: [], subCounts: new Map() });
      const entry = groups.get(group.key);
      entry.cards.push(card);
      if (group.year != null) {
        const decade = Math.floor(group.year / 10) * 10;
        entry.subCounts.set(decade, (entry.subCounts.get(decade) || 0) + 1);
      }
    });
    return [...groups.values()].sort((a, b) => a.order - b.order);
  }

  function buildReadingGroups(sourceCards) {
    const groups = new Map();
    sourceCards.forEach((card) => {
      const date = parseFinishedDate(card.dataset.dateFinished);
      if (!date) return;
      const year = date.getUTCFullYear();
      if (!groups.has(year)) groups.set(year, { key: String(year), label: String(year), order: year, cards: [], subCounts: new Map() });
      const entry = groups.get(year);
      entry.cards.push(card);
      const month = date.getUTCMonth();
      entry.subCounts.set(month, (entry.subCounts.get(month) || 0) + 1);
    });
    return [...groups.values()].sort((a, b) => a.order - b.order);
  }

  function timelineBars(group, mode) {
    let values;
    if (mode === 'reading') {
      values = Array.from({ length: 12 }, (_, month) => group.subCounts.get(month) || 0);
    } else {
      const sorted = [...group.subCounts.entries()].sort((a, b) => a[0] - b[0]);
      values = sorted.length > 8
        ? sorted.slice(-8).map((entry) => entry[1])
        : sorted.map((entry) => entry[1]);
      while (values.length < 5) values.push(0);
    }
    const maximum = Math.max(1, ...values);
    return values.map((value) => `<span data-peak="${value === maximum && value > 0}" style="height:${Math.max(8, (value / maximum) * 100)}%"></span>`).join('');
  }

  function timelineCaption(group, mode) {
    if (mode === 'reading') {
      const months = [...group.subCounts.entries()].sort((a, b) => b[1] - a[1]);
      if (!months.length) return 'No dated entries';
      const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' })
        .format(new Date(Date.UTC(2020, months[0][0], 1)));
      return `Busiest month: ${monthName} (${formatNumber(months[0][1])})`;
    }

    const years = group.cards
      .map((card) => Number(card.dataset.publicationYear))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    if (!years.length) return 'Publication year unavailable';
    const formatYear = (year) => year < 0 ? `${Math.abs(year)} BCE` : String(year);
    return years[0] === years[years.length - 1]
      ? `Published ${formatYear(years[0])}`
      : `${formatYear(years[0])}–${formatYear(years[years.length - 1])}`;
  }

  function applyTimelineFilter(group) {
    if (state.timelineMode === 'reading') {
      if (!yearSelect) return;
      yearSelect.value = group.key;
      yearSelect.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      if (!periodSelect) return;
      periodSelect.value = group.key;
      periodSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function renderTimeline() {
    const sourceCards = getVisibleCards();
    const mode = state.timelineMode;
    const groups = mode === 'reading' ? buildReadingGroups(sourceCards) : buildPublicationGroups(sourceCards);
    const busiest = [...groups].sort((a, b) => b.cards.length - a.cards.length)[0];

    const publicationYears = sourceCards
      .map((card) => Number(card.dataset.publicationYear))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    const finishedDates = sourceCards
      .map((card) => parseFinishedDate(card.dataset.dateFinished))
      .filter(Boolean)
      .sort((a, b) => a - b);

    const firstLabel = mode === 'reading'
      ? (finishedDates[0]?.getUTCFullYear() || '—')
      : (publicationYears.length ? (publicationYears[0] < 0 ? `${Math.abs(publicationYears[0])} BCE` : publicationYears[0]) : '—');
    const lastLabel = mode === 'reading'
      ? (finishedDates.at(-1)?.getUTCFullYear() || '—')
      : (publicationYears.length ? publicationYears.at(-1) : '—');

    timelineMetrics.innerHTML = [
      metricMarkup('Books in timeline', formatNumber(sourceCards.length), 'After all active filters'),
      metricMarkup(mode === 'reading' ? 'First tracked year' : 'Earliest work', firstLabel, mode === 'reading' ? 'When it entered my log' : 'Publication date'),
      metricMarkup(mode === 'reading' ? 'Latest tracked year' : 'Newest work', lastLabel, mode === 'reading' ? 'Current end of the journey' : 'Publication date'),
      metricMarkup('Busiest period', busiest?.label || '—', busiest ? `${formatNumber(busiest.cards.length)} books` : 'No dated books'),
    ].join('');

    timelineHelp.textContent = mode === 'reading'
      ? 'Each stop is a year; the small bars show its months. Select one to filter the page.'
      : 'Each stop is a publication era; select one to apply the existing period filter.';

    if (!groups.length) {
      timelineContent.innerHTML = '<div class="books-timeline-empty">No dated books match the current filters.</div>';
      return;
    }

    timelineContent.innerHTML = `
      <div class="books-timeline-viewport" aria-label="${mode === 'reading' ? 'Reading journey timeline' : 'Publication history timeline'}">
        <div class="books-timeline-track">
          ${groups.map((group) => `
            <article class="books-timeline-stop">
              <button type="button" class="books-timeline-stop-button" data-timeline-key="${group.key}">
                <span class="books-timeline-period">${group.label}</span>
                <span class="books-timeline-count">${formatNumber(group.cards.length)} ${group.cards.length === 1 ? 'book' : 'books'}</span>
                <span class="books-timeline-covers" aria-hidden="true">
                  ${group.cards.slice(0, 3).map((card) => `<img src="${getCardCover(card)}" alt="" loading="lazy" />`).join('')}
                </span>
                <span class="books-timeline-bar" aria-hidden="true">${timelineBars(group, mode)}</span>
                <span class="books-timeline-caption">${timelineCaption(group, mode)}</span>
              </button>
            </article>
          `).join('')}
        </div>
      </div>
    `;

    timelineContent.querySelectorAll('[data-timeline-key]').forEach((button) => {
      button.addEventListener('click', () => {
        const group = groups.find((candidate) => candidate.key === button.dataset.timelineKey);
        if (group) applyTimelineFilter(group);
      });
    });
  }

  function activeBaseFilterCount() {
    return ['#genre-filter', '#year-filter', '#period-filter', '#language-filter', '#country-filter']
      .map((selector) => document.querySelector(selector))
      .filter((control) => control?.value)
      .length;
  }

  function refreshResultsState() {
    const baseCards = getBaseCards();
    cards.forEach((card) => {
      const hideForCountry = Boolean(state.selectedCountryId)
        && !(card._atlasCountryIds || []).includes(state.selectedCountryId);
      card.classList.toggle('atlas-country-hidden', hideForCountry);
    });

    const visibleCards = getVisibleCards();
    if (resultsCount) {
      const suffix = state.selectedCountryId && state.countryById.has(state.selectedCountryId)
        ? ` · ${state.countryById.get(state.selectedCountryId).name}`
        : '';
      resultsCount.textContent = `Showing ${formatNumber(visibleCards.length)} of ${formatNumber(cards.length)} books${suffix}`;
    }

    if (filterEmpty) filterEmpty.hidden = visibleCards.length !== 0;

    const activeCount = activeBaseFilterCount() + Number(Boolean(state.selectedCountryId));
    if (filtersCount) {
      filtersCount.textContent = String(activeCount);
      filtersCount.hidden = activeCount === 0;
    }
    filtersButton?.classList.toggle('has-active-filters', activeCount > 0);

    const hasSearch = Boolean(searchInput?.value.trim());
    if (clearFiltersButton) clearFiltersButton.hidden = !(activeCount || hasSearch);
  }

  function refreshUI() {
    refreshResultsState();
    if (state.activeView === 'map') renderMapView();
    if (state.activeView === 'timeline') renderTimeline();
  }

  let refreshTimer;
  const scheduleRefresh = () => {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshUI, 120);
  };

  ['#q', '#genre-filter', '#year-filter', '#period-filter', '#language-filter', '#country-filter', '#sort-books']
    .forEach((selector) => {
      const control = document.querySelector(selector);
      control?.addEventListener(control.matches('input') ? 'input' : 'change', scheduleRefresh);
    });

  clearFiltersButton?.addEventListener('click', () => {
    state.selectedCountryId = null;
    window.setTimeout(refreshUI, 0);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.selectedCountryId) {
      state.selectedCountryId = null;
      window.setTimeout(refreshUI, 0);
    }
  });

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(grid, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['style'],
  });

  refreshResultsState();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startBooksAtlas, { once: true });
} else {
  startBooksAtlas();
}
