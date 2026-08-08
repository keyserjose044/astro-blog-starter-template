(() => {
  const MOBILE_QUERY = '(max-width: 1000px)';

  const iconFor = (label) => ({
    Home: '🏠',
    Blog: '✍️',
    Templates: '🧰',
    'Stats & Explore': '📊',
    Culture: '🎨',
    Build: '🛠️',
    About: '👤',
    FAQ: '❓',
  }[label] || '•');

  const openFamilyRootsFromHash = () => {
    if (window.location.hash !== '#family-roots') return;

    const feature = document.querySelector('[data-about-photo-feature]');
    const toggle = feature?.querySelector('[data-where-toggle]');
    if (!(feature instanceof HTMLElement)) return;

    if (!document.getElementById('family-roots')) feature.id = 'family-roots';
    if (toggle instanceof HTMLElement && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.requestAnimationFrame(() => {
      feature.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  };

  window.addEventListener('hashchange', openFamilyRootsFromHash);

  const setup = () => {
    const navToggle = document.querySelector('.mobile-nav .nav-toggle');
    if (!(navToggle instanceof HTMLDetailsElement) || navToggle.dataset.inlineNavReady === '1') {
      openFamilyRootsFromHash();
      return;
    }

    const panel = navToggle.querySelector('.menu-panel');
    const topDirect = panel?.querySelector('.mobile-direct-links:not(.mobile-direct-links-bottom)');
    const bottomDirect = panel?.querySelector('.mobile-direct-links-bottom');
    const footer = panel?.querySelector('.mobile-footer');
    const groups = panel ? Array.from(panel.querySelectorAll('.mobile-group')) : [];

    if (!(panel instanceof HTMLElement) || !(topDirect instanceof HTMLElement) || !(footer instanceof HTMLElement) || groups.length === 0) {
      openFamilyRootsFromHash();
      return;
    }

    const directLinks = Array.from(topDirect.querySelectorAll('a'));
    const faqLink = bottomDirect?.querySelector('a') || null;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const list = document.createElement('div');
    list.className = 'mobile-inline-list';
    list.setAttribute('aria-label', 'Main navigation');

    const decorateDirectLink = (source, label) => {
      const link = source.cloneNode(true);
      link.classList.add('mobile-inline-root-row', 'mobile-inline-direct-link');
      link.replaceChildren();

      const icon = document.createElement('span');
      icon.className = 'mobile-inline-root-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = iconFor(label);

      const text = document.createElement('span');
      text.className = 'mobile-inline-root-label';
      text.textContent = label;

      const arrow = document.createElement('span');
      arrow.className = 'mobile-inline-root-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';

      link.append(icon, text, arrow);
      link.addEventListener('click', () => {
        navToggle.open = false;
      });
      return link;
    };

    directLinks.forEach((source) => {
      const label = source.textContent?.trim() || '';
      if (label) list.appendChild(decorateDirectLink(source, label));
    });

    const inlineSections = [];

    const closeSections = (except = null) => {
      inlineSections.forEach(({ section, button, submenu }) => {
        if (section === except) return;
        section.classList.remove('is-open');
        button.setAttribute('aria-expanded', 'false');
        submenu.setAttribute('aria-hidden', 'true');
        if ('inert' in submenu) submenu.inert = true;
      });
    };

    groups.forEach((group, index) => {
      const summary = group.querySelector(':scope > summary');
      const originalSubmenu = group.querySelector(':scope > .mobile-submenu');
      const label = summary?.querySelector('span')?.textContent?.trim() || `Section ${index + 1}`;
      const submenuId = `mobile-inline-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      const section = document.createElement('section');
      section.className = 'mobile-inline-section';
      if (group.classList.contains('section-active')) section.classList.add('is-current');

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-inline-root-row mobile-inline-section-button';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', submenuId);

      const icon = document.createElement('span');
      icon.className = 'mobile-inline-root-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = iconFor(label);

      const text = document.createElement('span');
      text.className = 'mobile-inline-root-label';
      text.textContent = label;

      const arrow = document.createElement('span');
      arrow.className = 'mobile-inline-root-arrow mobile-inline-section-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '⌄';

      button.append(icon, text, arrow);

      const submenu = document.createElement('div');
      submenu.className = 'mobile-inline-submenu';
      submenu.id = submenuId;
      submenu.setAttribute('aria-hidden', 'true');
      if ('inert' in submenu) submenu.inert = true;

      const submenuInner = document.createElement('div');
      submenuInner.className = 'mobile-inline-submenu-inner';

      originalSubmenu?.querySelectorAll('a').forEach((source) => {
        const child = source.cloneNode(true);
        child.classList.add('mobile-inline-child-link');

        const childArrow = document.createElement('span');
        childArrow.className = 'mobile-inline-child-arrow';
        childArrow.setAttribute('aria-hidden', 'true');
        childArrow.textContent = '→';
        child.appendChild(childArrow);

        child.addEventListener('click', () => {
          navToggle.open = false;
        });
        submenuInner.appendChild(child);
      });

      submenu.appendChild(submenuInner);
      section.append(button, submenu);
      list.appendChild(section);
      inlineSections.push({ section, button, submenu });

      button.addEventListener('click', () => {
        const opening = !section.classList.contains('is-open');
        closeSections(section);
        section.classList.toggle('is-open', opening);
        button.setAttribute('aria-expanded', opening ? 'true' : 'false');
        submenu.setAttribute('aria-hidden', opening ? 'false' : 'true');
        if ('inert' in submenu) submenu.inert = !opening;

        if (opening) {
          window.setTimeout(() => {
            section.scrollIntoView({
              block: 'nearest',
              behavior: reducedMotion.matches ? 'auto' : 'smooth',
            });
          }, 120);
        }
      });
    });

    if (faqLink) {
      list.appendChild(decorateDirectLink(faqLink, faqLink.textContent?.trim() || 'FAQ'));
    }

    footer.classList.add('mobile-inline-footer');
    panel.replaceChildren(list, footer);
    panel.classList.add('mobile-inline-ready');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Site navigation');
    navToggle.dataset.inlineNavReady = '1';

    const summary = navToggle.querySelector(':scope > summary');
    const summaryIcon = summary?.querySelector('[aria-hidden="true"]');

    const setHeaderOffset = () => {
      const header = navToggle.closest('.site-header');
      if (!(header instanceof HTMLElement)) return;
      document.documentElement.style.setProperty('--mobile-nav-top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
    };

    const visibleFocusable = () => Array.from(navToggle.querySelectorAll(
      'summary, a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) =>
      element instanceof HTMLElement &&
      !element.closest('[inert]') &&
      element.offsetParent !== null,
    );

    navToggle.addEventListener('toggle', () => {
      const open = navToggle.open && window.matchMedia(MOBILE_QUERY).matches;
      if (open) {
        setHeaderOffset();
        document.documentElement.classList.add('mobile-nav-open');
        if (summaryIcon) summaryIcon.textContent = '×';
        summary?.setAttribute('aria-label', 'Close menu');
      } else {
        document.documentElement.classList.remove('mobile-nav-open');
        if (summaryIcon) summaryIcon.textContent = '☰';
        summary?.setAttribute('aria-label', 'Open menu');
        closeSections();
        list.scrollTop = 0;
      }
    });

    window.addEventListener('resize', () => {
      if (!window.matchMedia(MOBILE_QUERY).matches && navToggle.open) navToggle.open = false;
      if (navToggle.open) setHeaderOffset();
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (!navToggle.open || !window.matchMedia(MOBILE_QUERY).matches) return;

      if (event.key === 'Tab') {
        const focusable = visibleFocusable();
        if (!focusable.length) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }

      if (event.key !== 'Escape') return;
      const openSection = inlineSections.find(({ section }) => section.classList.contains('is-open'));
      if (openSection) {
        event.preventDefault();
        closeSections();
        openSection.button.focus({ preventScroll: true });
      } else {
        navToggle.open = false;
        summary?.focus({ preventScroll: true });
      }
    });

    openFamilyRootsFromHash();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }

  document.addEventListener('astro:page-load', setup);
})();