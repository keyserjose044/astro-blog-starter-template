import { formatNumber, parseFinishedDate, visibleCards, cardGenre, distinctCount } from './books-atlas-insights-utils.js';

export function installMapInsights({ cards, mapView, mapMetrics, countryPanel, mapNote }) {
  const state = { signature: '', busy: false };
  const baseCards = () => visibleCards(cards, false);

  function growthMarkup(items) {
    const dated = items.map((card) => ({ card, date: parseFinishedDate(card.dataset.dateFinished) }))
      .filter(({ card, date }) => date && Array.isArray(card._atlasCountryIds) && card._atlasCountryIds.length)
      .sort((a, b) => a.date - b.date);
    if (!dated.length) return '';
    const firstSeen = new Map();
    dated.forEach(({ card, date }) => card._atlasCountryIds.forEach((id) => { if (!firstSeen.has(id)) firstSeen.set(id, date); }));
    const years = [...new Set(dated.map(({ date }) => date.getUTCFullYear()))].sort((a, b) => a - b);
    let cumulative = 0;
    const entries = years.map((year) => {
      const added = [...firstSeen.values()].filter((date) => date.getUTCFullYear() === year).length;
      cumulative += added;
      return { year, added, cumulative };
    });
    const maximum = Math.max(1, ...entries.map((entry) => entry.cumulative));
    return `<section class="books-atlas-growth" data-books-atlas-growth><div class="books-atlas-growth-copy"><p class="books-insight-kicker">Atlas growth</p><h3>How the reading world expanded</h3><p>Each column shows the cumulative author countries reached by the end of that year.</p></div>
      <div class="books-atlas-growth-chart" aria-label="Cumulative countries by reading year">${entries.map((entry) => `<div class="books-atlas-growth-year"><strong>${entry.cumulative}</strong><span class="books-atlas-growth-bar" style="height:${Math.max(12, entry.cumulative / maximum * 100)}%"></span><b>${entry.year}</b><small>+${entry.added} new</small></div>`).join('')}</div></section>`;
  }

  function enrichCountry() {
    if (!countryPanel.querySelector('[data-clear-map-country]') || countryPanel.querySelector('[data-country-insights]')) return;
    const selected = visibleCards(cards, true);
    if (!selected.length) return;
    const genreCounts = new Map();
    selected.forEach((card) => genreCounts.set(cardGenre(card), (genreCounts.get(cardGenre(card)) || 0) + 1));
    const topGenre = [...genreCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
    const years = selected.map((card) => Number(card.dataset.publicationYear)).filter(Number.isFinite).sort((a, b) => a - b);
    const dates = selected.map((card) => parseFinishedDate(card.dataset.dateFinished)).filter(Boolean).sort((a, b) => a - b);
    const formatYear = (year) => year < 0 ? `${Math.abs(year)} BCE` : year;
    const box = document.createElement('div');
    box.className = 'books-country-insights'; box.dataset.countryInsights = '';
    box.innerHTML = `<div><span>Authors</span><strong>${formatNumber(distinctCount(selected, (card) => String(card.dataset.author || '').trim()))}</strong></div><div><span>Top genre</span><strong>${topGenre}</strong></div>
      <div><span>Works span</span><strong>${years.length ? `${formatYear(years[0])}–${formatYear(years.at(-1))}` : '—'}</strong></div><div><span>First logged</span><strong>${dates.length ? dates[0].toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—'}</strong></div>`;
    countryPanel.querySelector('.books-country-panel-header')?.after(box);
  }

  function fixCopy() {
    if (/^1 books have country labels/.test(mapNote.textContent || '')) mapNote.textContent = mapNote.textContent.replace(/^1 books have country labels/, '1 book has a country label');
    mapMetrics.querySelectorAll('.books-atlas-metric-note').forEach((note) => {
      const next = note.textContent.replace(/books in the base view/i, 'books after active filters');
      if (next !== note.textContent) note.textContent = next;
    });
  }

  function signature(items) {
    return items.map((card) => `${card.dataset.originalIndex}:${(card._atlasCountryIds || []).join(',')}:${card.style.display}`).join('|');
  }

  function enhance(force = false) {
    if (state.busy || mapView.hidden) return;
    const items = baseCards();
    const next = signature(items);
    const exists = Boolean(mapView.querySelector('[data-books-atlas-growth]'));
    if (!force && next === state.signature && exists) { fixCopy(); enrichCountry(); return; }
    state.busy = true;
    mapView.querySelector('[data-books-atlas-growth]')?.remove();
    const markup = growthMarkup(items);
    if (markup) { const holder = document.createElement('div'); holder.innerHTML = markup; mapMetrics.after(holder.firstElementChild); }
    fixCopy(); enrichCountry(); state.signature = next; state.busy = false;
  }

  let frame = 0;
  const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => enhance()); };
  new MutationObserver(schedule).observe(mapView, { childList: true, subtree: true, characterData: true });
  document.querySelectorAll('#q, #genre-filter, #year-filter, #period-filter, #language-filter, #country-filter')
    .forEach((control) => control.addEventListener(control.matches('input') ? 'input' : 'change', () => { state.signature = ''; schedule(); }));
  schedule();
}
