(function () {
  function renderCount(elId, key) {
    if (!elId || !key) return;
    fetch("https://v.lifeloggerz.com/count/downloads?key=" + encodeURIComponent(key), {
      cache: "no-store"
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var el = document.getElementById(elId);
        var n = (data && typeof data.count === "number") ? data.count : 0;
        if (el) el.textContent = n + " Download" + (n === 1 ? "" : "s");
      })
      .catch(function () { /* silently ignore */ });
  }

  // Run once the DOM is ready
  window.addEventListener("DOMContentLoaded", function () {
    document
      .querySelectorAll('script[src$="/downloadcount.js"]')
      .forEach(function (s) {
        renderCount(s.dataset.el, s.dataset.key);
      });
  });
})();
