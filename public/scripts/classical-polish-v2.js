/* LifeLoggerz Classical Music: visual/interaction polish for Works, Overview, Composers, Calendar, Journey, Records, and Favorites. */

const CLASSICAL_POLISH_V2_VERSION = '20260802-1126';
const CLASSICAL_POLISH_V2_RETRIES = 180;

function ensureClassicalPolishV2Styles() {
  if (document.querySelector('link[data-classical-polish-v2-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.classicalPolishV2Css = 'true';
  link.href = new URL(`../styles/classical-polish-v2.css?v=${CLASSICAL_POLISH_V2_VERSION}`, import.meta.url).toString();
  document.head.append(link);
}

const polishClean = (value) => String(value ?? '').trim();
const polishNorm = (value) => polishClean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function youtubeVideoId(value) {
  const raw = polishClean(value);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    const parts = url.pathname.split('/').filter(Boolean);
    let id = '';
    if (host === 'youtu.be') id = parts[0] || '';
    else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      id = url.searchParams.get('v')
        || (['shorts', 'embed', 'live'].includes(parts[0]) ? parts[1] : '')
        || '';
    }
    return /^[A-Za-z0-9_-]{6,20}$/.test(id) ? id : '';
  } catch (_error) {
    return '';
  }
}

function youtubeThumb(href) {
  const id = youtubeVideoId(href);
  return id ? `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg` : '';
}

function shortMinutes(value) {
  const minutes = Math.max(0, Number(value || 0));
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hr${Math.abs(hours - 1) < .05 ? '' : 's'}`;
}

function bootClassicalPolishV2(attempt = 0) {
  ensureClassicalPolishV2Styles();

  const tabs = document.querySelector('.page-tabs');
  const worksPanel = document.querySelector('[data-page-panel="works"]');
  const composerGrid = document.querySelector('#composer-grid');
  const expansionReady = document.body.dataset.classicalExpansionReady === 'true';

  if ((!tabs || !worksPanel || !composerGrid || !expansionReady) && attempt < CLASSICAL_POLISH_V2_RETRIES) {
    window.setTimeout(() => bootClassicalPolishV2(attempt + 1), 75);
    return;
  }
  if (!tabs || !worksPanel || !composerGrid || !expansionReady || document.body.dataset.classicalPolishV2Ready) return;
  document.body.dataset.classicalPolishV2Ready = 'true';

  const composerCards = Array.from(composerGrid.querySelectorAll('.composer-card'));
  const composerById = new Map();
  const composerByName = new Map();

  composerCards.forEach((card) => {
    const id = polishClean(card.dataset.composerId);
    const name = polishClean(card.dataset.name);
    const portrait = card.querySelector('.portrait')?.getAttribute('src') || '';
    const initials = polishClean(card.querySelector('.portrait-fallback')?.textContent)
      || name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 3);
    const data = { id, name, portrait, initials, card };
    composerById.set(id, data);
    composerByName.set(polishNorm(name), data);
  });

  const workItems = Array.from(document.querySelectorAll('[data-work-item]'));
  const workByKey = new Map();
  workItems.forEach((item) => {
    const open = item.querySelector('[data-work-open]');
    if (open?.dataset.workOpen) workByKey.set(open.dataset.workOpen, item);
  });

  function composerVisual(composer, className = 'classical-polish-avatar') {
    if (!composer) return null;
    if (composer.portrait) {
      const img = document.createElement('img');
      img.className = className;
      img.src = composer.portrait;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      return img;
    }
    const span = document.createElement('span');
    span.className = `${className} classical-polish-avatar--fallback`;
    span.textContent = composer.initials || composer.name.slice(0, 2);
    span.setAttribute('aria-hidden', 'true');
    return span;
  }

  function findComposerByText(value) {
    const normalized = polishNorm(value);
    if (!normalized) return null;
    if (composerByName.has(normalized)) return composerByName.get(normalized);
    return Array.from(composerByName.entries()).find(([name]) => normalized.includes(name) || name.includes(normalized))?.[1] || null;
  }

  function makeYoutubeThumbLink(href, label, className) {
    const src = youtubeThumb(href);
    if (!src) return null;
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', label);

    const image = document.createElement('img');
    image.src = src;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';

    const play = document.createElement('span');
    play.className = 'classical-polish-play';
    play.textContent = '▶';
    play.setAttribute('aria-hidden', 'true');

    image.addEventListener('error', () => link.remove(), { once: true });
    link.append(image, play);
    return link;
  }

  function patchComposerCards() {
    composerCards.forEach((card) => {
      if (card.dataset.polishCardReady) return;
      card.dataset.polishCardReady = 'true';
      const body = card.querySelector('.card-body');
      if (!body || Number(card.dataset.entries || 0) <= 0) return;

      const repeatedWorks = workItems.filter((item) => item.dataset.composer === card.dataset.composerId && Number(item.dataset.listens || 1) > 1);
      const repeatListens = repeatedWorks.reduce((sum, item) => sum + Math.max(0, Number(item.dataset.listens || 1) - 1), 0);
      const latestMs = Number(card.dataset.lastListened || 0);
      const latestLabel = latestMs
        ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(latestMs))
        : '';

      const quick = document.createElement('span');
      quick.className = 'classical-card-quickline';
      quick.innerHTML = `<span>↻ <b>${repeatedWorks.length.toLocaleString('en-US')}</b> repeated</span>${repeatListens ? `<span><b>${repeatListens.toLocaleString('en-US')}</b> return listens</span>` : ''}${latestLabel ? `<span>Latest <b>${latestLabel}</b></span>` : ''}`;
      body.append(quick);
    });
  }

  function patchWorkItems() {
    workItems.forEach((item) => {
      if (item.dataset.polishWorkReady) return;
      item.dataset.polishWorkReady = 'true';
      const main = item.querySelector('.entry-main');
      const side = item.querySelector('.entry-side');
      const play = item.querySelector('.play-link[href]');
      const details = item.querySelector('[data-work-open]');
      const composer = composerById.get(item.dataset.composer || '');

      if (main && details) {
        main.classList.add('classical-work-main-clickable');
        main.tabIndex = 0;
        main.setAttribute('role', 'button');
        main.setAttribute('aria-label', `Open details for ${polishClean(item.querySelector('.entry-title')?.textContent)}`);
        const openDetails = () => details.click();
        main.addEventListener('click', openDetails);
        main.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openDetails();
          }
        });
      }

      const count = Number(item.dataset.listens || 1);
      const performanceCount = Number(item.dataset.performanceCount || 0);
      const meta = item.querySelector('.entry-meta');
      if (meta && count > 1 && performanceCount > 0 && !meta.querySelector('.classical-performance-count')) {
        const badge = document.createElement('span');
        badge.className = 'classical-performance-count';
        badge.textContent = `${performanceCount} performance${performanceCount === 1 ? '' : 's'}`;
        meta.append(' ', badge);
      }

      if (play) {
        const thumb = makeYoutubeThumbLink(play.href, `Open YouTube performance for ${polishClean(item.querySelector('.entry-title')?.textContent)}`, 'classical-work-thumbnail');
        if (thumb) {
          item.classList.add('has-work-thumbnail');
          item.append(thumb);
        }
      } else if (composer && side) {
        const avatar = composerVisual(composer, 'classical-work-composer-avatar');
        if (avatar) {
          item.classList.add('has-composer-avatar');
          item.append(avatar);
        }
      }
    });
  }

  function patchRecentOverview() {
    document.querySelectorAll('.recent-item').forEach((item) => {
      if (item.dataset.polishRecentReady) return;
      item.dataset.polishRecentReady = 'true';
      const link = item.querySelector('a[href]');
      const strong = item.querySelector('strong');
      const composerName = polishClean(strong?.textContent).split(' · ')[0];
      const composer = findComposerByText(composerName);
      let visual = link ? makeYoutubeThumbLink(link.href, `Open ${polishClean(strong?.textContent)}`, 'classical-recent-thumbnail') : null;
      if (!visual) visual = composerVisual(composer, 'classical-recent-avatar');
      if (visual) item.prepend(visual);
    });
  }

  function collectTemplateEntries() {
    const entries = [];
    composerCards.forEach((card) => {
      const composer = composerById.get(card.dataset.composerId || '');
      const template = document.querySelector(`#composer-template-${CSS.escape(card.dataset.composerId || '')}`);
      template?.content?.querySelectorAll('[data-detail-panel="history"] [data-list-item]').forEach((row) => {
        const date = Number(row.dataset.date || 0);
        if (!date) return;
        entries.push({
          composer,
          date,
          minutes: Number(row.dataset.minutes || 0),
          piece: polishClean(row.querySelector('.entry-title')?.textContent),
          href: row.querySelector('.play-link[href]')?.getAttribute('href') || '',
        });
      });
    });
    return entries;
  }

  function addCurrentObsessions() {
    const layout = document.querySelector('.overview-layout');
    if (!layout || layout.querySelector('[data-current-obsessions]')) return;
    const entries = collectTemplateEntries();
    const latest = Math.max(0, ...entries.map((entry) => entry.date));
    if (!latest) return;
    const cutoff = latest - 90 * 86400000;
    const recent = entries.filter((entry) => entry.date >= cutoff);
    const byComposer = new Map();
    recent.forEach((entry) => {
      const id = entry.composer?.id || '';
      if (!id) return;
      if (!byComposer.has(id)) byComposer.set(id, { composer: entry.composer, entries: 0, minutes: 0, latest: 0, works: new Set() });
      const stat = byComposer.get(id);
      stat.entries += 1;
      stat.minutes += entry.minutes;
      stat.latest = Math.max(stat.latest, entry.date);
      stat.works.add(polishNorm(entry.piece));
    });
    const top = Array.from(byComposer.values()).sort((a, b) => b.minutes - a.minutes || b.entries - a.entries || b.latest - a.latest).slice(0, 6);
    if (!top.length) return;

    const article = document.createElement('article');
    article.className = 'overview-card classical-current-obsessions';
    article.dataset.currentObsessions = 'true';
    const header = document.createElement('div');
    header.className = 'overview-card-header';
    header.innerHTML = '<div><h3>Current Obsessions</h3><p>Composers dominating the latest 90 days of the listening archive.</p></div>';
    const grid = document.createElement('div');
    grid.className = 'classical-obsession-grid';
    top.forEach((stat) => {
      const card = document.createElement('article');
      const visual = composerVisual(stat.composer, 'classical-obsession-avatar');
      if (visual) card.append(visual);
      const text = document.createElement('div');
      text.innerHTML = `<b>${stat.composer.name}</b><span>${shortMinutes(stat.minutes)} · ${stat.works.size.toLocaleString('en-US')} works · ${stat.entries.toLocaleString('en-US')} entries</span>`;
      card.append(text);
      grid.append(card);
    });
    article.append(header, grid);
    layout.append(article);
  }

  function patchWorkDialog() {
    const dialog = document.querySelector('#classical-work-dialog');
    if (!dialog) return;
    const content = dialog.querySelector('[data-work-dialog-content]');
    if (!content || !content.children.length || content.dataset.polishDialogReady === content.querySelector('h2')?.textContent) return;
    content.dataset.polishDialogReady = content.querySelector('h2')?.textContent || String(Date.now());

    const header = content.querySelector('.classical-work-dialog__header');
    const composerName = polishClean(content.querySelector('.classical-work-dialog__eyebrow')?.textContent);
    const composer = findComposerByText(composerName);
    if (header && composer && !header.querySelector('.classical-work-dialog__portrait')) {
      const visual = composerVisual(composer, 'classical-work-dialog__portrait');
      if (visual) header.prepend(visual);
    }

    const historySection = content.querySelector('.classical-work-history-section');
    if (!historySection || content.querySelector('.classical-performance-strip')) return;
    const links = Array.from(historySection.querySelectorAll('.classical-work-history a[href]'));
    const unique = [];
    const seen = new Set();
    links.forEach((link) => {
      const id = youtubeVideoId(link.href);
      if (!id || seen.has(id)) return;
      seen.add(id);
      const row = link.closest('li');
      unique.push({ href: link.href, id, date: polishClean(row?.querySelector('strong')?.textContent) });
    });
    if (!unique.length) return;

    const section = document.createElement('section');
    section.className = 'classical-performance-strip';
    section.innerHTML = '<div class="classical-section-heading"><div><h3>Performances</h3><p>Distinct linked interpretations used across the listening history.</p></div></div>';
    const row = document.createElement('div');
    row.className = 'classical-performance-strip__row';
    unique.slice(0, 8).forEach((performance, index) => {
      const card = makeYoutubeThumbLink(performance.href, `Open performance ${index + 1}`, 'classical-performance-card');
      if (!card) return;
      const caption = document.createElement('span');
      caption.innerHTML = `<b>Performance ${index + 1}</b><em>${performance.date || 'Linked listen'}</em>`;
      card.append(caption);
      row.append(card);
    });
    section.append(row);
    historySection.before(section);
  }

  function setupDialogObserver() {
    const dialog = document.querySelector('#classical-work-dialog');
    if (!dialog || dialog.dataset.polishObserverReady) return;
    dialog.dataset.polishObserverReady = 'true';
    const observer = new MutationObserver(() => window.requestAnimationFrame(patchWorkDialog));
    observer.observe(dialog, { childList: true, subtree: true });
    dialog.addEventListener('toggle', patchWorkDialog);
    patchWorkDialog();
  }

  function patchMobileWorksFilters() {
    const toolbar = document.querySelector('.works-toolbar');
    if (!toolbar || toolbar.dataset.polishFilterReady) return;
    toolbar.dataset.polishFilterReady = 'true';

    const search = document.querySelector('#works-search');
    const sort = document.querySelector('#works-sort');
    const composer = document.querySelector('#works-composer-filter');
    const period = document.querySelector('#works-period-filter');
    const form = document.querySelector('#works-form-filter');
    const rating = document.querySelector('#works-rating-filter');
    const repeat = toolbar.querySelector('.classical-repeat-select');
    const nativeRepeat = document.querySelector('#works-repeat-filter');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'classical-mobile-filters-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<span>Filters</span><b data-mobile-filter-count>0</b>';

    const panel = document.createElement('div');
    panel.className = 'classical-mobile-filters-panel';
    panel.hidden = true;
    [composer, period, form, rating, repeat].filter(Boolean).forEach((control) => panel.append(control));

    if (search) search.insertAdjacentElement('afterend', toggle);
    else toolbar.prepend(toggle);
    if (sort) toggle.insertAdjacentElement('afterend', sort);
    toolbar.append(panel);

    function countActive() {
      const count = [composer?.value, period?.value, form?.value, rating?.value, nativeRepeat?.value].filter(Boolean).length;
      const badge = toggle.querySelector('[data-mobile-filter-count]');
      if (badge) badge.textContent = String(count);
      toggle.classList.toggle('has-active-filters', count > 0);
    }

    function setOpen(open) {
      panel.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    toggle.addEventListener('click', () => setOpen(panel.hidden));
    [composer, period, form, rating, nativeRepeat].forEach((control) => control?.addEventListener('change', countActive));
    document.querySelector('#clear-work-filters')?.addEventListener('click', () => window.setTimeout(countActive, 0));
    countActive();
  }

  let calendarMode = window.matchMedia('(max-width: 800px)').matches ? 'agenda' : 'month';
  function patchCalendar() {
    const host = document.querySelector('[data-page-panel="calendar"] [data-classical-panel-content]');
    const shell = host?.querySelector('.classical-calendar-shell');
    if (!host || !shell || shell.dataset.polishCalendarReady) return;
    shell.dataset.polishCalendarReady = 'true';

    const toolbar = shell.querySelector('.classical-calendar-toolbar');
    const weekdays = shell.querySelector('.classical-calendar-weekdays');
    const grid = shell.querySelector('.classical-calendar-grid');
    if (!toolbar || !grid) return;

    const switcher = document.createElement('div');
    switcher.className = 'classical-calendar-mode-switch';
    switcher.innerHTML = '<button type="button" data-calendar-polish-mode="month">Month</button><button type="button" data-calendar-polish-mode="agenda">Agenda</button>';
    toolbar.append(switcher);

    const agenda = document.createElement('div');
    agenda.className = 'classical-calendar-agenda';
    grid.querySelectorAll('.classical-calendar-day:not(.classical-calendar-day--outside)').forEach((day) => {
      const workButtons = Array.from(day.querySelectorAll('.classical-calendar-work'));
      if (!workButtons.length) return;
      const dayNumber = polishClean(day.querySelector('.classical-calendar-day__head b')?.textContent);
      const duration = polishClean(day.querySelector('.classical-calendar-day__head span')?.textContent);
      const item = document.createElement('section');
      item.className = 'classical-calendar-agenda-day';
      const heading = document.createElement('div');
      heading.className = 'classical-calendar-agenda-day__head';
      heading.innerHTML = `<b>${dayNumber}</b><span>${duration}</span>`;
      const works = document.createElement('div');
      works.className = 'classical-calendar-agenda-day__works';
      workButtons.forEach((button) => works.append(button.cloneNode(true)));
      const more = day.querySelector('.classical-calendar-more');
      if (more) works.append(more.cloneNode(true));
      item.append(heading, works);
      agenda.append(item);
    });
    grid.insertAdjacentElement('afterend', agenda);

    function sync() {
      switcher.querySelectorAll('button').forEach((button) => button.setAttribute('aria-pressed', button.dataset.calendarPolishMode === calendarMode ? 'true' : 'false'));
      const agendaActive = calendarMode === 'agenda';
      if (weekdays) weekdays.hidden = agendaActive;
      grid.hidden = agendaActive;
      agenda.hidden = !agendaActive;
    }
    switcher.addEventListener('click', (event) => {
      const button = event.target.closest('[data-calendar-polish-mode]');
      if (!button) return;
      calendarMode = button.dataset.calendarPolishMode || 'month';
      sync();
    });
    sync();
  }

  function setupCalendarObserver() {
    const host = document.querySelector('[data-page-panel="calendar"] [data-classical-panel-content]');
    if (!host || host.dataset.polishCalendarObserver) return;
    host.dataset.polishCalendarObserver = 'true';
    const observer = new MutationObserver(() => window.requestAnimationFrame(patchCalendar));
    observer.observe(host, { childList: true, subtree: true });
    patchCalendar();
  }

  function patchJourney() {
    document.querySelectorAll('.classical-personal-journey li > button, .classical-history-journey li > button').forEach((button) => {
      if (button.dataset.polishJourneyReady) return;
      button.dataset.polishJourneyReady = 'true';
      const composerName = polishClean(button.querySelector('b')?.textContent);
      const composer = findComposerByText(composerName);
      const visual = composerVisual(composer, 'classical-journey-avatar');
      if (visual) button.prepend(visual);
    });
  }

  function setupJourneyObserver() {
    const host = document.querySelector('[data-page-panel="journey"] [data-classical-panel-content]');
    if (!host || host.dataset.polishJourneyObserver) return;
    host.dataset.polishJourneyObserver = 'true';
    const observer = new MutationObserver(() => window.requestAnimationFrame(patchJourney));
    observer.observe(host, { childList: true, subtree: true });
    patchJourney();
  }

  function patchRecords() {
    document.querySelectorAll('.classical-record-card').forEach((card) => {
      if (card.dataset.polishRecordReady) return;
      card.dataset.polishRecordReady = 'true';
      let composer = null;
      const workButton = card.querySelector('[data-work-open]');
      if (workButton) {
        const sourceItem = workByKey.get(workButton.dataset.workOpen || '');
        composer = composerById.get(sourceItem?.dataset.composer || '');
      }
      if (!composer) composer = findComposerByText(card.textContent || '');
      const visual = composerVisual(composer, 'classical-record-avatar');
      if (visual) card.append(visual);
    });
  }

  function patchFavorites() {
    document.querySelectorAll('[data-favorite-work-row]').forEach((row) => {
      if (row.dataset.polishFavoriteReady) return;
      row.dataset.polishFavoriteReady = 'true';
      const button = row.querySelector('[data-work-open]');
      const sourceItem = workByKey.get(button?.dataset.workOpen || '');
      const play = sourceItem?.querySelector('.play-link[href]');
      let visual = play ? makeYoutubeThumbLink(play.href, `Open YouTube performance for ${polishClean(sourceItem?.querySelector('.entry-title')?.textContent)}`, 'classical-favorite-work-thumbnail') : null;
      if (!visual) visual = composerVisual(composerById.get(sourceItem?.dataset.composer || ''), 'classical-favorite-work-avatar');
      if (visual) row.prepend(visual);
    });
  }

  function setupExpansionObserver() {
    const main = document.querySelector('main.wrap');
    if (!main || main.dataset.polishV2Observer) return;
    main.dataset.polishV2Observer = 'true';
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(() => {
        patchWorkItems();
        patchRecentOverview();
        patchCalendar();
        patchJourney();
        patchRecords();
        patchFavorites();
        patchWorkDialog();
      });
    });
    observer.observe(main, { childList: true, subtree: true });
  }

  patchComposerCards();
  patchWorkItems();
  patchRecentOverview();
  addCurrentObsessions();
  patchMobileWorksFilters();
  setupDialogObserver();
  setupCalendarObserver();
  setupJourneyObserver();
  patchRecords();
  patchFavorites();
  setupExpansionObserver();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => window.setTimeout(() => bootClassicalPolishV2(), 0), { once: true });
} else {
  window.setTimeout(() => bootClassicalPolishV2(), 0);
}
