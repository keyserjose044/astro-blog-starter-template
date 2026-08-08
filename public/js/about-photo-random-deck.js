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

  document.querySelectorAll('.about-photo-block').forEach((figure) => {
    const wrapper = figure.querySelector('[data-family-photo]');
    const button = figure.querySelector('[data-random-thought]');
    const progress = figure.querySelector('[data-random-progress]');
    const status = figure.querySelector('[data-random-status]');
    const bubble = wrapper?.querySelector('.speech-bubble');
    const whoLayer = wrapper?.querySelector('[data-whos-who-layer]');
    const spots = wrapper
      ? Array.from(wrapper.querySelectorAll('.person-hotspot')).filter((spot) => spot.dataset.quote?.trim())
      : [];

    if (!wrapper || !button || !spots.length) return;

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

    const spotlightEnabled = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const spotlightByPerson = new Map();
    const spotlightTimers = new Map();
    let spotlightLayer = null;

    /*
      The blurred portrait-light effect is desktop-only. Touch devices skip the
      layer and its observers entirely so Who's Who stays lightweight on phones.
    */
    if (spotlightEnabled) {
      spotlightLayer = document.createElement('div');
      spotlightLayer.className = 'portrait-spotlight-layer';
      spotlightLayer.setAttribute('aria-hidden', 'true');
      spotlightLayer.dataset.hasActive = '0';
      wrapper.appendChild(spotlightLayer);

      spots.forEach((spot, index) => {
        const light = document.createElement('span');
        light.className = 'portrait-spotlight';
        light.dataset.forPerson = spot.dataset.person || '';
        light.dataset.visible = '0';
        light.style.setProperty('--spot-delay', `${index * 50}ms`);
        spotlightLayer.appendChild(light);
        spotlightByPerson.set(spot.dataset.person || '', light);
      });
    }

    const positionSpotlights = () => {
      if (!spotlightEnabled || !spotlightLayer) return;
      const wrapperRect = wrapper.getBoundingClientRect();
      if (!wrapperRect.width || !wrapperRect.height) return;

      spots.forEach((spot) => {
        const light = spotlightByPerson.get(spot.dataset.person || '');
        if (!light) return;

        const rect = spot.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const centerX = rect.left - wrapperRect.left + rect.width / 2;
        const centerY = rect.top - wrapperRect.top + rect.height * 0.5;
        const width = Math.min(wrapperRect.width * 0.27, Math.max(74, rect.width * 1.28));
        const height = Math.min(wrapperRect.height * 0.78, Math.max(92, rect.height * 1.12));

        light.style.left = `${centerX}px`;
        light.style.top = `${centerY}px`;
        light.style.width = `${width}px`;
        light.style.height = `${height}px`;
      });
    };

    const syncSpotlights = () => {
      if (!spotlightEnabled || !spotlightLayer) return;
      const whoVisible = wrapper.dataset.whosWho === '1';
      const activePerson = bubble?.dataset.visible === '1' ? (bubble.dataset.person || '') : '';
      spotlightLayer.dataset.hasActive = whoVisible && activePerson ? '1' : '0';

      spotlightByPerson.forEach((light, person) => {
        light.dataset.visible = whoVisible ? '1' : '0';
        light.classList.toggle('is-active', Boolean(whoVisible && activePerson && person === activePerson));
      });
    };

    const pulseSpotlight = (spot) => {
      if (!spotlightEnabled) return;
      const person = spot?.dataset.person || '';
      const light = spotlightByPerson.get(person);
      if (!light) return;

      const oldTimer = spotlightTimers.get(person);
      if (oldTimer) window.clearTimeout(oldTimer);

      light.classList.remove('is-random-pulse');
      // Force a fresh animation when the same person is chosen in a later round.
      void light.offsetWidth;
      light.classList.add('is-random-pulse');

      const timer = window.setTimeout(() => {
        light.classList.remove('is-random-pulse');
        spotlightTimers.delete(person);
      }, 800);
      spotlightTimers.set(person, timer);
    };

    if (spotlightEnabled && spotlightLayer) {
      positionSpotlights();
      syncSpotlights();

      const spotlightWrapperObserver = new MutationObserver(syncSpotlights);
      spotlightWrapperObserver.observe(wrapper, {
        attributes: true,
        attributeFilter: ['data-whos-who'],
      });

      if ('ResizeObserver' in window) {
        const spotlightResizeObserver = new ResizeObserver(() => {
          requestAnimationFrame(positionSpotlights);
        });
        spotlightResizeObserver.observe(wrapper);
      }

      window.addEventListener('resize', () => requestAnimationFrame(positionSpotlights), { passive: true });
      window.visualViewport?.addEventListener('resize', () => requestAnimationFrame(positionSpotlights), { passive: true });
    }

    updateProgress();

    button.addEventListener('click', (event) => {
      // Replace the older independent-random handler without changing the
      // main portrait script. Capture phase runs before its click listener.
      event.preventDefault();
      event.stopImmediatePropagation();

      const spot = nextSpot();
      if (!spot) return;

      pulseSpotlight(spot);
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

      syncSpotlights();
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
