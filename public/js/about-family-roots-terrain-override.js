(() => {
  if (typeof document === 'undefined') return;

  const VERSION = '20260808-topo-v1';
  const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  const TOPO_TILES = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';

  const mapDefinitions = {
    dad: [
      {
        center: [23.6345, -102.5528],
        marker: [21.8818, -102.2916],
        zoom: 5,
        label: 'Aguascalientes within México',
        googleQuery: 'Aguascalientes, Mexico',
      },
      {
        center: [21.96, -102.30],
        marker: [22.2381, -102.0898],
        zoom: 8,
        label: 'State of Aguascalientes',
        googleQuery: 'Estado de Aguascalientes, México',
      },
      {
        center: [22.2381, -102.0898],
        marker: [22.045308, -102.013514],
        zoom: 10,
        label: 'Asientos, Aguascalientes',
        googleQuery: 'Asientos, Aguascalientes, Mexico',
      },
      {
        center: [22.045308, -102.013514],
        marker: [22.045308, -102.013514],
        zoom: 14,
        label: 'Amarillas de Esparza',
        googleQuery: '22.045308,-102.013514',
      },
    ],
    mom: [
      {
        center: [23.6345, -102.5528],
        marker: [24.2669, -98.8363],
        zoom: 5,
        label: 'Tamaulipas within México',
        googleQuery: 'Tamaulipas, Mexico',
      },
      {
        center: [24.2669, -98.8363],
        marker: [25.87972, -97.50417],
        zoom: 7,
        label: 'State of Tamaulipas',
        googleQuery: 'Tamaulipas, Mexico',
      },
      {
        center: [25.87972, -97.50417],
        marker: [25.8602, -97.46717],
        zoom: 10,
        label: 'Heroica Matamoros, Tamaulipas',
        googleQuery: 'Heroica Matamoros, Tamaulipas, Mexico',
      },
      {
        center: [25.8602, -97.46717],
        marker: [25.8602, -97.46717],
        zoom: 16,
        label: 'Colonia Progreso, Matamoros',
        googleQuery: 'Progreso, 87440 Matamoros, Tamaulipas, Mexico',
      },
    ],
  };

  const ensureStyles = () => {
    if (!document.querySelector(`link[data-lifeloggerz-leaflet='${VERSION}']`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      link.dataset.lifeloggerzLeaflet = VERSION;
      document.head.appendChild(link);
    }

    if (document.getElementById('lifeloggerz-topo-map-styles')) return;
    const style = document.createElement('style');
    style.id = 'lifeloggerz-topo-map-styles';
    style.textContent = `
      .about-photo-map-slot--topo{position:relative;background:#e9e2d6;}
      .about-photo-topo-map{position:absolute;z-index:1;inset:0;width:100%;height:100%;background:#e9e2d6;}
      .about-photo-topo-google-link{position:absolute;z-index:500;top:.45rem;right:.45rem;display:inline-flex;align-items:center;gap:.28rem;padding:.38rem .55rem;border:1px solid rgba(67,49,31,.25);border-radius:999px;background:rgba(255,250,242,.94);box-shadow:0 2px 8px rgba(44,31,20,.16);color:#3f3024!important;font:700 .67rem/1.1 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;text-decoration:none!important;backdrop-filter:blur(5px);}
      .about-photo-topo-google-link:hover,.about-photo-topo-google-link:focus-visible{background:#fff;color:#1f5b46!important;}
      .about-photo-map-slot--topo .leaflet-control-zoom a{color:#3f3024!important;text-decoration:none!important;}
      .about-photo-map-slot--topo .leaflet-control-attribution{max-width:82%;padding:2px 4px;background:rgba(255,255,255,.86);font-size:7px;line-height:1.25;white-space:normal;text-align:right;}
      .about-photo-map-slot--topo .leaflet-control-attribution a{color:#315f50!important;}
      .about-photo-where[data-touch-guard='1'] .about-photo-topo-map,
      .about-photo-where[data-branch-touch-guard='1'] .about-photo-topo-map{pointer-events:none;}
      @media(max-width:768px){
        .about-photo-topo-google-link{top:.38rem;right:.38rem;padding:.36rem .5rem;font-size:.64rem;}
        .about-photo-map-slot--topo .leaflet-control-attribution{max-width:88%;font-size:6.5px;}
      }
    `;
    document.head.appendChild(style);
  };

  const ensureLeaflet = () => {
    if (window.L?.map) return Promise.resolve(window.L);
    if (window.__lifeLoggerzLeafletPromise) return window.__lifeLoggerzLeafletPromise;

    window.__lifeLoggerzLeafletPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-lifeloggerz-leaflet]');
      if (existing) {
        existing.addEventListener('load', () => resolve(window.L), { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.dataset.lifeloggerzLeaflet = VERSION;
      script.addEventListener('load', () => resolve(window.L), { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });

    return window.__lifeLoggerzLeafletPromise;
  };

  const getDefinition = (frame) => {
    const branch = frame.closest('[aria-labelledby="family-roots-dad-title"], [aria-labelledby="family-roots-mom-title"]');
    const slot = frame.closest('.about-photo-map-slot');
    if (!(branch instanceof HTMLElement) || !(slot instanceof HTMLElement)) return null;

    const key = branch.getAttribute('aria-labelledby') === 'family-roots-dad-title' ? 'dad' : 'mom';
    const slots = Array.from(branch.querySelectorAll('.about-photo-map-slot'));
    const index = slots.indexOf(slot);
    const definition = mapDefinitions[key]?.[index];
    return definition ? { definition, slot } : null;
  };

  const installTopoMap = async (frame) => {
    if (!(frame instanceof HTMLIFrameElement) || frame.dataset.topoPending === '1') return;
    const match = getDefinition(frame);
    if (!match) return;

    frame.dataset.topoPending = '1';

    let L;
    try {
      L = await ensureLeaflet();
    } catch {
      delete frame.dataset.topoPending;
      return;
    }

    if (!L?.map || !frame.isConnected) return;

    const { definition, slot } = match;
    if (slot.dataset.topoReady === VERSION) {
      frame.remove();
      return;
    }

    const mapElement = document.createElement('div');
    mapElement.className = 'about-photo-topo-map';
    mapElement.dataset.topoMap = '';
    mapElement.setAttribute('role', 'region');
    mapElement.setAttribute('aria-label', `Topographic map of ${definition.label}`);

    const googleLink = document.createElement('a');
    googleLink.className = 'about-photo-topo-google-link';
    googleLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(definition.googleQuery)}`;
    googleLink.target = '_blank';
    googleLink.rel = 'noopener noreferrer';
    googleLink.textContent = 'Open in Google Maps ↗';
    googleLink.setAttribute('aria-label', `Open ${definition.label} in Google Maps`);

    slot.querySelectorAll('.about-photo-map-frame,.about-photo-topo-map,.about-photo-topo-google-link').forEach((node) => node.remove());
    slot.classList.add('about-photo-map-slot--topo');
    slot.dataset.topoReady = VERSION;
    slot.append(mapElement, googleLink);

    const map = L.map(mapElement, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
      doubleClickZoom: true,
    }).setView(definition.center, definition.zoom);

    map.attributionControl.setPrefix(false);
    L.tileLayer(TOPO_TILES, {
      maxZoom: 17,
      maxNativeZoom: 17,
      attribution: 'Map data: <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>, SRTM | Map style: <a href="https://opentopomap.org/" target="_blank" rel="noopener">© OpenTopoMap</a> (CC-BY-SA)',
    }).addTo(map);

    L.circleMarker(definition.marker, {
      radius: 6,
      weight: 2,
      color: '#fffaf2',
      fillColor: '#8a2f2f',
      fillOpacity: 1,
    }).addTo(map).bindTooltip(definition.label, { direction: 'top', offset: [0, -5] });

    mapElement.__lifeLoggerzLeafletMap = map;

    const invalidate = () => window.setTimeout(() => map.invalidateSize({ pan: false }), 0);
    invalidate();
    window.setTimeout(invalidate, 180);

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(invalidate);
      resizeObserver.observe(mapElement);
    }
  };

  const scan = (root = document) => {
    root.querySelectorAll?.('.about-photo-map-frame').forEach((frame) => installTopoMap(frame));
  };

  const setup = () => {
    ensureStyles();
    scan();

    document.querySelectorAll('[data-where-panel]').forEach((panel) => {
      if (!(panel instanceof HTMLElement) || panel.dataset.topoObserverReady === VERSION) return;
      panel.dataset.topoObserverReady = VERSION;

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (!(node instanceof Element)) return;
            if (node.matches('.about-photo-map-frame')) installTopoMap(node);
            scan(node);
          });
        });
      });
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