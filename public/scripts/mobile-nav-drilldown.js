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

  const setup = () => {
    const navToggle = document.querySelector('.mobile-nav .nav-toggle');
    if (!(navToggle instanceof HTMLDetailsElement) || navToggle.dataset.drilldownReady === '1') return;

    const panel = navToggle.querySelector('.menu-panel');
    const topDirect = panel?.querySelector('.mobile-direct-links:not(.mobile-direct-links-bottom)');
    const bottomDirect = panel?.querySelector('.mobile-direct-links-bottom');
    const footer = panel?.querySelector('.mobile-footer');
    const groups = panel ? Array.from(panel.querySelectorAll('.mobile-group')) : [];

    if (!(panel instanceof HTMLElement) || !(topDirect instanceof HTMLElement) || !(footer instanceof HTMLElement) || groups.length === 0) return;

    const directLinks = Array.from(topDirect.querySelectorAll('a'));
    const faqLink = bottomDirect?.querySelector('a') || null;

    const views = document.createElement('div');
    views.className = 'mobile-drill-views';

    const rootView = document.createElement('section');
    rootView.className = 'mobile-drill-view mobile-drill-root is-active';
    rootView.dataset.view = 'root';
    rootView.setAttribute('aria-label', 'Main navigation');

    const rootHeading = document.createElement('div');
    rootHeading.className = 'mobile-drill-heading';
    rootHeading.innerHTML = '<span class="mobile-drill-eyebrow">Navigate</span><strong>Explore LifeLoggerz</strong>';
    rootView.appendChild(rootHeading);

    const rootList = document.createElement('div');
    rootList.className = 'mobile-drill-list';
    rootView.appendChild(rootList);

    const decorateDirectLink = (source, label) => {
      const link = source.cloneNode(true);
      link.classList.add('mobile-drill-root-link');
      link.replaceChildren();

      const icon = document.createElement('span');
      icon.className = 'mobile-drill-root-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = iconFor(label);

      const text = document.createElement('span');
      text.className = 'mobile-drill-root-label';
      text.textContent = label;

      const arrow = document.createElement('span');
      arrow.className = 'mobile-drill-root-arrow';
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
      if (label) rootList.appendChild(decorateDirectLink(source, label));
    });

    const sectionButtons = new Map();
    const sectionViews = new Map();

    groups.forEach((group, index) => {
      const summary = group.querySelector(':scope > summary');
      const submenu = group.querySelector(':scope > .mobile-submenu');
      const label = summary?.querySelector('span')?.textContent?.trim() || `Section ${index + 1}`;
      const viewId = `mobile-drill-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-drill-root-link mobile-drill-section-button';
      if (group.classList.contains('section-active')) button.classList.add('is-current');
      button.dataset.targetView = viewId;
      button.setAttribute('aria-controls', viewId);
      button.setAttribute('aria-expanded', 'false');

      const icon = document.createElement('span');
      icon.className = 'mobile-drill-root-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = iconFor(label);

      const text = document.createElement('span');
      text.className = 'mobile-drill-root-label';
      text.textContent = label;

      const arrow = document.createElement('span');
      arrow.className = 'mobile-drill-root-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '›';

      button.append(icon, text, arrow);
      rootList.appendChild(button);
      sectionButtons.set(viewId, button);

      const view = document.createElement('section');
      view.className = 'mobile-drill-view mobile-drill-section';
      view.dataset.view = viewId;
      view.id = viewId;
      view.setAttribute('aria-label', `${label} navigation`);
      view.setAttribute('aria-hidden', 'true');

      const viewHead = document.createElement('div');
      viewHead.className = 'mobile-drill-section-head';

      const back = document.createElement('button');
      back.type = 'button';
      back.className = 'mobile-drill-back';
      back.innerHTML = '<span aria-hidden="true">‹</span><span>All sections</span>';

      const title = document.createElement('h3');
      title.className = 'mobile-drill-section-title';
      title.textContent = label;

      viewHead.append(back, title);
      view.appendChild(viewHead);

      const childList = document.createElement('div');
      childList.className = 'mobile-drill-child-list';

      submenu?.querySelectorAll('a').forEach((source) => {
        const child = source.cloneNode(true);
        child.classList.add('mobile-drill-child-link');

        const arrow = document.createElement('span');
        arrow.className = 'mobile-drill-child-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '→';
        child.appendChild(arrow);

        child.addEventListener('click', () => {
          navToggle.open = false;
        });
        childList.appendChild(child);
      });

      view.appendChild(childList);
      views.appendChild(view);
      sectionViews.set(viewId, view);

      back.addEventListener('click', () => showRoot(true));
      button.addEventListener('click', () => showSection(viewId));
    });

    if (faqLink) {
      rootList.appendChild(decorateDirectLink(faqLink, faqLink.textContent?.trim() || 'FAQ'));
    }

    views.prepend(rootView);
    footer.classList.add('mobile-drill-footer');
    panel.replaceChildren(views, footer);
    panel.classList.add('mobile-drilldown-ready');
    navToggle.dataset.drilldownReady = '1';

    const summary = navToggle.querySelector(':scope > summary');
    const summaryIcon = summary?.querySelector('[aria-hidden="true"]');

    const setHeaderOffset = () => {
      const header = navToggle.closest('.site-header');
      if (!(header instanceof HTMLElement)) return;
      document.documentElement.style.setProperty('--mobile-nav-top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`);
    };

    function showRoot(focusBack = false) {
      rootView.classList.remove('is-behind');
      rootView.classList.add('is-active');
      rootView.setAttribute('aria-hidden', 'false');

      sectionViews.forEach((view, id) => {
        view.classList.remove('is-active');
        view.setAttribute('aria-hidden', 'true');
        sectionButtons.get(id)?.setAttribute('aria-expanded', 'false');
      });

      panel.dataset.activeView = 'root';
      if (focusBack) window.setTimeout(() => sectionButtons.values().next().value?.focus({ preventScroll: true }), 180);
    }

    function showSection(viewId) {
      const view = sectionViews.get(viewId);
      const trigger = sectionButtons.get(viewId);
      if (!view || !trigger) return;

      rootView.classList.remove('is-active');
      rootView.classList.add('is-behind');
      rootView.setAttribute('aria-hidden', 'true');

      sectionViews.forEach((section, id) => {
        const active = id === viewId;
        section.classList.toggle('is-active', active);
        section.setAttribute('aria-hidden', active ? 'false' : 'true');
        sectionButtons.get(id)?.setAttribute('aria-expanded', active ? 'true' : 'false');
      });

      panel.dataset.activeView = viewId;
      window.setTimeout(() => view.querySelector('.mobile-drill-back')?.focus({ preventScroll: true }), 180);
    }

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
        window.setTimeout(() => showRoot(false), 180);
      }
    });

    window.addEventListener('resize', () => {
      if (!window.matchMedia(MOBILE_QUERY).matches && navToggle.open) navToggle.open = false;
      if (navToggle.open) setHeaderOffset();
    }, { passive: true });

    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !navToggle.open || !window.matchMedia(MOBILE_QUERY).matches) return;
      if (panel.dataset.activeView !== 'root') {
        event.preventDefault();
        showRoot(false);
      } else {
        navToggle.open = false;
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }

  document.addEventListener('astro:page-load', setup);
})();
