export interface RaindropGalleryItem {
  id: number | string;
  title: string;
  href: string;
  cover: string;
  note: string;
  tags: string[];
}

interface FetchRaindropsOptions {
  token?: string;
  collectionId?: string;
  label: string;
  placeholder: string;
}

const PER_PAGE = 50;
const MAX_RATE_LIMIT_RETRIES = 2;
const REQUEST_SPACING_MS = 550;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getRetryDelayMs(response: Response): number {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(Math.max(retryAfter * 1000, 1000), 65_000);
  }

  const resetEpochSeconds = Number(response.headers.get('x-ratelimit-reset'));
  if (Number.isFinite(resetEpochSeconds) && resetEpochSeconds > 0) {
    const untilReset = resetEpochSeconds * 1000 - Date.now() + 1000;
    return Math.min(Math.max(untilReset, 1000), 65_000);
  }

  return 5000;
}

async function fetchPage(
  url: string,
  token: string,
  label: string
): Promise<Response | null> {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) return response;

      if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const delayMs = getRetryDelayMs(response);
        console.warn(
          `Raindrop rate limit reached while building ${label}. Retrying in ${Math.ceil(delayMs / 1000)}s.`
        );
        await sleep(delayMs);
        continue;
      }

      let snippet = '';
      try {
        snippet = (await response.text()).slice(0, 200);
      } catch {
        // Ignore response-body read errors.
      }

      console.warn(
        `Raindrop fetch failed (${response.status}) while building ${label}: ${snippet}`
      );
      return null;
    } catch (error) {
      if (attempt < MAX_RATE_LIMIT_RETRIES) {
        const delayMs = 2000 * 2 ** attempt;
        console.warn(
          `Raindrop network error while building ${label}. Retrying in ${delayMs / 1000}s.`,
          error
        );
        await sleep(delayMs);
        continue;
      }

      console.warn(`Raindrop fetch error while building ${label}:`, error);
      return null;
    }
  }

  return null;
}

export async function fetchAllRaindrops({
  token,
  collectionId,
  label,
  placeholder,
}: FetchRaindropsOptions): Promise<RaindropGalleryItem[]> {
  if (!token) {
    console.warn(`RAINDROP_TOKEN is missing; ${label} will build without remote items.`);
    return [];
  }

  if (!collectionId) {
    console.warn(`Raindrop collection ID is missing; ${label} will build without remote items.`);
    return [];
  }

  const items: any[] = [];
  let page = 0;

  while (true) {
    const url = new URL(
      `https://api.raindrop.io/rest/v1/raindrops/${collectionId}`
    );
    url.searchParams.set('perpage', String(PER_PAGE));
    url.searchParams.set('page', String(page));
    url.searchParams.set('sort', '-created');

    const response = await fetchPage(url.toString(), token, label);
    if (!response) break;

    const batch = (await response.json())?.items ?? [];
    if (!batch.length) break;

    items.push(...batch);
    if (batch.length < PER_PAGE) break;

    page += 1;
    await sleep(REQUEST_SPACING_MS);
  }

  items.sort(
    (a, b) =>
      new Date(b.created || b.lastUpdate || 0).getTime() -
      new Date(a.created || a.lastUpdate || 0).getTime()
  );

  return items.map((item) => ({
    id: item._id,
    title: item.title ?? 'Untitled',
    href: item.link ?? '#',
    cover: item.cover || item.media?.[0]?.link || placeholder,
    note:
      (typeof item.note === 'string' ? item.note : '') ||
      (typeof item.excerpt === 'string' ? item.excerpt : ''),
    tags: item.tags ?? [],
  }));
}
