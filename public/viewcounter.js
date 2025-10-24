(function(){
  function normalize(p){ if(!p) return "/"; return p.startsWith("/") ? p : "/"+p; }
  window.addEventListener("DOMContentLoaded", function(){
    document.querySelectorAll('script[src$="/viewcounter.js"]').forEach(function(s){
      var elId  = s.dataset.el;
      var p     = normalize(s.dataset.path || location.pathname);
      var label = s.dataset.label || "views";

      // write beacon
      var img = new Image();
      img.src = "https://v.lifeloggerz.com/v?p=" + encodeURIComponent(p);

      // read & render
      fetch("https://v.lifeloggerz.com/count/views?p=" + encodeURIComponent(p), { cache: "no-store" })
        .then(function(r){ return r.json(); })
        .then(function(data){
          var el = document.getElementById(elId);
          if (el) el.textContent = data.count + " " + label;
        })
        .catch(function(e){ console.warn("[ViewCounter] read failed:", e); });
    });
  });
})();
