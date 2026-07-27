(function () {
  function renderCount(script) {
    if (!script || script.dataset.downloadCountBound === "true") return;

    var elId = script.dataset.el;
    var key = script.dataset.key;
    var countUrl = script.dataset.url;
    if (!elId || !key || !countUrl) return;

    script.dataset.downloadCountBound = "true";

    var offset = Number.parseInt(script.dataset.offset || "0", 10);
    if (!Number.isFinite(offset)) offset = 0;

    fetch(countUrl, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Download count request failed");
        return response.json();
      })
      .then(function (data) {
        var el = document.getElementById(elId);
        var liveCount = Number(data && data.count);
        if (!Number.isFinite(liveCount)) liveCount = 0;

        var total = Math.max(0, liveCount + offset);
        if (el) {
          el.textContent = total.toLocaleString("en-US") + " Download" + (total === 1 ? "" : "s");
        }
      })
      .catch(function () { /* Keep the placeholder when the counter is unavailable. */ });
  }

  var current = document.currentScript;
  if (current && current.matches("script[data-download-count]")) {
    renderCount(current);
    return;
  }

  document.querySelectorAll("script[data-download-count]").forEach(renderCount);
})();
