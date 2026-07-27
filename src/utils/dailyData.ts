export const DAILY_DATA_API_URL =
  'https://script.google.com/macros/s/AKfycbxOueEMNf46c9RO7VA1Y2i7sWOQkJCnGT-WNMjfSqImYhoqNrMCRqZ7t_hsGyoUxmOd/exec';

export type DailyStatus = 'complete' | 'partial' | string;

export interface DailyMeta {
  schemaVersion: number | null;
  availableYears: number[];
  dataThrough: string | null;
  latestCompleteDate: string | null;
  timeZone: string;
  updatedAt: string | null;
  recordCount: number | null;
  supportedViews: string[];
  supportedMetrics: string[];
}

export interface DailyRecord {
  schemaVersion: number | null;
  date: string;
  day: string | null;
  status: DailyStatus;
  sleep: {
    hours: number | null;
    napHours: number | null;
    category: string | null;
  };
  weather: {
    highF: number | null;
    lowF: number | null;
    flags: string[];
  };
  dayEvent: string | null;
  food: {
    breakfastType: string | null;
    lunchType: string | null;
    dinnerType: string | null;
  };
  diary: { words: number | null };
  work: {
    hours: number | null;
    category: string | null;
  };
  hobbies: {
    bibleChapter: string | null;
    dictionaryPage: number | null;
    languageMinutes: number | null;
    runningMiles: number | null;
    treadmillMinutes: number | null;
    treadmillMiles: number | null;
    totalDistanceMiles: number | null;
    guitarMinutes: number | null;
    danceMinutes: number | null;
  };
  audiobook: {
    title: string | null;
    started: boolean;
    timestamp: string | null;
    minutes: number | null;
  };
  public?: {
    summary: string | null;
    workDescription: string | null;
    breakfast: string | null;
    lunch: string | null;
    dinner: string | null;
    sleepTime: string | null;
    wakeTime: string | null;
  };
}

export interface DailySeriesPoint {
  date: string;
  day: string | null;
  status: DailyStatus;
  value: number | null;
}

type ApiErrorPayload = {
  error?: string;
  message?: string;
};

const memoryCache = new Map<string, { expiresAt: number; value: unknown }>();
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15000;

export class DailyDataApiError extends Error {
  status: number | null;
  payload: unknown;

  constructor(message: string, status: number | null = null, payload: unknown = null) {
    super(message);
    this.name = 'DailyDataApiError';
    this.status = status;
    this.payload = payload;
  }
}

function buildUrl(params: Record<string, string | number>) {
  const url = new URL(DAILY_DATA_API_URL);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function readCached<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return cached.value as T;
}

async function requestJson<T>(
  params: Record<string, string | number>,
  options: { ttlMs?: number; timeoutMs?: number; force?: boolean } = {},
): Promise<T> {
  const url = buildUrl(params);
  const cacheKey = url;
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  if (!options.force) {
    const cached = readCached<T>(cacheKey);
    if (cached !== null) return cached;
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new DailyDataApiError(
        'The daily archive returned an unreadable response.',
        response.status,
      );
    }

    if (!response.ok) {
      throw new DailyDataApiError(
        `The daily archive request failed (${response.status}).`,
        response.status,
        payload,
      );
    }

    const errorPayload = payload as ApiErrorPayload;
    if (errorPayload?.error) {
      throw new DailyDataApiError(
        errorPayload.message || errorPayload.error,
        response.status,
        payload,
      );
    }

    memoryCache.set(cacheKey, {
      expiresAt: Date.now() + ttlMs,
      value: payload,
    });

    return payload as T;
  } catch (error) {
    if (error instanceof DailyDataApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new DailyDataApiError('The daily archive took too long to respond.');
    }
    throw new DailyDataApiError(
      error instanceof Error ? error.message : 'The daily archive request failed.',
    );
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function assertIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DailyDataApiError('A date must use YYYY-MM-DD.');
  }
}

export function getDailyMeta(options?: { force?: boolean }) {
  return requestJson<DailyMeta>(
    { view: 'meta' },
    { ttlMs: 2 * 60 * 1000, force: options?.force },
  );
}

export function getDay(date: string, options?: { force?: boolean }) {
  assertIsoDate(date);
  return requestJson<DailyRecord>(
    { view: 'day', date },
    { ttlMs: 5 * 60 * 1000, force: options?.force },
  );
}

export function getYear(year: number, options?: { force?: boolean }) {
  return requestJson<DailyRecord[]>(
    { view: 'year', year },
    { ttlMs: 10 * 60 * 1000, force: options?.force },
  );
}

export function getSeries(
  metric: string,
  year: number,
  options?: { force?: boolean },
) {
  return requestJson<DailySeriesPoint[]>(
    { view: 'series', metric, year },
    { ttlMs: 10 * 60 * 1000, force: options?.force },
  );
}

export function getSameDate(
  month: number,
  day: number,
  options?: { force?: boolean },
) {
  return requestJson<DailyRecord[]>(
    { view: 'same-date', month, day },
    { ttlMs: 10 * 60 * 1000, force: options?.force },
  );
}
