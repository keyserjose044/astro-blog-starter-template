// LifeLoggerz view counter (same-origin, slash-safe)
// Works with ViewCounter.astro (data-el, data-path, data-label)
// Optional: add data-write="1" on the <script> to increment; defaults to write.
(function () {
  function norm(p) {
    if (!p) return "/";
    if (!p.startsWith("/")) p = "/" + p;
    p = p.replace(/\/+$/, "") || "/";
    return p;
  }

  function update(el, label, count) {
    if (!el) return;
    if (typeof count === "number" && isFinite(count)) {
      el.textContent = `${count.toLocaleString()} ${label || "views"}`;
    } else {
      el.textContent = "—";
    }
  }

  // Find all instances of this loader (supports multiple counters)
  const scripts = document.querySelectorAll('script[src$="/viewcounter.js"]');
  if (!scripts.length) return;

  // Group by normalized path so we write/read once per unique path
  const groups = new Map();
  for (const s of scripts) {
    const elId  = s.dataset.el || "";
    const el    = elId ? document.getElementById(elId) : null;
    const label = s.dataset.label || "views";
    const raw   = s.dataset.path || (location && location.pathname) || "/";
    const path  = norm(raw);
    const write = s.dataset.write === "" ? false : (s.dataset.write ? true : true); 
    // default write=true; set data-write="" to force false, or data-write="1" to force true

    if (!groups.has(path)) groups.set(path, { els: [], label, write });
    const g = groups.get(path);
    g.els.push(el);
    g.label = label;               // last label wins for this path (fine for single-page)
    g.write = g.write || write;    // if any instance wants write, we write once
  }

  // Write (increment) first
  for (const [path, g] of groups) {
    if (!g.write) continue;
    fetch(`/v?p=${encodeURIComponent(path)}`, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
    }).catch(() => {});
  }

  // Then read and render
  for (const [path, g] of groups) {
    fetch(`/count/views?p=${encodeURIComponent(path)}`, {
      cache: "no-store",
      mode: "cors",
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(({ count }) => g.els.forEach(el => update(el, g.label, count)))
      .catch(() => g.els.forEach(el => update(el, g.label, null)));
  }
})();
