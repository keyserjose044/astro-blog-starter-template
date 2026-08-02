(() => {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('[data-family-photo]').forEach((wrapper) => {
    const bubble = wrapper.querySelector('.speech-bubble');
    const copy = bubble?.querySelector('p');
    const img = bubble?.querySelector('.cloud-adornment');
    const spots = wrapper.querySelectorAll('.person-hotspot');
    const secret = wrapper.querySelector('.secret-bubble');
    const block = wrapper.closest('.about-photo-block');
    const photo = wrapper.querySelector('.about-photo-img');
    if (!bubble || !copy || !img || !block || !photo) return;

    let pinned = null;
    let activeSpot = null;
    let frame = 0;
    let settleTimer = 0;
    let resizeFrame = 0;
    let explorerResizeFrame = 0;
    let previousBodyOverflow = '';
    const mobileQuery = window.matchMedia('(max-width: 640px)');

    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'about-photo-mobile-hint';
    hint.setAttribute('aria-expanded', 'false');
    hint.setAttribute('aria-label', 'Open the interactive family portrait');
    hint.innerHTML = '<span aria-hidden="true">💭</span><span>Tap the photo to see what\'s going on in their heads.</span>';
    wrapper.insertAdjacentElement('afterend', hint);

    const stage = document.createElement('div');
    stage.className = 'about-photo-explorer-stage';
    stage.dataset.visible = '0';
    stage.dataset.virtualRotation = '0';
    stage.setAttribute('aria-hidden', 'true');
    stage.setAttribute('role', 'dialog');
    stage.setAttribute('aria-modal', 'true');
    stage.setAttribute('aria-label', 'Interactive family portrait');

    const canvas = document.createElement('div');
    canvas.className = 'about-photo-explorer-canvas';

    const exitButton = document.createElement('button');
    exitButton.type = 'button';
    exitButton.className = 'about-photo-explorer-exit';
    exitButton.innerHTML = '<span aria-hidden="true">×</span><span>Exit</span>';
    exitButton.setAttribute('aria-label', 'Exit interactive family portrait');

    canvas.append(exitButton);
    stage.append(canvas);
    document.body.append(stage);

    const originParent = wrapper.parentNode;
    const originNextSibling = hint;

    const isExplorerOpen = () => wrapper.dataset.mobileExplorer === '1';

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

    const fitMobileBubble = (spot) => {
      if (!spot) return;

      const preferredPlacement = spot.dataset.placement || 'above';
      bubble.style.left = spot.dataset.bubbleLeft || '50%';
      bubble.style.top = spot.dataset.bubbleTop || '50%';
      bubble.dataset.placement = preferredPlacement;
      bubble.style.setProperty('--mobile-shift', '0px');

      if (!mobileQuery.matches && !isExplorerOpen()) return;

      const wrapperRect = wrapper.getBoundingClientRect();
      const explorerOpen = isExplorerOpen();
      const logicalWidth = explorerOpen ? wrapper.clientWidth : wrapperRect.width;
      const logicalHeight = explorerOpen ? wrapper.clientHeight : wrapperRect.height;
      const bubbleWidth = bubble.offsetWidth;
      const bubbleHeight = bubble.offsetHeight;
      if (!logicalWidth || !logicalHeight || !bubbleWidth || !bubbleHeight) return;

      const leftRatio = parsePercent(spot.dataset.bubbleLeft, 0.5);
      const topRatio = parsePercent(spot.dataset.bubbleTop, 0.5);
      const desiredCenter = logicalWidth * leftRatio;
      const desiredAnchorY = logicalHeight * topRatio;
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

      let minCenter;
      let maxCenter;

      if (explorerOpen) {
        minCenter = edgePad + bubbleWidth / 2 + extraLeft;
        maxCenter = logicalWidth - edgePad - bubbleWidth / 2 - extraRight;
      } else {
        const viewportMin = edgePad - wrapperRect.left + bubbleWidth / 2 + extraLeft;
        const viewportMax = window.innerWidth - edgePad - wrapperRect.left - bubbleWidth / 2 - extraRight;
        const wrapperMin = bubbleWidth / 2 + extraLeft;
        const wrapperMax = logicalWidth - bubbleWidth / 2 - extraRight;
        minCenter = Math.max(viewportMin, wrapperMin);
        maxCenter = Math.min(viewportMax, wrapperMax);
      }

      const fittedCenter = minCenter <= maxCenter
        ? Math.min(maxCenter, Math.max(minCenter, desiredCenter))
        : logicalWidth / 2;

      const horizontalShift = fittedCenter - desiredCenter;
      bubble.style.left = `${fittedCenter}px`;
      bubble.style.setProperty('--mobile-shift', `${horizontalShift}px`);

      const safeTop = 8;
      const safeBottom = logicalHeight - 8;
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

      fitMobileBubble(spot);
      bubble.dataset.visible = '1';
      bubble.setAttribute('aria-hidden', 'false');

      frame = requestAnimationFrame(() => {
        fitMobileBubble(spot);
        if (src) bubble.dataset.hasAdornment = '1';
      });

      settleTimer = window.setTimeout(() => fitMobileBubble(spot), 720);
    };

    const layoutExplorer = () => {
      if (!isExplorerOpen()) return;
      cancelAnimationFrame(explorerResizeFrame);
      explorerResizeFrame = requestAnimationFrame(() => {
        const viewportWidth = window.visualViewport?.width || window.innerWidth;
        const viewportHeight = window.visualViewport?.height || window.innerHeight;
        const rotateVirtually = viewportHeight >= viewportWidth;
        const surfaceWidth = rotateVirtually ? viewportHeight : viewportWidth;
        const surfaceHeight = rotateVirtually ? viewportWidth : viewportHeight;
        const ratio = photo.naturalWidth && photo.naturalHeight
          ? photo.naturalWidth / photo.naturalHeight
          : 985 / 551;

        stage.dataset.virtualRotation = rotateVirtually ? '1' : '0';
        stage.style.setProperty('--explorer-surface-width', `${surfaceWidth}px`);
        stage.style.setProperty('--explorer-surface-height', `${surfaceHeight}px`);

        const availableWidth = Math.max(300, surfaceWidth - 24);
        const availableHeight = Math.max(180, surfaceHeight - 60);
        const logicalWidth = Math.min(availableWidth, availableHeight * ratio);
        wrapper.style.setProperty('--explorer-width', `${Math.max(300, logicalWidth)}px`);

        requestAnimationFrame(() => {
          if (activeSpot) fitMobileBubble(activeSpot);
        });
      });
    };

    const openExplorer = () => {
      if (!mobileQuery.matches || isExplorerOpen()) return;

      pinned = null;
      hide();
      wrapper.dataset.mobileExplorer = '1';
      hint.setAttribute('aria-expanded', 'true');
      stage.dataset.visible = '1';
      stage.setAttribute('aria-hidden', 'false');
      previousBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.body.classList.add('about-photo-explorer-open');
      canvas.append(wrapper);
      layoutExplorer();

      requestAnimationFrame(() => {
        exitButton.focus({ preventScroll: true });
      });
    };

    const closeExplorer = () => {
      if (!isExplorerOpen()) return;

      pinned = null;
      hide();
      wrapper.dataset.mobileExplorer = '0';
      wrapper.style.removeProperty('--explorer-width');
      stage.style.removeProperty('--explorer-surface-width');
      stage.style.removeProperty('--explorer-surface-height');
      stage.dataset.virtualRotation = '0';
      hint.setAttribute('aria-expanded', 'false');
      stage.dataset.visible = '0';
      stage.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = previousBodyOverflow;
      document.body.classList.remove('about-photo-explorer-open');
      originParent.insertBefore(wrapper, originNextSibling);
      hint.focus({ preventScroll: true });
    };

    img.addEventListener('load', () => {
      if (!activeSpot) return;
      requestAnimationFrame(() => fitMobileBubble(activeSpot));
    });

    spots.forEach((spot) => {
      spot.addEventListener('pointerenter', () => {
        if (mobileQuery.matches && !isExplorerOpen()) return;
        if (!pinned) show(spot);
      });
      spot.addEventListener('pointerleave', () => {
        if (!pinned && document.activeElement !== spot) hide();
      });
      spot.addEventListener('focus', () => {
        if (mobileQuery.matches && !isExplorerOpen()) return;
        if (!pinned) show(spot);
      });
      spot.addEventListener('blur', () => {
        if (!pinned) hide();
      });
      spot.addEventListener('click', (event) => {
        event.stopPropagation();

        if (mobileQuery.matches && !isExplorerOpen()) {
          openExplorer();
          return;
        }

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
          if (isExplorerOpen()) {
            closeExplorer();
          } else {
            pinned = null;
            hide();
            spot.blur();
          }
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          spot.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      });
    });

    wrapper.addEventListener('click', (event) => {
      if (mobileQuery.matches && !isExplorerOpen()) {
        openExplorer();
        return;
      }
      if (event.target.closest?.('.person-hotspot')) return;
      pinned = null;
      hide();
    });

    hint.addEventListener('click', openExplorer);
    exitButton.addEventListener('click', closeExplorer);

    stage.addEventListener('click', (event) => {
      if (event.target !== stage && event.target !== canvas) return;
      if (bubble.dataset.visible === '1') {
        pinned = null;
        hide();
      }
    });

    const refit = () => {
      if (isExplorerOpen()) layoutExplorer();
      if (!activeSpot) return;
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => fitMobileBubble(activeSpot));
    };
    window.addEventListener('resize', refit, { passive: true });
    window.visualViewport?.addEventListener('resize', refit, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isExplorerOpen()) closeExplorer();
    });

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