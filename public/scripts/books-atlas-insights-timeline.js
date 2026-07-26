import {
  MONTH_NAMES, escapeHtml, formatNumber, parseFinishedDate, visibleCards,
  cardCountry, publicationEra, topSeries, legendMarkup, groupReadingYears,
  groupPublication, chartMarkup, toggleSelect, distinctCount,
} from './books-atlas-insights-utils.js';

export function installTimelineInsights({ cards, timelineContent, timelineView }) {
  const state = { readingBreakdown: 'genre', monthYear: 'all', publicationBreakdown: 'genre', signature: '', busy: false };

  const mode = () => timelineView.querySelector('[data-timeline-mode][aria-pressed="true"]')?.dataset.timelineMode || 'publication';
  const sourceCards = () => visibleCards(cards, true);
  const labelFor = (value) => ({ genre: 'genre', country: 'author country', era: 'publication era', language: 'language', total: 'total books' }[value] || value);

  function busiestMonth(items) {
    const counts = new Map();
    items.forEach((card) => {
      const date = parseFinishedDate(card.dataset.dateFinished);
      if (!date) return;
      const key = `${date.getUTCFullYear()}-${date.getUTCMonth()}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    const top = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!top) return null;
    const [year, month] = top[0].split('-').map(Number);
    return { label: `${MONTH_NAMES[month]} ${year}`, count: top[1] };
  }

  function activeMonthSpan(items) {
    const dates = items.map((card) => parseFinishedDate(card.dataset.dateFinished)).filter(Boolean).sort((a, b) => a - b);
    if (!dates.length) return 0;
    return ((dates.at(-1).getUTCFullYear() - dates[0].getUTCFullYear()) * 12)
      + dates.at(-1).getUTCMonth() - dates[0].getUTCMonth() + 1;
  }

  function readingMarkup(items) {
    const groups = groupReadingYears(items);
    const years = groups.map((group) => group.key);
    if (state.monthYear !== 'all' && !years.includes(state.monthYear)) state.monthYear = 'all';
    const monthlyItems = state.monthYear === 'all' ? items : items.filter((card) =>
      parseFinishedDate(card.dataset.dateFinished)?.getUTCFullYear() === Number(state.monthYear));
    const series = topSeries(items, state.readingBreakdown);
    const monthSeries = topSeries(monthlyItems, state.readingBreakdown);
    const monthGroups = MONTH_NAMES.map((label, month) => ({ key: String(month), label, cards: monthlyItems.filter((card) =>
      parseFinishedDate(card.dataset.dateFinished)?.getUTCMonth() === month) }));
    const peak = busiestMonth(items);
    const span = activeMonthSpan(items);
    const pace = span ? items.length / span : 0;

    return `<section class="books-timeline-insights" data-books-timeline-insights="reading">
      <div class="books-insight-section-heading"><div><p class="books-insight-kicker">Reading rhythm</p><h3>How the collection grew year by year</h3><p>Bar height shows books finished. Colored segments show the mix within each year.</p></div>
      <label class="books-insight-select-label"><span>Color bars by</span><select data-reading-breakdown>
        <option value="genre" ${state.readingBreakdown === 'genre' ? 'selected' : ''}>Genre</option><option value="country" ${state.readingBreakdown === 'country' ? 'selected' : ''}>Author country</option>
        <option value="era" ${state.readingBreakdown === 'era' ? 'selected' : ''}>Publication era</option><option value="language" ${state.readingBreakdown === 'language' ? 'selected' : ''}>Language</option>
        <option value="total" ${state.readingBreakdown === 'total' ? 'selected' : ''}>Total only</option></select></label></div>
      ${legendMarkup(series)}<div class="books-insight-chart books-insight-chart--years" aria-label="Books finished per year, colored by ${escapeHtml(labelFor(state.readingBreakdown))}">${chartMarkup(groups, series, state.readingBreakdown, 'reading')}</div>
      <div class="books-reading-pulse"><div><span>Busiest month</span><strong>${peak ? peak.label : '—'}</strong><small>${peak ? `${formatNumber(peak.count)} books` : 'No dates'}</small></div>
      <div><span>Monthly pace</span><strong>${pace ? pace.toFixed(1) : '—'}</strong><small>books per calendar month</small></div>
      <div><span>Countries reached</span><strong>${formatNumber(distinctCount(items, cardCountry))}</strong><small>in the current view</small></div></div>
      <div class="books-month-panel"><div class="books-insight-section-heading books-insight-section-heading--compact"><div><p class="books-insight-kicker">By month</p>
      <h3>${state.monthYear === 'all' ? 'The recurring shape of a reading year' : `Reading activity in ${state.monthYear}`}</h3><p>${state.monthYear === 'all' ? 'All tracked years combined by calendar month.' : 'One year shown month by month.'}</p></div>
      <label class="books-insight-select-label"><span>Year</span><select data-reading-month-year><option value="all" ${state.monthYear === 'all' ? 'selected' : ''}>All years</option>${years.map((year) => `<option value="${year}" ${state.monthYear === year ? 'selected' : ''}>${year}</option>`).join('')}</select></label></div>
      ${legendMarkup(monthSeries)}<div class="books-insight-chart books-insight-chart--months" aria-label="Books by calendar month">${chartMarkup(monthGroups, monthSeries, state.readingBreakdown, 'month')}</div></div>
    </section>`;
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
    return `<div class="books-age-profile"><div class="books-age-profile-track">${labels.map((label, index) => {
      const count = counts.get(label) || 0; return count ? `<span class="books-insight-series-${index}" style="width:${count / total * 100}%" title="${label}: ${count}"></span>` : '';
    }).join('')}</div><div class="books-age-profile-legend">${labels.map((label, index) => counts.get(label) ? `<span><i class="books-insight-series-${index}"></i>${label} <strong>${counts.get(label)}</strong></span>` : '').join('')}</div></div>`;
  }

  function medianYear(items) {
    const years = items.map((card) => Number(card.dataset.publicationYear)).filter(Number.isFinite).sort((a, b) => a - b);
    if (!years.length) return null;
    const middle = Math.floor(years.length / 2);
    const value = years.length % 2 ? years[middle] : Math.round((years[middle - 1] + years[middle]) / 2);
    return value < 0 ? `${Math.abs(value)} BCE` : String(value);
  }

  function publicationMarkup(items) {
    const groups = groupPublication(items);
    const series = topSeries(items, state.publicationBreakdown);
    const years = items.map((card) => Number(card.dataset.publicationYear)).filter(Number.isFinite).sort((a, b) => a - b);
    const formatYear = (year) => year < 0 ? `${Math.abs(year)} BCE` : String(year);
    return `<section class="books-timeline-insights" data-books-timeline-insights="publication">
      <div class="books-insight-section-heading"><div><p class="books-insight-kicker">Collection shape</p><h3>Where the books sit in literary time</h3><p>Bar height shows works in each era. Select one to use the publication-period filter.</p></div>
      <label class="books-insight-select-label"><span>Color bars by</span><select data-publication-breakdown>
      <option value="genre" ${state.publicationBreakdown === 'genre' ? 'selected' : ''}>Genre</option><option value="country" ${state.publicationBreakdown === 'country' ? 'selected' : ''}>Author country</option>
      <option value="language" ${state.publicationBreakdown === 'language' ? 'selected' : ''}>Language</option><option value="total" ${state.publicationBreakdown === 'total' ? 'selected' : ''}>Total only</option></select></label></div>
      ${legendMarkup(series)}<div class="books-insight-chart books-insight-chart--eras" aria-label="Books by publication era">${chartMarkup(groups, series, state.publicationBreakdown, 'publication')}</div>
      <div class="books-publication-summary"><div><span>Median publication year</span><strong>${medianYear(items) || '—'}</strong></div>
      <div><span>Historical span</span><strong>${years.length ? `${formatYear(years[0])} to ${formatYear(years.at(-1))}` : '—'}</strong></div><div><span>Distinct eras</span><strong>${groups.filter((group) => group.key !== 'unknown').length}</strong></div></div>
      <div class="books-age-profile-panel"><div class="books-insight-section-heading books-insight-section-heading--compact"><div><p class="books-insight-kicker">Age profile</p><h3>The collection at a glance</h3><p>A proportional view of the broad periods represented.</p></div></div>${ageProfile(items)}</div>
    </section>`;
  }

  function addSnapshotsHeading() {
    const viewport = timelineContent.querySelector('.books-timeline-viewport');
    if (!viewport) return;
    viewport.classList.add('books-timeline-viewport--snapshots');
    const heading = document.createElement('div');
    heading.className = 'books-snapshot-heading';
    heading.innerHTML = `<div><p class="books-insight-kicker">Snapshots</p><h3>${mode() === 'reading' ? 'Year-by-year details' : 'Period-by-period details'}</h3></div><span>Select a card to filter the collection.</span>`;
    viewport.before(heading);
  }

  function wire(panel) {
    panel.querySelector('[data-reading-breakdown]')?.addEventListener('change', (event) => { state.readingBreakdown = event.target.value; state.signature = ''; enhance(true); });
    panel.querySelector('[data-reading-month-year]')?.addEventListener('change', (event) => { state.monthYear = event.target.value; state.signature = ''; enhance(true); });
    panel.querySelector('[data-publication-breakdown]')?.addEventListener('change', (event) => { state.publicationBreakdown = event.target.value; state.signature = ''; enhance(true); });
    panel.querySelectorAll('[data-insight-reading-key]').forEach((button) => button.addEventListener('click', () => toggleSelect(document.querySelector('#year-filter'), button.dataset.insightReadingKey)));
    panel.querySelectorAll('[data-insight-publication-key]').forEach((button) => button.addEventListener('click', () => toggleSelect(document.querySelector('#period-filter'), button.dataset.insightPublicationKey)));
    panel.querySelectorAll('[data-insight-month-key]').forEach((button) => { button.disabled = true; button.setAttribute('aria-disabled', 'true'); });
  }

  function signature(items) {
    return [mode(), state.readingBreakdown, state.monthYear, state.publicationBreakdown,
      ...items.map((card) => `${card.dataset.originalIndex}:${card.style.display}:${card.classList.contains('atlas-country-hidden')}`)].join('|');
  }

  function enhance(force = false) {
    if (state.busy || timelineView.hidden) return;
    const items = sourceCards();
    const next = signature(items);
    if (!force && next === state.signature && timelineContent.querySelector('[data-books-timeline-insights]')) return;
    state.busy = true;
    timelineContent.querySelector('[data-books-timeline-insights]')?.remove();
    timelineContent.querySelector('.books-snapshot-heading')?.remove();
    const holder = document.createElement('div');
    holder.innerHTML = mode() === 'reading' ? readingMarkup(items) : publicationMarkup(items);
    timelineContent.prepend(holder.firstElementChild);
    wire(timelineContent.firstElementChild);
    addSnapshotsHeading();
    state.signature = next;
    state.busy = false;
  }

  let frame = 0;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => enhance()); };
  new MutationObserver(schedule).observe(timelineContent, { childList: true, subtree: true });
  timelineView.querySelectorAll('[data-timeline-mode]').forEach((button) => button.addEventListener('click', schedule));
  document.querySelectorAll('#q, #genre-filter, #year-filter, #period-filter, #language-filter, #country-filter')
    .forEach((control) => control.addEventListener(control.matches('input') ? 'input' : 'change', () => { state.signature = ''; schedule(); }));
  schedule();
}
