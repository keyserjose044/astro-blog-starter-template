/* LifeLoggerz Classical Music: deep views, repeat analytics, work details, calendar, journey, records, and favorites. */

const CLASSICAL_EXPANSION_VERSION = '20260802-0914';
const CLASSICAL_EXPANSION_RETRIES = 160;
const CLASSICAL_PAGE_SIZE = 40;

function ensureClassicalExpansionCss() {
  if (document.querySelector('link[data-classical-expansion-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.classicalExpansionCss = 'true';
  link.href = new URL(`../styles/classical-expansion.css?v=${CLASSICAL_EXPANSION_VERSION}`, import.meta.url).toString();
  document.head.append(link);
}

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
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

function formatDate(dateOrMs, options = {}) {
  const date = dateOrMs instanceof Date ? dateOrMs : new Date(Number(dateOrMs || 0));
  if (!date || Number.isNaN(date.getTime())) return 'Date not logged';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: options.short ? 'short' : 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatMonthShort(date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value || 0));
  if (minutes < 60) return `${Math.round(minutes).toLocaleString('en-US')} min`;
  const hours = minutes / 60;
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hr${Math.abs(hours - 1) < 0.05 ? '' : 's'}`;
}

function dateKey(ms) {
  const date = new Date(Number(ms || 0));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function monthKey(ms) {
  const date = new Date(Number(ms || 0));
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function parseCompositionYear(raw) {
  const match = clean(raw).match(/\b(\d{3,4})\b/);
  return match ? Number(match[1]) : 0;
}

function ratingLabel(bucket) {
  if (bucket === 'amazing') return 'Amazing';
  if (bucket === 'gorgeous') return 'Gorgeous';
  return 'Other';
}

function ratingRank(bucket) {
  if (bucket === 'amazing') return 3;
  if (bucket === 'gorgeous') return 2;
  return 1;
}

function workKey(composerId, piece) {
  return `${clean(composerId)}|${norm(piece)}`;
}

function repeatLabel(count) {
  return count > 1 ? `↻ ${Number(count).toLocaleString('en-US')}` : '';
}

function spanLabel(firstMs, latestMs) {
  if (!firstMs || !latestMs || latestMs <= firstMs) return 'same day';
  const days = Math.round((latestMs - firstMs) / 86400000);
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30.44));
    return `${months} mo`;
  }
  const years = Math.floor(days / 365.25);
  const months = Math.max(0, Math.floor((days - Math.round(years * 365.25)) / 30.44));
  return months ? `${years} yr ${months} mo` : `${years} yr`;
}

function bootClassicalExpansion(attempt = 0) {
  ensureClassicalExpansionCss();

  const tabs = document.querySelector('.page-tabs');
  const worksPanel = document.querySelector('[data-page-panel="works"]');
  const composerGrid = document.querySelector('#composer-grid');
  const workItems = Array.from(document.querySelectorAll('[data-work-item]'));

  if ((!tabs || !worksPanel || !composerGrid || !workItems.length) && attempt < CLASSICAL_EXPANSION_RETRIES) {
    window.setTimeout(() => bootClassicalExpansion(attempt + 1), 75);
    return;
  }
  if (!tabs || !worksPanel || !composerGrid || !workItems.length || document.body.dataset.classicalExpansionReady) return;
  document.body.dataset.classicalExpansionReady = 'true';

  const composerCards = Array.from(composerGrid.querySelectorAll('.composer-card'));
  const composers = new Map();
  composerCards.forEach((card) => {
    const id = clean(card.dataset.composerId);
    const name = clean(card.dataset.name) || id.replace(/-/g, ' ');
    const portrait = card.querySelector('.portrait')?.getAttribute('src') || '';
    const initials = clean(card.querySelector('.portrait-fallback')?.textContent) || name.split(/\s+/).map((part) => part[0]).join('').slice(0, 3);
    composers.set(id, {
      id,
      name,
      portrait,
      initials,
      worksCount: Number(card.dataset.unique || 0),
      listeningMinutes: Number(card.dataset.minutes || 0),
      favoritesCount: Number(card.dataset.favorites || 0),
      favoriteRate: Number(card.dataset.rate || 0),
      entriesCount: Number(card.dataset.entries || 0),
    });
  });

  const works = new Map();
  workItems.forEach((item) => {
    const composerId = clean(item.dataset.composer);
    const piece = clean(item.querySelector('.entry-title')?.textContent);
    const key = workKey(composerId, piece);
    const metaParts = Array.from(item.querySelector('.entry-meta')?.childNodes || [])
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => clean(node.textContent))
      .filter(Boolean)
      .join(' ');
    const record = {
      key,
      item,
      composerId,
      composer: clean(item.querySelector('.entry-composer')?.textContent) || composers.get(composerId)?.name || composerId,
      piece,
      form: clean(item.dataset.form),
      period: clean(item.dataset.period),
      compositionYear: metaParts.match(/\b\d{3,4}(?:[-–]\d{1,4})?\b/)?.[0] || '',
      compositionYearNumber: 0,
      rating: clean(item.dataset.rating) || 'other',
      latestDate: Number(item.dataset.date || 0),
      latestMinutes: Number(item.dataset.minutes || 0),
      listenCount: Number(item.dataset.listens || 1),
      firstDate: 0,
      totalMinutes: 0,
      performanceCount: 0,
      entries: [],
      favorite: item.dataset.rating === 'amazing' || item.dataset.rating === 'gorgeous',
    };
    record.compositionYearNumber = parseCompositionYear(record.compositionYear);
    works.set(key, record);
  });

  const entries = [];
  composerCards.forEach((card) => {
    const composerId = clean(card.dataset.composerId);
    const composer = composers.get(composerId)?.name || clean(card.dataset.name);
    const template = document.querySelector(`#composer-template-${CSS.escape(composerId)}`);
    const historyItems = template?.content?.querySelectorAll('[data-detail-panel="history"] [data-list-item]') || [];

    Array.from(historyItems).forEach((item) => {
      const piece = clean(item.querySelector('.entry-title')?.textContent);
      const key = workKey(composerId, piece);
      const entry = {
        key,
        composerId,
        composer,
        piece,
        date: Number(item.dataset.date || 0),
        minutes: Number(item.dataset.minutes || 0),
        rating: clean(item.dataset.rating) || 'other',
        row: Number(item.dataset.row || 0),
        url: item.querySelector('.play-link')?.getAttribute('href') || '',
      };
      if (entry.date) entries.push(entry);
      if (!works.has(key)) {
        works.set(key, {
          key,
          item: null,
          composerId,
          composer,
          piece,
          form: '',
          period: '',
          compositionYear: '',
          compositionYearNumber: 0,
          rating: entry.rating,
          latestDate: entry.date,
          latestMinutes: entry.minutes,
          listenCount: 1,
          firstDate: entry.date,
          totalMinutes: entry.minutes,
          performanceCount: entry.url ? 1 : 0,
          entries: [entry],
          favorite: entry.rating === 'amazing' || entry.rating === 'gorgeous',
        });
      }
    });
  });

  works.forEach((work) => {
    const history = entries
      .filter((entry) => entry.key === work.key)
      .sort((a, b) => a.date - b.date || a.row - b.row);
    if (history.length) {
      work.entries = history;
      work.listenCount = history.length;
      work.firstDate = history[0].date;
      work.latestDate = history[history.length - 1].date;
      work.totalMinutes = history.reduce((sum, entry) => sum + entry.minutes, 0);
      work.performanceCount = new Set(history.map((entry) => entry.url).filter(Boolean)).size;
      const best = [...history].sort((a, b) => ratingRank(b.rating) - ratingRank(a.rating))[0];
      if (best) work.rating = best.rating;
      work.favorite = work.rating === 'amazing' || work.rating === 'gorgeous';
    } else {
      work.firstDate = work.latestDate;
      work.totalMinutes = work.latestMinutes;
    }
    if (work.item) {
      work.item.dataset.firstDate = String(work.firstDate || 0);
      work.item.dataset.totalMinutes = String(work.totalMinutes || 0);
      work.item.dataset.compositionYearSort = String(work.compositionYearNumber || 0);
      work.item.dataset.performanceCount = String(work.performanceCount || 0);
    }
  });

  const workRecords = Array.from(works.values());
  const favoriteWorks = workRecords.filter((work) => work.favorite);
  const repeatedWorks = workRecords.filter((work) => work.listenCount > 1);
  const latestEntryDate = Math.max(...entries.map((entry) => entry.date), Date.UTC(2024, 10, 1));

  function openWork(key) {
    const work = works.get(key);
    if (!work) return;
    const dialog = ensureWorkDialog();
    const content = dialog.querySelector('[data-work-dialog-content]');
    if (!content) return;

    const history = [...work.entries].sort((a, b) => b.date - a.date || b.row - a.row);
    const performanceUrls = [...new Set(history.map((entry) => entry.url).filter(Boolean))];
    const first = work.firstDate || work.latestDate;
    const latest = work.latestDate || work.firstDate;
    const metadata = [work.form, work.period, work.compositionYear].filter(Boolean).join(' · ') || 'Metadata not logged';

    content.innerHTML = `
      <header class="classical-work-dialog__header">
        <div>
          <span class="classical-work-dialog__eyebrow">${html(work.composer)}</span>
          <h2 id="classical-work-dialog-title">${html(work.piece)}</h2>
          <p>${html(metadata)}</p>
        </div>
        <button type="button" class="classical-work-dialog__close" data-close-work-dialog>Close</button>
      </header>
      <div class="classical-work-dialog__body">
        <div class="classical-work-summary">
          <div><strong>${work.listenCount.toLocaleString('en-US')}</strong><span>listens</span></div>
          <div><strong>${formatMinutes(work.totalMinutes)}</strong><span>total time</span></div>
          <div><strong>${first ? html(formatDate(first, { short: true })) : '—'}</strong><span>first heard</span></div>
          <div><strong>${latest ? html(formatDate(latest, { short: true })) : '—'}</strong><span>latest heard</span></div>
          <div><strong>${work.performanceCount.toLocaleString('en-US')}</strong><span>linked performances</span></div>
          <div><strong>${work.listenCount > 1 ? html(spanLabel(first, latest)) : 'First listen'}</strong><span>listening span</span></div>
        </div>

        <section class="classical-work-history-section">
          <div class="classical-section-heading">
            <div><h3>Listening History</h3><p>Every dated encounter with this composition.</p></div>
            ${performanceUrls.length ? `<span>${performanceUrls.length.toLocaleString('en-US')} distinct linked performance${performanceUrls.length === 1 ? '' : 's'}</span>` : ''}
          </div>
          ${history.length ? `
            <ol class="classical-work-history">
              ${history.map((entry, index) => `
                <li>
                  <div class="classical-work-history__index">${history.length - index}</div>
                  <div class="classical-work-history__main">
                    <strong>${html(formatDate(entry.date))}</strong>
                    <span><span class="rating ${attr(entry.rating)}">${html(ratingLabel(entry.rating))}</span> ${html(formatMinutes(entry.minutes))}</span>
                  </div>
                  ${entry.url ? `<a href="${attr(entry.url)}" target="_blank" rel="noopener noreferrer">Performance ↗</a>` : '<span class="classical-work-history__missing">No link</span>'}
                </li>
              `).join('')}
            </ol>
          ` : '<p class="classical-empty">No dated listening history is available for this work.</p>'}
        </section>
      </div>
    `;
    dialog.setAttribute('aria-labelledby', 'classical-work-dialog-title');
    if (!dialog.open) dialog.showModal();
    requestAnimationFrame(() => dialog.querySelector('[data-close-work-dialog]')?.focus());
  }

  function ensureWorkDialog() {
    let dialog = document.querySelector('#classical-work-dialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'classical-work-dialog';
    dialog.className = 'classical-work-dialog';
    dialog.setAttribute('aria-modal', 'true');
    dialog.innerHTML = '<div data-work-dialog-content></div>';
    document.body.append(dialog);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    return dialog;
  }

  function addRepeatBadgesAndDetailButtons() {
    workRecords.forEach((work) => {
      const item = work.item;
      if (!item) return;
      const meta = item.querySelector('.entry-meta');
      if (meta && work.listenCount > 1 && !meta.querySelector('.classical-repeat-badge')) {
        const badge = document.createElement('span');
        badge.className = 'classical-repeat-badge';
        badge.textContent = repeatLabel(work.listenCount);
        badge.title = `${work.listenCount.toLocaleString('en-US')} recorded listens · ${formatMinutes(work.totalMinutes)} total`;
        meta.append(' ', badge);
      }
      const side = item.querySelector('.entry-side');
      if (side && !side.querySelector('[data-work-open]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'classical-work-details-button';
        button.dataset.workOpen = work.key;
        button.textContent = 'Details';
        side.append(button);
      }
    });
  }

  function enhanceWorksExplorer() {
    const browser = document.querySelector('#works-browser');
    const toolbar = document.querySelector('.works-toolbar');
    if (!browser || !toolbar || toolbar.querySelector('#works-repeat-filter')) return;

    const repeatFilter = document.createElement('select');
    repeatFilter.id = 'works-repeat-filter';
    repeatFilter.setAttribute('aria-label', 'Filter works by repeat count');
    repeatFilter.innerHTML = `
      <option value="">All listens</option>
      <option value="once">Heard once</option>
      <option value="repeat">Repeated</option>
      <option value="3">3+ listens</option>
      <option value="5">5+ listens</option>
      <option value="10">10+ listens</option>
    `;
    const sort = document.querySelector('#works-sort');
    toolbar.insertBefore(repeatFilter, sort || null);

    if (sort) {
      const additions = [
        ['first-heard', 'First heard'],
        ['most-time', 'Most time spent'],
        ['composition-asc', 'Composition year ↑'],
        ['composition-desc', 'Composition year ↓'],
      ];
      additions.forEach(([value, label]) => {
        if (sort.querySelector(`option[value="${value}"]`)) return;
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        sort.append(option);
      });
    }

    const search = document.querySelector('#works-search');
    const composer = document.querySelector('#works-composer-filter');
    const period = document.querySelector('#works-period-filter');
    const form = document.querySelector('#works-form-filter');
    const rating = document.querySelector('#works-rating-filter');
    const results = document.querySelector('#works-results');
    const clearButton = document.querySelector('#clear-work-filters');
    const list = document.querySelector('#work-list');
    const empty = document.querySelector('#works-empty');
    const more = document.querySelector('#works-more');
    let visibleLimit = CLASSICAL_PAGE_SIZE;

    const allItems = workRecords.map((work) => work.item).filter(Boolean);

    function applyEnhancedWorks() {
      const words = norm(search?.value).split(/\s+/).filter(Boolean);
      const selectedComposer = composer?.value || '';
      const selectedPeriod = period?.value || '';
      const selectedForm = form?.value || '';
      const selectedRating = rating?.value || '';
      const repeatMode = repeatFilter.value || '';
      const mode = sort?.value || 'latest';

      const filtered = allItems.filter((item) => {
        const count = Number(item.dataset.listens || 1);
        const repeatMatches = !repeatMode ||
          (repeatMode === 'once' && count === 1) ||
          (repeatMode === 'repeat' && count > 1) ||
          (!Number.isNaN(Number(repeatMode)) && Number(repeatMode) > 0 && count >= Number(repeatMode));
        return (!words.length || words.every((word) => (item.dataset.search || '').includes(word))) &&
          (!selectedComposer || item.dataset.composer === selectedComposer) &&
          (!selectedPeriod || item.dataset.period === selectedPeriod) &&
          (!selectedForm || item.dataset.form === selectedForm) &&
          (!selectedRating || item.dataset.rating === selectedRating) &&
          repeatMatches;
      });

      filtered.sort((a, b) => {
        let comparison = 0;
        if (mode === 'composer') comparison = collator.compare(a.dataset.composerName || '', b.dataset.composerName || '') || collator.compare(a.dataset.title || '', b.dataset.title || '');
        else if (mode === 'title') comparison = collator.compare(a.dataset.title || '', b.dataset.title || '');
        else if (mode === 'longest') comparison = Number(b.dataset.minutes || 0) - Number(a.dataset.minutes || 0);
        else if (mode === 'most-listened') comparison = Number(b.dataset.listens || 0) - Number(a.dataset.listens || 0);
        else if (mode === 'first-heard') comparison = Number(a.dataset.firstDate || 0) - Number(b.dataset.firstDate || 0);
        else if (mode === 'most-time') comparison = Number(b.dataset.totalMinutes || 0) - Number(a.dataset.totalMinutes || 0);
        else if (mode === 'composition-asc') comparison = (Number(a.dataset.compositionYearSort || 99999) || 99999) - (Number(b.dataset.compositionYearSort || 99999) || 99999);
        else if (mode === 'composition-desc') comparison = Number(b.dataset.compositionYearSort || 0) - Number(a.dataset.compositionYearSort || 0);
        else comparison = Number(b.dataset.date || 0) - Number(a.dataset.date || 0);
        return comparison || Number(b.dataset.row || 0) - Number(a.dataset.row || 0);
      });

      allItems.forEach((item) => { item.hidden = true; });
      filtered.forEach((item, index) => {
        list?.append(item);
        item.hidden = index >= visibleLimit;
      });

      const shown = Math.min(filtered.length, visibleLimit);
      if (results) results.textContent = filtered.length
        ? `Showing ${shown.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')} works`
        : 'No matching works';
      if (empty) empty.hidden = filtered.length > 0;
      if (more) more.hidden = filtered.length <= visibleLimit;
      if (clearButton) clearButton.hidden = !(words.length || selectedComposer || selectedPeriod || selectedForm || selectedRating || repeatMode || mode !== 'latest');
    }

    [composer, period, form, rating, repeatFilter].forEach((control) => control?.addEventListener('change', () => {
      visibleLimit = CLASSICAL_PAGE_SIZE;
      window.setTimeout(applyEnhancedWorks, 0);
    }));
    search?.addEventListener('input', () => {
      visibleLimit = CLASSICAL_PAGE_SIZE;
      window.setTimeout(applyEnhancedWorks, 0);
    });
    sort?.addEventListener('change', () => window.setTimeout(applyEnhancedWorks, 0));
    more?.addEventListener('click', () => {
      visibleLimit += CLASSICAL_PAGE_SIZE;
      window.setTimeout(applyEnhancedWorks, 0);
    });
    clearButton?.addEventListener('click', () => {
      repeatFilter.value = '';
      visibleLimit = CLASSICAL_PAGE_SIZE;
      window.setTimeout(applyEnhancedWorks, 0);
    });

    applyEnhancedWorks();
  }

  function addMostRevisitedOverview() {
    const layout = document.querySelector('.overview-layout');
    if (!layout || layout.querySelector('[data-most-revisited]')) return;
    const top = [...repeatedWorks]
      .sort((a, b) => b.listenCount - a.listenCount || b.totalMinutes - a.totalMinutes || b.latestDate - a.latestDate)
      .slice(0, 10);
    const article = document.createElement('article');
    article.className = 'overview-card classical-most-revisited';
    article.dataset.mostRevisited = 'true';
    article.innerHTML = `
      <div class="overview-card-header">
        <div><h3>Most Revisited Works</h3><p>Compositions that have pulled me back more than once.</p></div>
        <span class="classical-mini-stat">${repeatedWorks.length.toLocaleString('en-US')} repeated works</span>
      </div>
      ${top.length ? `<ol class="classical-revisited-list">
        ${top.map((work, index) => `
          <li>
            <span class="classical-rank">${index + 1}</span>
            <button type="button" data-work-open="${attr(work.key)}">
              <strong>${html(work.composer)}</strong>
              <span>${html(work.piece)}</span>
            </button>
            <span class="classical-revisit-meta"><b>${work.listenCount.toLocaleString('en-US')}×</b>${html(formatMinutes(work.totalMinutes))}</span>
          </li>
        `).join('')}
      </ol>` : '<p class="classical-empty">No repeated works are available yet.</p>'}
    `;
    layout.append(article);
  }

  function enhanceComposerTemplates() {
    composers.forEach((composer, composerId) => {
      const template = document.querySelector(`#composer-template-${CSS.escape(composerId)}`);
      if (!template?.content || template.dataset.classicalExpansionEnhanced) return;
      template.dataset.classicalExpansionEnhanced = 'true';
      const composerWorks = workRecords
        .filter((work) => work.composerId === composerId)
        .sort((a, b) => b.latestDate - a.latestDate || collator.compare(a.piece, b.piece));
      const composerRepeated = composerWorks.filter((work) => work.listenCount > 1);
      const repeats = composerWorks.reduce((sum, work) => sum + Math.max(0, work.listenCount - 1), 0);
      const mostReplayed = [...composerRepeated].sort((a, b) => b.listenCount - a.listenCount || b.totalMinutes - a.totalMinutes)[0];

      const summary = template.content.querySelector('.detail-summary');
      if (summary) {
        summary.insertAdjacentHTML('beforeend', `
          <div><strong>${composerRepeated.length.toLocaleString('en-US')}</strong><span>repeated works</span></div>
          <div><strong>${repeats.toLocaleString('en-US')}</strong><span>repeat listens</span></div>
        `);
      }
      const note = template.content.querySelector('.overview-note');
      if (note && mostReplayed) {
        note.insertAdjacentHTML('beforeend', ` <strong>Most replayed:</strong> ${html(mostReplayed.piece)} (${mostReplayed.listenCount.toLocaleString('en-US')} listens, ${html(formatMinutes(mostReplayed.totalMinutes))}).`);
      }

      const tablist = template.content.querySelector('.detail-tabs');
      const panelWrap = template.content.querySelector('.detail-panel-wrap');
      const overviewPanel = template.content.querySelector('[data-detail-panel="overview"]');
      if (!tablist || !panelWrap || !overviewPanel || tablist.querySelector('[data-detail-tab="works"]')) return;

      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'detail-tab';
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', 'false');
      tab.tabIndex = -1;
      tab.dataset.detailTab = 'works';
      tab.textContent = `Works (${composerWorks.length.toLocaleString('en-US')})`;
      const firstExistingAfterOverview = tablist.querySelector('[data-detail-tab="favorites"]');
      tablist.insertBefore(tab, firstExistingAfterOverview || null);

      const panel = document.createElement('section');
      panel.className = 'detail-panel classical-composer-works-panel';
      panel.setAttribute('role', 'tabpanel');
      panel.dataset.detailPanel = 'works';
      panel.hidden = true;
      panel.innerHTML = `
        <div class="section-heading">
          <div><h3>Works</h3><p>${composerWorks.length.toLocaleString('en-US')} unique works · ${composerRepeated.length.toLocaleString('en-US')} revisited</p></div>
          <div class="classical-segmented" data-composer-works-controls>
            <button type="button" aria-pressed="true" data-composer-work-filter="all">All</button>
            <button type="button" aria-pressed="false" data-composer-work-filter="favorites">Favorites</button>
            <button type="button" aria-pressed="false" data-composer-work-filter="repeats">Repeats</button>
          </div>
        </div>
        ${composerWorks.length ? `<ul class="classical-composer-work-list">
          ${composerWorks.map((work) => `
            <li data-composer-work-row data-favorite="${work.favorite ? 'true' : 'false'}" data-repeat="${work.listenCount > 1 ? 'true' : 'false'}">
              <button type="button" data-work-open="${attr(work.key)}">
                <span class="classical-composer-work-title">${html(work.piece)}</span>
                <span class="classical-composer-work-meta"><span class="rating ${attr(work.rating)}">${html(ratingLabel(work.rating))}</span> ${html([work.form, work.period, work.compositionYear].filter(Boolean).join(' · ') || 'Metadata not logged')}</span>
              </button>
              <span class="classical-composer-work-side"><b>${work.listenCount.toLocaleString('en-US')}×</b>${html(formatMinutes(work.totalMinutes))}</span>
            </li>
          `).join('')}
        </ul>` : '<p class="empty-detail">No works are available for this composer.</p>'}
      `;
      overviewPanel.insertAdjacentElement('afterend', panel);
    });
  }

  function insertPageTab(id, label) {
    let tab = tabs.querySelector(`[data-page-tab="${id}"]`);
    if (tab) return tab;
    tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'page-tab';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', 'false');
    tab.dataset.pageTab = id;
    tab.textContent = label;
    tabs.append(tab);
    return tab;
  }

  function createPagePanel(id, heading, description) {
    let panel = document.querySelector(`[data-page-panel="${id}"]`);
    if (panel) return panel;
    panel = document.createElement('section');
    panel.className = 'page-panel classical-expansion-panel';
    panel.dataset.pagePanel = id;
    panel.setAttribute('role', 'tabpanel');
    panel.hidden = true;
    panel.innerHTML = `
      <div class="panel-heading">
        <h2>${html(heading)}</h2>
        <p>${html(description)}</p>
      </div>
      <div data-classical-panel-content></div>
    `;
    worksPanel.insertAdjacentElement('afterend', panel);
    return panel;
  }

  insertPageTab('calendar', 'Calendar');
  insertPageTab('journey', 'Journey');
  insertPageTab('records', 'Records');
  insertPageTab('favorites', 'Favorites');

  const calendarPanel = createPagePanel('calendar', 'Listening Calendar', 'See when classical listening happened, what filled each day, and how intense each session became.');
  const journeyPanel = createPagePanel('journey', 'Listening Journey', 'Switch between my own listening chronology and the historical chronology of the music itself.');
  const recordsPanel = createPagePanel('records', 'Listening Records', 'Memorable extremes, milestones, and unusually large moments in the classical archive.');
  const favoritesPanel = createPagePanel('favorites', 'Favorites', 'The works and composers that rose above the archive rather than merely passing through it.');

  function activateExpandedPage(name, updateUrl = true) {
    const validNames = new Set(Array.from(document.querySelectorAll('[data-page-panel]')).map((panel) => panel.dataset.pagePanel));
    const valid = validNames.has(name) ? name : 'composers';
    document.querySelectorAll('[data-page-tab]').forEach((tab) => tab.setAttribute('aria-selected', tab.dataset.pageTab === valid ? 'true' : 'false'));
    document.querySelectorAll('[data-page-panel]').forEach((panel) => { panel.hidden = panel.dataset.pagePanel !== valid; });
    if (updateUrl) {
      const url = new URL(window.location.href);
      if (valid === 'composers') url.searchParams.delete('view');
      else url.searchParams.set('view', valid);
      history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  Array.from(document.querySelectorAll('[data-page-tab]')).forEach((tab) => {
    tab.addEventListener('click', () => window.setTimeout(() => activateExpandedPage(tab.dataset.pageTab || 'composers'), 0));
  });

  function buildCalendar() {
    const host = calendarPanel.querySelector('[data-classical-panel-content]');
    if (!host) return;
    const state = {
      year: new Date(latestEntryDate).getUTCFullYear(),
      month: new Date(latestEntryDate).getUTCMonth(),
    };
    const byDay = new Map();
    entries.forEach((entry) => {
      const key = dateKey(entry.date);
      if (!key) return;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(entry);
    });
    const maxDayMinutes = Math.max(1, ...Array.from(byDay.values()).map((dayEntries) => dayEntries.reduce((sum, entry) => sum + entry.minutes, 0)));

    function render() {
      const first = new Date(Date.UTC(state.year, state.month, 1));
      const daysInMonth = new Date(Date.UTC(state.year, state.month + 1, 0)).getUTCDate();
      const leading = first.getUTCDay();
      const monthEntries = entries.filter((entry) => {
        const date = new Date(entry.date);
        return date.getUTCFullYear() === state.year && date.getUTCMonth() === state.month;
      });
      const monthMinutes = monthEntries.reduce((sum, entry) => sum + entry.minutes, 0);
      const monthWorks = new Set(monthEntries.map((entry) => entry.key)).size;
      const cells = [];
      for (let i = 0; i < leading; i += 1) cells.push('<div class="classical-calendar-day classical-calendar-day--outside" aria-hidden="true"></div>');
      for (let day = 1; day <= daysInMonth; day += 1) {
        const ms = Date.UTC(state.year, state.month, day);
        const key = dateKey(ms);
        const dayEntries = [...(byDay.get(key) || [])].sort((a, b) => b.minutes - a.minutes || b.row - a.row);
        const grouped = new Map();
        dayEntries.forEach((entry) => {
          if (!grouped.has(entry.key)) grouped.set(entry.key, []);
          grouped.get(entry.key).push(entry);
        });
        const dayMinutes = dayEntries.reduce((sum, entry) => sum + entry.minutes, 0);
        const intensity = Math.min(1, dayMinutes / maxDayMinutes);
        const groupedRows = Array.from(grouped.entries()).map(([workKeyValue, group]) => {
          const work = works.get(workKeyValue);
          const composer = composers.get(group[0].composerId);
          const minutes = group.reduce((sum, entry) => sum + entry.minutes, 0);
          const bestRating = [...group].sort((a, b) => ratingRank(b.rating) - ratingRank(a.rating))[0]?.rating || 'other';
          const avatar = composer?.portrait
            ? `<img src="${attr(composer.portrait)}" alt="" loading="lazy" decoding="async" />`
            : `<span>${html(composer?.initials || group[0].composer.slice(0, 2))}</span>`;
          const title = `${group[0].composer} · ${group[0].piece} · ${formatMinutes(minutes)} · ${ratingLabel(bestRating)}${group.length > 1 ? ` · ${group.length} listens` : ''}`;
          return `<button type="button" class="classical-calendar-work rating-border-${attr(bestRating)}" data-work-open="${attr(workKeyValue)}" title="${attr(title)}">${avatar}<span><b>${html(group[0].composer)}</b><em>${html(work?.piece || group[0].piece)}</em></span>${group.length > 1 ? `<i>${group.length}×</i>` : ''}</button>`;
        });
        const visibleRows = groupedRows.slice(0, 4);
        const moreCount = groupedRows.length - visibleRows.length;
        cells.push(`
          <div class="classical-calendar-day" style="--calendar-activity:${intensity.toFixed(3)}">
            <div class="classical-calendar-day__head"><b>${day}</b>${dayMinutes ? `<span>${html(formatMinutes(dayMinutes))}</span>` : ''}</div>
            <div class="classical-calendar-day__works">${visibleRows.join('')}${moreCount > 0 ? `<span class="classical-calendar-more">+${moreCount} more</span>` : ''}</div>
          </div>
        `);
      }
      while (cells.length % 7) cells.push('<div class="classical-calendar-day classical-calendar-day--outside" aria-hidden="true"></div>');

      host.innerHTML = `
        <div class="classical-calendar-shell">
          <div class="classical-view-toolbar classical-calendar-toolbar">
            <div class="classical-calendar-nav">
              <button type="button" data-calendar-prev aria-label="Previous month">‹</button>
              <strong>${html(formatMonth(first))}</strong>
              <button type="button" data-calendar-next aria-label="Next month">›</button>
              <button type="button" data-calendar-latest>Latest</button>
            </div>
            <div class="classical-calendar-summary"><span><b>${monthEntries.length.toLocaleString('en-US')}</b> entries</span><span><b>${monthWorks.toLocaleString('en-US')}</b> works</span><span><b>${html(formatMinutes(monthMinutes))}</b></span></div>
          </div>
          <div class="classical-calendar-weekdays">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => `<span>${day}</span>`).join('')}</div>
          <div class="classical-calendar-grid">${cells.join('')}</div>
        </div>
      `;
      host.querySelector('[data-calendar-prev]')?.addEventListener('click', () => {
        state.month -= 1;
        if (state.month < 0) { state.month = 11; state.year -= 1; }
        render();
      });
      host.querySelector('[data-calendar-next]')?.addEventListener('click', () => {
        state.month += 1;
        if (state.month > 11) { state.month = 0; state.year += 1; }
        render();
      });
      host.querySelector('[data-calendar-latest]')?.addEventListener('click', () => {
        const latest = new Date(latestEntryDate);
        state.year = latest.getUTCFullYear();
        state.month = latest.getUTCMonth();
        render();
      });
    }
    render();
  }

  function buildJourney() {
    const host = journeyPanel.querySelector('[data-classical-panel-content]');
    if (!host) return;
    host.innerHTML = `
      <div class="classical-journey-shell">
        <div class="classical-journey-switch" role="tablist" aria-label="Listening journey chronology">
          <button type="button" aria-pressed="true" data-journey-mode="personal">My Listening</button>
          <button type="button" aria-pressed="false" data-journey-mode="history">Music History</button>
        </div>
        <div data-journey-content></div>
      </div>
    `;
    const content = host.querySelector('[data-journey-content]');

    function renderPersonal() {
      const sorted = [...entries].sort((a, b) => b.date - a.date || b.row - a.row);
      const years = new Map();
      sorted.forEach((entry) => {
        const date = new Date(entry.date);
        const year = date.getUTCFullYear();
        const month = `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
        if (!years.has(year)) years.set(year, new Map());
        const months = years.get(year);
        if (!months.has(month)) months.set(month, []);
        months.get(month).push(entry);
      });
      const latestYear = Math.max(...years.keys());
      content.innerHTML = `<div class="classical-personal-journey">${Array.from(years.entries()).map(([year, months]) => {
        const yearEntries = Array.from(months.values()).flat();
        const yearMinutes = yearEntries.reduce((sum, entry) => sum + entry.minutes, 0);
        return `<details class="classical-journey-year" ${year === latestYear ? 'open' : ''}>
          <summary><span><b>${year}</b><em>${yearEntries.length.toLocaleString('en-US')} entries · ${new Set(yearEntries.map((entry) => entry.key)).size.toLocaleString('en-US')} works</em></span><strong>${html(formatMinutes(yearMinutes))}</strong></summary>
          <div class="classical-journey-months">${Array.from(months.entries()).map(([key, monthEntries], index) => {
            const date = new Date(`${key}-01T00:00:00Z`);
            const monthMinutes = monthEntries.reduce((sum, entry) => sum + entry.minutes, 0);
            return `<details class="classical-journey-month" ${year === latestYear && index === 0 ? 'open' : ''}>
              <summary><span>${html(formatMonth(date))}</span><em>${monthEntries.length.toLocaleString('en-US')} entries · ${html(formatMinutes(monthMinutes))}</em></summary>
              <ol>${monthEntries.map((entry) => `<li><time>${html(formatDate(entry.date, { short: true }))}</time><button type="button" data-work-open="${attr(entry.key)}"><b>${html(entry.composer)}</b><span>${html(entry.piece)}</span></button><span><i class="rating ${attr(entry.rating)}">${html(ratingLabel(entry.rating))}</i>${html(formatMinutes(entry.minutes))}</span></li>`).join('')}</ol>
            </details>`;
          }).join('')}</div>
        </details>`;
      }).join('')}</div>`;
    }

    function renderHistory() {
      const periodOrder = ['Medieval','Renaissance','Baroque','Galant','Classical','Romantic','Late Romantic','Impressionist','Modern','Contemporary'];
      const grouped = new Map();
      workRecords.forEach((work) => {
        const period = work.period || 'Period not logged';
        if (!grouped.has(period)) grouped.set(period, []);
        grouped.get(period).push(work);
      });
      const periods = Array.from(grouped.keys()).sort((a, b) => {
        const ai = periodOrder.indexOf(a);
        const bi = periodOrder.indexOf(b);
        if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
        return collator.compare(a, b);
      });
      content.innerHTML = `<div class="classical-history-journey">${periods.map((period, index) => {
        const periodWorks = grouped.get(period).sort((a, b) => (a.compositionYearNumber || 99999) - (b.compositionYearNumber || 99999) || collator.compare(a.composer, b.composer));
        const dated = periodWorks.filter((work) => work.compositionYearNumber);
        const range = dated.length ? `${Math.min(...dated.map((work) => work.compositionYearNumber))}–${Math.max(...dated.map((work) => work.compositionYearNumber))}` : 'Years not logged';
        return `<details class="classical-history-period" ${index === 0 ? 'open' : ''}>
          <summary><span><b>${html(period)}</b><em>${periodWorks.length.toLocaleString('en-US')} works</em></span><strong>${html(range)}</strong></summary>
          <ol>${periodWorks.map((work) => `<li><time>${html(work.compositionYear || '—')}</time><button type="button" data-work-open="${attr(work.key)}"><b>${html(work.composer)}</b><span>${html(work.piece)}</span></button><span>${work.listenCount > 1 ? `<i>${work.listenCount}×</i>` : ''}<em>${html(formatMinutes(work.totalMinutes))}</em></span></li>`).join('')}</ol>
        </details>`;
      }).join('')}</div>`;
    }

    function setMode(mode) {
      host.querySelectorAll('[data-journey-mode]').forEach((button) => button.setAttribute('aria-pressed', button.dataset.journeyMode === mode ? 'true' : 'false'));
      if (mode === 'history') renderHistory();
      else renderPersonal();
    }

    host.querySelectorAll('[data-journey-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.journeyMode || 'personal')));
    setMode('personal');
  }

  function buildRecords() {
    const host = recordsPanel.querySelector('[data-classical-panel-content]');
    if (!host) return;
    const mostReplayed = [...workRecords].sort((a, b) => b.listenCount - a.listenCount || b.totalMinutes - a.totalMinutes)[0];
    const mostTime = [...workRecords].sort((a, b) => b.totalMinutes - a.totalMinutes || b.listenCount - a.listenCount)[0];
    const longestEntry = [...entries].sort((a, b) => b.minutes - a.minutes || b.date - a.date)[0];

    const byDay = new Map();
    const byMonth = new Map();
    const byComposerDay = new Map();
    entries.forEach((entry) => {
      const day = dateKey(entry.date);
      const month = monthKey(entry.date);
      if (!byDay.has(day)) byDay.set(day, []);
      if (!byMonth.has(month)) byMonth.set(month, []);
      byDay.get(day).push(entry);
      byMonth.get(month).push(entry);
      const composerDayKey = `${day}|${entry.composerId}`;
      if (!byComposerDay.has(composerDayKey)) byComposerDay.set(composerDayKey, []);
      byComposerDay.get(composerDayKey).push(entry);
    });
    const busiestDay = [...byDay.entries()].map(([key, values]) => ({ key, values, minutes: values.reduce((sum, entry) => sum + entry.minutes, 0) })).sort((a, b) => b.minutes - a.minutes || b.values.length - a.values.length)[0];
    const busiestMonth = [...byMonth.entries()].map(([key, values]) => ({ key, values, minutes: values.reduce((sum, entry) => sum + entry.minutes, 0) })).sort((a, b) => b.minutes - a.minutes || b.values.length - a.values.length)[0];
    const composerMarathon = [...byComposerDay.entries()].map(([key, values]) => ({ key, values, minutes: values.reduce((sum, entry) => sum + entry.minutes, 0) })).sort((a, b) => b.minutes - a.minutes || b.values.length - a.values.length)[0];
    const datedCompositions = workRecords.filter((work) => work.compositionYearNumber);
    const earliestComposition = [...datedCompositions].sort((a, b) => a.compositionYearNumber - b.compositionYearNumber)[0];
    const latestComposition = [...datedCompositions].sort((a, b) => b.compositionYearNumber - a.compositionYearNumber)[0];
    const sessionDays = [...new Set(entries.map((entry) => dateKey(entry.date)).filter(Boolean))].sort();
    let longestGap = null;
    for (let i = 1; i < sessionDays.length; i += 1) {
      const start = Date.parse(`${sessionDays[i - 1]}T00:00:00Z`);
      const end = Date.parse(`${sessionDays[i]}T00:00:00Z`);
      const days = Math.round((end - start) / 86400000);
      if (!longestGap || days > longestGap.days) longestGap = { days, start, end };
    }
    const milestones = [100, 250, 500, 750, 1000]
      .filter((target) => entries.length >= target)
      .map((target) => {
        const chronological = [...entries].sort((a, b) => a.date - b.date || a.row - b.row);
        return { target, entry: chronological[target - 1] };
      });

    const cards = [
      mostReplayed && { icon: '↻', label: 'Most replayed work', value: `${mostReplayed.listenCount.toLocaleString('en-US')} listens`, detail: `${mostReplayed.composer} · ${mostReplayed.piece}`, sub: formatMinutes(mostReplayed.totalMinutes), workKey: mostReplayed.key },
      mostTime && { icon: '◷', label: 'Most time with one work', value: formatMinutes(mostTime.totalMinutes), detail: `${mostTime.composer} · ${mostTime.piece}`, sub: `${mostTime.listenCount.toLocaleString('en-US')} listens`, workKey: mostTime.key },
      longestEntry && { icon: '▶', label: 'Longest logged performance', value: formatMinutes(longestEntry.minutes), detail: `${longestEntry.composer} · ${longestEntry.piece}`, sub: formatDate(longestEntry.date, { short: true }), workKey: longestEntry.key },
      busiestDay && { icon: '☀', label: 'Busiest classical day', value: formatMinutes(busiestDay.minutes), detail: formatDate(Date.parse(`${busiestDay.key}T00:00:00Z`)), sub: `${busiestDay.values.length.toLocaleString('en-US')} entries` },
      busiestMonth && { icon: '▦', label: 'Busiest classical month', value: formatMinutes(busiestMonth.minutes), detail: formatMonthShort(new Date(`${busiestMonth.key}-01T00:00:00Z`)), sub: `${busiestMonth.values.length.toLocaleString('en-US')} entries` },
      composerMarathon && { icon: '♬', label: 'Longest composer marathon', value: formatMinutes(composerMarathon.minutes), detail: `${composerMarathon.values[0].composer} · ${formatDate(composerMarathon.values[0].date, { short: true })}`, sub: `${composerMarathon.values.length.toLocaleString('en-US')} entries` },
      earliestComposition && { icon: '←', label: 'Earliest composition heard', value: String(earliestComposition.compositionYearNumber), detail: `${earliestComposition.composer} · ${earliestComposition.piece}`, sub: earliestComposition.period || 'Period not logged', workKey: earliestComposition.key },
      latestComposition && { icon: '→', label: 'Most recently composed work', value: String(latestComposition.compositionYearNumber), detail: `${latestComposition.composer} · ${latestComposition.piece}`, sub: latestComposition.period || 'Period not logged', workKey: latestComposition.key },
      longestGap && { icon: '⋯', label: 'Longest gap between sessions', value: `${longestGap.days.toLocaleString('en-US')} days`, detail: `${formatDate(longestGap.start, { short: true })} → ${formatDate(longestGap.end, { short: true })}`, sub: 'Between dated listening days' },
    ].filter(Boolean);

    host.innerHTML = `
      <div class="classical-records-shell">
        <div class="classical-record-grid">${cards.map((card) => `
          <article class="classical-record-card">
            <span class="classical-record-icon">${html(card.icon)}</span>
            <p>${html(card.label)}</p>
            <strong>${html(card.value)}</strong>
            ${card.workKey ? `<button type="button" data-work-open="${attr(card.workKey)}">${html(card.detail)}</button>` : `<span class="classical-record-detail">${html(card.detail)}</span>`}
            <em>${html(card.sub)}</em>
          </article>
        `).join('')}</div>
        ${milestones.length ? `<section class="classical-milestones"><div class="classical-section-heading"><div><h3>Listening Milestones</h3><p>Where major entry-count thresholds landed in the archive.</p></div></div><div class="classical-milestone-row">${milestones.map(({ target, entry }) => `<button type="button" data-work-open="${attr(entry.key)}"><b>${target.toLocaleString('en-US')}</b><span>${html(formatDate(entry.date, { short: true }))}</span><em>${html(entry.composer)}</em></button>`).join('')}</div></section>` : ''}
      </div>
    `;
  }

  function buildFavorites() {
    const host = favoritesPanel.querySelector('[data-classical-panel-content]');
    if (!host) return;
    const favoriteComposers = Array.from(composers.values())
      .filter((composer) => composer.favoritesCount > 0)
      .sort((a, b) => b.favoritesCount - a.favoritesCount || b.favoriteRate - a.favoriteRate)
      .slice(0, 8);
    const composerOptions = Array.from(new Set(favoriteWorks.map((work) => work.composerId)))
      .map((id) => composers.get(id))
      .filter(Boolean)
      .sort((a, b) => collator.compare(a.name, b.name));

    host.innerHTML = `
      <div class="classical-favorites-shell">
        <section class="classical-favorite-composers">
          <div class="classical-section-heading"><div><h3>Favorite Composers</h3><p>Ranked by the number of unique works marked Amazing or Gorgeous.</p></div></div>
          <div class="classical-favorite-composer-grid">${favoriteComposers.map((composer) => `
            <article>
              ${composer.portrait ? `<img src="${attr(composer.portrait)}" alt="Portrait of ${attr(composer.name)}" loading="lazy" decoding="async" />` : `<span class="classical-favorite-composer-fallback">${html(composer.initials)}</span>`}
              <div><b>${html(composer.name)}</b><span>${composer.favoritesCount.toLocaleString('en-US')} favorites · ${composer.favoriteRate.toFixed(0)}% favorite rate</span></div>
            </article>
          `).join('')}</div>
        </section>

        <section class="classical-favorite-works">
          <div class="classical-section-heading"><div><h3>Favorite Works</h3><p>${favoriteWorks.length.toLocaleString('en-US')} unique works currently carry an Amazing or Gorgeous rating.</p></div></div>
          <div class="classical-favorites-toolbar">
            <input type="search" placeholder="Search favorite works or composers…" aria-label="Search favorite classical works" data-favorites-search />
            <select aria-label="Filter favorite works by composer" data-favorites-composer><option value="">All composers</option>${composerOptions.map((composer) => `<option value="${attr(composer.id)}">${html(composer.name)}</option>`).join('')}</select>
            <select aria-label="Filter favorite works by rating" data-favorites-rating><option value="">All favorite ratings</option><option value="amazing">Amazing</option><option value="gorgeous">Gorgeous</option></select>
            <select aria-label="Sort favorite classical works" data-favorites-sort><option value="latest">Recently heard</option><option value="repeats">Most replayed</option><option value="time">Most time spent</option><option value="composer">Composer A–Z</option><option value="title">Work A–Z</option></select>
          </div>
          <p class="classical-favorites-results" data-favorites-results></p>
          <ul class="classical-favorite-work-list" data-favorite-work-list>${favoriteWorks.map((work) => `
            <li data-favorite-work-row data-key="${attr(work.key)}" data-composer="${attr(work.composerId)}" data-rating="${attr(work.rating)}" data-search="${attr(norm(`${work.composer} ${work.piece} ${work.form} ${work.period} ${work.compositionYear}`))}" data-date="${work.latestDate}" data-listens="${work.listenCount}" data-time="${work.totalMinutes}" data-composer-name="${attr(norm(work.composer))}" data-title="${attr(norm(work.piece))}">
              <button type="button" data-work-open="${attr(work.key)}"><span class="entry-composer">${html(work.composer)}</span><b>${html(work.piece)}</b><span><i class="rating ${attr(work.rating)}">${html(ratingLabel(work.rating))}</i>${html([work.form, work.period, work.compositionYear].filter(Boolean).join(' · ') || 'Metadata not logged')}</span></button>
              <span><b>${work.listenCount.toLocaleString('en-US')}×</b><em>${html(formatMinutes(work.totalMinutes))}</em></span>
            </li>
          `).join('')}</ul>
          <p class="classical-empty" data-favorites-empty hidden>No favorite works match these filters.</p>
          <button type="button" class="show-more" data-favorites-more hidden>Show more</button>
        </section>
      </div>
    `;

    const search = host.querySelector('[data-favorites-search]');
    const composer = host.querySelector('[data-favorites-composer]');
    const rating = host.querySelector('[data-favorites-rating]');
    const sort = host.querySelector('[data-favorites-sort]');
    const list = host.querySelector('[data-favorite-work-list]');
    const rows = Array.from(host.querySelectorAll('[data-favorite-work-row]'));
    const results = host.querySelector('[data-favorites-results]');
    const empty = host.querySelector('[data-favorites-empty]');
    const more = host.querySelector('[data-favorites-more]');
    let visibleLimit = CLASSICAL_PAGE_SIZE;

    function apply() {
      const words = norm(search?.value).split(/\s+/).filter(Boolean);
      const selectedComposer = composer?.value || '';
      const selectedRating = rating?.value || '';
      const mode = sort?.value || 'latest';
      const filtered = rows.filter((row) => (!words.length || words.every((word) => (row.dataset.search || '').includes(word))) && (!selectedComposer || row.dataset.composer === selectedComposer) && (!selectedRating || row.dataset.rating === selectedRating));
      filtered.sort((a, b) => {
        if (mode === 'repeats') return Number(b.dataset.listens || 0) - Number(a.dataset.listens || 0) || Number(b.dataset.time || 0) - Number(a.dataset.time || 0);
        if (mode === 'time') return Number(b.dataset.time || 0) - Number(a.dataset.time || 0);
        if (mode === 'composer') return collator.compare(a.dataset.composerName || '', b.dataset.composerName || '') || collator.compare(a.dataset.title || '', b.dataset.title || '');
        if (mode === 'title') return collator.compare(a.dataset.title || '', b.dataset.title || '');
        return Number(b.dataset.date || 0) - Number(a.dataset.date || 0);
      });
      rows.forEach((row) => { row.hidden = true; });
      filtered.forEach((row, index) => { list?.append(row); row.hidden = index >= visibleLimit; });
      const shown = Math.min(filtered.length, visibleLimit);
      if (results) results.textContent = filtered.length ? `Showing ${shown.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')} favorite works` : 'No matching favorite works';
      if (empty) empty.hidden = filtered.length > 0;
      if (more) more.hidden = filtered.length <= visibleLimit;
    }

    [composer, rating].forEach((control) => control?.addEventListener('change', () => { visibleLimit = CLASSICAL_PAGE_SIZE; apply(); }));
    search?.addEventListener('input', () => { visibleLimit = CLASSICAL_PAGE_SIZE; apply(); });
    sort?.addEventListener('change', apply);
    more?.addEventListener('click', () => { visibleLimit += CLASSICAL_PAGE_SIZE; apply(); });
    apply();
  }

  addRepeatBadgesAndDetailButtons();
  enhanceWorksExplorer();
  addMostRevisitedOverview();
  enhanceComposerTemplates();
  buildCalendar();
  buildJourney();
  buildRecords();
  buildFavorites();
  ensureWorkDialog();

  document.addEventListener('click', (event) => {
    const openButton = event.target.closest?.('[data-work-open]');
    if (openButton) {
      event.preventDefault();
      openWork(openButton.dataset.workOpen || '');
      return;
    }
    const closeButton = event.target.closest?.('[data-close-work-dialog]');
    if (closeButton) {
      event.preventDefault();
      document.querySelector('#classical-work-dialog')?.close();
      return;
    }
    const filterButton = event.target.closest?.('[data-composer-work-filter]');
    if (filterButton) {
      const panel = filterButton.closest('[data-detail-panel="works"]');
      if (!panel) return;
      const mode = filterButton.dataset.composerWorkFilter || 'all';
      panel.querySelectorAll('[data-composer-work-filter]').forEach((button) => button.setAttribute('aria-pressed', button === filterButton ? 'true' : 'false'));
      panel.querySelectorAll('[data-composer-work-row]').forEach((row) => {
        row.hidden = mode === 'favorites' ? row.dataset.favorite !== 'true' : mode === 'repeats' ? row.dataset.repeat !== 'true' : false;
      });
    }
  });

  const requestedView = new URL(window.location.href).searchParams.get('view') || 'composers';
  activateExpandedPage(requestedView, false);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.setTimeout(() => bootClassicalExpansion(), 0), { once: true });
} else {
  window.setTimeout(() => bootClassicalExpansion(), 0);
}
