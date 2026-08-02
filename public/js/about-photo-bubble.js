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
    let hintTimer = 0;

    const touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)');
    const portraitQuery = window.matchMedia('(orientation: portrait)');

    const hint = document.createElement('div');
    hint.className = 'about-photo-mobile-hint';
    hint.setAttribute('role', 'note');
    hint.innerHTML = '<span class="about-photo-mobile-hint-icon" aria-hidden="true">💭</span><span class="about-photo-mobile-hint-copy"></span>';
    wrapper.insertAdjacentElement('afterend', hint);

    const hintCopy = hint.querySelector('.about-photo-mobile-hint-copy');

    const updateHint = () => {
      if (!hintCopy) return;
      hintCopy.textContent = portraitQuery.matches
        ? "Tap someone to see what they're thinking — rotate your phone sideways for a better view."
        : "Tap someone to see what they're thinking.";
    };

    updateHint();

    const shouldNudgeHint = () => touchQuery.matches && portraitQuery.matches;

    const nudgeHint = () => {
      if (!shouldNudgeHint()) return;
      window.clearTimeout(hintTimer);
      hint.dataset.nudge = '1';
      hintTimer = window.setTimeout(() => {
        hint.dataset.nudge = '0';
      }, 650);
    };

    const parsePercent = (value, fallback) => {
      const parsed = Number.parseFloat(value || '');
      return Number.isFinite(parsed) ? parsed / 100 : fallback;
    };

    const placementBounds = (placement, anchorY, bubbleHeight, extraTop, extraBottom) => {
      if (placement === 'below') {
        return {
          top: anchorY + 15 - extraTop,
          bottom: anchorY + 15 + bubbleHeight + extraBottom,
        };
      }

      return {
        top: anchorY - 15 - bubbleHeight - extraTop,
        bottom: anchorY - 15 + extraBottom,
      };
    };

    const overflowAmount = (bounds, safeTop, safeBottom) =>
      Math.max(0, safeTop - bounds.top) + Math.max(0, bounds.bottom - safeBottom);

    const fitTouchBubble = (spot) => {
      if (!spot) return;

      const preferredPlacement = spot.dataset.placement || 'above';
      bubble.style.left = spot.dataset.bubbleLeft || '50%';
      bubble.style.top = spot.dataset.bubbleTop || '50%';
      bubble.dataset.placement = preferredPlacement;
      bubble.style.setProperty('--mobile-shift', '0px');

      if (!touchQuery.matches) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const bubbleWidth = bubble.offsetWidth;
      const bubbleHeight = bubble.offsetHeight;
      if (!wrapperRect.width || !wrapperRect.height || !bubbleWidth || !bubbleHeight) return;

      const leftRatio = parsePercent(spot.dataset.bubbleLeft, 0.5);
      const topRatio = parsePercent(spot.dataset.bubbleTop, 0.5);
      const desiredCenter = wrapperRect.width * leftRatio;
      const desiredAnchorY = wrapperRect.height * topRatio;
      const corner = spot.dataset.corner || '';
      const hasAdornment = Boolean(spot.dataset.adornment);
      const edgePad = 10;

      let extraLeft = 10;
      let extraRight = 10;
      let extraTop = 8;
      let extraBottom = 8;

      if (hasAdornment) {
        if (corner === 'bottom-left') {
          extraLeft += bubbleWidth * 0.19;
          extraBottom += bubbleHeight * 0.16;
        } else if (corner === 'top-left') {
          extraLeft += bubbleWidth * 0.05;
          extraTop += bubbleHeight * 0.18;
        } else if (corner === 'top-right') {
          extraRight += bubbleWidth * 0.13;
          extraTop += bubbleHeight * 0.24;
        } else if (corner === 'bottom-right') {
          extraRight += bubbleWidth * 0.13;
          extraBottom += bubbleHeight * 0.2;
        }
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

      const horizontalShift = fittedCenter - desiredCenter;
      bubble.style.left = `${fittedCenter}px`;
      bubble.style.setProperty('--mobile-shift', `${horizontalShift}px`);

      const safeTop = 8;
      const safeBottom = wrapperRect.height - 8;
      const alternatePlacement = preferredPlacement === 'above' ? 'below' : 'above';
      const preferredBounds = placementBounds(
        preferredPlacement,
        desiredAnchorY,
        bubbleHeight,
        extraTop,
        extraBottom
      );
      const alternateBounds = placementBounds(
        alternatePlacement,
        desiredAnchorY,
        bubbleHeight,
        extraTop,
        extraBottom
      );

      const preferredOverflow = overflowAmount(preferredBounds, safeTop, safeBottom);
      const alternateOverflow = overflowAmount(alternateBounds, safeTop, safeBottom);
      const chosenPlacement = alternateOverflow < preferredOverflow
        ? alternatePlacement
        : preferredPlacement;

      bubble.dataset.placement = chosenPlacement;

      let fittedAnchorY = desiredAnchorY;
      const chosenBounds = placementBounds(
        chosenPlacement,
        fittedAnchorY,
        bubbleHeight,
        extraTop,
        extraBottom
      );

      if (chosenBounds.top < safeTop) {
        fittedAnchorY += safeTop - chosenBounds.top;
      }

      const shiftedBounds = placementBounds(
        chosenPlacement,
        fittedAnchorY,
        bubbleHeight,
        extraTop,
        extraBottom
      );

      if (shiftedBounds.bottom > safeBottom) {
        fittedAnchorY -= shiftedBounds.bottom - safeBottom;
      }

      bubble.style.top = `${fittedAnchorY}px`;
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

      fitTouchBubble(spot);
      bubble.dataset.visible = '1';
      bubble.setAttribute('aria-hidden', 'false');

      frame = requestAnimationFrame(() => {
        fitTouchBubble(spot);
        if (src) bubble.dataset.hasAdornment = '1';
      });

      settleTimer = window.setTimeout(() => fitTouchBubble(spot), 720);
    };

    img.addEventListener('load', () => {
      if (!activeSpot) return;
      requestAnimationFrame(() => fitTouchBubble(activeSpot));
    });

    spots.forEach((spot) => {
      spot.addEventListener('pointerenter', () => {
        if (!pinned) show(spot);
      });

      spot.addEventListener('pointerleave', () => {
        if (!pinned && document.activeElement !== spot) hide();
      });

      spot.addEventListener('focus', () => {
        if (!pinned) show(spot);
      });

      spot.addEventListener('blur', () => {
        if (!pinned) hide();
      });

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
      nudgeHint();
    });

    const refit = () => {
      updateHint();
      if (!activeSpot) return;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => fitTouchBubble(activeSpot));
    };

    window.addEventListener('resize', refit, { passive: true });
    window.visualViewport?.addEventListener('resize', refit, { passive: true });
    portraitQuery.addEventListener?.('change', refit);
    touchQuery.addEventListener?.('change', updateHint);

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
