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
          title: 'Interactive Google Map of Aguascalientes, México',
          query: 'Aguascalientes, Mexico',
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
          title: 'Interactive Google Map showing Mom’s Tamaulipas roots within México',
          query: 'Heroica Matamoros, Tamaulipas, Mexico',
          zoom: 5,
        },
        {
          title: 'Interactive Google Map of Tamaulipas, México',
          query: 'Tamaulipas, Mexico',
          zoom: 7,
        },
        {
          title: 'Interactive Google Map of Heroica Matamoros, Tamaulipas, México',
          query: 'Heroica Matamoros, Tamaulipas, Mexico',
          zoom: 10,
        },
        {
          title: 'Interactive Google Map centered on Colonia Progreso, Heroica Matamoros, Tamaulipas, México',
          query: '25.8602,-97.46717',
          zoom: 14,
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
        frame.className = 'about-photo-map-frame';
        frame.src = buildGoogleMapUrl(map.query, map.zoom);
        frame.title = map.title;
        frame.loading = 'lazy';
        frame.referrerPolicy = 'no-referrer-when-downgrade';
        frame.setAttribute('allowfullscreen', '');
        slot.appendChild(frame);
      });
    });

    panel.querySelector('.about-photo-map-credit')?.remove();

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
