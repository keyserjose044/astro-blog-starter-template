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
  cleanVideoCovers?: boolean;
  cleanVideoCoversAfter?: string;
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

function getYouTubeVideoId(rawLink?: string | null): string | null {
  if (!rawLink) return null;

  try {
    const url = new URL(rawLink);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    const pathParts = url.pathname.split('/').filter(Boolean);
    let videoId: string | null = null;

    if (hostname === 'youtu.be') {
      videoId = pathParts[0] ?? null;
    } else if (
      hostname === 'youtube.com' ||
      hostname === 'm.youtube.com' ||
      hostname === 'music.youtube.com'
    ) {
      videoId = url.searchParams.get('v');

      if (!videoId && ['embed', 'shorts', 'live'].includes(pathParts[0] ?? '')) {
        videoId = pathParts[1] ?? null;
      }
    } else if (hostname === 'youtube-nocookie.com' && pathParts[0] === 'embed') {
      videoId = pathParts[1] ?? null;
    }

    if (!videoId || !/^[A-Za-z0-9_-]{6,}$/.test(videoId)) return null;
    return videoId;
  } catch {
    return null;
  }
}

function getYouTubeThumbnail(rawLink?: string | null): string | null {
  const videoId = getYouTubeVideoId(rawLink);
  return videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;
}

function getFirstMediaCover(media?: Array<{ link?: string }>): string | null {
  const mediaLink = media?.find(
    (entry) => typeof entry?.link === 'string' && entry.link.trim().length > 0
  )?.link;

  return mediaLink?.trim() || null;
}

function parseCalendarDate(rawValue?: string | null): number | null {
  const raw = String(rawValue || '').trim();
  if (!raw) return null;

  const isoDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const usDate = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);

  let year: number;
  let month: number;
  let day: number;

  if (isoDate) {
    year = Number(isoDate[1]);
    month = Number(isoDate[2]);
    day = Number(isoDate[3]);
  } else if (usDate) {
    month = Number(usDate[1]);
    day = Number(usDate[2]);
    year = Number(usDate[3]);
    if (year < 100) year += 2000;
  } else {
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) return null;

    const date = new Date(parsed);
    year = date.getFullYear();
    month = date.getMonth() + 1;
    day = date.getDate();
  }

  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  // Reject impossible dates such as 2/30/26 instead of letting JavaScript roll them forward.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function getLoggedDate(note?: string | null): number | null {
  const firstMetadataField = String(note || '')
    .split(/\s*[·•]\s*/, 1)[0]
    .trim();

  return parseCalendarDate(firstMetadataField);
}

function chooseCover(
  item: any,
  placeholder: string,
  cleanVideoCovers: boolean,
  cleanVideoCoversAfter: number | null,
  note: string
): string {
  const mediaCover = getFirstMediaCover(item.media);
  const loggedDate = getLoggedDate(note);
  const isAfterCutoff =
    cleanVideoCoversAfter === null ||
    (loggedDate !== null && loggedDate > cleanVideoCoversAfter);

  if (cleanVideoCovers && isAfterCutoff) {
    // Raindrop may place a play badge on its generated video cover.
    // YouTube's source thumbnail does not include Raindrop's overlay.
    const youtubeThumbnail = getYouTubeThumbnail(item.link);
    if (youtubeThumbnail) return youtubeThumbnail;

    // For other video providers, prefer the underlying media image when present.
    if (item.type === 'video' && mediaCover) return mediaCover;
  }

  // Items on/before the cutoff, or without a parseable logged date, keep Raindrop's cover.
  return item.cover || mediaCover || placeholder;
}

export async function fetchAllRaindrops({
  token,
  collectionId,
  label,
  placeholder,
  cleanVideoCovers = false,
  cleanVideoCoversAfter,
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

  const cleanVideoCoversAfterTimestamp = cleanVideoCoversAfter
    ? parseCalendarDate(cleanVideoCoversAfter)
    : null;

  if (cleanVideoCoversAfter && cleanVideoCoversAfterTimestamp === null) {
    console.warn(
      `Invalid cleanVideoCoversAfter date "${cleanVideoCoversAfter}" while building ${label}; video-cover cleanup is disabled.`
    );
  }

  return items.map((item) => {
    const note =
      (typeof item.note === 'string' ? item.note : '') ||
      (typeof item.excerpt === 'string' ? item.excerpt : '');

    return {
      id: item._id,
      title: item.title ?? 'Untitled',
      href: item.link ?? '#',
      cover: chooseCover(
        item,
        placeholder,
        cleanVideoCovers && (!cleanVideoCoversAfter || cleanVideoCoversAfterTimestamp !== null),
        cleanVideoCoversAfterTimestamp,
        note
      ),
      note,
      tags: item.tags ?? [],
    };
  });
}
