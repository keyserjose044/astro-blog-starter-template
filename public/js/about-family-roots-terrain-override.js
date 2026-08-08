(() => {
  if (typeof document === 'undefined') return;

  const TERRAIN_VERSION = '20260808-terrain-v3';

  const terrainizeFrame = (frame) => {
    if (!(frame instanceof HTMLIFrameElement)) return;

    const source = frame.dataset.mapSrc || frame.getAttribute('src') || '';
    if (!source || source === 'about:blank') return;

    let current;
    try {
      current = new URL(source, window.location.href);
    } catch {
      return;
    }

    const isGoogleMapsHost =
      current.hostname === 'google.com' ||
      current.hostname === 'maps.google.com' ||
      current.hostname.endsWith('.google.com');
    if (!isGoogleMapsHost) return;

    const query = current.searchParams.get('q');
    if (!query) return;

    const terrain = new URL('https://maps.google.com/maps');
    terrain.searchParams.set('hl', 'en');
    terrain.searchParams.set('q', query);

    const zoom = current.searchParams.get('z');
    if (zoom) terrain.searchParams.set('z', zoom);

    terrain.searchParams.set('t', 'p');
    terrain.searchParams.set('output', 'embed');
    terrain.searchParams.set('iwloc', 'near');

    const terrainSrc = terrain.toString();
    if (frame.dataset.terrainVersion === TERRAIN_VERSION && frame.getAttribute('src') === terrainSrc) return;

    frame.dataset.terrainVersion = TERRAIN_VERSION;
    frame.dataset.mapSrc = terrainSrc;
    frame.setAttribute('src', terrainSrc);
  };

  const applyTerrain = (root = document) => {
    root.querySelectorAll?.('.about-photo-map-frame').forEach(terrainizeFrame);
  };

  const setup = () => {
    applyTerrain();

    document.querySelectorAll('[data-where-panel]').forEach((panel) => {
      if (!(panel instanceof HTMLElement) || panel.dataset.terrainObserverReady === '1') return;
      panel.dataset.terrainObserverReady = '1';

      const observer = new MutationObserver(() => applyTerrain(panel));
      observer.observe(panel, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src'],
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }

  document.addEventListener('astro:page-load', setup);
})();
