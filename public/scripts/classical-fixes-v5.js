/* LifeLoggerz Classical Music — records/calendar mobile follow-up.
   Enriches Listening Milestones and compacts the mobile month calendar. */

const CLASSICAL_FIXES_V5_RETRIES = 200;

function classicalV5YoutubeId(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, window.location.href);
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

function bootClassicalFixesV5(attempt = 0) {
  const v4Ready = document.body.dataset.classicalFixesV4Ready === 'true';
  const recordsPanel = document.querySelector('[data-page-panel="records"]');
  const calendarPanel = document.querySelector('[data-page-panel="calendar"]');
  const milestoneButtons = recordsPanel
    ? Array.from(recordsPanel.querySelectorAll('.classical-milestone-row button[data-work-open]'))
    : [];

  if ((!v4Ready || !recordsPanel || !calendarPanel || !milestoneButtons.length) && attempt < CLASSICAL_FIXES_V5_RETRIES) {
    window.setTimeout(() => bootClassicalFixesV5(attempt + 1), 75);
    return;
  }
  if (!v4Ready || !recordsPanel || !calendarPanel || document.body.dataset.classicalFixesV5Ready) return;
  document.body.dataset.classicalFixesV5Ready = 'true';

  const workItems = Array.from(document.querySelectorAll('[data-work-item]'));
  const composerCards = Array.from(document.querySelectorAll('.composer-card[data-composer-id]'));

  function findWorkItem(key) {
    return workItems.find((item) => item.querySelector('[data-work-open]')?.dataset.workOpen === key) || null;
  }

  function findComposerCard(id) {
    return composerCards.find((card) => card.dataset.composerId === id) || null;
  }

  milestoneButtons.forEach((button) => {
    if (button.dataset.classicalV5Ready) return;
    button.dataset.classicalV5Ready = 'true';
    button.classList.add('classical-milestone-visual');

    const key = button.dataset.workOpen || '';
    const workItem = findWorkItem(key);
    if (!workItem) return;

    const composerId = workItem.dataset.composer || '';
    const composerCard = findComposerCard(composerId);
    const portrait = composerCard?.querySelector('.portrait[src]')?.getAttribute('src') || '';
    const initials = composerCard?.querySelector('.portrait-fallback')?.textContent?.trim()
      || composerCard?.dataset.name?.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 3)
      || '♪';

    if (!button.querySelector('.classical-milestone-composer')) {
      const bubble = portrait ? document.createElement('img') : document.createElement('span');
      bubble.className = 'classical-milestone-composer';
      if (portrait) {
        bubble.src = portrait;
        bubble.alt = '';
        bubble.loading = 'lazy';
        bubble.decoding = 'async';
      } else {
        bubble.textContent = initials;
        bubble.setAttribute('aria-hidden', 'true');
      }
      button.append(bubble);
    }

    if (!button.querySelector('.classical-milestone-thumbnail')) {
      const href = workItem.querySelector('.play-link[href]')?.getAttribute('href') || '';
      const videoId = classicalV5YoutubeId(href);
      const date = button.querySelector('.classical-milestone-date');
      const title = button.querySelector('strong');
      if (videoId && date && title) {
        const thumb = document.createElement('span');
        thumb.className = 'classical-milestone-thumbnail';
        thumb.setAttribute('aria-hidden', 'true');

        const image = document.createElement('img');
        image.src = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
        image.alt = '';
        image.loading = 'lazy';
        image.decoding = 'async';
        image.referrerPolicy = 'no-referrer';

        const play = document.createElement('span');
        play.className = 'classical-milestone-play';
        play.textContent = '▶';

        image.addEventListener('error', () => thumb.remove(), { once: true });
        thumb.append(image, play);
        title.insertAdjacentElement('beforebegin', thumb);
      }
    }
  });

  recordsPanel.classList.add('classical-records-mobile-safe');
  calendarPanel.classList.add('classical-calendar-mobile-compact');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalFixesV5(), { once: true });
} else {
  bootClassicalFixesV5();
}
