(() => {
  if (typeof document === 'undefined') return;

  const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');

  document.querySelectorAll('[data-family-photo]').forEach((wrapper) => {
    const tag = wrapper.querySelector('.person-name-tag');
    const spots = wrapper.querySelectorAll('.person-hotspot');
    if (!tag) return;

    let timer = 0;
    let activeSpot = null;
    let pointerX = 0;
    let pointerY = 0;
    let fitFrame = 0;

    const hideTag = () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(fitFrame);
      activeSpot = null;
      tag.dataset.visible = '0';
      tag.setAttribute('aria-hidden', 'true');
      tag.style.setProperty('--label-shift-x', '0px');
      tag.style.setProperty('--label-shift-y', '0px');
    };

    const placeTag = () => {
      const wrapperRect = wrapper.getBoundingClientRect();
      tag.style.left = `${pointerX - wrapperRect.left}px`;
      tag.style.top = `${pointerY - wrapperRect.top}px`;
      tag.style.setProperty('--label-shift-x', '0px');
      tag.style.setProperty('--label-shift-y', '0px');

      cancelAnimationFrame(fitFrame);
      fitFrame = requestAnimationFrame(() => {
        const tagRect = tag.getBoundingClientRect();
        const safe = 7;
        let shiftX = 0;
        let shiftY = 0;

        if (tagRect.left < wrapperRect.left + safe) {
          shiftX += wrapperRect.left + safe - tagRect.left;
        } else if (tagRect.right > wrapperRect.right - safe) {
          shiftX -= tagRect.right - (wrapperRect.right - safe);
        }

        if (tagRect.bottom > wrapperRect.bottom - safe) {
          shiftY -= tagRect.bottom - (wrapperRect.bottom - safe);
        }

        tag.style.setProperty('--label-shift-x', `${shiftX}px`);
        tag.style.setProperty('--label-shift-y', `${shiftY}px`);
      });
    };

    spots.forEach((spot) => {
      spot.addEventListener('pointerenter', (event) => {
        if (!hoverCapable.matches) return;

        window.clearTimeout(timer);
        activeSpot = spot;
        pointerX = event.clientX;
        pointerY = event.clientY;
        tag.textContent = spot.dataset.label || spot.dataset.person || '';
        placeTag();

        timer = window.setTimeout(() => {
          if (activeSpot !== spot) return;
          placeTag();
          tag.dataset.visible = '1';
          tag.setAttribute('aria-hidden', 'false');
        }, 700);
      });

      spot.addEventListener('pointermove', (event) => {
        if (activeSpot !== spot || !hoverCapable.matches) return;
        pointerX = event.clientX;
        pointerY = event.clientY;
        if (tag.dataset.visible === '1') placeTag();
      });

      spot.addEventListener('pointerleave', () => {
        if (activeSpot === spot) hideTag();
      });

      spot.addEventListener('pointerdown', hideTag);
      spot.addEventListener('blur', hideTag);
    });

    wrapper.addEventListener('mouseleave', hideTag);
  });
})();
