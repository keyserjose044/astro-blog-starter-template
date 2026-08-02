/* Art layout pass — August 1, 2026. */

const mobileQuery = window.matchMedia('(max-width: 900px)');
let surprisePlaceholder = null;
let queued = false;
let gallerySignature = '';

const esc = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

function parseDate(value) {
  const raw = String(value || '').trim().replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  if (!raw) return null;
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const date = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const numeric = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const date = new Date(Date.UTC(year, Number(numeric[1]) - 1, Number(numeric[2])));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function syncMobileViews() {
  const toggle = document.querySelector('#art-view-toggle');
  const surprise = document.querySelector('#art-surprise');
  const trigger = document.querySelector('#art-surprise-trigger');
  const label = trigger?.querySelector('span:nth-child(2)');
  if (!toggle || !surprise) return;

  if (!surprisePlaceholder) {
    surprisePlaceholder = document.createComment('art-surprise-desktop-position');
    surprise.before(surprisePlaceholder);
  }

  if (mobileQuery.matches) {
    if (surprise.parentElement !== toggle) toggle.append(surprise);
    if (label && label.textContent !== 'Random') label.textContent = 'Random';
  } else {
    if (surprisePlaceholder?.parentNode && surprise.parentElement !== surprisePlaceholder.parentNode) {
      surprisePlaceholder.after(surprise);
    }
    if (label && label.textContent !== 'Surprise Me') label.textContent = 'Surprise Me';
  }
}

function ensureMonthGallery() {
  const calendarView = document.querySelector('#art-calendar-view');
  const desktop = calendarView?.querySelector('.art-calendar-desktop');
  if (!calendarView || !desktop) return null;
  let host = calendarView.querySelector('#art-calendar-month-gallery');
  if (host) return host;

  host = document.createElement('section');
  host.id = 'art-calendar-month-gallery';
  host.className = 'art-calendar-month-gallery';
  host.setAttribute('aria-live', 'polite');
  host.innerHTML = `
    <div class="art-calendar-month-gallery-heading">
      <div><p class="art-eyebrow">Month collection</p><h3 data-art-month-gallery-title>Works this month</h3></div>
      <strong data-art-month-gallery-count></strong>
    </div>
    <div class="art-calendar-month-gallery-grid" data-art-month-gallery-grid></div>
  `;
  desktop.insertAdjacentElement('afterend', host);

  host.addEventListener('click', (event) => {
    const button = event.target.closest('[data-art-month-card-index]');
    if (!button) return;
    const selector = `.art-card[data-original-index="${CSS.escape(button.dataset.artMonthCardIndex || '')}"]`;
    const card = document.querySelector(selector);
    if (card) card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  });

  return host;
}

function renderMonthGallery() {
  const host = ensureMonthGallery();
  const select = document.querySelector('[data-art-calendar-month]');
  if (!host || !select?.value) return;

  const selectedMonth = select.value;
  const cards = Array.from(document.querySelectorAll('#art-grid .art-card'))
    .filter((card) => {
      if (card.style.display === 'none') return false;
      const date = parseDate(card.dataset.dateViewed);
      return date && monthKey(date) === selectedMonth;
    })
    .sort((a, b) => {
      const aDate = parseDate(a.dataset.dateViewed)?.getTime() || 0;
      const bDate = parseDate(b.dataset.dateViewed)?.getTime() || 0;
      return aDate - bDate || Number(a.dataset.originalIndex || 0) - Number(b.dataset.originalIndex || 0);
    });

  const label = select.selectedOptions?.[0]?.textContent?.trim() || 'Selected month';
  const signature = `${selectedMonth}|${label}|${cards.map((card) => card.dataset.originalIndex).join(',')}`;
  if (gallerySignature === signature) return;
  gallerySignature = signature;

  const title = host.querySelector('[data-art-month-gallery-title]');
  const count = host.querySelector('[data-art-month-gallery-count]');
  const grid = host.querySelector('[data-art-month-gallery-grid]');
  if (title) title.textContent = `${label} works`;
  if (count) count.textContent = `${cards.length.toLocaleString('en-US')} ${cards.length === 1 ? 'work' : 'works'}`;
  if (!grid) return;

  if (!cards.length) {
    grid.innerHTML = '<p class="art-calendar-month-gallery-empty">No artworks match the current filters in this month.</p>';
    return;
  }

  grid.innerHTML = cards.map((card) => `
    <button type="button" class="art-calendar-month-gallery-work" data-art-month-card-index="${esc(card.dataset.originalIndex)}" aria-label="Open ${esc(card.dataset.title || 'artwork')}">
      <img class="art-derived-cover" src="${esc(card.dataset.cover || '')}" data-cover-fallbacks="${esc(card.dataset.coverFallbacks || '[]')}" alt="" loading="lazy" decoding="async">
    </button>
  `).join('');
}

function normalizeNetherlandsCards() {
  document.querySelectorAll('#art-grid .art-card[data-art-country-ids]').forEach((card) => {
    const raw = String(card.dataset.artCountryIds || '').trim();
    if (!raw) return;
    const ids = raw.split(/\s+/).filter(Boolean).map((id) => id === '535' ? '528' : id);
    const normalized = [...new Set(ids)].join(' ');
    if (normalized !== raw) card.dataset.artCountryIds = normalized;
  });
}

function cleanNetherlandsUi() {
  const caribbeanPath = document.querySelector('.art-map-country[data-country-id="535"]');
  const caribbeanCount = Number(caribbeanPath?.querySelector('title')?.textContent?.match(/:\s*([\d,]+)\s+works?/)?.[1]?.replace(/,/g, '') || 0);

  if (caribbeanPath) {
    if (caribbeanPath.style.display !== 'none') caribbeanPath.style.display = 'none';
    if (caribbeanPath.dataset.count !== '0') caribbeanPath.dataset.count = '0';
    if (caribbeanPath.dataset.hasArt !== 'false') caribbeanPath.dataset.hasArt = 'false';
    caribbeanPath.removeAttribute('tabindex');
  }

  document.querySelectorAll('.art-country-rank[data-country-id="535"]').forEach((button) => button.remove());

  const netherlandsPath = document.querySelector('.art-map-country[data-country-id="528"]');
  const netherlandsCount = Number(netherlandsPath?.dataset.count || 0);

  if (caribbeanCount > 0 && netherlandsPath && netherlandsCount === 0) {
    netherlandsPath.dataset.count = String(caribbeanCount);
    netherlandsPath.dataset.hasArt = 'true';
  }

  const metrics = document.querySelector('#art-map-metrics');
  if (metrics && caribbeanCount > 0 && netherlandsCount > 0) {
    const firstValue = metrics.querySelector('.art-metric-value');
    const current = Number(String(firstValue?.textContent || '').replace(/,/g, ''));
    if (firstValue && Number.isFinite(current) && current > 0 && metrics.dataset.netherlandsMerged !== 'true') {
      firstValue.textContent = (current - 1).toLocaleString('en-US');
      metrics.dataset.netherlandsMerged = 'true';
    }
  }
}

function syncAll() {
  queued = false;
  syncMobileViews();
  normalizeNetherlandsCards();
  cleanNetherlandsUi();
  renderMonthGallery();
}

function queueSync() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(syncAll);
}

const observer = new MutationObserver(queueSync);
observer.observe(document.documentElement, {
  subtree: true,
  childList: true,
  attributes: true,
  attributeFilter: ['hidden', 'aria-pressed', 'data-art-country-ids', 'style'],
});

mobileQuery.addEventListener?.('change', queueSync);
document.addEventListener('change', (event) => {
  if (event.target.matches?.('[data-art-calendar-month], #art-country-filter, #art-viewed-year-filter, #art-period-filter, #art-artist-filter, #art-movement-filter, #art-medium-filter')) {
    gallerySignature = '';
    window.setTimeout(queueSync, 0);
  }
});
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-art-calendar-prev], [data-art-calendar-next], [data-art-calendar-latest], [data-art-view="calendar"], [data-art-view="map"], [data-country-id]')) {
    gallerySignature = '';
    window.setTimeout(queueSync, 30);
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', queueSync, { once: true });
} else {
  queueSync();
}
