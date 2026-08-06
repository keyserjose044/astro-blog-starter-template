/* LifeLoggerz Classical Music — small layout follow-up.
   Moves the canon help control into a useful context and restores a balanced six-stat summary. */

const CLASSICAL_FIXES_V4_RETRIES = 200;

function bootClassicalFixesV4(attempt = 0) {
  const v3Ready = document.body.dataset.classicalFixesV3Ready === 'true';
  const statContainer = document.querySelector('.overall-stats');
  const tabs = document.querySelector('.page-tabs');
  const randomFavorite = document.querySelector('#random-favorite');
  const helpButton = document.querySelector('.classical-canon-help-button');

  if ((!v3Ready || !statContainer || !tabs || !randomFavorite || !helpButton) && attempt < CLASSICAL_FIXES_V4_RETRIES) {
    window.setTimeout(() => bootClassicalFixesV4(attempt + 1), 75);
    return;
  }
  if (!v3Ready || !statContainer || !tabs || !randomFavorite || !helpButton || document.body.dataset.classicalFixesV4Ready) return;
  document.body.dataset.classicalFixesV4Ready = 'true';

  if (!statContainer.querySelector('[data-classical-listening-days]')) {
    const dates = new Set();
    document.querySelectorAll('[id^="composer-template-"]').forEach((template) => {
      template.content?.querySelectorAll('[data-detail-panel="history"] [data-list-item]').forEach((row) => {
        const ms = Number(row.dataset.date || 0);
        if (!ms) return;
        const date = new Date(ms);
        if (Number.isNaN(date.getTime())) return;
        dates.add(`${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`);
      });
    });

    /* Clone a complete rendered card and edit its existing scoped children instead of
       replacing them. Astro's scoped attributes live on the <strong>/<span> too. */
    const sourceCard = statContainer.querySelector('.overall-stat');
    const card = sourceCard ? sourceCard.cloneNode(true) : document.createElement('div');
    card.className = 'overall-stat';
    card.removeAttribute('id');
    card.dataset.classicalListeningDays = 'true';

    let value = card.querySelector('strong');
    let label = card.querySelector('span');
    if (!value) {
      value = document.createElement('strong');
      card.append(value);
    }
    if (!label) {
      label = document.createElement('span');
      card.append(label);
    }
    value.textContent = dates.size.toLocaleString('en-US');
    label.textContent = 'listening days';

    card.title = 'Distinct calendar days with at least one tracked classical listening entry';
    statContainer.append(card);
  }
  statContainer.classList.remove('classical-stats-five');
  statContainer.classList.add('classical-stats-six');

  const libraryHeading = Array.from(document.querySelectorAll('.page-panel[data-page-panel="composers"] h2, .page-panel[data-page-panel="composers"] h3'))
    .find((heading) => heading.textContent?.trim() === 'Composer Library');
  const libraryDescription = libraryHeading?.parentElement?.querySelector('p');
  if (libraryDescription) {
    libraryDescription.textContent = 'Profiled composers appear by default; listening-log-only composers can be revealed when needed.';
  }

  const originalHelpRow = document.querySelector('.classical-canon-help-row');
  const mobileQuery = window.matchMedia('(max-width: 700px)');

  function placeHelp() {
    if (mobileQuery.matches) {
      helpButton.classList.add('classical-canon-help-button--nav');
      helpButton.classList.remove('classical-canon-help-button--toolbar');
      tabs.append(helpButton);
    } else {
      helpButton.classList.remove('classical-canon-help-button--nav');
      helpButton.classList.add('classical-canon-help-button--toolbar');
      randomFavorite.insertAdjacentElement('afterend', helpButton);
    }
    helpButton.setAttribute('aria-label', 'About my Western classical music canon journey');
    helpButton.title = 'About my Western classical music canon journey';
    if (originalHelpRow && !originalHelpRow.children.length) originalHelpRow.remove();
  }

  if (typeof mobileQuery.addEventListener === 'function') mobileQuery.addEventListener('change', placeHelp);
  else if (typeof mobileQuery.addListener === 'function') mobileQuery.addListener(placeHelp);
  placeHelp();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => bootClassicalFixesV4(), { once: true });
} else {
  bootClassicalFixesV4();
}
