/* LifeLoggerz Classical Music — Canon Journey v10.
   Reframes Journey as the signature Classical experience: a formal canon trail,
   personal listening chronology, and geography view built from profile metadata. */

const CLASSICAL_JOURNEY_V10_RETRIES = 240;

const journeyClean = (value) => String(value ?? '').trim();
const journeyNorm = (value) => journeyClean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const journeyHtml = (value) => journeyClean(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const journeyAttr = journeyHtml;
const journeyCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

const JOURNEY_PERIODS = [
  'Medieval',
  'Renaissance',
  'Baroque',
  'Galant',
  'Classical',
  'Romantic',
  'Late Romantic',
  'Impressionist',
  'Modern',
  'Contemporary',
];

const EUROPE_MAP_URL = 'https://upload.wikimedia.org/wikipedia/commons/2/21/Blank_map_europe_no_borders.svg';
const WORLD_MAP_URL = 'https://upload.wikimedia.org/wikipedia/commons/8/8e/BlankMap_World_simple.svg';

/* Approximate country-centroid placement for the current reliable metadata layer.
   These are intentionally country/region anchors, not claimed city locations. */
const JOURNEY_GEO_POINTS = [
  { keys: ['italian', 'italy'], label: 'Italy', europe: [52, 68], world: [53, 36] },
  { keys: ['german', 'germany'], label: 'Germany', europe: [49, 48], world: [51, 31] },
  { keys: ['austrian', 'austria'], label: 'Austria', europe: [55, 57], world: [52, 33] },
  { keys: ['french', 'france'], label: 'France', europe: [39, 58], world: [48, 34] },
  { keys: ['polish', 'poland'], label: 'Poland', europe: [59, 45], world: [54, 30] },
  { keys: ['czech', 'bohemian', 'czechia'], label: 'Czechia', europe: [54, 51], world: [52, 32] },
  { keys: ['english', 'british', 'scottish', 'united kingdom', 'uk'], label: 'United Kingdom', europe: [31, 43], world: [47, 29] },
  { keys: ['russian', 'russia'], label: 'Russia', europe: [73, 34], world: [64, 25] },
  { keys: ['spanish', 'spain'], label: 'Spain', europe: [28, 72], world: [45, 38] },
  { keys: ['portuguese', 'portugal'], label: 'Portugal', europe: [22, 72], world: [44, 38] },
  { keys: ['dutch', 'netherlands'], label: 'Netherlands', europe: [43, 43], world: [49, 30] },
  { keys: ['belgian', 'flemish', 'belgium'], label: 'Belgium', europe: [42, 49], world: [49, 31] },
  { keys: ['danish', 'denmark'], label: 'Denmark', europe: [49, 35], world: [51, 28] },
  { keys: ['norwegian', 'norway'], label: 'Norway', europe: [46, 19], world: [50, 22] },
  { keys: ['swedish', 'sweden'], label: 'Sweden', europe: [55, 20], world: [53, 22] },
  { keys: ['finnish', 'finland'], label: 'Finland', europe: [64, 18], world: [56, 22] },
  { keys: ['hungarian', 'hungary'], label: 'Hungary', europe: [59, 58], world: [53, 33] },
  { keys: ['romanian', 'romania'], label: 'Romania', europe: [67, 60], world: [55, 34] },
  { keys: ['swiss', 'switzerland'], label: 'Switzerland', europe: [45, 60], world: [50, 34] },
  { keys: ['greek', 'greece'], label: 'Greece', europe: [64, 75], world: [54, 38] },
  { keys: ['ukrainian', 'ukraine'], label: 'Ukraine', europe: [70, 49], world: [57, 31] },
  { keys: ['croatian', 'croatia'], label: 'Croatia', europe: [57, 64], world: [52, 35] },
  { keys: ['slovenian', 'slovenia'], label: 'Slovenia', europe: [54, 62], world: [52, 35] },
  { keys: ['serbian', 'serbia'], label: 'Serbia', europe: [62, 65], world: [54, 35] },
  { keys: ['american', 'united states', 'usa', 'u s'], label: 'United States', world: [24, 38] },
  { keys: ['chinese', 'china'], label: 'China', world: [76, 40] },
  { keys: ['mexican', 'mexico'], label: 'Mexico', world: [19, 50] },
  { keys: ['brazilian', 'brazil'], label: 'Brazil', world: [34, 67] },
  { keys: ['argentine', 'argentinian', 'argentina'], label: 'Argentina', world: [30, 78] },
  { keys: ['canadian', 'canada'], label: 'Canada', world: [22, 24] },
  { keys: ['japanese', 'japan'], label: 'Japan', world: [86, 41] },
  { keys: ['korean', 'korea'], label: 'Korea', world: [82, 39] },
];

function journeyFormatMinutes(value) {
  const minutes = Math.max(0, Number(value || 0));
  if (minutes < 60) return `${Math.round(minutes).toLocaleString('en-US')} min`;
  const hours = minutes / 60;
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hr${Math.abs(hours - 1) < .05 ? '' : 's'}`;
}

function journeyFormatDate(ms, monthOnly = false) {
  const date = new Date(Number(ms || 0));
  if (!ms || Number.isNaN(date.getTime())) return 'Date not logged';
  return new Intl.DateTimeFormat('en-US', monthOnly
    ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
    : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function journeyLifeFromMeta(meta) {
  return journeyClean(meta).match(/\b(?:c\.?\s*)?\d{3,4}\s*[–—-]\s*(?:c\.?\s*)?(?:\d{3,4}|present)\b/i)?.[0] || '';
}

function journeyNationalityFromMeta(meta, period) {
  const life = journeyLifeFromMeta(meta);
  return journeyClean(meta)
    .split(/\s*·\s*/)
    .map((part) => part.trim())
    .find((part) => part && part !== life && journeyNorm(part) !== journeyNorm(period)) || '';
}

function journeyGeoPoint(nationality) {
  const normalized = journeyNorm(nationality);
  if (!normalized) return null;
  return JOURNEY_GEO_POINTS.find((point) => point.keys.some((key) => normalized.includes(journeyNorm(key)))) || null;
}

function journeyWorkKey(composerId, piece) {
  return `${journeyClean(composerId)}|${journeyNorm(piece)}`;
}

function bootClassicalJourneyV10(attempt = 0) {
  const expansionReady = document.body.dataset.classicalExpansionReady === 'true';
  const journeyPanel = document.querySelector('[data-page-panel="journey"]');
  const host = journeyPanel?.querySelector('[data-classical-panel-content]');
  const composerGrid = document.querySelector('#composer-grid');
  const workItems = Array.from(document.querySelectorAll('[data-work-item]'));

  if ((!expansionReady || !journeyPanel || !host || !composerGrid || !workItems.length) && attempt < CLASSICAL_JOURNEY_V10_RETRIES) {
    window.setTimeout(() => bootClassicalJourneyV10(attempt + 1), 75);
    return;
  }
  if (!expansionReady || !journeyPanel || !host || !composerGrid || !workItems.length || document.body.dataset.classicalJourneyV10Ready) return;
  document.body.dataset.classicalJourneyV10Ready = 'true';

  const heading = journeyPanel.querySelector('.panel-heading');
  const headingTitle = heading?.querySelector('h2');
  const headingCopy = heading?.querySelector('p');
  if (headingTitle) headingTitle.textContent = 'Classical Canon Journey';
  if (headingCopy) headingCopy.textContent = 'Follow the composer-by-composer quest, retrace my own listening path, and see where the canon spreads across the map.';

  const cards = Array.from(composerGrid.querySelectorAll('.composer-card[data-composer-id]'));
  const workByKey = new Map();
  const worksByComposer = new Map();

  workItems.forEach((item) => {
    const composerId = journeyClean(item.dataset.composer);
    const piece = journeyClean(item.querySelector('.entry-title')?.textContent);
    const key = journeyWorkKey(composerId, piece);
    const record = {
      key,
      composerId,
      piece,
      item,
      listens: Number(item.dataset.listens || 1),
      minutes: Number(item.dataset.totalMinutes || item.dataset.minutes || 0),
      rating: journeyClean(item.dataset.rating) || 'other',
      date: Number(item.dataset.date || 0),
      period: journeyClean(item.dataset.period),
      form: journeyClean(item.dataset.form),
    };
    workByKey.set(key, record);
    worksByComposer.set(composerId, [...(worksByComposer.get(composerId) || []), record]);
  });

  const composers = cards.map((card) => {
    const id = journeyClean(card.dataset.composerId);
    const name = journeyClean(card.dataset.name);
    const meta = journeyClean(card.querySelector('.composer-meta')?.textContent);
    const period = journeyClean(card.dataset.period);
    const life = journeyLifeFromMeta(meta);
    const yearMatch = life.match(/\d{3,4}/);
    const birthYear = Number(yearMatch?.[0] || 0);
    const nationality = journeyNationalityFromMeta(meta, period);
    const works = worksByComposer.get(id) || [];
    const repeatedWorks = works.filter((work) => work.listens > 1);
    const repeatListens = repeatedWorks.reduce((sum, work) => sum + Math.max(0, work.listens - 1), 0);
    const topReplay = [...repeatedWorks].sort((a, b) => b.listens - a.listens || b.minutes - a.minutes)[0] || null;
    const portrait = card.querySelector('.portrait')?.getAttribute('src') || '';
    const initials = journeyClean(card.querySelector('.portrait-fallback')?.textContent) || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3);
    return {
      id,
      name,
      card,
      profiled: !card.querySelector('.profile-badge'),
      portrait,
      initials,
      period,
      life,
      birthYear,
      nationality,
      works: Number(card.dataset.unique || works.length),
      minutes: Number(card.dataset.minutes || 0),
      favorites: Number(card.dataset.favorites || 0),
      entries: Number(card.dataset.entries || 0),
      lastListened: Number(card.dataset.lastListened || 0),
      repeatedWorks: repeatedWorks.length,
      repeatListens,
      topReplay,
    };
  });

  const profiled = composers.filter((composer) => composer.profiled);
  const latestListening = Math.max(0, ...composers.map((composer) => composer.lastListened));
  const recentCutoff = latestListening ? latestListening - (90 * 86400000) : 0;
  const activeRecently = profiled.filter((composer) => composer.lastListened >= recentCutoff && composer.lastListened > 0).length;
  const totalMinutes = composers.reduce((sum, composer) => sum + composer.minutes, 0);
  const totalWorks = workItems.length;
  const totalFavorites = workItems.filter((item) => ['amazing', 'gorgeous'].includes(item.dataset.rating || '')).length;
  const periodsExplored = new Set(profiled.map((composer) => composer.period).filter(Boolean)).size;

  const listeningEntries = [];
  cards.forEach((card) => {
    const composerId = journeyClean(card.dataset.composerId);
    const composer = composers.find((candidate) => candidate.id === composerId);
    const template = document.querySelector(`#composer-template-${CSS.escape(composerId)}`);
    template?.content?.querySelectorAll('[data-detail-panel="history"] [data-list-item]').forEach((row) => {
      const date = Number(row.dataset.date || 0);
      if (!date) return;
      const piece = journeyClean(row.querySelector('.entry-title')?.textContent);
      listeningEntries.push({
        composerId,
        composer: composer?.name || journeyClean(card.dataset.name),
        piece,
        key: journeyWorkKey(composerId, piece),
        date,
        minutes: Number(row.dataset.minutes || 0),
        rating: journeyClean(row.dataset.rating) || 'other',
        row: Number(row.dataset.row || 0),
      });
    });
  });
  listeningEntries.sort((a, b) => a.date - b.date || a.row - b.row);

  function composerVisual(composer, className = 'canon-node__portrait') {
    if (composer.portrait) return `<img class="${className}" src="${journeyAttr(composer.portrait)}" alt="" loading="lazy" decoding="async">`;
    return `<span class="${className} canon-node__portrait--fallback" aria-hidden="true">${journeyHtml(composer.initials || composer.name.slice(0, 2))}</span>`;
  }

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

  function openWork(key) {
    const work = workByKey.get(key);
    const trigger = work?.item?.querySelector('[data-work-open]');
    if (trigger) trigger.click();
  }

  function canonNode(composer, index) {
    const side = index % 2 === 0 ? 'left' : 'right';
    const replay = composer.topReplay ? `${composer.topReplay.listens}× ${composer.topReplay.piece}` : 'No repeat work yet';
    return `
      <button type="button" class="canon-node canon-node--${side}" data-canon-composer="${journeyAttr(composer.id)}" aria-label="Open ${journeyAttr(composer.name)} repertoire">
        <span class="canon-node__anchor" aria-hidden="true"></span>
        <span class="canon-node__card">
          ${composerVisual(composer)}
          <span class="canon-node__copy">
            <span class="canon-node__name">${journeyHtml(composer.name)}</span>
            <span class="canon-node__identity">${journeyHtml([composer.life, composer.nationality].filter(Boolean).join(' · ') || composer.period || 'Composer profile')}</span>
            <span class="canon-node__stats">
              <span><b>${composer.works.toLocaleString('en-US')}</b> works</span>
              <span><b>${journeyHtml(journeyFormatMinutes(composer.minutes))}</b> heard</span>
              <span><b>${composer.favorites.toLocaleString('en-US')}</b> favorites</span>
              <span><b>${composer.repeatedWorks.toLocaleString('en-US')}</b> repeated</span>
            </span>
            <span class="canon-node__replay">${journeyHtml(replay)}</span>
          </span>
        </span>
      </button>`;
  }

  function buildCanonTrail() {
    const grouped = new Map();
    profiled.forEach((composer) => {
      const period = composer.period || 'Unclassified';
      grouped.set(period, [...(grouped.get(period) || []), composer]);
    });
    const orderedPeriods = [...grouped.keys()].sort((a, b) => {
      const ai = JOURNEY_PERIODS.indexOf(a);
      const bi = JOURNEY_PERIODS.indexOf(b);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      return journeyCollator.compare(a, b);
    });

    return `
      <section class="canon-view" data-journey-view="canon">
        <div class="canon-view__intro">
          <span class="canon-kicker">THE CANON TRAIL</span>
          <h3>Composer by composer, era by era.</h3>
          <p>This is the formal part of the quest: the composers I have deliberately reached, profiled, and explored. Portraits light up the path as the canon grows; click any composer to open the repertoire I have heard.</p>
        </div>
        <div class="canon-trail">
          ${orderedPeriods.map((period, periodIndex) => {
            const eraComposers = [...grouped.get(period)].sort((a, b) => {
              if (a.birthYear && b.birthYear) return a.birthYear - b.birthYear || journeyCollator.compare(a.name, b.name);
              if (a.birthYear) return -1;
              if (b.birthYear) return 1;
              return journeyCollator.compare(a.name, b.name);
            });
            const eraMinutes = eraComposers.reduce((sum, composer) => sum + composer.minutes, 0);
            const eraWorks = eraComposers.reduce((sum, composer) => sum + composer.works, 0);
            const eraFavorites = eraComposers.reduce((sum, composer) => sum + composer.favorites, 0);
            return `
              <section class="canon-era" data-era="${journeyAttr(journeyNorm(period))}">
                <div class="canon-era__portal">
                  <span class="canon-era__number">${String(periodIndex + 1).padStart(2, '0')}</span>
                  <div><h4>${journeyHtml(period)}</h4><p>${eraComposers.length.toLocaleString('en-US')} composers · ${eraWorks.toLocaleString('en-US')} works · ${journeyHtml(journeyFormatMinutes(eraMinutes))} · ${eraFavorites.toLocaleString('en-US')} favorites</p></div>
                </div>
                <div class="canon-era__path">
                  <span class="canon-era__spine" aria-hidden="true"></span>
                  <span class="canon-era__glyph canon-era__glyph--a" aria-hidden="true">♪</span>
                  <span class="canon-era__glyph canon-era__glyph--b" aria-hidden="true">♬</span>
                  ${eraComposers.map((composer, index) => canonNode(composer, index)).join('')}
                </div>
              </section>`;
          }).join('')}
        </div>
      </section>`;
  }

  function buildPersonalJourney() {
    if (!listeningEntries.length) return '<section class="canon-view" data-journey-view="personal" hidden><p class="canon-empty">No dated listening entries are available.</p></section>';
    const years = new Map();
    listeningEntries.forEach((entry) => {
      const date = new Date(entry.date);
      const year = date.getUTCFullYear();
      const month = `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!years.has(year)) years.set(year, new Map());
      years.get(year).set(month, [...(years.get(year).get(month) || []), entry]);
    });
    const sortedYears = [...years.keys()].sort((a, b) => b - a);
    return `
      <section class="canon-view" data-journey-view="personal" hidden>
        <div class="canon-view__intro">
          <span class="canon-kicker">MY LISTENING PATH</span>
          <h3>How the archive actually unfolded.</h3>
          <p>The canon has a historical order; my education did not. This chronology shows the order in which the music entered my life after formal tracking began.</p>
        </div>
        <div class="personal-canon-years">
          ${sortedYears.map((year, yearIndex) => {
            const months = years.get(year);
            const yearEntries = [...months.values()].flat();
            const yearMinutes = yearEntries.reduce((sum, entry) => sum + entry.minutes, 0);
            const uniqueWorks = new Set(yearEntries.map((entry) => entry.key)).size;
            const uniqueComposers = new Set(yearEntries.map((entry) => entry.composerId)).size;
            return `
              <details class="personal-canon-year" ${yearIndex === 0 ? 'open' : ''}>
                <summary>
                  <span class="personal-canon-year__year">${year}</span>
                  <span><b>${yearEntries.length.toLocaleString('en-US')} listens</b><em>${uniqueWorks.toLocaleString('en-US')} works · ${uniqueComposers.toLocaleString('en-US')} composers</em></span>
                  <strong>${journeyHtml(journeyFormatMinutes(yearMinutes))}</strong>
                </summary>
                <div class="personal-canon-months">
                  ${[...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, monthEntries]) => {
                    const monthDate = new Date(`${month}-01T00:00:00Z`);
                    const monthMinutes = monthEntries.reduce((sum, entry) => sum + entry.minutes, 0);
                    const monthComposers = new Set(monthEntries.map((entry) => entry.composerId)).size;
                    return `
                      <details class="personal-canon-month">
                        <summary><span><b>${journeyHtml(new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(monthDate))}</b><em>${monthEntries.length.toLocaleString('en-US')} listens · ${monthComposers.toLocaleString('en-US')} composers</em></span><strong>${journeyHtml(journeyFormatMinutes(monthMinutes))}</strong></summary>
                        <ol>
                          ${[...monthEntries].sort((a, b) => b.date - a.date || b.row - a.row).map((entry) => `
                            <li>
                              <time>${journeyHtml(journeyFormatDate(entry.date))}</time>
                              <button type="button" data-canon-work="${journeyAttr(entry.key)}"><b>${journeyHtml(entry.composer)}</b><span>${journeyHtml(entry.piece)}</span></button>
                              <span><i class="rating ${journeyAttr(entry.rating)}">${journeyHtml(entry.rating === 'amazing' ? 'Amazing' : entry.rating === 'gorgeous' ? 'Gorgeous' : 'Other')}</i>${journeyHtml(journeyFormatMinutes(entry.minutes))}</span>
                            </li>`).join('')}
                        </ol>
                      </details>`;
                  }).join('')}
                </div>
              </details>`;
          }).join('')}
        </div>
      </section>`;
  }

  function mapPin(composer, point, mode, index, count) {
    const coords = mode === 'europe' ? point.europe : point.world;
    if (!coords) return '';
    const spread = count > 1 ? Math.min(4.5, 1.4 + count * .55) : 0;
    const angle = count > 1 ? ((index / count) * Math.PI * 2) - Math.PI / 2 : 0;
    const x = Math.max(3, Math.min(97, coords[0] + Math.cos(angle) * spread));
    const y = Math.max(4, Math.min(96, coords[1] + Math.sin(angle) * spread));
    return `
      <button type="button" class="canon-map-pin" style="--pin-x:${x}%;--pin-y:${y}%;" data-canon-composer="${journeyAttr(composer.id)}" title="${journeyAttr(`${composer.name} · ${point.label}`)}" aria-label="Open ${journeyAttr(composer.name)} repertoire">
        ${composerVisual(composer, 'canon-map-pin__portrait')}
      </button>`;
  }

  function buildMap(mode) {
    const mapped = [];
    const unmapped = [];
    profiled.forEach((composer) => {
      const point = journeyGeoPoint(composer.nationality);
      if (!point || (mode === 'europe' && !point.europe)) unmapped.push(composer);
      else mapped.push({ composer, point });
    });
    const byPlace = new Map();
    mapped.forEach((record) => {
      byPlace.set(record.point.label, [...(byPlace.get(record.point.label) || []), record]);
    });
    const pins = [];
    byPlace.forEach((records) => {
      records.forEach((record, index) => pins.push(mapPin(record.composer, record.point, mode, index, records.length)));
    });
    const image = mode === 'europe' ? EUROPE_MAP_URL : WORLD_MAP_URL;
    const source = mode === 'europe'
      ? 'https://commons.wikimedia.org/wiki/File:Blank_map_europe_no_borders.svg'
      : 'https://commons.wikimedia.org/wiki/File:BlankMap_World_simple.svg';
    return `
      <div class="canon-map-stage" data-canon-map-stage="${mode}">
        <img class="canon-map-stage__base" src="${journeyAttr(image)}" alt="${mode === 'europe' ? 'Outline map of Europe' : 'Outline map of the world'}" loading="lazy" referrerpolicy="no-referrer">
        <div class="canon-map-stage__pins">${pins.join('')}</div>
      </div>
      <div class="canon-map-legend">
        <span>${mapped.length.toLocaleString('en-US')} profiled composers placed from current nationality metadata.</span>
        ${unmapped.length ? `<span>${unmapped.length.toLocaleString('en-US')} profile${unmapped.length === 1 ? '' : 's'} outside this map or not yet mapped.</span>` : ''}
        <a href="${journeyAttr(source)}" target="_blank" rel="noopener noreferrer">Public-domain base map ↗</a>
      </div>`;
  }

  function buildGeography() {
    return `
      <section class="canon-view" data-journey-view="geography" hidden>
        <div class="canon-view__intro">
          <span class="canon-kicker">COMPOSER GEOGRAPHY</span>
          <h3>The canon is also a map.</h3>
          <p>For now, the reliable location layer is the nationality stored in each composer profile, so these are regional anchors rather than claims about a single career city. The structure is ready for exact Vienna, Leipzig, Venice, Paris, London, New York, Beijing, and other city pins as that metadata is added.</p>
        </div>
        <div class="canon-map-controls" role="group" aria-label="Composer geography map">
          <button type="button" aria-pressed="true" data-canon-map="europe">Europe</button>
          <button type="button" aria-pressed="false" data-canon-map="world">World</button>
        </div>
        <div class="canon-map-wrap" data-canon-map-wrap>${buildMap('europe')}</div>
      </section>`;
  }

  host.innerHTML = `
    <div class="canon-journey-shell">
      <section class="canon-quest-hero">
        <div class="canon-quest-hero__copy">
          <span class="canon-kicker">CLASSICAL CANON QUEST</span>
          <h3>My education in an artistic tradition, made visible.</h3>
          <p>I listened to classical music before I tracked it. The project changed when I set a deliberate goal: move through the Western canon composer by composer, hear the major repertoire, compare performances, and find the music that survives repeated listening.</p>
        </div>
        <div class="canon-quest-stats" aria-label="Classical Canon progress">
          <div><strong>${profiled.length.toLocaleString('en-US')}</strong><span>composer profiles reached</span></div>
          <div><strong>${totalWorks.toLocaleString('en-US')}</strong><span>works heard</span></div>
          <div><strong>${totalFavorites.toLocaleString('en-US')}</strong><span>favorites found</span></div>
          <div><strong>${journeyHtml(journeyFormatMinutes(totalMinutes))}</strong><span>listening time</span></div>
          <div><strong>${periodsExplored.toLocaleString('en-US')}</strong><span>profiled periods</span></div>
          <div><strong>${activeRecently.toLocaleString('en-US')}</strong><span>composers active in latest 90 days</span></div>
        </div>
      </section>

      <nav class="canon-journey-switch" aria-label="Classical journey views">
        <button type="button" aria-pressed="true" data-canon-view="canon">Canon Trail</button>
        <button type="button" aria-pressed="false" data-canon-view="personal">My Listening</button>
        <button type="button" aria-pressed="false" data-canon-view="geography">Geography</button>
      </nav>

      ${buildCanonTrail()}
      ${buildPersonalJourney()}
      ${buildGeography()}
    </div>`;

  function setView(name) {
    host.querySelectorAll('[data-canon-view]').forEach((button) => button.setAttribute('aria-pressed', button.dataset.canonView === name ? 'true' : 'false'));
    host.querySelectorAll('[data-journey-view]').forEach((view) => { view.hidden = view.dataset.journeyView !== name; });
  }

  host.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-canon-view]');
    if (viewButton) {
      setView(viewButton.dataset.canonView || 'canon');
      return;
    }

    const composerButton = event.target.closest('[data-canon-composer]');
    if (composerButton) {
      openComposerWorks(composerButton.dataset.canonComposer || '');
      return;
    }

    const workButton = event.target.closest('[data-canon-work]');
    if (workButton) {
      openWork(workButton.dataset.canonWork || '');
      return;
    }

    const mapButton = event.target.closest('[data-canon-map]');
    if (mapButton) {
      const mode = mapButton.dataset.canonMap === 'world' ? 'world' : 'europe';
      host.querySelectorAll('[data-canon-map]').forEach((button) => button.setAttribute('aria-pressed', button === mapButton ? 'true' : 'false'));
      const wrap = host.querySelector('[data-canon-map-wrap]');
      if (wrap) wrap.innerHTML = buildMap(mode);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalJourneyV10(), { once: true });
} else {
  bootClassicalJourneyV10();
}
