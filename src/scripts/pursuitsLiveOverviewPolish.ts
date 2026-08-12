import { getDailyMeta } from '../utils/dailyData';

const SHORT_UNITS: Record<string, string> = {
  guitar: 'h',
  dance: 'h',
  running: 'mi',
  languages: 'h',
};

const formatArchiveDate = (value: string) => new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
}).format(new Date(`${value}T12:00:00`));

function addBestMonthUnit(card: HTMLElement) {
  const key = card.dataset.pursuitSummary || '';
  const unit = SHORT_UNITS[key];
  const node = card.querySelector<HTMLElement>('[data-live-best-month]');
  if (!node || !unit) return;

  const text = node.textContent?.trim() || '';
  if (!text || text === '—' || /\s(?:h|mi)$/.test(text)) return;
  if (!text.includes('·')) return;
  node.textContent = `${text} ${unit}`;
}

function initOverview(root: HTMLElement) {
  if (root.dataset.overviewPolishReady === 'true') return;
  root.dataset.overviewPolishReady = 'true';

  const cards = Array.from(root.querySelectorAll<HTMLElement>('[data-pursuit-summary]'));
  const status = root.querySelector<HTMLElement>('[data-pursuits-status]');
  const yearLabels = Array.from(root.querySelectorAll<HTMLElement>('[data-live-year-label]'));

  cards.forEach((card) => {
    addBestMonthUnit(card);
    const bestMonth = card.querySelector<HTMLElement>('[data-live-best-month]');
    if (!bestMonth) return;
    new MutationObserver(() => addBestMonthUnit(card)).observe(bestMonth, { childList: true, characterData: true, subtree: true });
  });

  let desiredStatus = '';
  const applyStatus = () => {
    if (!status || !desiredStatus || status.textContent === desiredStatus) return;
    status.textContent = desiredStatus;
    status.dataset.state = 'live';
  };

  if (status) {
    new MutationObserver(applyStatus).observe(status, { childList: true, characterData: true, subtree: true });
  }

  getDailyMeta().then((meta) => {
    const archiveYear = meta.dataThrough ? meta.dataThrough.slice(0, 4) : String(new Date().getFullYear());
    yearLabels.forEach((node) => { node.textContent = archiveYear; });

    desiredStatus = meta.dataThrough
      ? `Archive current through ${formatArchiveDate(meta.dataThrough)}`
      : 'Live public-safe daily Archive connected';
    applyStatus();
  }).catch(() => {
    desiredStatus = 'Live public-safe daily Archive connected';
    applyStatus();
  });
}

const initialize = () => {
  document.querySelectorAll<HTMLElement>('[data-pursuits-teleport][data-active="overview"]').forEach(initOverview);
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
