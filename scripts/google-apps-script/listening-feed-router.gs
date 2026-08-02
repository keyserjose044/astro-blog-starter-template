/**
 * LifeLoggerz shared listening-feed web-app router.
 *
 * Replace the existing doGet() in Classical Listening.gs with this single
 * doGet(e). Keep buildLifeLoggerzClassicalPayload_() in the Classical file and
 * add music-listening-feed.gs to the same Apps Script project.
 *
 * Existing Classical URL:
 *   .../exec
 *   .../exec?feed=classical
 *
 * Complete Music Listen Log URL:
 *   .../exec?feed=music
 */
function doGet(e) {
  const feed = String(e && e.parameter && e.parameter.feed || '')
    .trim()
    .toLowerCase();

  const payload = feed === 'music' || feed === 'listen-log' || feed === 'listenlog'
    ? buildLifeLoggerzMusicListeningPayload_()
    : buildLifeLoggerzClassicalPayload_();

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
