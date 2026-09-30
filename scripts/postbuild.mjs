// Post-build steps for GitHub Pages:
// - Copies index.html into a folder per client route so direct visits get HTTP 200
//   instead of being served by 404.html (which GitHub Pages returns with status 404).
// - Generates sitemap.xml with the build date.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist";
const SITE_URL = "https://luisbedoia.github.io/thermoprops/";

// Keep in sync with the routes in src/Router.tsx.
const APP_ROUTES = ["settings", "workspace"];

// Only canonical, indexable URLs belong here.
const SITEMAP_PATHS = [""];

const indexHtml = join(DIST, "index.html");

copyFileSync(indexHtml, join(DIST, "404.html"));
for (const route of APP_ROUTES) {
  mkdirSync(join(DIST, route), { recursive: true });
  copyFileSync(indexHtml, join(DIST, route, "index.html"));
}

const lastmod = new Date().toISOString().slice(0, 10);
const urls = SITEMAP_PATHS.map(
  (path) => `  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
).join("\n");

writeFileSync(
  join(DIST, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
);

console.log(
  `postbuild: 404.html, ${APP_ROUTES.map((r) => `${r}/index.html`).join(", ")}, sitemap.xml (${SITEMAP_PATHS.length} URLs)`,
);
