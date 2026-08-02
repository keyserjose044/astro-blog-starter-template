(() => {
  if (typeof document === 'undefined') return;

  const shuffle = (items) => {
    const shuffled = [...items];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const parsePolygonPoints = (spot) =>
    (spot.getAttribute('points') || '')
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(',').map(Number))
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

  const pointInPolygon = (x, y, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
      const [xi, yi] = polygon[i];
      const [xj, yj] = polygon[j];
      const intersects = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  };

  const polygonCenter = (polygon) => {
    if (!polygon.length) return { x: 0, y: 0 };
    const totals = polygon.reduce((sum, [x, y]) => ({ x: sum.x + x, y: sum.y + y }), { x: 0, y: 0 });
    return { x: totals.x / polygon.length, y: totals.y / polygon.length };
  };

  document.querySelectorAll('.about-photo-block').forEach((figure) => {
    const wrapper = figure.querySelector('[data-family-photo]');
    const button = figure.querySelector('[data-random-thought]');
    const progress = figure.querySelector('[data-random-progress]');
    const status = figure.querySelector('[data-random-status]');
    const bubble = wrapper?.querySelector('.speech-bubble');
    const whoLayer = wrapper?.querySelector('[data-whos-who-layer]');
    const hotspotLayer = wrapper?.querySelector('.family-hotspot-layer');
    const spots = wrapper
      ? Array.from(wrapper.querySelectorAll('.person-hotspot')).filter((spot) => spot.dataset.quote?.trim())
      : [];

    if (!wrapper || !button || !spots.length) return;

    const touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
    const portraitQuery = window.matchMedia('(orientation: portrait)');
    const spotGeometry = new Map(
      spots.map((spot) => {
        const polygon = parsePolygonPoints(spot);
        return [spot, { polygon, center: polygonCenter(polygon) }];
      })
    );

    let reroutingLandscapeTap = false;

    if (hotspotLayer) {
      hotspotLayer.addEventListener('click', (event) => {
        // On a real touch tap in landscape, overlapping SVG polygons can cause
        // a person above the intended subject to steal the click. Resolve the
        // tap from its actual coordinates and choose the nearest matching
        // person's polygon instead. Keyboard/programmatic clicks are left alone.
        if (reroutingLandscapeTap || !touchQuery.matches || portraitQuery.matches || event.detail === 0) return;

        const rect = hotspotLayer.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const x = ((event.clientX - rect.left) / rect.width) * 985;
        const y = ((event.clientY - rect.top) / rect.height) * 551;
        if (x < 0 || x > 985 || y < 0 || y > 551) return;

        const matches = spots.filter((spot) => {
          const geometry = spotGeometry.get(spot);
          return geometry?.polygon?.length && pointInPolygon(x, y, geometry.polygon);
        });
        if (!matches.length) return;

        const chosen = matches.reduce((best, spot) => {
          const center = spotGeometry.get(spot)?.center;
          if (!center) return best;
          const distance = ((center.x - x) ** 2) + ((center.y - y) ** 2);
          if (!best || distance < best.distance) return { spot, distance };
          return best;
        }, null)?.spot;

        const browserTarget = event.target.closest?.('.person-hotspot');
        if (!chosen || chosen === browserTarget) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        reroutingLandscapeTap = true;
        chosen.dispatchEvent(new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: event.clientX,
          clientY: event.clientY,
          detail: 1,
        }));
        reroutingLandscapeTap = false;
      }, true);
    }

    let deck = [];
    let lastServed = null;
    let roundCount = 0;
    let roundPulseTimer = 0;

    const updateProgress = () => {
      if (progress) progress.textContent = `${roundCount} / ${spots.length}`;
    };

    const pulseRoundComplete = () => {
      window.clearTimeout(roundPulseTimer);
      button.dataset.roundComplete = '1';
      if (status) status.textContent = `Round complete. You saw all ${spots.length} thoughts.`;
      roundPulseTimer = window.setTimeout(() => {
        button.dataset.roundComplete = '0';
      }, 760);
    };

    const refillDeck = () => {
      deck = shuffle(spots);
      roundCount = 0;

      // Avoid an immediate repeat where one completed round meets the next.
      if (lastServed && deck.length > 1 && deck[0] === lastServed) {
        const swapIndex = 1 + Math.floor(Math.random() * (deck.length - 1));
        [deck[0], deck[swapIndex]] = [deck[swapIndex], deck[0]];
      }
    };

    const nextSpot = () => {
      if (!deck.length) refillDeck();

      // If the user manually opened the thought that is next in the deck,
      // postpone it rather than showing the same thought twice in a row.
      const activePerson = bubble?.dataset.person || '';
      if (deck.length > 1 && activePerson && deck[0]?.dataset.person === activePerson) {
        deck.push(deck.shift());
      }

      const spot = deck.shift();
      if (!spot) return null;

      lastServed = spot;
      roundCount += 1;
      updateProgress();

      if (status && roundCount < spots.length) {
        status.textContent = `Random thought ${roundCount} of ${spots.length}: ${spot.dataset.label || 'family member'}.`;
      }

      if (roundCount === spots.length) pulseRoundComplete();
      return spot;
    };

    updateProgress();

    button.addEventListener('click', (event) => {
      // Replace the older independent-random handler without changing the
      // main portrait script. Capture phase runs before its click listener.
      event.preventDefault();
      event.stopImmediatePropagation();

      const spot = nextSpot();
      if (!spot) return;

      spot.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      }));
    }, true);

    if (!whoLayer) return;

    let unfurlFrame = 0;
    let unfurlSettleFrame = 0;

    const whoLabels = () => Array.from(whoLayer.querySelectorAll('.whos-who-label'));

    const decorateWhoLabels = () => {
      whoLabels().forEach((label, index) => {
        label.style.setProperty('--who-delay', `${index * 50}ms`);
        if (!label.dataset.unfurl) label.dataset.unfurl = '0';
      });
    };

    const playWhoUnfurl = () => {
      decorateWhoLabels();
      const labels = whoLabels();
      cancelAnimationFrame(unfurlFrame);
      cancelAnimationFrame(unfurlSettleFrame);

      if (whoLayer.dataset.visible !== '1') {
        labels.forEach((label) => { label.dataset.unfurl = '0'; });
        return;
      }

      labels.forEach((label) => { label.dataset.unfurl = '0'; });
      unfurlFrame = requestAnimationFrame(() => {
        unfurlSettleFrame = requestAnimationFrame(() => {
          labels.forEach((label) => { label.dataset.unfurl = '1'; });
        });
      });
    };

    const syncWhoActive = () => {
      const activePerson = bubble?.dataset.visible === '1' ? (bubble.dataset.person || '') : '';
      const labels = whoLabels();
      whoLayer.dataset.hasActive = activePerson ? '1' : '0';

      labels.forEach((label) => {
        label.classList.toggle('is-active', Boolean(activePerson) && label.dataset.forPerson === activePerson);
      });
    };

    const whoObserver = new MutationObserver(() => {
      playWhoUnfurl();
      syncWhoActive();
    });

    whoObserver.observe(whoLayer, {
      childList: true,
      attributes: true,
      attributeFilter: ['data-visible'],
    });

    if (bubble) {
      const bubbleObserver = new MutationObserver(syncWhoActive);
      bubbleObserver.observe(bubble, {
        attributes: true,
        attributeFilter: ['data-person', 'data-visible'],
      });
    }

    decorateWhoLabels();
    syncWhoActive();
  });
})();