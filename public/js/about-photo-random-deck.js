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
    const bubble = wrapper?.querySelector('.speech-bubble');
    const spots = wrapper
      ? Array.from(wrapper.querySelectorAll('.person-hotspot')).filter((spot) => spot.dataset.quote?.trim())
      : [];

    if (!wrapper || !button || !spots.length) return;

    let deck = [];
    let lastServed = null;

    const refillDeck = () => {
      deck = shuffle(spots);

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
      lastServed = spot || lastServed;
      return spot;
    };

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
  });
})();
