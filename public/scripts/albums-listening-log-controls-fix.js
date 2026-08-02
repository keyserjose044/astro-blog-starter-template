/* LifeLoggerz Albums: coordinate Rows / Days / Repeated Listening Log controls. */

const ALBUMS_LISTENING_CONTROLS_FIX_RETRIES = 240;
const REPEATED_UI_ATTR = 'data-albums-repeated-ui-active';

function injectRepeatedControlStyles() {
  if (document.querySelector('style[data-albums-listening-controls-fix]')) return;
  const style = document.createElement('style');
  style.dataset.albumsListeningControlsFix = 'true';
  style.textContent = `
    body[${REPEATED_UI_ATTR}='true'] .albums-listening-log-layout-group [data-log-layout='rows'],
    body[${REPEATED_UI_ATTR}='true'] .albums-listening-log-layout-group [data-log-layout='days'] {
      background: transparent !important;
      color: var(--albums-muted) !important;
      box-shadow: none !important;
    }

    body[${REPEATED_UI_ATTR}='true'] .albums-listening-log-layout-group [data-log-layout='repeated'] {
      background: var(--albums-accent) !important;
      color: #fff !important;
      box-shadow: 0 4px 10px rgba(64, 92, 245, 0.18) !important;
    }

    .albums-listening-log-layout-group [data-log-layout='repeated'][disabled] {
      opacity: 0.55;
      cursor: wait;
    }
  `;
  document.head.append(style);
}

function isEntriesMode(expansion) {
  const pressed = expansion
    .querySelector('.albums-listening-log-mode-group button[aria-pressed="true"]');
  return !/titles|works/i.test(pressed?.textContent || '');
}

function ensureRepeatedButton(layoutGroup) {
  let button = layoutGroup.querySelector('[data-log-layout="repeated"]');
  if (button) return button;

  button = document.createElement('button');
  button.type = 'button';
  button.dataset.logLayout = 'repeated';
  button.textContent = 'Repeated';
  button.title = 'Rank titles heard more than once by number of recorded listens.';
  button.setAttribute('aria-pressed', 'false');
  layoutGroup.append(button);
  return button;
}

function repeatedDataReady() {
  return document.body.dataset.albumsListeningRepeatedReady === 'true';
}

function bootAlbumsListeningControlsFix(attempt = 0) {
  injectRepeatedControlStyles();

  const expansion = document.querySelector('#albums-expansion-views');
  const viewToggle = document.querySelector('#album-view-toggle');
  const layoutGroup = expansion?.querySelector('.albums-listening-log-layout-group');

  if ((!expansion || !viewToggle || !layoutGroup)
      && attempt < ALBUMS_LISTENING_CONTROLS_FIX_RETRIES) {
    window.setTimeout(() => bootAlbumsListeningControlsFix(attempt + 1), 75);
    return;
  }

  if (!expansion || !viewToggle || !layoutGroup
      || document.body.dataset.albumsListeningControlsFixReady) return;

  document.body.dataset.albumsListeningControlsFixReady = 'true';
  ensureRepeatedButton(layoutGroup);

  function syncAvailability() {
    const group = expansion.querySelector('.albums-listening-log-layout-group');
    if (!group) return;
    const repeated = ensureRepeatedButton(group);
    const ready = repeatedDataReady();
    repeated.disabled = !ready;
    repeated.setAttribute('aria-disabled', String(!ready));
    repeated.title = ready
      ? 'Rank titles heard more than once by number of recorded listens.'
      : 'Loading repeated-listening data…';
  }

  function setRepeatedUiActive(active) {
    const group = expansion.querySelector('.albums-listening-log-layout-group');
    if (!group) return;
    const repeated = ensureRepeatedButton(group);
    const next = Boolean(active && repeatedDataReady() && isEntriesMode(expansion));

    if (next) document.body.setAttribute(REPEATED_UI_ATTR, 'true');
    else document.body.removeAttribute(REPEATED_UI_ATTR);

    if (repeated.getAttribute('aria-pressed') !== String(next)) {
      repeated.setAttribute('aria-pressed', String(next));
    }

    if (next) {
      group.querySelectorAll('[data-log-layout="rows"], [data-log-layout="days"]').forEach((button) => {
        if (button.getAttribute('aria-pressed') !== 'false') button.setAttribute('aria-pressed', 'false');
      });
    }
  }

  function syncRepeatedButton() {
    const group = expansion.querySelector('.albums-listening-log-layout-group');
    if (!group) return;
    ensureRepeatedButton(group);
    syncAvailability();

    const ranking = expansion.querySelector('.albums-listening-log-list.is-repeated-ranking');
    const uiLocked = document.body.getAttribute(REPEATED_UI_ATTR) === 'true';
    if ((uiLocked || ranking) && isEntriesMode(expansion)) setRepeatedUiActive(true);
  }

  expansion.addEventListener('click', (event) => {
    const repeated = event.target.closest('[data-log-layout="repeated"]');
    if (repeated) {
      if (!repeatedDataReady()) {
        event.preventDefault();
        syncAvailability();
        return;
      }
      /* Lock the visual state immediately, before the other modules' queued patches run. */
      setRepeatedUiActive(true);
      return;
    }

    const ordinary = event.target.closest('[data-log-layout="rows"], [data-log-layout="days"]');
    if (ordinary) {
      setRepeatedUiActive(false);
      return;
    }

    const modeButton = event.target.closest('.albums-listening-log-mode-group button');
    if (modeButton && /titles|works/i.test(modeButton.textContent || '')) {
      setRepeatedUiActive(false);
    }
  }, true);

  expansion.addEventListener('change', (event) => {
    const sort = event.target.closest('select[aria-label="Sort listening log"]');
    if (!sort) return;
    setRepeatedUiActive(isEntriesMode(expansion) && sort.value === 'most-listened');
  }, true);

  viewToggle.addEventListener('click', (event) => {
    const button = event.target.closest('.albums-view-button');
    if (button && !button.classList.contains('albums-listening-log-view-button')) {
      setRepeatedUiActive(false);
    }
  }, true);

  const expansionObserver = new MutationObserver(() => {
    window.requestAnimationFrame(syncRepeatedButton);
  });
  expansionObserver.observe(expansion, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-pressed', 'class'],
  });

  const readinessObserver = new MutationObserver(() => {
    window.requestAnimationFrame(syncRepeatedButton);
  });
  readinessObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-albums-listening-repeated-ready'],
  });

  syncRepeatedButton();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootAlbumsListeningControlsFix(), { once: true });
} else {
  bootAlbumsListeningControlsFix();
}
