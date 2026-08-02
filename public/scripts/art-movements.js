const esc = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));
const num = (value) => value === '' || value == null ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
const formatYear = (year) => year < 0 ? `${Math.abs(year)} BCE` : String(year);

function rangeLabel(cards) {
  const years = cards.map((card) => num(card.dataset.artworkSort)).filter((value) => value !== null).sort((a, b) => a - b);
  if (!years.length) return 'Date not recorded';
  return years[0] === years.at(-1) ? formatYear(years[0]) : `${formatYear(years[0])}–${formatYear(years.at(-1))}`;
}

function movementGroups(api) {
  const groups = new Map();
  api.getVisibleCards().forEach((card) => {
    api.split(card.dataset.movement).forEach((movement) => {
      const key = api.norm(movement);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, { key, label: movement, cards: [] });
      groups.get(key).cards.push(card);
    });
  });
  return [...groups.values()].sort((a, b) => b.cards.length - a.cards.length || a.label.localeCompare(b.label));
}

function uniqueTokens(cards, field, api) {
  const labels = new Map();
  cards.flatMap((card) => api.split(card.dataset[field])).forEach((label) => {
    const key = api.norm(label);
    if (key && !labels.has(key)) labels.set(key, label);
  });
  return [...labels.values()];
}

function buildMetrics(api, groups) {
  const host = api.controls.movementsMetrics;
  if (!host) return;
  const largest = groups[0];
  const representedArtists = new Set(groups.flatMap((group) => group.cards.map((card) => api.norm(card.dataset.artist))).filter(Boolean));
  const representedWorks = new Set(groups.flatMap((group) => group.cards.map((card) => card.dataset.originalIndex)));
  const multiMovementWorks = api.getVisibleCards().filter((card) => api.split(card.dataset.movement).length > 1).length;
  host.innerHTML = `
    <div class="art-metric"><span class="art-metric-label">Movements represented</span><strong class="art-metric-value">${groups.length.toLocaleString('en-US')}</strong><small class="art-metric-note">After active filters</small></div>
    <div class="art-metric"><span class="art-metric-label">Works classified</span><strong class="art-metric-value">${representedWorks.size.toLocaleString('en-US')}</strong><small class="art-metric-note">Works with movement metadata</small></div>
    <div class="art-metric"><span class="art-metric-label">Artists represented</span><strong class="art-metric-value">${representedArtists.size.toLocaleString('en-US')}</strong><small class="art-metric-note">Across movement groups</small></div>
    <div class="art-metric"><span class="art-metric-label">Largest movement</span><strong class="art-metric-value">${esc(largest?.label || '—')}</strong><small class="art-metric-note">${largest ? `${largest.cards.length.toLocaleString('en-US')} works` : 'No classified works'}${multiMovementWorks ? ` · ${multiMovementWorks.toLocaleString('en-US')} multi-tagged` : ''}</small></div>
  `;
}

function renderGroup(group, api) {
  const artists = new Set(group.cards.map((card) => api.norm(card.dataset.artist)).filter(Boolean));
  const countries = uniqueTokens(group.cards, 'country', api);
  const media = uniqueTokens(group.cards, 'medium', api);
  const mosaic = group.cards.slice(0, 4);
  return `
    <details class="art-movement-card">
      <summary class="art-movement-summary">
        <span class="art-movement-mosaic" data-count="${Math.min(mosaic.length, 4)}">
          ${mosaic.map((card) => `<img class="art-derived-cover" src="${esc(card.dataset.cover || '')}" data-cover-fallbacks="${esc(card.dataset.coverFallbacks || '[]')}" alt="" loading="lazy" decoding="async">`).join('')}
        </span>
        <span class="art-movement-summary-copy">
          <span class="art-movement-title-row"><h3>${esc(group.label)}</h3><span class="art-movement-count">${group.cards.length.toLocaleString('en-US')} ${group.cards.length === 1 ? 'work' : 'works'}</span></span>
          <span class="art-movement-facts">
            <span class="art-movement-fact"><span>Artists</span><strong>${artists.size.toLocaleString('en-US')}</strong></span>
            <span class="art-movement-fact"><span>Historical range</span><strong>${esc(rangeLabel(group.cards))}</strong></span>
            <span class="art-movement-fact"><span>Countries</span><strong>${esc(countries.slice(0, 3).join(', ') || 'Not recorded')}${countries.length > 3 ? ` +${countries.length - 3}` : ''}</strong></span>
            <span class="art-movement-fact"><span>Media</span><strong>${esc(media.slice(0, 3).join(', ') || 'Not recorded')}${media.length > 3 ? ` +${media.length - 3}` : ''}</strong></span>
          </span>
          <span class="art-movement-open-hint">Open mini-exhibition ↓</span>
        </span>
      </summary>
      <div class="art-movement-collection">
        <div class="art-movement-collection-head"><strong>${esc(group.label)} collection</strong><span>${group.cards.length.toLocaleString('en-US')} works · click any work for details</span></div>
        <div class="art-movement-works">
          ${group.cards.map((card) => `
            <button type="button" class="art-movement-work" data-art-card-index="${esc(card.dataset.originalIndex)}" title="Open ${esc(card.dataset.title || 'artwork')}">
              <img class="art-derived-cover" src="${esc(card.dataset.cover || '')}" data-cover-fallbacks="${esc(card.dataset.coverFallbacks || '[]')}" alt="" loading="lazy" decoding="async">
              <strong>${esc(card.dataset.title || 'Untitled')}</strong><span>${esc(card.dataset.artist || 'Artist not recorded')}</span>
            </button>
          `).join('')}
        </div>
      </div>
    </details>
  `;
}

export function renderArtMovements(api) {
  const groups = movementGroups(api);
  buildMetrics(api, groups);
  const host = api.controls.movementsContent;
  if (!host) return;
  if (!groups.length) {
    host.innerHTML = '<div class="art-timeline-empty">No movement metadata matches the current filters.</div>';
    return;
  }
  host.innerHTML = `<div class="art-movements-grid">${groups.map((group) => renderGroup(group, api)).join('')}</div>`;
  host.querySelectorAll('[data-art-card-index]').forEach((button) => button.addEventListener('click', () => {
    const card = api.cards.find((candidate) => candidate.dataset.originalIndex === button.dataset.artCardIndex);
    if (card) api.openViewer(card);
  }));
}
