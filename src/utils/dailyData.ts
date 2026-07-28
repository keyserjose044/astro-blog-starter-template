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
  sleep: { hours: number | null; napHours: number | null; category: string | null };
  weather: { highF: number | null; lowF: number | null; flags: string[] };
  dayEvent: string | null;
  food: {
    breakfastType: string | null;
    lunchType: string | null;
    dinnerType: string | null;
  };
  diary: { words: number | null };
  work: { hours: number | null; category: string | null };
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

type ApiErrorPayload = { error?: string; message?: string };
type CacheEntry<T> = { savedAt: number; expiresAt: number; value: T };
type RequestOptions = {
  ttlMs?: number;
  timeoutMs?: number;
  force?: boolean;
  staleMs?: number;
};

const memoryCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();
const STORAGE_PREFIX = 'lifeloggerz-daily-api-v3:';
const DEFAULT_TTL_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_STALE_MS = 24 * 60 * 60 * 1000;

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
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  return url.toString();
}

function storageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function readEntry<T>(key: string, allowStale = false, staleMs = DEFAULT_STALE_MS): T | null {
  const now = Date.now();
  const memory = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (memory && (memory.expiresAt > now || (allowStale && now - memory.savedAt <= staleMs))) {
    return memory.value;
  }

  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const stored = JSON.parse(raw) as CacheEntry<T>;
    if (!stored || typeof stored.savedAt !== 'number' || !('value' in stored)) return null;
    if (stored.expiresAt <= now && (!allowStale || now - stored.savedAt > staleMs)) return null;
    memoryCache.set(key, stored as CacheEntry<unknown>);
    return stored.value;
  } catch {
    return null;
  }
}

function writeEntry<T>(key: string, value: T, ttlMs: number) {
  const entry: CacheEntry<T> = {
    savedAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
    value,
  };
  memoryCache.set(key, entry as CacheEntry<unknown>);
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // Memory caching still works when local storage is full or unavailable.
  }
}

async function requestJson<T>(
  params: Record<string, string | number>,
  options: RequestOptions = {},
): Promise<T> {
  const url = buildUrl(params);
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

  if (!options.force) {
    const cached = readEntry<T>(url);
    if (cached !== null) return cached;
    const pending = inFlight.get(url);
    if (pending) return pending as Promise<T>;
  }

  const request = (async () => {
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

      writeEntry(url, payload, ttlMs);
      return payload as T;
    } catch (error) {
      const stale = readEntry<T>(url, true, options.staleMs ?? DEFAULT_STALE_MS);
      if (stale !== null) return stale;
      if (error instanceof DailyDataApiError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DailyDataApiError('The daily archive took too long to respond.');
      }
      throw new DailyDataApiError(
        error instanceof Error ? error.message : 'The daily archive request failed.',
      );
    } finally {
      globalThis.clearTimeout(timeout);
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, request as Promise<unknown>);
  return request;
}

function assertIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DailyDataApiError('A date must use YYYY-MM-DD.');
  }
}

function cachedYear(year: number) {
  return readEntry<DailyRecord[]>(buildUrl({ view: 'year', year }));
}

export function dailyMetricValue(record: DailyRecord, metric: string): number | null {
  const values: Record<string, number | null> = {
    sleepHours: record.sleep.hours,
    napHours: record.sleep.napHours,
    weatherHighF: record.weather.highF,
    weatherLowF: record.weather.lowF,
    diaryWords: record.diary.words,
    workHours: record.work.hours,
    languageMinutes: record.hobbies.languageMinutes,
    runningMiles: record.hobbies.runningMiles,
    treadmillMinutes: record.hobbies.treadmillMinutes,
    treadmillMiles: record.hobbies.treadmillMiles,
    totalDistanceMiles: record.hobbies.totalDistanceMiles,
    guitarMinutes: record.hobbies.guitarMinutes,
    danceMinutes: record.hobbies.danceMinutes,
    audiobookMinutes: record.audiobook.minutes,
  };
  return Object.prototype.hasOwnProperty.call(values, metric) ? values[metric] : null;
}

export function getDailyMeta(options?: { force?: boolean }) {
  return requestJson<DailyMeta>(
    { view: 'meta' },
    { ttlMs: 5 * 60 * 1000, force: options?.force },
  );
}

export function getYear(year: number, options?: { force?: boolean }) {
  return requestJson<DailyRecord[]>(
    { view: 'year', year },
    { ttlMs: 30 * 60 * 1000, force: options?.force },
  );
}

export async function getYears(years: number[], options?: { force?: boolean }) {
  const unique = Array.from(new Set(years)).sort((a, b) => a - b);
  const groups = await Promise.all(unique.map((year) => getYear(year, options)));
  return groups.flat().sort((a, b) => a.date.localeCompare(b.date));
}

export function prefetchYear(year: number) {
  void getYear(year).catch(() => undefined);
}

export async function getDay(date: string, options?: { force?: boolean }) {
  assertIsoDate(date);
  if (!options?.force) {
    const yearRecords = cachedYear(Number(date.slice(0, 4)));
    const record = yearRecords?.find((item) => item.date === date);
    if (record) return record;
  }
  return requestJson<DailyRecord>(
    { view: 'day', date },
    { ttlMs: 10 * 60 * 1000, force: options?.force },
  );
}

export async function getSeries(
  metric: string,
  year: number,
  options?: { force?: boolean },
) {
  const records = await getYear(year, options);
  return records.map<DailySeriesPoint>((record) => ({
    date: record.date,
    day: record.day,
    status: record.status,
    value: dailyMetricValue(record, metric),
  }));
}

export function getSameDate(
  month: number,
  day: number,
  options?: { force?: boolean },
) {
  return requestJson<DailyRecord[]>(
    { view: 'same-date', month, day },
    { ttlMs: 30 * 60 * 1000, force: options?.force },
  );
}
