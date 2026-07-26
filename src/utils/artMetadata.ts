const normalize = (value?: string | null) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ')
  .trim();

const splitNote = (note?: string | null) => String(note || '')
  .split(/\s*(?:·|•)\s*/)
  .map((part) => part.trim());

export const looksLikeArtworkYear = (value?: string | null) => {
  const raw = normalize(value);
  return Boolean(raw) && (
    /\b(?:bc|bce|ad|ce)\b/.test(raw)
    || /\b\d{1,2}(?:st|nd|rd|th)\s+century\b/.test(raw)
    || /(?:^|\s)(?:c(?:irca)?\.?\s*)?-?\d{1,4}(?:\s|$|[–—/.,-])/.test(raw)
  );
};

export interface ArtMeta {
  dateViewed: string;
  artist: string;
  country: string;
  medium: string;
  movement: string;
  artworkYear: string;
  source: string;
}

export const parseArtMeta = (note?: string | null): ArtMeta => {
  const parts = splitNote(note);
  const yearComesFourth = looksLikeArtworkYear(parts[3]);

  return {
    dateViewed: parts[0] || '',
    artist: parts[2] || '',
    artworkYear: yearComesFourth ? (parts[3] || '') : (parts[6] || ''),
    medium: parts[4] || '',
    movement: parts[5] || '',
    country: yearComesFourth ? (parts[6] || '') : (parts[3] || ''),
    source: parts.slice(7).filter(Boolean).join(' · '),
  };
};

export const getArtViewedYear = (dateViewed?: string | null) => {
  const raw = String(dateViewed || '').trim();
  const numeric = raw.match(/\b\d{1,2}[\/-]\d{1,2}[\/-](\d{2}|\d{4})\b/);
  if (numeric) return numeric[1].length === 2 ? String(2000 + Number(numeric[1])) : numeric[1];
  return raw.match(/\b(?:19|20)\d{2}\b/)?.[0] || '';
};

export type ArtworkDatePrecision = 'year' | 'range' | 'century' | 'unknown';

export interface ArtworkDateInfo {
  label: string;
  year: number | null;
  sortYear: number | null;
  precision: ArtworkDatePrecision;
  periodKey: string;
  periodLabel: string;
  periodOrder: number;
}

const ordinal = (value: number) => {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  const mod10 = value % 10;
  if (mod10 === 1) return `${value}st`;
  if (mod10 === 2) return `${value}nd`;
  if (mod10 === 3) return `${value}rd`;
  return `${value}th`;
};

const periodForYear = (year: number | null) => {
  if (year === null) return { key: 'unknown', label: 'Unknown date', order: 100000 };
  if (year < 500) return { key: 'ancient', label: 'Ancient (before 500)', order: -10000 };
  if (year < 1400) return { key: 'medieval', label: 'Medieval (500–1399)', order: 500 };
  if (year < 1600) return { key: 'renaissance', label: 'Renaissance (1400–1599)', order: 1400 };
  if (year < 1900) {
    const century = Math.ceil(year / 100);
    return { key: `century-${century}`, label: `${ordinal(century)} century`, order: century * 100 };
  }
  const decade = Math.floor(year / 10) * 10;
  return { key: `decade-${decade}`, label: `${decade}s`, order: decade };
};

export const getArtworkDateInfo = (value?: string | null): ArtworkDateInfo => {
  const label = String(value || '').trim();
  const raw = normalize(label).replace(/,/g, '').replace(/[–—]/g, '-');
  if (!raw) {
    const period = periodForYear(null);
    return { label: 'Unknown', year: null, sortYear: null, precision: 'unknown', periodKey: period.key, periodLabel: period.label, periodOrder: period.order };
  }

  const isBce = /\b(?:bc|bce)\b/.test(raw);
  const centuryMatch = raw.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+century\b/);
  if (centuryMatch) {
    const century = Number(centuryMatch[1]);
    if (Number.isFinite(century) && century > 0) {
      const midpoint = isBce ? -(century * 100 - 50) : (century - 1) * 100 + 50;
      const period = periodForYear(midpoint);
      return { label, year: null, sortYear: midpoint, precision: 'century', periodKey: period.key, periodLabel: period.label, periodOrder: period.order };
    }
  }

  const numericTokens = [...raw.matchAll(/-?\d{1,4}/g)]
    .map((match) => Number(match[0]))
    .filter(Number.isFinite);

  if (!numericTokens.length) {
    const period = periodForYear(null);
    return { label, year: null, sortYear: null, precision: 'unknown', periodKey: period.key, periodLabel: period.label, periodOrder: period.order };
  }

  const signed = numericTokens.slice(0, 2).map((year) => isBce ? -Math.abs(year) : year);
  const sortYear = signed.length > 1 ? Math.round((signed[0] + signed[1]) / 2) : signed[0];
  const precision: ArtworkDatePrecision = signed.length > 1 || /\b(?:c|ca|circa|about|before|after)\.?\b/.test(raw) ? 'range' : 'year';
  const period = periodForYear(sortYear);

  return {
    label,
    year: precision === 'year' ? sortYear : null,
    sortYear,
    precision,
    periodKey: period.key,
    periodLabel: period.label,
    periodOrder: period.order,
  };
};