const fmt = (value) => Number(value || 0).toLocaleString('en-US');
const esc = (value) => String(value || '').replace(/[&<>'"]/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
}[character]));

const metric = (label, value, note = '') => `
  <div class="art-metric">
    <span class="art-metric-label">${esc(label)}</span>
    <strong class="art-metric-value">${esc(value)}</strong>
    ${note ? `<small class="art-metric-note">${esc(note)}</small>` : ''}
  </div>
`;

const topValue = (cards, field) => {
  const counts = new Map();
  cards.forEach((card) => {
    String(card.dataset[field] || '').split(/\s*(?:\/|;|\||\+)\s*|\s*,\s*/).filter(Boolean).forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || '';
};

const yearRange = (cards) => {
  const years = cards.map((card) => Number(card.dataset.artworkSort)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!years.length) return '';
  const format = (year) => year < 0 ? `${Math.abs(year)} BCE` : String(year);
  return years[0] === years.at(-1) ? format(years[0]) : `${format(years[0])}–${format(years.at(-1))}`;
};

export function renderArtArtists(api) {
  const cards = api.getVisibleCards();
  const groups = new Map();

  cards.forEach((card) => {
    const artist = String(card.dataset.artist || '').trim() || 'Artist not recorded';
    const key = api.norm(artist) || 'unknown';
    if (!groups.has(key)) groups.set(key, { key, artist, cards: [] });
    groups.get(key).cards.push(card);
  });

  const artists = [...groups.values()].sort((a, b) => b.cards.length - a.cards.length || a.artist.localeCompare(b.artist));
  const mostRepresented = artists[0];
  const countries = new Set(cards.flatMap((card) => api.split(card.dataset.country)).filter(Boolean));
  const movements = new Set(cards.flatMap((card) => api.split(card.dataset.movement)).filter(Boolean));

  api.controls.artistsMetrics.innerHTML = [
    metric('Artists in view', fmt(artists.length), `${fmt(cards.length)} works after active filters`),
    metric('Most represented', mostRepresented?.artist || '—', mostRepresented ? `${fmt(mostRepresented.cards.length)} works` : 'No artist metadata'),
    metric('Recorded origins', fmt(countries.size), 'Country or nationality labels'),
    metric('Movements represented', fmt(movements.size), 'Based on the current metadata'),
  ].join('');

  if (!artists.length) {
    api.controls.artistsContent.innerHTML = '<div class="art-timeline-empty">No artists match the current filters.</div>';
    return;
  }

  api.controls.artistsContent.innerHTML = `
    <div class="art-artists-grid">
      ${artists.map((entry) => {
        const representative = entry.cards[0];
        const movement = topValue(entry.cards, 'movement');
        const country = topValue(entry.cards, 'country');
        const range = yearRange(entry.cards);
        return `
          <details class="art-artist-card" ${artists.length === 1 ? 'open' : ''}>
            <summary>
              <img src="${esc(representative.dataset.cover || '')}" alt="" loading="lazy">
              <div>
                <h3>${esc(entry.artist)}</h3>
                <p>${fmt(entry.cards.length)} ${entry.cards.length === 1 ? 'work' : 'works'}${movement ? ` · ${esc(movement)}` : ''}</p>
                <p>${[country, range].filter(Boolean).map(esc).join(' · ') || 'Additional metadata not recorded'}</p>
              </div>
            </summary>
            <div class="art-artist-works">
              ${entry.cards.slice(0, 12).map((card) => `
                <button type="button" class="art-artist-work" data-art-card-index="${esc(card.dataset.originalIndex)}" title="Open ${esc(card.dataset.title)}">
                  <img src="${esc(card.dataset.cover || '')}" alt="" loading="lazy">
                  <span>${esc(card.dataset.title || 'Untitled')}</span>
                </button>
              `).join('')}
            </div>
          </details>
        `;
      }).join('')}
    </div>
  `;

  api.controls.artistsContent.querySelectorAll('[data-art-card-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const card = api.cards.find((candidate) => candidate.dataset.originalIndex === button.dataset.artCardIndex);
      if (card) api.openViewer(card);
    });
  });
}