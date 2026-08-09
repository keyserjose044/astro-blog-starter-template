(() => {
  if (typeof document === 'undefined') return;

  const buildSatelliteUrl = (source) => {
    if (!source || source === 'about:blank') return null;

    let current;
    try {
      current = new URL(source, window.location.href);
    } catch {
      return null;
    }

    const isGoogleMapsHost =
      current.hostname === 'google.com' ||
      current.hostname === 'maps.google.com' ||
      current.hostname.endsWith('.google.com');
    if (!isGoogleMapsHost) return null;

    const query = current.searchParams.get('q');
    if (!query) return null;

    const satellite = new URL('https://maps.google.com/maps');
    satellite.searchParams.set('hl', 'en');
    satellite.searchParams.set('q', query);

    const zoom = current.searchParams.get('z');
    if (zoom) satellite.searchParams.set('z', zoom);

    satellite.searchParams.set('t', 'k');
    satellite.searchParams.set('output', 'embed');
    return satellite.toString();
  };

  const satelliteizeFrame = (frame) => {
    if (!(frame instanceof HTMLIFrameElement)) return;

    const source = frame.dataset.mapSrc || frame.getAttribute('src') || '';
    const satelliteSrc = buildSatelliteUrl(source);
    if (!satelliteSrc) return;

    if (frame.dataset.mapSrc !== satelliteSrc) frame.dataset.mapSrc = satelliteSrc;
    if (frame.getAttribute('src') !== satelliteSrc) frame.setAttribute('src', satelliteSrc);
  };

  const applySatelliteMaps = (root = document) => {
    root.querySelectorAll?.('.about-photo-map-frame').forEach(satelliteizeFrame);
  };

  const setup = () => {
    applySatelliteMaps();

    document.querySelectorAll('[data-where-panel]').forEach((panel) => {
      if (!(panel instanceof HTMLElement) || panel.dataset.satelliteObserverReady === '1') return;
      panel.dataset.satelliteObserverReady = '1';

      const observer = new MutationObserver(() => applySatelliteMaps(panel));
      observer.observe(panel, { childList: true, subtree: true });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }

  document.addEventListener('astro:page-load', setup);
})();
