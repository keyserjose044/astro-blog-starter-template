const POLISH_STYLE_ID = 'lifeloggerz-art-view-polish';

function installStyles() {
  if (document.getElementById(POLISH_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = POLISH_STYLE_ID;
  style.textContent = `
    /* The remembered List layout must never override the hidden attribute in explorer views. */
    .art-grid[hidden] { display: none !important; }

    #art-timeline-selection,
    #art-map-selection {
      margin-top: 18px;
      padding: 16px;
      border: 1px solid var(--art-border);
      border-radius: 14px;
      background: rgba(255,255,255,.74);
    }

    #art-timeline-selection.art-selection-shelf,
    #art-map-selection.art-selection-shelf {
      border-top: 1px solid var(--art-border);
    }

    .art-selection-placeholder {
      grid-column: 1 / -1;
      display: flex;
      min-height: 78px;
      align-items: center;
      justify-content: center;
      padding: 18px;
      border: 1px dashed var(--art-border);
      border-radius: 10px;
      background: rgba(245,246,251,.72);
      color: var(--art-muted);
      font-size: .78rem;
      text-align: center;
    }
  `;
  document.head.append(style);
}

function renameWorldView() {
  const button = document.querySelector('[data-art-view="map"]');
  const label = button?.querySelector('span:last-child');
  if (label && label.textContent !== 'World') label.textContent = 'World';

  const close = document.querySelector('#art-map-view [data-close-explorer]');
  if (close) close.setAttribute('aria-label', 'Close world view');

  const info = document.querySelector('#art-info');
  if (info) {
    Array.from(info.querySelectorAll('p')).forEach((paragraph) => {
      if (paragraph.textContent?.includes('World Map')) {
        paragraph.textContent = paragraph.textContent.replace(/World Map/g, 'World');
      }
    });
  }
}

function timelineEmptyCopy() {
  const mode = document.querySelector('[data-timeline-mode][aria-pressed="true"]')?.dataset.timelineMode || 'history';
  const zoom = document.querySelector('#art-timeline-zoom [data-timeline-zoom][aria-pressed="true"]')?.dataset.timelineZoom || 'coarse';

  if (mode === 'viewing' && zoom === 'fine') {
    return ['Select a month to view its artworks', 'Choose a month above to populate this Timeline Selection.'];
  }
  if (mode === 'viewing') {
    return ['Select a year to view its artworks', 'Choose a viewing year above to populate this Timeline Selection.'];
  }
  if (zoom === 'fine') {
    return ['Select a century to view its artworks', 'Choose an art-history century above to populate this Timeline Selection.'];
  }
  return ['Select a period to view its artworks', 'Choose an art-history period above to populate this Timeline Selection.'];
}

function renderEmptySelection(host, kind) {
  if (!host || host.dataset.artPolishState === 'empty') return;
  const [title, summary] = kind === 'timeline'
    ? timelineEmptyCopy()
    : ['Select a country to view its artworks', 'Choose a highlighted country on the map or in the country ranking above.'];

  host.hidden = false;
  host.dataset.artPolishState = 'empty';
  host.innerHTML = `
    <div class="art-selection-heading">
      <div>
        <p class="art-eyebrow">${kind === 'timeline' ? 'Timeline selection' : 'World selection'}</p>
        <h3>${title}</h3>
        <p>${summary}</p>
      </div>
    </div>
    <div class="art-selection-grid">
      <p class="art-selection-placeholder">No artwork selection yet.</p>
    </div>
  `;
}

function syncSelection(host, kind) {
  if (!host) return;
  const hasFilledSelection = Boolean(host.querySelector('.art-selection-work'));

  if (!hasFilledSelection) {
    const desiredCopy = kind === 'timeline' ? timelineEmptyCopy() : null;
    if (host.dataset.artPolishState !== 'empty') {
      renderEmptySelection(host, kind);
      return;
    }
    host.hidden = false;
    if (kind === 'timeline' && desiredCopy) {
      const title = host.querySelector('.art-selection-heading h3');
      const summary = host.querySelector('.art-selection-heading p:not(.art-eyebrow)');
      if (title && title.textContent !== desiredCopy[0]) title.textContent = desiredCopy[0];
      if (summary && summary.textContent !== desiredCopy[1]) summary.textContent = desiredCopy[1];
    }
    return;
  }

  host.hidden = false;
  host.dataset.artPolishState = 'filled';
  const eyebrow = host.querySelector('.art-eyebrow');
  const desired = kind === 'timeline' ? 'Timeline selection' : 'World selection';
  if (eyebrow && eyebrow.textContent !== desired) eyebrow.textContent = desired;
}

let queued = false;
function syncAll() {
  queued = false;
  installStyles();
  renameWorldView();
  syncSelection(document.querySelector('#art-timeline-selection'), 'timeline');
  syncSelection(document.querySelector('#art-map-selection'), 'world');
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
  attributeFilter: ['hidden', 'aria-pressed'],
});

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-timeline-mode], [data-timeline-zoom], [data-timeline-key], [data-country-id], .art-map-country, .art-selection-clear')) {
    window.setTimeout(queueSync, 0);
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', queueSync, { once: true });
} else {
  queueSync();
}
