(() => {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('[data-family-photo]').forEach((wrapper) => {
    const bubble = wrapper.querySelector('.speech-bubble');
    const copy = bubble?.querySelector('p');
    const img = bubble?.querySelector('.cloud-adornment');
    const spots = wrapper.querySelectorAll('.person-hotspot');
    const secret = wrapper.querySelector('.secret-bubble');
    if (!bubble || !copy || !img) return;

    let pinned = null;
    let activeSpot = null;
    let frame = 0;
    let settleTimer = 0;
    let resizeFrame = 0;
    const mobileQuery = window.matchMedia('(max-width: 640px)');

    const fitMobileBubble = (spot) => {
      if (!spot || bubble.dataset.visible !== '1') return;

      bubble.style.left = spot.dataset.bubbleLeft || '50%';
      bubble.style.setProperty('--mobile-shift', '0px');
      if (!mobileQuery.matches) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const bubbleWidth = bubble.offsetWidth;
      if (!wrapperRect.width || !bubbleWidth) return;

      const parsedLeft = Number.parseFloat(spot.dataset.bubbleLeft || '50');
      const desiredCenter = wrapperRect.width * (Number.isFinite(parsedLeft) ? parsedLeft / 100 : 0.5);
      const corner = spot.dataset.corner || '';
      const hasAdornment = Boolean(spot.dataset.adornment);
      const edgePad = 10;
      let extraLeft = 10;
      let extraRight = 10;

      if (hasAdornment) {
        if (corner === 'bottom-left') extraLeft += bubbleWidth * 0.19;
        else if (corner === 'top-left') extraLeft += bubbleWidth * 0.05;
        else if (corner.endsWith('right')) extraRight += bubbleWidth * 0.13;
      }

      const viewportMin = edgePad - wrapperRect.left + bubbleWidth / 2 + extraLeft;
      const viewportMax = window.innerWidth - edgePad - wrapperRect.left - bubbleWidth / 2 - extraRight;
      const wrapperMin = bubbleWidth / 2 + extraLeft;
      const wrapperMax = wrapperRect.width - bubbleWidth / 2 - extraRight;
      const minCenter = Math.max(viewportMin, wrapperMin);
      const maxCenter = Math.min(viewportMax, wrapperMax);

      const fittedCenter = minCenter <= maxCenter
        ? Math.min(maxCenter, Math.max(minCenter, desiredCenter))
        : wrapperRect.width / 2;

      const shift = fittedCenter - desiredCenter;
      bubble.style.left = `${fittedCenter}px`;
      bubble.style.setProperty('--mobile-shift', `${shift}px`);
    };

    const hide = () => {
      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      activeSpot = null;
      bubble.dataset.visible = '0';
      bubble.dataset.hasAdornment = '0';
      bubble.setAttribute('aria-hidden', 'true');
      bubble.style.setProperty('--mobile-shift', '0px');
      img.src = '';
      img.alt = '';
    };

    const show = (spot) => {
      const q = spot.dataset.quote?.trim();
      if (!q) return;

      cancelAnimationFrame(frame);
      clearTimeout(settleTimer);
      activeSpot = spot;
      bubble.dataset.hasAdornment = '0';
      copy.textContent = q;
      bubble.style.left = spot.dataset.bubbleLeft || '50%';
      bubble.style.top = spot.dataset.bubbleTop || '50%';
      bubble.dataset.placement = spot.dataset.placement || 'above';
      bubble.dataset.cloudVariant = spot.dataset.cloudVariant || 'wide';
      bubble.dataset.person = spot.dataset.person || '';
      bubble.style.setProperty('--tail-shift', spot.dataset.tailShift || '0px');
      bubble.style.setProperty('--mobile-shift', '0px');
      bubble.style.setProperty('--cloud-tilt', spot.dataset.cloudTilt || '0deg');

      const src = spot.dataset.adornment || '';
      if (src) {
        bubble.dataset.corner = spot.dataset.corner || 'top-right';
        bubble.dataset.size = spot.dataset.size || 'medium';
        bubble.style.setProperty('--adornment-tilt', spot.dataset.adornmentTilt || '0deg');
        img.src = src;
        img.alt = spot.dataset.adornmentAlt || '';
      } else {
        bubble.dataset.corner = '';
        bubble.dataset.size = '';
        img.src = '';
        img.alt = '';
      }

      bubble.dataset.visible = '1';
      bubble.setAttribute('aria-hidden', 'false');

      frame = requestAnimationFrame(() => {
        fitMobileBubble(spot);
        if (src) bubble.dataset.hasAdornment = '1';
      });

      settleTimer = window.setTimeout(() => fitMobileBubble(spot), 720);
    };

    img.addEventListener('load', () => {
      if (!activeSpot) return;
      requestAnimationFrame(() => fitMobileBubble(activeSpot));
    });

    spots.forEach((spot) => {
      spot.addEventListener('pointerenter', () => { if (!pinned) show(spot); });
      spot.addEventListener('pointerleave', () => { if (!pinned && document.activeElement !== spot) hide(); });
      spot.addEventListener('focus', () => { if (!pinned) show(spot); });
      spot.addEventListener('blur', () => { if (!pinned) hide(); });
      spot.addEventListener('click', (event) => {
        event.stopPropagation();
        if (pinned === spot) {
          pinned = null;
          hide();
        } else {
          pinned = spot;
          show(spot);
        }
      });
      spot.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          pinned = null;
          hide();
          spot.blur();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          spot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
    });

    wrapper.addEventListener('click', (event) => {
      if (event.target.closest?.('.person-hotspot')) return;
      pinned = null;
      hide();
    });

    const refit = () => {
      if (!activeSpot) return;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => fitMobileBubble(activeSpot));
    };
    window.addEventListener('resize', refit, { passive: true });
    window.visualViewport?.addEventListener('resize', refit, { passive: true });

    if (secret) {
      const messages = [
        'Even then, I was building systems.',
        'Future LifeLogger in the making.',
        'Everything starts with a blank page.',
        'Tiny José, huge plans.',
        'Drafting v0.1 of my life-OS.'
      ];
      secret.textContent = messages[new Date().getDate() % messages.length];
      wrapper.addEventListener('dblclick', (event) => {
        if (event.target.closest?.('.person-hotspot')) return;
        secret.dataset.visible = secret.dataset.visible === '1' ? '0' : '1';
      });
    }
  });
})();
