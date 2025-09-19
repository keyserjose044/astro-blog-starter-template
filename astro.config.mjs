// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// No adapter needed for GitHub Pages (static output)
export default defineConfig({
  site: "https://lifeloggerz.com",
  base: "/",                 // root domain
  output: "static",          // default, but explicit is fine
  integrations: [mdx(), sitemap()],
});
