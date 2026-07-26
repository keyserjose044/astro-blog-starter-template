import {
  MONTH_NAMES, escapeHtml, formatNumber, parseFinishedDate, visibleCards,
  cardCountry, cardGenre, cardLanguage, publicationEra, toggleSelect, normalize,
} from './books-atlas-insights-utils.js';

export function installTimelineInsights({ cards, timelineContent, timelineView }) {
  const state = { signature: '', busy: false };
  const controls = {
    search: document.querySelector('#q'),
    genre: document.querySelector('#genre-filter'),
    year: document.querySelector('#year-filter'),
    period: document.querySelector('#period-filter'),
    language: document.querySelector('#language-filter'),
    country: document.querySelector('#country-filter'),
  };

  const mode = () => timelineView.querySelector('[data-timeline-mode][aria-pressed="true"]')?.dataset.timelineMode || 'publication';
  const currentCards = () => visibleCards(cards, true);

  function matchesControls(card, ignored = new Set()) {
    if (card.classList.contains('atlas-country-hidden')) return false;

    if (!ignored.has('search')) {
      const words = normalize(controls.search?.value || '').split(/\s+/).filter(Boolean);
      const haystack = normalize(`${card.dataset.title || ''} ${card.dataset.note || ''} ${card.dataset.noteRaw || ''}`);
      if (words.length && !words.every((word) => haystack.includes(word))) return false;
    }

    if (!ignored.has('genre') && controls.genre?.value) {
      const selected = normalize(controls.genre.value);
      const actual = normalize(card.dataset.genreKey || card.dataset.genre || cardGenre(card));
      if (actual !== selected) return false;
    }

    if (!ignored.has('year') && controls.year?.value && card.dataset.finishedYear !== controls.year.value) return false;
    if (!ignored.has('period') && controls.period?.value && card.dataset.publicationPeriod !== controls.period.value) return false;

    if (!ignored.has('language') && controls.language?.value) {
      const keys = String(card.dataset.languageKeys || '').split(/\s+/).filter(Boolean);
      const selected = controls.language.value;
      const matches = selected === 'other' ? keys.length === 0 : keys.includes(selected);
      if (!matches) return false;
    }

    if (!ignored.has('country') && controls.country?.value) {
      if (normalize(card.dataset.country) !== normalize(controls.country.value)) return false;
    }

    return true;
  }

  const cardsIgnoring = (filterName) => cards.filter((card) => matchesControls(card, new Set([filterName])));

  function categoryEntries(items, getter, limit = 5) {
    const counts = new Map();
    items.forEach((card) => {
      const label = String(getter(card) || 'Unknown').trim() || 'Unknown';
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (sorted.length <= limit) return sorted;
    const head = sorted.slice(0, limit);
    const other = sorted.slice(limit).reduce((sum, entry) => sum + entry[1], 0);
    return [...head, ['Other', other]];
  }

  function donutMarkup(items, getter, title, subtitle) {
    const entries = categoryEntries(items, getter);
    const total = entries.reduce((sum, entry) => sum + entry[1], 0);
    if (!total) {
      return `<article class="books-donut-card"><div class="books-donut-card-heading"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(subtitle)}</p></div><p class="books-donut-empty">No matching metadata.</p></article>`;
    }

    let running = 0;
    const stops = entries.map(([, count], index) => {
      const start = running;
      running += (count / total) * 100;
      return `var(--insight-${Math.min(index + 1, 6)}) ${start.toFixed(3)}% ${running.toFixed(3)}%`;
    }).join(', ');

    return `<article class="books-donut-card">
      <div class="books-donut-card-heading"><h4>${escapeHtml(title)}</h4><p>${escapeHtml(subtitle)}</p></div>
      <div class="books-donut-layout">
        <div class="books-donut" role="img" aria-label="${escapeHtml(title)} distribution for ${formatNumber(total)} books" style="--donut-fill:conic-gradient(${stops})">
          <div class="books-donut-center"><strong>${formatNumber(total)}</strong><span>${total === 1 ? 'book' : 'books'}</span></div>
        </div>
        <ol class="books-donut-legend">
          ${entries.map(([label, count], index) => `<li><i class="books-insight-series-${Math.min(index, 5)}"></i><span>${escapeHtml(label)}</span><strong>${formatNumber(count)}</strong><small>${Math.round((count / total) * 100)}%</small></li>`).join('')}
        </ol>
      </div>
    </article>`;
  }

  function ageBand(card) {
    const key = publicationEra(card).key;
    if (key === 'ancient' || key === 'medieval') return 'Ancient–Medieval';
    if (['century-15', 'century-16', 'century-17', 'century-18'].includes(key)) return '15th–18th c.';
    if (key === 'century-19') return '19th c.';
    if (key === 'century-20') return '20th c.';
    if (key === 'century-21') return '21st c.';
    return 'Unknown';
  }

  function ageProfile(items) {
    const labels = ['Ancient–Medieval', '15th–18th c.', '19th c.', '20th c.', '21st c.', 'Unknown'];
    const counts = new Map(labels.map((label) => [label, 0]));
    items.forEach((card) => counts.set(ageBand(card), (counts.get(ageBand(card)) || 0) + 1));
    const total = Math.max(items.length, 1);

    return `<section class="books-age-profile-panel books-age-profile-panel--constant">
      <div class="books-insight-section-heading books-insight-section-heading--compact">
        <div><p class="books-insight-kicker">Full collection</p><h3>Age profile</h3><p>This reference remains stable when a single publication period is selected.</p></div>
      </div>
      <div class="books-age-profile">
        <div class="books-age-profile-track" role="img" aria-label="Broad publication periods across ${formatNumber(items.length)} books">
          ${labels.map((label, index) => {
            const count = counts.get(label) || 0;
            return count ? `<span class="books-insight-series-${index}" style="width:${(count / total) * 100}%" title="${escapeHtml(label)}: ${formatNumber(count)}"></span>` : '';
          }).join('')}
        </div>
        <div class="books-age-profile-legend">
          ${labels.map((label, index) => {
            const count = counts.get(label) || 0;
            return count ? `<span><i class="books-insight-series-${index}"></i>${escapeHtml(label)} <strong>${formatNumber(count)}</strong></span>` : '';
          }).join('')}
        </div>
      </div>
    </section>`;
  }

  function calendarMarkup(items) {
    const groups = new Map();
    items.forEach((card) => {
      const date = parseFinishedDate(card.dataset.dateFinished);
      if (!date) return;
      const year = date.getUTCFullYear();
      if (!groups.has(year)) groups.set(year, Array(12).fill(0));
      groups.get(year)[date.getUTCMonth()] += 1;
    });
    const years = [...groups.keys()].sort((a, b) => a - b);
    const maximum = Math.max(1, ...[...groups.values()].flat());
    const activeYear = controls.year?.value || '';

    return `<section class="books-reading-calendar-panel">
      <div class="books-insight-section-heading books-insight-section-heading--compact">
        <div><p class="books-insight-kicker">Full reading log</p><h3>Reading calendar</h3><p>Each square is a month. Darker squares contain more completed books; select a year to filter the page.</p></div>
      </div>
      <div class="books-reading-calendar" role="table" aria-label="Books completed by month and year">
        <div class="books-reading-calendar-header" role="row"><span></span>${MONTH_NAMES.map((month) => `<b role="columnheader">${month}</b>`).join('')}</div>
        ${years.map((year) => `<div class="books-reading-calendar-row" role="row" data-active="${String(year) === activeYear}">
          <button type="button" data-calendar-year="${year}" aria-pressed="${String(year) === activeYear}">${year}</button>
          ${groups.get(year).map((count, month) => {
            const level = count ? Math.max(1, Math.min(5, Math.ceil((count / maximum) * 5))) : 0;
            return `<span class="books-reading-calendar-cell" role="cell" data-level="${level}" title="${MONTH_NAMES[month]} ${year}: ${formatNumber(count)} ${count === 1 ? 'book' : 'books'}"><i>${count || ''}</i></span>`;
          }).join('')}
        </div>`).join('')}
      </div>
    </section>`;
  }

  function formatYear(year) {
    return year < 0 ? `${Math.abs(year)} BCE` : String(year);
  }

  function bucketLabel(start, size) {
    const end = start + size - 1;
    if (end < 0) return `${Math.abs(end)}–${Math.abs(start)} BCE`;
    if (start < 0) return `${Math.abs(start)} BCE–${end}`;
    return size === 10 ? `${start}s` : `${start}–${end}`;
  }

  function representativeCards(sorted, maximum = 7) {
    if (sorted.length <= maximum) return sorted;
    const selected = [];
    for (let index = 0; index < maximum; index += 1) {
      selected.push(sorted[Math.round((index / (maximum - 1)) * (sorted.length - 1))]);
    }
    return [...new Set(selected)];
  }

  function withinPeriodMarkup(items) {
    const selectedKey = controls.period?.value || '';
    if (!selectedKey) return '';
    const label = controls.period?.selectedOptions?.[0]?.textContent || selectedKey;
    const dated = items.map((card) => ({ card, year: Number(card.dataset.publicationYear) }))
      .filter((entry) => Number.isFinite(entry.year)).sort((a, b) => a.year - b.year);

    if (!dated.length) {
      return `<section class="books-period-detail"><div class="books-insight-section-heading books-insight-section-heading--compact"><div><p class="books-insight-kicker">Inside the selection</p><h3>${escapeHtml(label)}</h3><p>No precise publication years are available for this period.</p></div></div></section>`;
    }

    const span = dated.at(-1).year - dated[0].year;
    const bucketSize = span > 500 ? 500 : span > 180 ? 100 : 10;
    const buckets = new Map();
    dated.forEach((entry) => {
      const start = Math.floor(entry.year / bucketSize) * bucketSize;
      if (!buckets.has(start)) buckets.set(start, []);
      buckets.get(start).push(entry.card);
    });
    const entries = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    const maximum = Math.max(1, ...entries.map((entry) => entry[1].length));
    const samples = representativeCards(dated).map((entry) => entry.card);

    return `<section class="books-period-detail">
      <div class="books-insight-section-heading books-insight-section-heading--compact">
        <div><p class="books-insight-kicker">Inside the selection</p><h3>${escapeHtml(label)} in detail</h3><p>The stable age profile stays above; this view now opens the selected period into its internal chronology.</p></div>
      </div>
      <div class="books-period-heatstrip" role="img" aria-label="Books within ${escapeHtml(label)} grouped chronologically">
        ${entries.map(([start, bucketCards]) => {
          const level = Math.max(1, Math.min(5, Math.ceil((bucketCards.length / maximum) * 5)));
          return `<div class="books-period-bucket" data-level="${level}" title="${escapeHtml(bucketLabel(start, bucketSize))}: ${formatNumber(bucketCards.length)} books"><strong>${formatNumber(bucketCards.length)}</strong><span>${escapeHtml(bucketLabel(start, bucketSize))}</span></div>`;
        }).join('')}
      </div>
      <div class="books-period-samples" aria-label="Representative works across ${escapeHtml(label)}">
        ${samples.map((card) => `<a href="${escapeHtml(card.getAttribute('href') || '#')}" target="_blank" rel="noopener noreferrer"><img src="${escapeHtml(card.querySelector('.thumb')?.getAttribute('src') || '')}" alt="" loading="lazy"><span>${escapeHtml(card.querySelector('.title')?.textContent?.replace('↗', '').trim() || card.dataset.title || 'Untitled')}</span><small>${formatYear(Number(card.dataset.publicationYear))}</small></a>`).join('')}
      </div>
    </section>`;
  }

  function readingMarkup(items) {
    const calendarItems = cardsIgnoring('year');
    const selectedYear = controls.year?.value;
    return `<section class="books-timeline-insights" data-books-timeline-insights="reading">
      <div class="books-insight-section-heading">
        <div><p class="books-insight-kicker">Reading journey</p><h3>${selectedYear ? `The shape of ${escapeHtml(selectedYear)}` : 'What entered the reading log'}</h3><p>Composition charts summarize the current selection. The calendar remains anchored to the full filtered reading history.</p></div>
      </div>
      <div class="books-donut-grid books-donut-grid--three">
        ${donutMarkup(items, cardGenre, 'Genres', 'The kinds of books finished')}
        ${donutMarkup(items, (card) => publicationEra(card).label, 'Work ages', 'When those books were written')}
        ${donutMarkup(items, cardCountry, 'Author origins', 'Countries represented by the authors')}
      </div>
      ${calendarMarkup(calendarItems)}
    </section>`;
  }

  function publicationMarkup(items) {
    const ageItems = cardsIgnoring('period');
    return `<section class="books-timeline-insights" data-books-timeline-insights="publication">
      ${ageProfile(ageItems)}
      <div class="books-insight-section-heading books-insight-section-heading--distribution">
        <div><p class="books-insight-kicker">Current selection</p><h3>What the literary timeline contains</h3><p>These distributions respond to active filters without forcing unlike historical periods into competing bar heights.</p></div>
      </div>
      <div class="books-donut-grid books-donut-grid--two">
        ${donutMarkup(items, cardGenre, 'Genres', 'Genre mix in the current timeline view')}
        ${donutMarkup(items, cardCountry, 'Author origins', 'Country mix in the current timeline view')}
      </div>
      ${withinPeriodMarkup(items)}
    </section>`;
  }

  function configureBaseTimeline() {
    timelineContent.querySelector('.books-base-timeline-heading')?.remove();
    const viewport = timelineContent.querySelector('.books-timeline-viewport');
    if (!viewport) return;
    viewport.classList.remove('books-timeline-viewport--snapshots');

    const hideForPeriodDetail = mode() === 'publication' && Boolean(controls.period?.value);
    viewport.hidden = hideForPeriodDetail;
    if (hideForPeriodDetail) return;

    const heading = document.createElement('div');
    heading.className = 'books-base-timeline-heading';
    heading.innerHTML = mode() === 'reading'
      ? '<div><p class="books-insight-kicker">Years</p><h3>Year-by-year entries</h3></div><span>Select a year card to filter the collection.</span>'
      : '<div><p class="books-insight-kicker">Periods</p><h3>Browse the literary timeline</h3></div><span>Select a period card to open it in detail.</span>';
    viewport.before(heading);
  }

  function wire(panel) {
    panel.querySelectorAll('[data-calendar-year]').forEach((button) => {
      button.addEventListener('click', () => toggleSelect(controls.year, button.dataset.calendarYear));
    });
  }

  function signature(items) {
    return [
      mode(), controls.search?.value || '', controls.genre?.value || '', controls.year?.value || '',
      controls.period?.value || '', controls.language?.value || '', controls.country?.value || '',
      ...items.map((card) => `${card.dataset.originalIndex}:${card.style.display}:${card.classList.contains('atlas-country-hidden')}`),
    ].join('|');
  }

  function enhance(force = false) {
    if (state.busy || timelineView.hidden) return;
    const items = currentCards();
    const next = signature(items);
    if (!force && next === state.signature && timelineContent.querySelector('[data-books-timeline-insights]')) return;

    state.busy = true;
    timelineContent.querySelector('[data-books-timeline-insights]')?.remove();
    timelineContent.querySelector('.books-base-timeline-heading')?.remove();
    const holder = document.createElement('div');
    holder.innerHTML = mode() === 'reading' ? readingMarkup(items) : publicationMarkup(items);
    timelineContent.prepend(holder.firstElementChild);
    wire(timelineContent.firstElementChild);
    configureBaseTimeline();
    state.signature = next;
    state.busy = false;
  }

  let frame = 0;
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => enhance());
  };

  new MutationObserver(schedule).observe(timelineContent, { childList: true, subtree: true });
  timelineView.querySelectorAll('[data-timeline-mode]').forEach((button) => button.addEventListener('click', () => { state.signature = ''; schedule(); }));
  Object.values(controls).filter(Boolean).forEach((control) => {
    control.addEventListener(control.matches('input') ? 'input' : 'change', () => { state.signature = ''; schedule(); });
  });
  schedule();
}
