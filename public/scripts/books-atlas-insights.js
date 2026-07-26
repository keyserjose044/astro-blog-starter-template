import { installTimelineInsights } from './books-atlas-insights-timeline.js';
import { installMapInsights } from './books-atlas-insights-map.js';

function boot() {
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
  const cards = Array.from(grid.querySelectorAll('.card'));
  installTimelineInsights({ cards, timelineContent, timelineView });
  installMapInsights({ cards, mapView, mapMetrics, countryPanel, mapNote });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
else boot();
