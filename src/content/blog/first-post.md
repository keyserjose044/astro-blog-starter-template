---
title: "Hyperefficiency with Time"
description: "Every Minute Counts: Personal Time Audit"
pubDate: "2025-09-17"
heroImage: "/blog-placeholder-3.jpg"
---

What it do, what it do. It's ya boi, Lifeloggerz

How bout that!

I made a website!

<div class="sheet-wrap">
  <iframe
    id="sheet-iframe"
    src="https://docs.google.com/spreadsheets/d/e/2PACX-1vRla1G-D0S1J9hAHkDjtR1JgL07qrliMtBV6x4QfKdn6ffPuPSvdN3Fz62eTiLn7xdZZRUjg4hVRtkc/pubhtml?widget=true&headers=false"
    width="100%"
    style="border:0;"
    loading="lazy"
  ></iframe>
</div>

<style>
  .sheet-wrap {
    width: 100%;
    min-height: 500px; /* fallback */
  }
  #sheet-iframe {
    width: 100%;
    border: 0;
    transition: height 0.3s ease;
  }
</style>

<script>
  const iframe = document.getElementById("sheet-iframe");
  iframe.addEventListener("load", () => {
    try {
      // Try to auto-adjust height by reading scrollHeight
      const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (innerDoc && innerDoc.body) {
        iframe.style.height = innerDoc.body.scrollHeight + "px";
      }
    } catch (e) {
      // Cross-origin restriction fallback
      iframe.style.height = "800px";
    }
  });
</script>
