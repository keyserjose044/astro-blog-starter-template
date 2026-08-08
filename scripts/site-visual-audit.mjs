import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const OUT = path.resolve('audit-output');
const BASE_URL = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:4321';
const TARGET_SHA = process.env.AUDIT_SITE_SHA || 'unknown';

const DEVICES = [
  { name: 'desktop', width: 1440, height: 900, touch: false },
  { name: 'mobile', width: 390, height: 844, touch: true },
];

const SAFE_VIEW_LABELS = [
  'list', 'quilt', 'world', 'timeline', 'calendar', 'authors', 'records',
  'overview', 'works', 'composers', 'journey', 'favorites', 'artists',
  'albums', 'classical', 'gallery', 'map', 'month', 'year', 'agenda',
  'books', 'artworks', 'people', 'places', 'stats', 'explore',
];

const ignoreConsolePatterns = [
  /favicon/i,
  /third-party cookie/i,
];

function slug(value) {
  const clean = value
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/[?#].*$/, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return clean || 'home';
}

function normalizePathname(value) {
  let pathname = value || '/';
  pathname = pathname.split('#')[0].split('?')[0];
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.endsWith('/index.html')) pathname = pathname.slice(0, -10) || '/';
  if (pathname.endsWith('.html') && pathname !== '/404.html') pathname = pathname.slice(0, -5);
  if (pathname !== '/' && !path.extname(pathname) && !pathname.endsWith('/')) pathname += '/';
  return pathname;
}

async function discoverHtmlRoutes(dir = DIST) {
  const found = [];
  async function walk(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.html')) found.push(full);
    }
  }
  await walk(dir);
  return found
    .map((file) => {
      let rel = path.relative(DIST, file).split(path.sep).join('/');
      if (rel === 'index.html') return '/';
      if (rel.endsWith('/index.html')) return `/${rel.slice(0, -10)}/`;
      return `/${rel}`;
    })
    .map(normalizePathname)
    .sort((a, b) => a.localeCompare(b));
}

async function ensureDirs() {
  await fs.rm(OUT, { recursive: true, force: true });
  for (const device of DEVICES) {
    await fs.mkdir(path.join(OUT, 'screenshots', device.name), { recursive: true });
    await fs.mkdir(path.join(OUT, 'states', device.name), { recursive: true });
  }
}

async function scrollSweep(page) {
  await page.evaluate(async () => {
    const total = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    const step = Math.max(500, Math.floor(window.innerHeight * 0.8));
    const maxSteps = 28;
    for (let i = 0, y = 0; i < maxSteps && y < total; i += 1, y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 45));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(120);
}

async function inspectPage(page, deviceName) {
  return page.evaluate((device) => {
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
    };

    const describe = (el) => {
      const id = el.id ? `#${el.id}` : '';
      const classes = [...el.classList].slice(0, 3).map((c) => `.${c}`).join('');
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
      return `${el.tagName.toLowerCase()}${id}${classes}${text ? ` “${text}”` : ''}`;
    };

    const viewportWidth = window.innerWidth;
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth || 0);
    const overflowPx = Math.max(0, scrollWidth - viewportWidth);

    const offscreen = [...document.querySelectorAll('body *')]
      .filter(visible)
      .map((el) => ({ el, rect: el.getBoundingClientRect() }))
      .filter(({ rect }) => rect.right > viewportWidth + 3 || rect.left < -3)
      .filter(({ el }) => {
        const style = getComputedStyle(el);
        return !['fixed', 'absolute'].includes(style.position) || el.closest('main, article, section, .content, .container');
      })
      .slice(0, 20)
      .map(({ el, rect }) => ({
        element: describe(el),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      }));

    const brokenImages = [...document.images]
      .filter((img) => visible(img))
      .filter((img) => img.complete && img.naturalWidth === 0)
      .slice(0, 30)
      .map((img) => ({ src: img.currentSrc || img.src, alt: img.alt || '', element: describe(img) }));

    const clippedText = [...document.querySelectorAll('h1,h2,h3,h4,p,span,strong,small,a,button,label,summary')]
      .filter(visible)
      .filter((el) => el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 4)
      .filter((el) => {
        const style = getComputedStyle(el);
        return style.overflowX === 'hidden' || style.textOverflow === 'ellipsis';
      })
      .slice(0, 30)
      .map((el) => ({
        element: describe(el),
        clientWidth: el.clientWidth,
        scrollWidth: el.scrollWidth,
      }));

    const targetSelector = 'button,summary,input:not([type="hidden"]),select,textarea,[role="button"],[role="tab"],[aria-pressed]';
    const smallTargets = device === 'mobile'
      ? [...document.querySelectorAll(targetSelector)]
        .filter(visible)
        .map((el) => ({ el, rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width < 40 || rect.height < 40)
        .slice(0, 40)
        .map(({ el, rect }) => ({
          element: describe(el),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        }))
      : [];

    const internalLinks = [...document.querySelectorAll('a[href]')]
      .map((a) => a.href)
      .filter(Boolean)
      .filter((href) => {
        try { return new URL(href).origin === location.origin; } catch { return false; }
      });

    const headings = [...document.querySelectorAll('h1')].filter(visible).map((h) => (h.textContent || '').trim());
    const dialogs = [...document.querySelectorAll('dialog,[role="dialog"]')].filter(visible).length;

    return {
      title: document.title,
      h1: headings,
      documentHeight: Math.max(doc.scrollHeight, body?.scrollHeight || 0),
      scrollWidth,
      viewportWidth,
      overflowPx,
      offscreen,
      brokenImages,
      clippedText,
      smallTargets,
      internalLinks,
      visibleDialogs: dialogs,
    };
  }, deviceName);
}

function safeLabel(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function findSafeViewControls(page) {
  return page.evaluate((labels) => {
    const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const controls = [...document.querySelectorAll('main button, main [role="tab"], main [aria-pressed], #book-view-toggle button, #album-view-toggle button, .view-toggle button, .view-switcher button')]
      .filter(visible)
      .filter((el) => !el.closest('header,nav,dialog,[role="dialog"]'))
      .map((el) => ({ text: norm(el.textContent), raw: (el.textContent || '').replace(/\s+/g, ' ').trim() }))
      .filter((item) => labels.some((label) => item.text === label || item.text.startsWith(`${label} `)))
      .filter((item, index, arr) => arr.findIndex((other) => other.text === item.text) === index)
      .slice(0, 12);
    return controls;
  }, SAFE_VIEW_LABELS);
}

async function clickNamedControl(page, normalizedText) {
  return page.evaluate((wanted) => {
    const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const candidates = [...document.querySelectorAll('main button, main [role="tab"], main [aria-pressed], #book-view-toggle button, #album-view-toggle button, .view-toggle button, .view-switcher button')];
    const el = candidates.find((candidate) => {
      if (candidate.closest('header,nav,dialog,[role="dialog"]')) return false;
      const rect = candidate.getBoundingClientRect();
      if (!rect.width || !rect.height) return false;
      const text = norm(candidate.textContent);
      return text === wanted || text.startsWith(`${wanted} `);
    });
    if (!el) return false;
    el.click();
    return true;
  }, normalizedText);
}

async function captureRoute(browser, route, device, report, linkSet) {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    isMobile: device.touch,
    hasTouch: device.touch,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!ignoreConsolePatterns.some((pattern) => pattern.test(text))) consoleErrors.push(text.slice(0, 500));
  });
  page.on('pageerror', (error) => pageErrors.push(String(error?.message || error).slice(0, 500)));
  page.on('requestfailed', (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || 'failed' }));
  page.on('response', (response) => {
    if (response.status() >= 400) badResponses.push({ status: response.status(), url: response.url() });
  });

  const url = new URL(route, BASE_URL).toString();
  let navigationError = '';
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(650);
    await scrollSweep(page);
  } catch (error) {
    navigationError = String(error?.message || error);
  }

  const baseInspection = navigationError ? null : await inspectPage(page, device.name);
  if (baseInspection) baseInspection.internalLinks.forEach((href) => linkSet.add(href));

  const screenshotFile = `${slug(route)}.jpg`;
  if (!navigationError) {
    await page.screenshot({
      path: path.join(OUT, 'screenshots', device.name, screenshotFile),
      type: 'jpeg',
      quality: 64,
      fullPage: true,
    });
  }

  const states = [];
  if (!navigationError) {
    const controls = await findSafeViewControls(page);
    for (const control of controls) {
      const stateName = safeLabel(control.text);
      if (!stateName) continue;
      const clicked = await clickNamedControl(page, stateName);
      if (!clicked) continue;
      await page.waitForTimeout(500);
      await scrollSweep(page);
      const inspection = await inspectPage(page, device.name);
      inspection.internalLinks.forEach((href) => linkSet.add(href));
      const file = `${slug(route)}--${slug(stateName)}.jpg`;
      await page.screenshot({
        path: path.join(OUT, 'states', device.name, file),
        type: 'jpeg',
        quality: 62,
        fullPage: true,
      });
      states.push({ label: control.raw || stateName, key: stateName, screenshot: `states/${device.name}/${file}`, inspection });
    }
  }

  report.pages.push({
    device: device.name,
    route,
    url,
    screenshot: navigationError ? null : `screenshots/${device.name}/${screenshotFile}`,
    navigationError,
    inspection: baseInspection,
    consoleErrors: [...new Set(consoleErrors)].slice(0, 30),
    pageErrors: [...new Set(pageErrors)].slice(0, 30),
    failedRequests: failedRequests.slice(0, 30),
    badResponses: badResponses.slice(0, 30),
    states,
  });

  await context.close();
}

async function checkInternalLinks(urls) {
  const results = [];
  for (const raw of [...urls].sort()) {
    const url = new URL(raw);
    if (url.hash) url.hash = '';
    if (url.origin !== new URL(BASE_URL).origin) continue;
    try {
      const response = await fetch(url, { redirect: 'manual' });
      if (response.status >= 400) results.push({ status: response.status, url: url.toString() });
    } catch (error) {
      results.push({ status: 0, url: url.toString(), error: String(error?.message || error) });
    }
  }
  return results;
}

function summarize(report) {
  const summary = {
    targetSha: report.targetSha,
    routeCount: report.routes.length,
    pageCaptures: report.pages.length,
    stateCaptures: report.pages.reduce((sum, page) => sum + page.states.length, 0),
    navigationErrors: 0,
    horizontalOverflow: 0,
    brokenImagePages: 0,
    consoleErrorPages: 0,
    pageErrorPages: 0,
    smallTargetPages: 0,
    brokenInternalLinks: report.brokenInternalLinks.length,
  };
  for (const page of report.pages) {
    if (page.navigationError) summary.navigationErrors += 1;
    if ((page.inspection?.overflowPx || 0) > 3) summary.horizontalOverflow += 1;
    if ((page.inspection?.brokenImages || []).length) summary.brokenImagePages += 1;
    if (page.consoleErrors.length) summary.consoleErrorPages += 1;
    if (page.pageErrors.length) summary.pageErrorPages += 1;
    if ((page.inspection?.smallTargets || []).length) summary.smallTargetPages += 1;
  }
  return summary;
}

function markdownReport(report) {
  const s = report.summary;
  const lines = [
    '# LifeLoggerz full-site visual audit',
    '',
    `- Frozen site SHA: \`${report.targetSha}\``,
    `- Generated: ${report.generatedAt}`,
    `- Routes discovered from Astro build: **${s.routeCount}**`,
    `- Desktop/mobile route captures: **${s.pageCaptures}**`,
    `- Additional interactive-view captures: **${s.stateCaptures}**`,
    '',
    '## Automated flags',
    '',
    `- Navigation failures: **${s.navigationErrors}**`,
    `- Captures with horizontal overflow: **${s.horizontalOverflow}**`,
    `- Captures with broken visible images: **${s.brokenImagePages}**`,
    `- Captures with console errors: **${s.consoleErrorPages}**`,
    `- Captures with uncaught page errors: **${s.pageErrorPages}**`,
    `- Mobile captures with sub-40px control candidates: **${s.smallTargetPages}**`,
    `- Broken internal links: **${s.brokenInternalLinks}**`,
    '',
    '## Flagged captures',
    '',
  ];

  for (const page of report.pages) {
    const flags = [];
    if (page.navigationError) flags.push(`navigation: ${page.navigationError}`);
    if ((page.inspection?.overflowPx || 0) > 3) flags.push(`horizontal overflow ${page.inspection.overflowPx}px`);
    if (page.inspection?.brokenImages?.length) flags.push(`${page.inspection.brokenImages.length} broken visible image(s)`);
    if (page.consoleErrors.length) flags.push(`${page.consoleErrors.length} console error(s)`);
    if (page.pageErrors.length) flags.push(`${page.pageErrors.length} page error(s)`);
    if (page.inspection?.smallTargets?.length) flags.push(`${page.inspection.smallTargets.length} small control candidate(s)`);
    if (!flags.length) continue;
    lines.push(`- **${page.device} ${page.route}** — ${flags.join('; ')}`);
  }

  if (report.brokenInternalLinks.length) {
    lines.push('', '## Broken internal links', '');
    for (const item of report.brokenInternalLinks) lines.push(`- ${item.status}: ${item.url}`);
  }

  lines.push('', 'Detailed per-page measurements are in `report.json`. Screenshots are split into `screenshots/desktop`, `screenshots/mobile`, and interactive `states/` folders.', '');
  return lines.join('\n');
}

await ensureDirs();
const routes = await discoverHtmlRoutes();
const report = {
  targetSha: TARGET_SHA,
  generatedAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  routes,
  pages: [],
  brokenInternalLinks: [],
};
const internalLinks = new Set();

const browser = await chromium.launch({ headless: true });
try {
  // Deliberately complete the entire desktop pass before starting mobile.
  for (const device of DEVICES) {
    for (const route of routes) {
      process.stdout.write(`[audit] ${device.name.padEnd(7)} ${route}\n`);
      await captureRoute(browser, route, device, report, internalLinks);
    }
  }
} finally {
  await browser.close();
}

report.brokenInternalLinks = await checkInternalLinks(internalLinks);
report.summary = summarize(report);
await fs.writeFile(path.join(OUT, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
await fs.writeFile(path.join(OUT, 'REPORT.md'), markdownReport(report));
await fs.writeFile(path.join(OUT, 'routes.txt'), `${routes.join('\n')}\n`);

console.log('\n[audit] complete');
console.log(JSON.stringify(report.summary, null, 2));
