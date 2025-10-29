// LifeLoggerz view counter (same-origin, filename-agnostic)
(function () {
  function norm(p) {
    if (!p) return "/";
    if (!p.startsWith("/")) p = "/" + p;
    p = p.replace(/\/+$/, "") || "/";
    return p;
  }
  function setTxt(el, label, count) {
    if (!el) return;
    if (typeof count === "number" && isFinite(count)) {
      el.textContent = `${count.toLocaleString()} ${label || "views"}`;
    } else {
      el.textContent = "—";
    }
  }

  // ✅ Do NOT depend on the script src filename; look for our data attrs instead
  const scripts = Array.from(document.querySelectorAll('script[data-el][data-path]'));
  if (!scripts.length) return;

  // Group by normalized path (dedupe writes/reads)
  const groups = new Map();
  for (const s of scripts) {
    const elId  = s.dataset.el || "";
    const el    = elId ? document.getElementById(elId) : null;
    const label = s.dataset.label || "views";
    const raw   = s.dataset.path || (location && location.pathname) || "/";
    const path  = norm(raw);

    // default write = true unless explicitly empty string
    const write = s.dataset.write === "" ? false : (s.dataset.write ? true : true);

    if (!groups.has(path)) groups.set(path, { els: [], label, write });
    const g = groups.get(path);
    g.els.push(el);
    g.label = label;
    g.write = g.write || write;
  }

  // Write first
  for (const [path, g] of groups) {
    if (!g.write) continue;
    fetch(`/v?p=${encodeURIComponent(path)}`, {
      method: "GET",
      cache: "no-store",
      mode: "cors",
    }).catch(() => {});
  }

  // Then read
  for (const [path, g] of groups) {
    fetch(`/count/views?p=${encodeURIComponent(path)}`, {
      cache: "no-store",
      mode: "cors",
    })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(({ count }) => g.els.forEach(el => setTxt(el, g.label, count)))
      .catch(() => g.els.forEach(el => setTxt(el, g.label, null)));
  }
})();
