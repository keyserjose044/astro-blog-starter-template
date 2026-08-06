/* LifeLoggerz Classical Music — mobile readability follow-up.
   Adds YouTube thumbnails to the permanent Daily Listening agenda. */

const CLASSICAL_FIXES_V6_RETRIES = 220;

function classicalV6YoutubeId(value) {
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

function bootClassicalFixesV6(attempt = 0) {
  const v5Ready = document.body.dataset.classicalFixesV5Ready === 'true';
  const calendarPanel = document.querySelector('[data-page-panel="calendar"]');
  const works = Array.from(document.querySelectorAll('[data-work-item]'));

  if ((!v5Ready || !calendarPanel || !works.length) && attempt < CLASSICAL_FIXES_V6_RETRIES) {
    window.setTimeout(() => bootClassicalFixesV6(attempt + 1), 75);
    return;
  }
  if (!v5Ready || !calendarPanel || !works.length || document.body.dataset.classicalFixesV6Ready) return;
  document.body.dataset.classicalFixesV6Ready = 'true';

  const workMap = new Map();
  works.forEach((item) => {
    const key = item.querySelector('[data-work-open]')?.dataset.workOpen || '';
    if (key && !workMap.has(key)) workMap.set(key, item);
  });

  function enhanceAgenda() {
    calendarPanel.querySelectorAll('.classical-calendar-agenda [data-work-open]').forEach((button) => {
      if (button.dataset.classicalAgendaVisualReady) return;
      button.dataset.classicalAgendaVisualReady = 'true';

      const key = button.dataset.workOpen || '';
      const source = workMap.get(key);
      const href = source?.querySelector('.play-link[href]')?.getAttribute('href') || '';
      const videoId = classicalV6YoutubeId(href);
      if (!videoId) return;

      const thumb = document.createElement('span');
      thumb.className = 'classical-agenda-thumbnail';
      thumb.setAttribute('aria-hidden', 'true');

      const image = document.createElement('img');
      image.className = 'classical-agenda-thumbnail__img';
      image.src = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';

      const play = document.createElement('span');
      play.className = 'classical-agenda-thumbnail__play';
      play.textContent = '▶';

      image.addEventListener('error', () => {
        thumb.remove();
        button.classList.remove('has-agenda-thumbnail');
      }, { once: true });

      thumb.append(image, play);
      button.prepend(thumb);
      button.classList.add('has-agenda-thumbnail');
    });
  }

  enhanceAgenda();

  let timer = 0;
  const observer = new MutationObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(enhanceAgenda, 40);
  });
  observer.observe(calendarPanel, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalFixesV6(), { once: true });
} else {
  bootClassicalFixesV6();
}
