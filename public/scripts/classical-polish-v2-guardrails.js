/* Guardrails for Classical Music polish v2: viewport-safe filters, late repeat control placement, and dialog re-open state. */

const CLASSICAL_POLISH_V2_GUARDRAIL_RETRIES = 180;

function bootClassicalPolishV2Guardrails(attempt = 0) {
  const toolbar = document.querySelector('.works-toolbar');
  const panel = toolbar?.querySelector('.classical-mobile-filters-panel');
  const toggle = toolbar?.querySelector('.classical-mobile-filters-toggle');

  if ((!toolbar || !panel || !toggle) && attempt < CLASSICAL_POLISH_V2_GUARDRAIL_RETRIES) {
    window.setTimeout(() => bootClassicalPolishV2Guardrails(attempt + 1), 75);
    return;
  }
  if (!toolbar || !panel || !toggle || toolbar.dataset.polishV2GuardrailsReady) return;
  toolbar.dataset.polishV2GuardrailsReady = 'true';

  const mobileQuery = window.matchMedia('(max-width: 700px)');

  function syncRepeatPlacement() {
    const repeat = toolbar.querySelector('.classical-repeat-select');
    if (repeat && repeat.parentElement !== panel) panel.append(repeat);
  }

  function syncViewport() {
    syncRepeatPlacement();
    if (mobileQuery.matches) {
      panel.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    } else {
      panel.hidden = false;
      toggle.setAttribute('aria-expanded', 'true');
    }
  }

  const toolbarObserver = new MutationObserver(() => {
    window.requestAnimationFrame(syncRepeatPlacement);
  });
  toolbarObserver.observe(toolbar, { childList: true, subtree: true });

  if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', syncViewport);
  else if (typeof mobileQuery.addListener === 'function') mobileQuery.addListener(syncViewport);

  const dialog = document.querySelector('#classical-work-dialog');
  if (dialog && !dialog.dataset.polishV2ReopenGuard) {
    dialog.dataset.polishV2ReopenGuard = 'true';
    dialog.addEventListener('close', () => {
      const content = dialog.querySelector('[data-work-dialog-content]');
      if (content) delete content.dataset.polishDialogReady;
    });
  }

  syncViewport();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalPolishV2Guardrails(), { once: true });
} else {
  bootClassicalPolishV2Guardrails();
}
