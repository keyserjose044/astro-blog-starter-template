// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// Static GitHub Pages deployment with built-in internal-link prefetching.
export default defineConfig({
  site: "https://lifeloggerz.com",
  base: "/",
  output: "static",
  integrations: [mdx(), sitemap()],
  prefetch: {
    prefetchAll: true,
    defaultStrategy: "hover",
  },
});
