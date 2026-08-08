(() => {
  if (typeof document === 'undefined') return;

  document.querySelectorAll('[data-about-photo-feature]').forEach((feature) => {
    const toggle = feature.querySelector('[data-where-toggle]');
    const panel = feature.querySelector('[data-where-panel]');
    const close = feature.querySelector('[data-where-close]');
    if (!toggle || !panel) return;

    const dad = panel.querySelector('[aria-labelledby="family-roots-dad-title"]');
    const mom = panel.querySelector('[aria-labelledby="family-roots-mom-title"]');
    const dadRoute = dad?.querySelector('.about-photo-roots-branch-route');
    const momRoute = mom?.querySelector('.about-photo-roots-branch-route');

    if (dadRoute) dadRoute.textContent = 'Amarillas de Esparza, Asientos, Aguascalientes, México';
    if (momRoute) momRoute.textContent = 'Colonia Progreso, Matamoros, Tamaulipas, México';

    const rootsDetails = [
      [dad, {
        galleryTitle: 'Life in Amarillas',
        gallerySubtitle: 'Family photographs and scenes from Amarillas de Esparza will live here.',
        places: [
          {
            url: 'https://es.wikipedia.org/wiki/M%C3%A9xico',
            source: 'wiki',
          },
          {
            url: 'https://es.wikipedia.org/wiki/Aguascalientes',
            source: 'wiki',
            population: 'POP. 1,425,607 · 2020 CENSUS',
            populationTitle: 'State population, 2020 Census.',
          },
          {
            url: 'https://es.wikipedia.org/wiki/Municipio_de_Asientos',
            source: 'wiki',
            population: 'POP. 51,536 · 2020 CENSUS',
            populationTitle: 'Municipality population, 2020 Census.',
          },
          {
            url: 'https://mexico.pueblosamerica.com/i/amarillas-de-esparza-amarillas/',
            source: 'external',
            population: 'POP. 826 · 2020 CENSUS',
            populationTitle: 'Locality population, 2020 Census data reported from INEGI.',
          },
        ],
        slides: [
          ['Charreada', 'Local traditions and the scenes around them.'],
          ['Chapel', 'The chapel and landmarks that give the town its sense of place.'],
          ['Grandparents’ store', 'A family place directly tied to Dad’s side.'],
        ],
      }],
      [mom, {
        galleryTitle: 'Life in Colonia Progreso',
        gallerySubtitle: 'Family photographs and neighborhood scenes from Matamoros will live here.',
        places: [
          {
            url: 'https://es.wikipedia.org/wiki/M%C3%A9xico',
            source: 'wiki',
          },
          {
            url: 'https://es.wikipedia.org/wiki/Tamaulipas',
            source: 'wiki',
            population: 'POP. 3,527,735 · 2020 CENSUS',
            populationTitle: 'State population, 2020 Census.',
          },
          {
            url: 'https://es.wikipedia.org/wiki/Heroica_Matamoros',
            source: 'wiki',
            population: 'POP. 510,739 · 2020 CENSUS',
            populationTitle: 'Heroica Matamoros city population, 2020 Census.',
          },
          {
            url: 'https://www.marketdatamexico.com/es/article/Perfil-sociodemografico-Colonia-Progreso-Matamoros-Tamaulipas',
            source: 'external',
            population: '≈251 RESIDENTS · EST.',
            populationTitle: 'Neighborhood estimate based on INEGI data; not presented as a census-locality total.',
          },
        ],
        slides: [
          ['Neighborhood', 'Street scenes and the physical setting Mom knew.'],
          ['Family home', 'The home and nearby places connected to Mom’s family.'],
          ['Family memory', 'Photographs that connect the neighborhood to the people who lived there.'],
        ],
      }],
    ];

    const setupGallery = (branch, details) => {
      const list = branch?.querySelector('.about-photo-where-steps');
      if (!branch || !list || branch.querySelector('[data-roots-gallery]')) return;

      const steps = Array.from(list.children).filter((child) => child.classList.contains('about-photo-where-step'));

      steps.slice(0, 4).forEach((step, index) => {
        const place = details.places[index];
        const name = step.querySelector('.about-photo-where-name');
        if (!place || !name) return;

        const visibleName = name.textContent.trim();
        const link = document.createElement('a');
        link.className = 'about-photo-where-place-link';
        link.href = place.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.title = place.source === 'wiki'
          ? `Read about ${visibleName} on Wikipedia`
          : `Learn more about ${visibleName}`;
        link.textContent = visibleName;

        const source = document.createElement('span');
        source.className = 'about-photo-place-source';
        source.dataset.source = place.source;
        source.setAttribute('aria-hidden', 'true');
        source.textContent = place.source === 'wiki' ? 'W' : '↗';
        link.appendChild(source);
        name.replaceChildren(link);

        if (place.population) {
          const population = document.createElement('span');
          population.className = 'about-photo-where-population';
          population.textContent = place.population;
          if (place.populationTitle) population.title = place.populationTitle;
          name.insertAdjacentElement('afterend', population);
        }
      });

      if (steps.length > 4) steps.slice(4).forEach((step) => step.remove());

      const gallery = document.createElement('section');
      gallery.className = 'about-photo-roots-gallery';
      gallery.dataset.rootsGallery = '';
      gallery.setAttribute('aria-label', `${details.galleryTitle} photo gallery`);

      const galleryHead = document.createElement('div');
      galleryHead.className = 'about-photo-roots-gallery-head';

      const galleryCopy = document.createElement('div');
      const kicker = document.createElement('span');
      kicker.className = 'about-photo-roots-gallery-kicker';
      kicker.textContent = 'The place beyond the map';
      const title = document.createElement('h4');
      title.className = 'about-photo-roots-gallery-title';
      title.textContent = details.galleryTitle;
      const subtitle = document.createElement('p');
      subtitle.className = 'about-photo-roots-gallery-subtitle';
      subtitle.textContent = details.gallerySubtitle;
      galleryCopy.append(kicker, title, subtitle);

      const playToggle = document.createElement('button');
      playToggle.className = 'about-photo-roots-gallery-toggle';
      playToggle.type = 'button';
      playToggle.dataset.galleryToggle = '';
      playToggle.textContent = '⏸ Pause';
      playToggle.setAttribute('aria-label', `Pause ${details.galleryTitle} slideshow`);
      galleryHead.append(galleryCopy, playToggle);

      const viewport = document.createElement('div');
      viewport.className = 'about-photo-roots-gallery-viewport';
      viewport.dataset.galleryViewport = '';
      viewport.tabIndex = 0;
      viewport.setAttribute('role', 'group');
      viewport.setAttribute('aria-label', `${details.galleryTitle} slides; use left and right arrow keys to browse`);

      const track = document.createElement('div');
      track.className = 'about-photo-roots-gallery-track';
      track.dataset.galleryTrack = '';

      details.slides.forEach(([slideTitle, slideCopy], index) => {
        const slide = document.createElement('article');
        slide.className = 'about-photo-roots-gallery-slide';
        slide.dataset.gallerySlide = String(index);
        slide.setAttribute('aria-hidden', index === 0 ? 'false' : 'true');

        const caption = document.createElement('div');
        caption.className = 'about-photo-roots-gallery-caption';
        const strong = document.createElement('strong');
        strong.textContent = slideTitle;
        const copy = document.createElement('span');
        copy.textContent = slideCopy;
        caption.append(strong, copy);
        slide.appendChild(caption);
        track.appendChild(slide);
      });

      const previous = document.createElement('button');
      previous.className = 'about-photo-roots-gallery-arrow';
      previous.type = 'button';
      previous.dataset.galleryPrev = '';
      previous.setAttribute('aria-label', `Previous ${details.galleryTitle} photo`);
      previous.textContent = '‹';

      const next = document.createElement('button');
      next.className = 'about-photo-roots-gallery-arrow';
      next.type = 'button';
      next.dataset.galleryNext = '';
      next.setAttribute('aria-label', `Next ${details.galleryTitle} photo`);
      next.textContent = '›';

      viewport.append(track, previous, next);

      const foot = document.createElement('div');
      foot.className = 'about-photo-roots-gallery-foot';
      const status = document.createElement('span');
      status.className = 'about-photo-roots-gallery-status';
      status.dataset.galleryStatus = '';
      status.setAttribute('aria-live', 'polite');

      const dots = document.createElement('div');
      dots.className = 'about-photo-roots-gallery-dots';
      details.slides.forEach(([slideTitle], index) => {
        const dot = document.createElement('button');
        dot.className = 'about-photo-roots-gallery-dot';
        dot.type = 'button';
        dot.dataset.galleryDot = String(index);
        dot.setAttribute('aria-label', `Show ${slideTitle}`);
        dot.setAttribute('aria-current', index === 0 ? 'true' : 'false');
        dots.appendChild(dot);
      });
      foot.append(status, dots);
      gallery.append(galleryHead, viewport, foot);
      branch.appendChild(gallery);

      const slides = Array.from(track.children);
      const dotButtons = Array.from(dots.children);
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
      let index = 0;
      let timer = 0;
      let userPaused = false;
      let inView = false;
      let pointerStart = null;

      const updateToggle = () => {
        const paused = userPaused || reducedMotion.matches;
        playToggle.textContent = paused ? '▶ Play' : '⏸ Pause';
        playToggle.setAttribute(
          'aria-label',
          `${paused ? 'Play' : 'Pause'} ${details.galleryTitle} slideshow`
        );
      };

      const stopTimer = () => {
        window.clearTimeout(timer);
        timer = 0;
      };

      const schedule = () => {
        stopTimer();
        if (userPaused || reducedMotion.matches || document.hidden || !inView || slides.length < 2) return;
        timer = window.setTimeout(() => {
          showSlide(index + 1);
        }, 6000);
      };

      const showSlide = (requested, { manual = false } = {}) => {
        if (!slides.length) return;
        index = (requested + slides.length) % slides.length;
        track.style.transform = `translateX(-${index * 100}%)`;
        slides.forEach((slide, slideIndex) => {
          slide.setAttribute('aria-hidden', slideIndex === index ? 'false' : 'true');
        });
        dotButtons.forEach((dot, dotIndex) => {
          dot.setAttribute('aria-current', dotIndex === index ? 'true' : 'false');
        });
        status.textContent = `${index + 1} / ${slides.length} · ${details.slides[index][0]}`;

        if (manual) {
          userPaused = true;
          updateToggle();
        }
        schedule();
      };

      previous.addEventListener('click', () => showSlide(index - 1, { manual: true }));
      next.addEventListener('click', () => showSlide(index + 1, { manual: true }));
      dotButtons.forEach((dot, dotIndex) => {
        dot.addEventListener('click', () => showSlide(dotIndex, { manual: true }));
      });

      playToggle.addEventListener('click', () => {
        userPaused = !userPaused;
        updateToggle();
        schedule();
      });

      viewport.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          showSlide(index - 1, { manual: true });
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          showSlide(index + 1, { manual: true });
        }
      });

      viewport.addEventListener('pointerdown', (event) => {
        pointerStart = event.clientX;
      }, { passive: true });

      viewport.addEventListener('pointerup', (event) => {
        if (pointerStart === null) return;
        const delta = event.clientX - pointerStart;
        pointerStart = null;
        if (Math.abs(delta) < 45) return;
        showSlide(index + (delta < 0 ? 1 : -1), { manual: true });
      }, { passive: true });

      viewport.addEventListener('pointercancel', () => {
        pointerStart = null;
      }, { passive: true });

      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          inView = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= 0.35);
          schedule();
        }, { threshold: [0, 0.35, 0.7] });
        observer.observe(gallery);
      } else {
        inView = true;
      }

      document.addEventListener('visibilitychange', schedule);
      reducedMotion.addEventListener?.('change', () => {
        updateToggle();
        schedule();
      });

      updateToggle();
      showSlide(0);
    };

    rootsDetails.forEach(([branch, details]) => setupGallery(branch, details));

    const googleMaps = [
      [dad, [
        {
          title: 'Interactive Google Map showing Dad’s Aguascalientes roots within México',
          query: 'Aguascalientes, Mexico',
          zoom: 5,
        },
        {
          title: 'Interactive Google Map of the State of Aguascalientes, México',
          query: 'Estado de Aguascalientes, México',
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
          title: 'Interactive Google Map showing Tamaulipas within northeastern México',
          query: 'Tamaulipas, Mexico',
          zoom: 5,
        },
        {
          title: 'Interactive Google Map outlining the State of Tamaulipas, México',
          query: 'Tamaulipas, Mexico',
          zoom: 7,
        },
        {
          title: 'Interactive Google Map of Heroica Matamoros, Tamaulipas, México',
          query: 'Heroica Matamoros, Tamaulipas, Mexico',
          zoom: 10,
        },
        {
          title: 'Interactive Google Map of Progreso, 87440 Matamoros, Tamaulipas, México',
          query: 'Progreso, 87440 Matamoros, Tamaulipas, Mexico',
          zoom: 16,
        },
      ]],
    ];

    const buildGoogleMapUrl = (query, zoom) =>
      `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=${zoom}&output=embed`;

    let mapsInitialized = false;
    const initializeGoogleMaps = () => {
      if (mapsInitialized) return;
      mapsInitialized = true;

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
          const src = buildGoogleMapUrl(map.query, map.zoom);
          frame.className = 'about-photo-map-frame';
          frame.src = src;
          frame.dataset.mapSrc = src;
          frame.title = map.title;
          frame.loading = 'lazy';
          frame.referrerPolicy = 'no-referrer-when-downgrade';
          frame.setAttribute('allowfullscreen', '');
          slot.appendChild(frame);
        });
      });
    };

    /*
      Mobile browsers can restore this page from the back/forward cache after the
      Google Maps link inside an embed opens the Maps app/page. Cross-origin
      iframes are sometimes restored as blank rectangles. Rebuild the map srcs
      only after the page itself has actually been hidden, so ordinary panning
      and zooming inside an embed are left alone.
    */
    let mapsNeedRestore = false;
    let restoreTimer = 0;

    const activeElementIsMap = () =>
      document.activeElement instanceof HTMLIFrameElement &&
      document.activeElement.classList.contains('about-photo-map-frame');

    const restoreMapFrames = () => {
      if (!mapsNeedRestore) return;
      mapsNeedRestore = false;
      window.clearTimeout(restoreTimer);

      const frames = panel.querySelectorAll('.about-photo-map-frame[data-map-src]');
      frames.forEach((frame) => {
        const src = frame.dataset.mapSrc;
        if (!src) return;
        frame.setAttribute('src', 'about:blank');
        window.requestAnimationFrame(() => frame.setAttribute('src', src));
      });
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        if (activeElementIsMap()) mapsNeedRestore = true;
        return;
      }

      if (mapsNeedRestore) {
        restoreTimer = window.setTimeout(restoreMapFrames, 120);
      }
    });

    window.addEventListener('pagehide', () => {
      if (activeElementIsMap()) mapsNeedRestore = true;
    });

    window.addEventListener('pageshow', (event) => {
      if (event.persisted && mapsNeedRestore) {
        restoreTimer = window.setTimeout(restoreMapFrames, 120);
      }
    });

    panel.querySelector('.about-photo-map-credit')?.remove();

    const head = panel.querySelector('.about-photo-where-head');
    if (head && !head.querySelector('.about-photo-mexico-mark')) {
      const mark = document.createElement('div');
      mark.className = 'about-photo-mexico-mark';
      mark.setAttribute('aria-label', 'México');

      const outline = document.createElement('img');
      outline.className = 'about-photo-mexico-outline';
      outline.src = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Mexico_geoloc_blank.svg?width=180';
      outline.alt = 'Outline map of México';
      outline.loading = 'lazy';
      outline.decoding = 'async';

      const flag = document.createElement('img');
      flag.className = 'about-photo-mexico-flag';
      flag.src = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Flag_of_Mexico.svg?width=120';
      flag.alt = 'Flag of México';
      flag.loading = 'lazy';
      flag.decoding = 'async';

      mark.append(outline, flag);
      head.insertBefore(mark, close);
    }

    const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)');
    const desktopRoots = window.matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
    const mobileBranchView = window.matchMedia('(max-width: 768px)');
    let touchGuardTimer = 0;
    let activeBranch = 'dad';
    let branchTabs = null;
    let branchButtons = [];

    if (dad && mom && head) {
      dad.id = dad.id || 'family-roots-dad-panel';
      mom.id = mom.id || 'family-roots-mom-panel';

      branchTabs = document.createElement('div');
      branchTabs.className = 'about-photo-roots-tabs';
      branchTabs.dataset.rootsTabs = '';
      branchTabs.setAttribute('role', 'tablist');
      branchTabs.setAttribute('aria-label', 'Choose a family branch');

      [
        ['dad', 'Dad’s side', dad],
        ['mom', 'Mom’s side', mom],
      ].forEach(([key, label, branch]) => {
        const button = document.createElement('button');
        button.className = 'about-photo-roots-tab';
        button.type = 'button';
        button.dataset.rootsTab = key;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', branch.id);
        button.textContent = label;
        branchTabs.appendChild(button);
        branchButtons.push(button);
      });

      head.insertAdjacentElement('afterend', branchTabs);
    }

    const syncBranchView = ({ focus = false } = {}) => {
      if (!dad || !mom || !branchTabs) return;

      const mobile = mobileBranchView.matches;
      branchTabs.hidden = !mobile;

      [['dad', dad], ['mom', mom]].forEach(([key, branch]) => {
        const selected = key === activeBranch;
        branch.hidden = mobile && !selected;
        branch.setAttribute('aria-hidden', mobile && !selected ? 'true' : 'false');
      });

      branchButtons.forEach((button) => {
        const selected = button.dataset.rootsTab === activeBranch;
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
        button.tabIndex = selected ? 0 : -1;
        if (focus && selected) button.focus({ preventScroll: true });
      });
    };

    branchButtons.forEach((button, index) => {
      button.addEventListener('click', () => {
        activeBranch = button.dataset.rootsTab || 'dad';
        syncBranchView();
      });

      button.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();

        let nextIndex = index;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + branchButtons.length) % branchButtons.length;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % branchButtons.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = branchButtons.length - 1;

        activeBranch = branchButtons[nextIndex].dataset.rootsTab || 'dad';
        syncBranchView({ focus: true });
      });
    });

    if (typeof mobileBranchView.addEventListener === 'function') {
      mobileBranchView.addEventListener('change', () => syncBranchView());
    } else {
      mobileBranchView.addListener(() => syncBranchView());
    }

    syncBranchView();

    const releaseTouchGuard = () => {
      window.clearTimeout(touchGuardTimer);
      delete panel.dataset.touchGuard;
    };

    const guardMapsFromOpeningTap = () => {
      if (!coarsePointer.matches) return;
      window.clearTimeout(touchGuardTimer);
      panel.dataset.touchGuard = '1';
      touchGuardTimer = window.setTimeout(releaseTouchGuard, 650);
    };

    const setOpen = (open, { returnFocus = false } = {}) => {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      panel.dataset.open = open ? '1' : '0';

      if (open) {
        panel.setAttribute('aria-hidden', 'false');
        guardMapsFromOpeningTap();
        initializeGoogleMaps();
        syncBranchView();
      } else {
        releaseTouchGuard();
        panel.setAttribute('aria-hidden', 'true');
        if (returnFocus) toggle.focus({ preventScroll: true });
      }
    };

    toggle.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') event.stopPropagation();
    });

    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(panel.hidden);
    });

    close?.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch') event.stopPropagation();
    });

    close?.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false, { returnFocus: true });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || panel.hidden) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false, { returnFocus: true });
    }, true);

    /* Keep both controls available even though desktop opens the section initially. */
    toggle.hidden = false;
    if (close) close.hidden = false;
    delete panel.dataset.permanent;

    /* Desktop starts open but remains collapsible; touch/mobile starts closed. */
    setOpen(desktopRoots.matches);
  });
})();
