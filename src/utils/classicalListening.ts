export type RatingBucket = 'amazing' | 'gorgeous' | 'other';

export interface ListeningEntry {
  rowNumber: number;
  dateRaw: string;
  date: Date | null;
  composerId: string;
  composer: string;
  piece: string;
  youtubeUrl: string;
  form: string;
  minutes: number;
  rating: string;
  ratingBucket: RatingBucket;
  period: string;
  compositionYear: string;
}

export interface ListeningFeedResult {
  entries: ListeningEntry[];
  generatedAt: string;
  sourceSheet: string;
  rejectedRows: number;
}

type UnknownRow = Record<string, unknown>;

export const normalizeText = (value?: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const slugify = (value?: unknown) =>
  normalizeText(value).replace(/\s+/g, '-');

export const parseDateValue = (value?: unknown): Date | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;

  const cleaned = raw.replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  const numeric = cleaned.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/);

  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    const month = Number(numeric[1]);
    const day = Number(numeric[2]);
    const result = new Date(Date.UTC(year, month - 1, day));

    if (
      Number.isNaN(result.getTime()) ||
      result.getUTCFullYear() !== year ||
      result.getUTCMonth() !== month - 1 ||
      result.getUTCDate() !== day
    ) {
      return null;
    }

    return result;
  }

  const result = new Date(cleaned);
  return Number.isNaN(result.getTime()) ? null : result;
};

export const parseMinutes = (value?: unknown, assumeHours = false): number => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 0;

  const numeric = Number(raw.replace(/,/g, ''));
  if (Number.isFinite(numeric)) return Math.max(0, numeric * (assumeHours ? 60 : 1));

  const clock = raw.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (clock) {
    if (clock[3]) {
      return Number(clock[1]) * 60 + Number(clock[2]) + Number(clock[3]) / 60;
    }
    return Number(clock[1]) + Number(clock[2]) / 60;
  }

  const hours = Number(raw.match(/([\d.]+)\s*(?:h|hr|hrs|hour|hours)\b/)?.[1] || 0);
  const minutes = Number(raw.match(/([\d.]+)\s*(?:m|min|mins|minute|minutes)\b/)?.[1] || 0);
  const total = hours * 60 + minutes;
  return Number.isFinite(total) ? Math.max(0, total) : 0;
};

export const getRatingBucket = (rating?: unknown): RatingBucket => {
  const normalized = normalizeText(rating);
  if (normalized === 'amazing') return 'amazing';
  if (normalized === 'gorgeous') return 'gorgeous';
  return 'other';
};

export const isHttpUrl = (value?: unknown) => {
  const raw = String(value ?? '').trim();
  if (!raw) return false;

  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const cleanUrl = (value?: unknown) => {
  const raw = String(value ?? '').trim();
  return isHttpUrl(raw) ? raw : '';
};

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += character;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
};

const csvToObjects = (text: string): UnknownRow[] => {
  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => normalizeText(header));
  return rows.slice(1).map((values, index) => {
    const row: UnknownRow = { rownumber: index + 2 };
    headers.forEach((header, headerIndex) => {
      if (header) row[header] = String(values[headerIndex] ?? '').trim();
    });
    return row;
  });
};

const normalizeObjectKeys = (row: UnknownRow): UnknownRow =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      normalizeText(key.replace(/([a-z0-9])([A-Z])/g, '$1 $2')),
      value,
    ]),
  );

const firstValue = (row: UnknownRow, aliases: string[]) => {
  for (const alias of aliases) {
    const value = row[normalizeText(alias)];
    if (value !== undefined && value !== null && String(value).trim()) return value;
  }
  return '';
};

const extractRowsFromJson = (parsed: unknown): {
  rows: UnknownRow[];
  generatedAt: string;
  sourceSheet: string;
} => {
  if (Array.isArray(parsed)) {
    return { rows: parsed as UnknownRow[], generatedAt: '', sourceSheet: '' };
  }

  if (parsed && typeof parsed === 'object') {
    const object = parsed as Record<string, unknown>;
    const rows = Array.isArray(object.rows)
      ? (object.rows as UnknownRow[])
      : Array.isArray(object.data)
        ? (object.data as UnknownRow[])
        : [];

    return {
      rows,
      generatedAt: String(object.generatedAt ?? object.generated_at ?? ''),
      sourceSheet: String(object.sourceSheet ?? object.source_sheet ?? object.sheet ?? ''),
    };
  }

  return { rows: [], generatedAt: '', sourceSheet: '' };
};

const makeEntry = (sourceRow: UnknownRow, fallbackRowNumber: number): ListeningEntry | null => {
  const row = normalizeObjectKeys(sourceRow);
  const dateRaw = String(firstValue(row, ['date', 'listening date', 'listened date', 'date listened'])).trim();

  // The user's governing rule: an empty Column A/date means the row is not part of the listening pool.
  if (!dateRaw) return null;

  const composer = String(firstValue(row, ['composer', 'composer name', 'name'])).trim();
  let piece = String(firstValue(row, ['piece', 'work', 'composition', 'title'])).trim();
  let youtubeUrl = cleanUrl(firstValue(row, ['youtube url', 'youtube_url', 'url', 'link', 'piece url', 'recording url']));

  if (!youtubeUrl && isHttpUrl(piece)) {
    youtubeUrl = piece;
    piece = 'Linked performance';
  }

  if (!composer || !piece) return null;

  const hoursValue = firstValue(row, ['hours', 'listening hours']);
  const minutesValue = firstValue(row, ['minutes', 'mins', 'duration', 'length', 'length in minutes']);
  const rating = String(firstValue(row, ['rating', 'score'])).trim();
  const rowNumberValue = Number(firstValue(row, ['row number', 'rownumber', 'source row', 'source_row']));

  return {
    rowNumber: Number.isFinite(rowNumberValue) && rowNumberValue > 0 ? rowNumberValue : fallbackRowNumber,
    dateRaw,
    date: parseDateValue(dateRaw),
    composerId: slugify(firstValue(row, ['composer id', 'composer_id', 'composer slug', 'slug'])),
    composer,
    piece,
    youtubeUrl,
    form: String(firstValue(row, ['genre form', 'genre/form', 'form', 'genre', 'type'])).trim(),
    minutes: hoursValue ? parseMinutes(hoursValue, true) : parseMinutes(minutesValue),
    rating,
    ratingBucket: getRatingBucket(rating),
    period: String(firstValue(row, ['movement', 'period', 'era', 'style'])).trim(),
    compositionYear: String(firstValue(row, ['year of composition', 'composition year', 'year composed', 'year'])).trim(),
  };
};

export const parseClassicalListeningFeed = (
  text: string,
  contentType = '',
): ListeningFeedResult => {
  const trimmed = text.trim();
  const looksJson = contentType.toLowerCase().includes('json') || trimmed.startsWith('{') || trimmed.startsWith('[');

  let rows: UnknownRow[] = [];
  let generatedAt = '';
  let sourceSheet = '';

  if (looksJson) {
    const parsed = JSON.parse(trimmed || '[]');
    const extracted = extractRowsFromJson(parsed);
    rows = extracted.rows;
    generatedAt = extracted.generatedAt;
    sourceSheet = extracted.sourceSheet;
  } else {
    rows = csvToObjects(text);
  }

  const entries: ListeningEntry[] = [];
  let rejectedRows = 0;

  rows.forEach((row, index) => {
    const entry = makeEntry(row, index + 2);
    if (entry) entries.push(entry);
    else rejectedRows += 1;
  });

  return { entries, generatedAt, sourceSheet, rejectedRows };
};

export const formatListeningDate = (date: Date | null) =>
  date
    ? new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(date)
    : '';

export const formatListeningHours = (minutes: number) => {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  const hours = safeMinutes / 60;

  if (hours < 1) return `${Math.round(safeMinutes)} min`;
  return `${hours.toLocaleString('en-US', { maximumFractionDigits: 1 })} hr${Math.abs(hours - 1) < 0.05 ? '' : 's'}`;
};
