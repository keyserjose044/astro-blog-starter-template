export const PRIMARY_ALBUM_STYLES = [
  'Pop','Rock','Alternative/Indie','Hip-Hop/Rap','R&B/Soul','Electronic/Dance','Jazz',
  'Classical','Country','Folk/Acoustic','Blues','Metal','Reggae/Ska','Latin','World/Global',
  'Punk','Funk','Gospel/Christian','Soundtrack/Film Score','New Age/Ambient','Experimental/Avant-Garde',
] as const;

const normalize = (value?: string | null) => String(value || '')
  .toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&amp;/g, '&').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');

const styleAliases = new Map<string, string>();
PRIMARY_ALBUM_STYLES.forEach((style) => styleAliases.set(normalize(style), style));
[
  ['Alternative','Alternative/Indie'],['Indie','Alternative/Indie'],['Indie/Alternative','Alternative/Indie'],
  ['Hip Hop/Rap','Hip-Hop/Rap'],['Hip Hop','Hip-Hop/Rap'],['R&B / Soul','R&B/Soul'],
  ['R and B/Soul','R&B/Soul'],['Electronic / Dance','Electronic/Dance'],['EDM/Electronic','Electronic/Dance'],
  ['Folk','Folk/Acoustic'],['Acoustic/Folk','Folk/Acoustic'],['Reggae & Ska','Reggae/Ska'],
  ['World','World/Global'],['Global/World','World/Global'],['Gospel / Christian','Gospel/Christian'],
  ['Film Score/Soundtrack','Soundtrack/Film Score'],['Soundtrack','Soundtrack/Film Score'],
  ['New Age / Ambient','New Age/Ambient'],['Ambient/New Age','New Age/Ambient'],
  ['Experimental','Experimental/Avant-Garde'],['Avant-Garde','Experimental/Avant-Garde'],
].forEach(([alias, canonical]) => styleAliases.set(normalize(alias), canonical));

const moodAliases = new Map([
  ['upbeat','Upbeat'],['relaxed','Relaxed'],['sentimental','Sentimental'],['energetic','Energetic'],
  ['calm','Calm'],['melancholic','Melancholic'],['melancholy','Melancholic'],['dark','Dark'],
  ['romantic','Romantic'],['mixed','Mixed'],
]);

const splitNote = (note?: string | null) => String(note || '').split(/\s*[·•]\s*/).map((part) => part.trim());

const isDuration = (value?: string | null) => {
  const raw = String(value || '').trim();
  return /^(?:\d+(?:\.\d+)?\s*(?:h|hr|hrs|hour|hours)\s*)?(?:\d+(?:\.\d+)?\s*(?:m|min|mins|minute|minutes))$/i.test(raw)
    || /^\d+:\d{1,2}(?::\d{1,2})?$/.test(raw);
};

const isReleaseLabel = (value?: string | null) => {
  const raw = String(value || '').trim();
  return /^(?:18|19|20)\d{2}$/i.test(raw)
    || /^(?:18|19|20)\d0'?s$/i.test(raw)
    || /^\d{1,2}(?:st|nd|rd|th)\s+century$/i.test(raw)
    || /^(?:unknown|n\/?a|undated)$/i.test(raw);
};

export const parseAlbumLengthMinutes = (value?: string | null): number | null => {
  const raw = String(value || '').toLowerCase().trim();
  if (!raw) return null;
  const hms = raw.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
  if (hms) return Number(hms[1]) * 60 + Number(hms[2]) + Number(hms[3]) / 60;
  const ms = raw.match(/^(\d+):(\d{1,2})$/);
  if (ms) return Number(ms[1]) + Number(ms[2]) / 60;
  const hours = raw.match(/([\d.]+)\s*(?:h|hr|hrs|hour|hours)\b/);
  const minutes = raw.match(/([\d.]+)\s*(?:m|min|mins|minute|minutes)\b/);
  if (!hours && !minutes) return null;
  const total = (hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0);
  return Number.isFinite(total) ? total : null;
};

export const getAlbumListenedYear = (date?: string | null) => {
  const raw = String(date || '').trim();
  const numeric = raw.match(/\b\d{1,2}[\/-]\d{1,2}[\/-](\d{2}|\d{4})\b/);
  if (numeric) return numeric[1].length === 2 ? String(2000 + Number(numeric[1])) : numeric[1];
  return raw.match(/\b(?:19|20)\d{2}\b/)?.[0] || '';
};

export const getAlbumReleaseInfo = (value?: string | null) => {
  const raw = String(value || '').trim();
  if (/^(18|19|20)\d{2}$/.test(raw)) {
    const year = Number(raw); const decade = Math.floor(year / 10) * 10;
    return { label: raw, year, sortYear: year, periodKey: `decade-${decade}`, periodLabel: `${decade}s`, periodOrder: decade, precision: 'year' };
  }
  const decadeMatch = raw.match(/^((?:18|19|20)\d)0'?s$/i);
  if (decadeMatch) {
    const decade = Number(`${decadeMatch[1]}0`);
    return { label: raw, year: null, sortYear: decade + 5, periodKey: `decade-${decade}`, periodLabel: `${decade}s`, periodOrder: decade, precision: 'decade' };
  }
  const centuryMatch = raw.match(/^(\d{1,2})(?:st|nd|rd|th)\s+century$/i);
  if (centuryMatch) {
    const century = Number(centuryMatch[1]); const start = (century - 1) * 100;
    const suffix = century % 100 >= 11 && century % 100 <= 13 ? 'th' : century % 10 === 1 ? 'st' : century % 10 === 2 ? 'nd' : century % 10 === 3 ? 'rd' : 'th';
    return { label: raw, year: null, sortYear: start + 50, periodKey: `century-${century}`, periodLabel: `${century}${suffix} century`, periodOrder: start, precision: 'century' };
  }
  return { label: raw || 'Unknown', year: null, sortYear: null, periodKey: 'unknown', periodLabel: 'Unknown release period', periodOrder: 100000, precision: 'unknown' };
};

export interface AlbumMeta {
  dateListened: string; artist: string; country: string; style: string;
  subgenre: string; mood: string; length: string; yearReleased: string;
}

export const parseAlbumMeta = (note?: string | null): AlbumMeta => {
  const parts = splitNote(note);
  const dateListened = parts[0] || '';
  const artist = parts[2] || '';
  const durationIndex = parts.findIndex((part, index) => index >= 3 && isDuration(part));
  const length = durationIndex >= 0 ? parts[durationIndex] : '';
  const releaseCandidate = durationIndex >= 0
    ? parts.slice(durationIndex + 1).find(isReleaseLabel)
    : [...parts.slice(3)].reverse().find(isReleaseLabel);
  const yearReleased = releaseCandidate || '';
  let descriptors = durationIndex >= 0 ? parts.slice(3, durationIndex) : parts.slice(3);
  if (yearReleased) descriptors = descriptors.filter((part) => part !== yearReleased);
  descriptors = descriptors.filter(Boolean);

  const stylePosition = descriptors.findIndex((part) => styleAliases.has(normalize(part)));
  let country = ''; let style = ''; let subgenre = ''; let mood = '';
  if (stylePosition >= 0) {
    country = descriptors.slice(0, stylePosition).join('/');
    style = styleAliases.get(normalize(descriptors[stylePosition])) || descriptors[stylePosition];
    const trailing = descriptors.slice(stylePosition + 1);
    const moodPosition = trailing.findIndex((part) => moodAliases.has(normalize(part)));
    if (moodPosition >= 0) {
      subgenre = trailing.slice(0, moodPosition).join(' / ');
      mood = moodAliases.get(normalize(trailing[moodPosition])) || trailing[moodPosition];
    } else subgenre = trailing.join(' / ');
  } else if (descriptors.length >= 2) {
    country = descriptors[0]; style = descriptors[1];
    const trailing = descriptors.slice(2);
    const moodPosition = trailing.findIndex((part) => moodAliases.has(normalize(part)));
    if (moodPosition >= 0) {
      subgenre = trailing.slice(0, moodPosition).join(' / ');
      mood = moodAliases.get(normalize(trailing[moodPosition])) || trailing[moodPosition];
    } else subgenre = trailing.join(' / ');
  } else if (descriptors.length === 1) style = descriptors[0];

  return { dateListened, artist, country, style, subgenre, mood, length, yearReleased };
};

export const formatAlbumDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60); const remainder = minutes % 60;
  if (hours <= 0) return `${remainder.toLocaleString('en-US')} min`;
  return `${hours.toLocaleString('en-US')} hr${hours === 1 ? '' : 's'}${remainder ? ` ${remainder} min` : ''}`;
};
