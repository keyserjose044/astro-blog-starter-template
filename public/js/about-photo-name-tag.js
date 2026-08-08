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
        if (!hoverCapable.matches || wrapper.dataset.whosWho === '1') return;

        window.clearTimeout(timer);
        activeSpot = spot;
        pointerX = event.clientX;
        pointerY = event.clientY;
        tag.textContent = spot.dataset.label || spot.dataset.person || '';
        placeTag();

        timer = window.setTimeout(() => {
          if (activeSpot !== spot || wrapper.dataset.whosWho === '1') return;
          placeTag();
          tag.dataset.visible = '1';
          tag.setAttribute('aria-hidden', 'false');
        }, 700);
      });

      spot.addEventListener('pointermove', (event) => {
        if (activeSpot !== spot || !hoverCapable.matches || wrapper.dataset.whosWho === '1') return;
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
    wrapper.addEventListener('lifeloggerz:whoswho', hideTag);
  });
})();

/*
  Family Roots post-controller.
  The main Family Roots script builds the maps, branch tabs and two gallery
  instances. This layer consolidates those galleries into one shared third
  section and protects touch branch changes from falling through into a map.
*/
(() => {
  if (typeof document === 'undefined') return;

  const MOBILE_QUERY = '(max-width: 768px)';
  const COARSE_QUERY = '(hover: none), (pointer: coarse)';

  const setupFeature = (feature) => {
    if (!(feature instanceof HTMLElement)) return false;

    const panel = feature.querySelector('[data-where-panel]');
    const dad = panel?.querySelector('[aria-labelledby="family-roots-dad-title"]');
    const mom = panel?.querySelector('[aria-labelledby="family-roots-mom-title"]');
    const branchTabs = panel?.querySelector('[data-roots-tabs]');
    const dadGallery = dad?.querySelector('[data-roots-gallery]');
    const momGallery = mom?.querySelector('[data-roots-gallery]');

    if (
      !(panel instanceof HTMLElement) ||
      !(dad instanceof HTMLElement) ||
      !(mom instanceof HTMLElement) ||
      !(branchTabs instanceof HTMLElement) ||
      !(dadGallery instanceof HTMLElement) ||
      !(momGallery instanceof HTMLElement)
    ) return false;

    if (panel.dataset.sharedGalleryReady === '1') return true;
    panel.dataset.sharedGalleryReady = '1';

    const mobileQuery = window.matchMedia(MOBILE_QUERY);
    const coarseQuery = window.matchMedia(COARSE_QUERY);
    const topBranchButtons = Array.from(branchTabs.querySelectorAll('[data-roots-tab]'));

    let branchGuardTimer = 0;
    const guardBranchMaps = () => {
      if (!coarseQuery.matches) return;
      window.clearTimeout(branchGuardTimer);
      panel.dataset.branchTouchGuard = '1';
      branchGuardTimer = window.setTimeout(() => {
        delete panel.dataset.branchTouchGuard;
      }, 900);
    };

    /*
      Safari/Chrome mobile can retarget the same physical tap to an iframe that
      becomes visible after the branch layout changes. Start the guard at touch
      down, before the main branch-switch listener reveals the other map.
    */
    topBranchButtons.forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch' && !coarseQuery.matches) return;
        guardBranchMaps();
        event.stopPropagation();
      });

      button.addEventListener('touchstart', (event) => {
        guardBranchMaps();
        event.stopPropagation();
      }, { passive: true });

      button.addEventListener('click', (event) => {
        if (!coarseQuery.matches) return;
        guardBranchMaps();
        event.preventDefault();
        event.stopPropagation();
      });
    });

    dadGallery.dataset.galleryBranch = 'dad';
    momGallery.dataset.galleryBranch = 'mom';

    const stage = document.createElement('section');
    stage.className = 'about-photo-roots-gallery-stage';
    stage.dataset.sharedRootsGallery = '';
    stage.setAttribute('aria-labelledby', 'family-roots-gallery-stage-title');

    const stageHead = document.createElement('div');
    stageHead.className = 'about-photo-roots-gallery-stage-head';

    const stageCopy = document.createElement('div');
    const kicker = document.createElement('span');
    kicker.className = 'about-photo-roots-gallery-stage-kicker';
    kicker.textContent = 'The places beyond the maps';

    const heading = document.createElement('h3');
    heading.className = 'about-photo-roots-gallery-stage-title';
    heading.id = 'family-roots-gallery-stage-title';
    heading.textContent = 'Life in these places';

    const lead = document.createElement('p');
    lead.className = 'about-photo-roots-gallery-stage-lead';
    lead.textContent = 'Family photographs and scenes from the places behind both branches.';
    stageCopy.append(kicker, heading, lead);

    const galleryTabs = document.createElement('div');
    galleryTabs.className = 'about-photo-roots-gallery-stage-tabs';
    galleryTabs.setAttribute('role', 'tablist');
    galleryTabs.setAttribute('aria-label', 'Choose which family place to view');

    const galleryButtons = [];
    [
      ['dad', 'Dad’s side', dadGallery],
      ['mom', 'Mom’s side', momGallery],
    ].forEach(([key, label, gallery]) => {
      if (!gallery.id) gallery.id = `family-roots-${key}-gallery`;
      const button = document.createElement('button');
      button.className = 'about-photo-roots-gallery-stage-tab';
      button.type = 'button';
      button.dataset.sharedGalleryTab = key;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', gallery.id);
      button.textContent = label;
      galleryTabs.appendChild(button);
      galleryButtons.push(button);
    });

    stageHead.append(stageCopy, galleryTabs);
    stage.append(stageHead, dadGallery, momGallery);
    mom.insertAdjacentElement('afterend', stage);

    let activeGalleryBranch = 'dad';

    const setGalleryBranch = (key, { focus = false } = {}) => {
      if (key !== 'dad' && key !== 'mom') return;
      activeGalleryBranch = key;

      dadGallery.hidden = key !== 'dad';
      momGallery.hidden = key !== 'mom';
      dadGallery.setAttribute('aria-hidden', key === 'dad' ? 'false' : 'true');
      momGallery.setAttribute('aria-hidden', key === 'mom' ? 'false' : 'true');

      galleryButtons.forEach((button) => {
        const selected = button.dataset.sharedGalleryTab === key;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.tabIndex = selected ? 0 : -1;
        if (focus && selected) button.focus({ preventScroll: true });
      });
    };

    galleryButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        setGalleryBranch(button.dataset.sharedGalleryTab || 'dad');
      });

      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let nextIndex = index;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + galleryButtons.length) % galleryButtons.length;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % galleryButtons.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = galleryButtons.length - 1;
        setGalleryBranch(galleryButtons[nextIndex].dataset.sharedGalleryTab || 'dad', { focus: true });
      });
    });

    const selectedMobileBranch = () =>
      topBranchButtons.find((button) => button.getAttribute('aria-selected') === 'true')?.dataset.rootsTab || 'dad';

    const syncMobileGallery = () => {
      if (!mobileQuery.matches) return;
      setGalleryBranch(selectedMobileBranch());
    };

    const branchStateObserver = new MutationObserver(syncMobileGallery);
    topBranchButtons.forEach((button) => {
      branchStateObserver.observe(button, {
        attributes: true,
        attributeFilter: ['aria-selected'],
      });
    });

    const onViewportChange = () => {
      if (mobileQuery.matches) syncMobileGallery();
    };
    mobileQuery.addEventListener?.('change', onViewportChange);

    setGalleryBranch(mobileQuery.matches ? selectedMobileBranch() : activeGalleryBranch);
    return true;
  };

  const setupAll = () => {
    document.querySelectorAll('[data-about-photo-feature]').forEach((feature) => {
      if (setupFeature(feature)) return;

      const observer = new MutationObserver(() => {
        if (setupFeature(feature)) observer.disconnect();
      });
      observer.observe(feature, { childList: true, subtree: true });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupAll, { once: true });
  } else {
    setupAll();
  }

  document.addEventListener('astro:page-load', setupAll);
})();
