(() => {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('[data-about-photo-feature]').forEach((feature) => {
    const toggle = feature.querySelector('[data-where-toggle]');
    const panel = feature.querySelector('[data-where-panel]');
    const close = feature.querySelector('[data-where-close]');
    if (!toggle || !panel) return;

    const dad = panel.querySelector('[aria-labelledby="family-roots-dad-title"]');
    const mom = panel.querySelector('[aria-labelledby="family-roots-mom-title"]');

    const googleMaps = [
      [dad, [
        {
          title: 'Interactive Google Map showing Dad’s Aguascalientes roots within México',
          query: 'Aguascalientes, Mexico',
          zoom: 5,
        },
        {
          title: 'Interactive Google Map of the State of Aguascalientes, México',
          query: 'Estado de Aguascalientes, México',
          zoom: 8,
        },
        {
          title: 'Interactive Google Map of Asientos, Aguascalientes, México',
          query: 'Asientos, Aguascalientes, Mexico',
          zoom: 10,
        },
        {
          title: 'Interactive Google Map centered on Amarillas de Esparza, Asientos, Aguascalientes, México',
          query: '22.045308,-102.013514',
          zoom: 14,
        },
      ]],
      [mom, [
        {
          title: 'Interactive Google Map showing Tamaulipas within northeastern México',
          query: 'Tamaulipas, Mexico',
          zoom: 5,
        },
        {
          title: 'Interactive Google Map outlining the State of Tamaulipas, México',
          query: 'Tamaulipas, Mexico',
          zoom: 7,
        },
        {
          title: 'Interactive Google Map of Heroica Matamoros, Tamaulipas, México',
          query: 'Heroica Matamoros, Tamaulipas, Mexico',
          zoom: 10,
        },
        {
          title: 'Interactive Google Map of Progreso, 87440 Matamoros, Tamaulipas, México',
          query: 'Progreso, 87440 Matamoros, Tamaulipas, Mexico',
          zoom: 16,
        },
      ]],
    ];

    const buildGoogleMapUrl = (query, zoom) =>
      `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;

    googleMaps.forEach(([branch, maps]) => {
      if (!branch) return;

      const slots = branch.querySelectorAll('.about-photo-map-slot');
      slots.forEach((slot, index) => {
        const map = maps[index];
        if (!map) return;

        slot.removeAttribute('data-map-label');
        slot.removeAttribute('role');
        slot.removeAttribute('aria-label');
        slot.classList.add('about-photo-map-slot--live', 'about-photo-map-slot--google');

        slot.querySelectorAll('.about-photo-map-marker').forEach((marker) => marker.remove());
        slot.querySelectorAll('.about-photo-map-frame').forEach((frame) => frame.remove());

        const frame = document.createElement('iframe');
        const src = buildGoogleMapUrl(map.query, map.zoom);
        frame.className = 'about-photo-map-frame';
        frame.src = src;
        frame.dataset.mapSrc = src;
        frame.title = map.title;
        frame.loading = 'lazy';
        frame.referrerPolicy = 'no-referrer-when-downgrade';
        frame.setAttribute('allowfullscreen', '');
        slot.appendChild(frame);
      });
    });

    /*
      Mobile browsers can restore this page from the back/forward cache after the
      Google Maps link inside an embed opens the Maps app/page. Cross-origin
      iframes are sometimes restored as blank rectangles. Rebuild the map srcs
      only after the page itself has actually been hidden, so ordinary panning
      and zooming inside an embed are left alone.
    */
    let mapsNeedRestore = false;
    let restoreTimer = 0;

    const activeElementIsMap = () =>
      document.activeElement instanceof HTMLIFrameElement &&
      document.activeElement.classList.contains('about-photo-map-frame');

    const restoreMapFrames = () => {
      if (!mapsNeedRestore) return;
      mapsNeedRestore = false;
      window.clearTimeout(restoreTimer);

      const frames = panel.querySelectorAll('.about-photo-map-frame[data-map-src]');
      frames.forEach((frame) => {
        const src = frame.dataset.mapSrc;
        if (!src) return;
        frame.setAttribute('src', 'about:blank');
        window.requestAnimationFrame(() => frame.setAttribute('src', src));
      });
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (activeElementIsMap()) mapsNeedRestore = true;
        return;
      }

      if (mapsNeedRestore) {
        restoreTimer = window.setTimeout(restoreMapFrames, 120);
      }
    });

    window.addEventListener('pagehide', () => {
      if (activeElementIsMap()) mapsNeedRestore = true;
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted && mapsNeedRestore) {
        restoreTimer = window.setTimeout(restoreMapFrames, 120);
      }
    });

    panel.querySelector('.about-photo-map-credit')?.remove();

    const head = panel.querySelector('.about-photo-where-head');
    if (head && !head.querySelector('.about-photo-mexico-mark')) {
      const mark = document.createElement('div');
      mark.className = 'about-photo-mexico-mark';
      mark.setAttribute('aria-label', 'México');

      const outline = document.createElement('img');
      outline.className = 'about-photo-mexico-outline';
      outline.src = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Mexico_geoloc_blank.svg?width=180';
      outline.alt = 'Outline map of México';
      outline.loading = 'lazy';
      outline.decoding = 'async';

      const flag = document.createElement('img');
      flag.className = 'about-photo-mexico-flag';
      flag.src = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Flag_of_Mexico.svg?width=120';
      flag.alt = 'Flag of México';
      flag.loading = 'lazy';
      flag.decoding = 'async';

      mark.append(outline, flag);
      head.insertBefore(mark, close);
    }

    const setOpen = (open, { returnFocus = false } = {}) => {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      panel.dataset.open = open ? '1' : '0';

      if (open) {
        panel.setAttribute('aria-hidden', 'false');
      } else {
        panel.setAttribute('aria-hidden', 'true');
        if (returnFocus) toggle.focus({ preventScroll: true });
      }
    };

    toggle.addEventListener('click', () => {
      setOpen(panel.hidden);
    });

    close?.addEventListener('click', () => {
      setOpen(false, { returnFocus: true });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || panel.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false, { returnFocus: true });
    }, true);
  });
})();
