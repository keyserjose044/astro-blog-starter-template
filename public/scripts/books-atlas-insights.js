const BOOKS_INSIGHTS_VERSION = '20260726-1220';

let modulesPromise;

function loadInsightModules() {
  if (!modulesPromise) {
    modulesPromise = Promise.all([
      import(`./books-atlas-insights-timeline.js?v=${BOOKS_INSIGHTS_VERSION}`),
      import(`./books-atlas-insights-map.js?v=${BOOKS_INSIGHTS_VERSION}`),
    ]);
  }
  return modulesPromise;
}

async function boot() {
  const grid = document.querySelector('#grid');
  const timelineContent = document.querySelector('#books-timeline-content');
  const timelineView = document.querySelector('#books-timeline-view');
  const mapView = document.querySelector('#books-map-view');
  const mapMetrics = document.querySelector('#books-map-metrics');
  const countryPanel = document.querySelector('#books-country-panel');
  const mapNote = document.querySelector('#books-map-note');

  if (!grid || !timelineContent || !timelineView || !mapView || !mapMetrics || !countryPanel || !mapNote) {
    setTimeout(boot, 80);
    return;
  }

  try {
    const [{ installTimelineInsights }, { installMapInsights }] = await loadInsightModules();
    const cards = Array.from(grid.querySelectorAll('.card'));
    installTimelineInsights({ cards, timelineContent, timelineView });
    installMapInsights({ cards, mapView, mapMetrics, countryPanel, mapNote });
  } catch (error) {
    console.error('Books atlas insight modules could not load.', error);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
