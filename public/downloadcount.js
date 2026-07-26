(function () {
  function renderCount(elId, key, offsetValue) {
    if (!elId || !key) return;

    var offset = Number.parseInt(offsetValue || "0", 10);
    if (!Number.isFinite(offset)) offset = 0;

    fetch("https://v.lifeloggerz.com/count/downloads?key=" + encodeURIComponent(key), {
      cache: "no-store"
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var el = document.getElementById(elId);
        var liveCount = (data && typeof data.count === "number") ? data.count : 0;
        var total = Math.max(0, liveCount + offset);
        if (el) el.textContent = total + " Download" + (total === 1 ? "" : "s");
      })
      .catch(function () { /* silently ignore */ });
  }

  window.addEventListener("DOMContentLoaded", function () {
    document
      .querySelectorAll('script[src$="/downloadcount.js"]')
      .forEach(function (s) {
        renderCount(s.dataset.el, s.dataset.key, s.dataset.offset);
      });
  });
})();
