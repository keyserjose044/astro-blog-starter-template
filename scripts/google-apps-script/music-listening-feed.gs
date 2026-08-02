/**
 * LifeLoggerz complete Music Listen Log JSON feed
 *
 * Deploy this Apps Script as a web app from the Hobbies spreadsheet.
 * The GitHub Pages deployment downloads this feed into a static JSON snapshot,
 * so visitors never query Google Sheets directly.
 */

const LIFELOGGERZ_MUSIC_LISTENING_CONFIG = {
  spreadsheetId: '1jWNPYBaSY0-p2FTdGun9TLAWZshdzPOhfMxBHAcLaGU',
  sourceSheetGid: 1699822503,
  sourceSheetName: 'Listen Log',
  firstDataRow: 2,

  // Fixed 1-based source columns. Blank spacer columns are intentionally skipped.
  columns: {
    date: 1,          // A
    artist: 4,        // D
    title: 6,         // F — Album/Piece
    minutes: 8,       // H — Min
    rating: 10,       // J
    genre: 12,        // L
    subgenre: 14,     // N
    country: 16,      // P — COO
    year: 18,         // R
    instrumentRaw: 20,// T — Instrm
    albumRaw: 22,     // V — Album? (also contains occasional free-text notes)
  },
};

function doGet() {
  const payload = buildLifeLoggerzMusicListeningPayload_();
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Run manually in Apps Script to inspect the public-safe payload. */
function testLifeLoggerzMusicListeningFeed() {
  const payload = buildLifeLoggerzMusicListeningPayload_();
  console.log(JSON.stringify({
    generatedAt: payload.generatedAt,
    sourceSheet: payload.sourceSheet,
    rowCount: payload.rows.length,
    firstThreeRows: payload.rows.slice(0, 3),
    lastThreeRows: payload.rows.slice(-3),
  }, null, 2));
}

function buildLifeLoggerzMusicListeningPayload_() {
  const config = LIFELOGGERZ_MUSIC_LISTENING_CONFIG;
  const spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet = getMusicSheetByGid_(spreadsheet, config.sourceSheetGid);

  if (!sheet) {
    throw new Error(
      `No sheet with gid ${config.sourceSheetGid} was found in ${spreadsheet.getName()}.`
    );
  }

  if (config.sourceSheetName && sheet.getName() !== config.sourceSheetName) {
    console.warn(`Expected sheet "${config.sourceSheetName}" but gid ${config.sourceSheetGid} is "${sheet.getName()}".`);
  }

  const lastRow = sheet.getLastRow();
  const lastColumnNeeded = Math.max(...Object.values(config.columns));

  if (lastRow < config.firstDataRow) {
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      sourceSpreadsheet: spreadsheet.getName(),
      sourceSheet: sheet.getName(),
      sourceSheetGid: sheet.getSheetId(),
      rows: [],
    };
  }

  const rowCount = lastRow - config.firstDataRow + 1;
  const range = sheet.getRange(config.firstDataRow, 1, rowCount, lastColumnNeeded);
  const displayValues = range.getDisplayValues();
  const richTextValues = range.getRichTextValues();
  const formulas = range.getFormulas();
  const c = config.columns;
  const rows = [];

  displayValues.forEach((values, index) => {
    const date = cleanMusicValue_(values[c.date - 1]);
    if (!date) return;

    const artist = cleanMusicValue_(values[c.artist - 1]);
    const titleRaw = cleanMusicValue_(values[c.title - 1]);

    // Only structural identifiers are required. Older/newer rows may legitimately
    // have sparse genre/country/year metadata and should remain in the archive.
    if (!artist || !titleRaw) return;

    const albumRaw = cleanMusicValue_(values[c.albumRaw - 1]);
    const richTitle = richTextValues[index][c.title - 1];
    const titleFormula = formulas[index][c.title - 1];
    const sourceUrl = extractMusicCellLink_(richTitle, titleFormula, titleRaw);
    const title = isMusicHttpUrl_(titleRaw) ? 'Linked music entry' : titleRaw;
    const isAlbum = /^(?:y|yes|album|full album)$/i.test(albumRaw) ||
      /\b(?:full album|album completo|disco completo|full lp)\b/i.test(titleRaw);

    rows.push({
      rowNumber: config.firstDataRow + index,
      date,
      artist,
      title,
      sourceUrl,
      minutes: cleanMusicValue_(values[c.minutes - 1]),
      rating: cleanMusicValue_(values[c.rating - 1]),
      genre: cleanMusicValue_(values[c.genre - 1]),
      subgenre: cleanMusicValue_(values[c.subgenre - 1]),
      country: cleanMusicValue_(values[c.country - 1]),
      year: cleanMusicValue_(values[c.year - 1]),
      instrumentRaw: cleanMusicValue_(values[c.instrumentRaw - 1]),
      albumRaw,
      isAlbum,
    });
  });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourceSpreadsheet: spreadsheet.getName(),
    sourceSheet: sheet.getName(),
    sourceSheetGid: sheet.getSheetId(),
    rows,
  };
}

function getMusicSheetByGid_(spreadsheet, gid) {
  return spreadsheet.getSheets().find(sheet => sheet.getSheetId() === Number(gid)) || null;
}

function cleanMusicValue_(value) {
  return String(value == null ? '' : value).trim();
}

function extractMusicCellLink_(richTextValue, formula, displayedValue) {
  if (richTextValue) {
    const fullCellLink = richTextValue.getLinkUrl();
    if (isMusicHttpUrl_(fullCellLink)) return fullCellLink;

    const runs = richTextValue.getRuns ? richTextValue.getRuns() : [];
    for (const run of runs) {
      const runLink = run.getLinkUrl();
      if (isMusicHttpUrl_(runLink)) return runLink;
    }
  }

  const hyperlinkMatch = String(formula || '').match(
    /^=HYPERLINK\(\s*"([^"]+)"\s*[;,]/i
  );
  if (hyperlinkMatch && isMusicHttpUrl_(hyperlinkMatch[1])) return hyperlinkMatch[1];

  if (isMusicHttpUrl_(displayedValue)) return displayedValue;
  return '';
}

function isMusicHttpUrl_(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}
