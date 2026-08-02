/* LifeLoggerz Albums: YouTube thumbnails for the repeated-title Listening Log. */

const ALBUMS_REPEATED_THUMBNAILS_VERSION = '20260802-1104';
const ALBUMS_REPEATED_THUMBNAILS_RETRIES = 180;

function ensureRepeatedThumbnailStyles() {
  if (document.querySelector('link[data-albums-repeated-thumbnails-css]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.albumsRepeatedThumbnailsCss = 'true';
  link.href = new URL(`../styles/albums-repeated-thumbnails.css?v=${ALBUMS_REPEATED_THUMBNAILS_VERSION}`, import.meta.url).toString();
  document.head.append(link);
}

function youtubeVideoId(value) {
  const raw = String(value || '').trim();
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

function latestYouTubeSource(card) {
  const links = Array.from(card.querySelectorAll('.albums-listening-log-repeat-history a[href]'));
  for (const link of links) {
    const id = youtubeVideoId(link.href);
    if (id) return { id, href: link.href };
  }
  return null;
}

function patchRepeatedCard(card) {
  if (!(card instanceof HTMLElement)) return;
  if (card.dataset.youtubeThumbnailPatched === 'true') return;
  card.dataset.youtubeThumbnailPatched = 'true';

  const source = latestYouTubeSource(card);
  const main = card.querySelector('.albums-listening-log-repeat-main');
  const title = card.querySelector('.albums-listening-log-repeat-title')?.textContent?.trim() || 'this repeated title';
  if (!source || !main) return;

  const thumb = document.createElement('a');
  thumb.className = 'albums-listening-log-repeat-thumbnail';
  thumb.href = source.href;
  thumb.target = '_blank';
  thumb.rel = 'noopener noreferrer';
  thumb.setAttribute('aria-label', `Open latest YouTube source for ${title}`);
  thumb.title = 'Open latest YouTube source';

  const image = document.createElement('img');
  image.src = `https://i.ytimg.com/vi/${encodeURIComponent(source.id)}/hqdefault.jpg`;
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';

  const play = document.createElement('span');
  play.className = 'albums-listening-log-repeat-thumbnail-play';
  play.setAttribute('aria-hidden', 'true');
  play.textContent = '▶';

  image.addEventListener('error', () => {
    thumb.remove();
    card.classList.remove('has-youtube-thumbnail');
  }, { once: true });

  thumb.append(image, play);
  card.classList.add('has-youtube-thumbnail');
  main.before(thumb);
}

function patchAllRepeatedCards(root = document) {
  root.querySelectorAll?.('.albums-listening-log-repeated-card').forEach(patchRepeatedCard);
}

function bootAlbumsRepeatedThumbnails(attempt = 0) {
  ensureRepeatedThumbnailStyles();
  const expansion = document.querySelector('#albums-expansion-views');
  if (!expansion && attempt < ALBUMS_REPEATED_THUMBNAILS_RETRIES) {
    window.setTimeout(() => bootAlbumsRepeatedThumbnails(attempt + 1), 75);
    return;
  }
  if (!expansion || document.body.dataset.albumsRepeatedThumbnailsReady) return;
  document.body.dataset.albumsRepeatedThumbnailsReady = 'true';

  patchAllRepeatedCards(expansion);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches('.albums-listening-log-repeated-card')) patchRepeatedCard(node);
        patchAllRepeatedCards(node);
      });
    });
  });
  observer.observe(expansion, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsRepeatedThumbnails(), { once: true });
} else {
  bootAlbumsRepeatedThumbnails();
}
