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

    const decorateWhoLabels = () => {
      Array.from(whoLayer.querySelectorAll('.whos-who-label')).forEach((label, index) => {
        label.style.setProperty('--who-delay', `${index * 50}ms`);
      });
    };

    const syncWhoActive = () => {
      const activePerson = bubble?.dataset.visible === '1' ? (bubble.dataset.person || '') : '';
      const labels = Array.from(whoLayer.querySelectorAll('.whos-who-label'));
      whoLayer.dataset.hasActive = activePerson ? '1' : '0';

      labels.forEach((label) => {
        label.classList.toggle('is-active', Boolean(activePerson) && label.dataset.forPerson === activePerson);
      });
    };

    const whoObserver = new MutationObserver(() => {
      decorateWhoLabels();
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
