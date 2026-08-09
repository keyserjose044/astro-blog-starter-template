(() => {
  if (typeof document === 'undefined') return;

  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  const enabledPaths = new Set([
    '/inspirations',
    '/about/lifeloggerz',
    '/faq',
    '/guitar',
    '/music/guitar',
    '/pursuits/guitar',
  ]);
  if (!enabledPaths.has(path)) return;

  if (!document.querySelector('link[data-long-page-jump-style]')) {
    const style = document.createElement('link');
    style.rel = 'stylesheet';
    style.href = '/styles/long-page-jump.css?v=20260808-2245';
    style.dataset.longPageJumpStyle = 'true';
    document.head.append(style);
  }

  const slugify = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);

  const uniqueId = (base, used) => {
    let id = base || 'section';
    let suffix = 2;
    while (used.has(id) || document.getElementById(id)) {
      id = `${base || 'section'}-${suffix}`;
      suffix += 1;
    }
    used.add(id);
    return id;
  };

  const boot = () => {
    if (document.body.dataset.longPageJumpReady === 'true') return;

    const main = document.querySelector('main');
    if (!main) return;

    const headings = Array.from(main.querySelectorAll('h2'))
      .filter((heading) => {
        const text = heading.textContent?.trim() || '';
        if (!text) return false;
        if (heading.closest('[hidden], dialog, [aria-hidden="true"]')) return false;
        return true;
      });

    if (headings.length < 3 || document.documentElement.scrollHeight < 2200) return;
    document.body.dataset.longPageJumpReady = 'true';

    const used = new Set();
    headings.forEach((heading) => {
      if (heading.id) {
        used.add(heading.id);
        return;
      }
      heading.id = uniqueId(slugify(heading.textContent), used);
    });

    const nav = document.createElement('nav');
    nav.className = 'long-page-jump';
    nav.setAttribute('aria-label', 'Jump to a section');

    const details = document.createElement('details');
    details.className = 'long-page-jump-menu';
    const summary = document.createElement('summary');
    summary.textContent = 'On this page';
    const links = document.createElement('div');
    links.className = 'long-page-jump-links';

    headings.forEach((heading) => {
      const link = document.createElement('a');
      link.href = `#${heading.id}`;
      link.textContent = heading.textContent?.trim() || 'Section';
      link.addEventListener('click', () => {
        details.open = false;
      });
      links.append(link);
    });

    details.append(summary, links);

    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'long-page-back-top';
    top.textContent = '↑ Top';
    top.setAttribute('aria-label', 'Back to top');
    top.hidden = true;
    top.addEventListener('click', () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });

    nav.append(details, top);
    document.body.append(nav);

    let ticking = false;
    const sync = () => {
      ticking = false;
      top.hidden = window.scrollY < 900;
    };
    window.addEventListener('scroll', () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(sync);
    }, { passive: true });
    sync();

    document.addEventListener('click', (event) => {
      if (details.open && !details.contains(event.target)) details.open = false;
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && details.open) {
        details.open = false;
        summary.focus();
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(boot), { once: true });
  } else {
    requestAnimationFrame(boot);
  }
})();
