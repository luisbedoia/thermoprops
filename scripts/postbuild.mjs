// Post-build steps for GitHub Pages:
// - Writes each client route's page into its own folder, so direct visits get
//   HTTP 200 instead of being served by 404.html (which GitHub Pages returns
//   with status 404). Each page is rendered in advance (src/prerender.tsx):
//   its HTML holds what React then shows, for search engines and without a
//   change on screen when the app starts. Each has its own title and
//   description.
// - Generates sitemap.xml with the build date.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const DIST = "dist";
const SITE_URL = "https://luisbedoia.github.io/thermoprops/";

// Keep in sync with the routes in src/Router.tsx. "" is the landing.
const APP_ROUTES = [
  "",
  "home",
  "explorer",
  "settings",
  "workspace",
  "worksheet",
  "script",
];

// The text face, asked for with the page instead of after its stylesheet:
// the first paint is in Inter, not in a fallback then Inter again.
const inter = readdirSync(join(DIST, "assets")).find((f) =>
  /^inter-latin-wght-normal-.*\.woff2$/.test(f),
);
if (!inter) throw new Error("No Inter (latin) font in dist/assets");
const template = readFileSync(join(DIST, "index.html"), "utf8").replace(
  "</title>",
  `</title>\n    <link rel="preload" href="/thermoprops/assets/${inter}" as="font" type="font/woff2" crossorigin />`,
);

const server = await createServer({
  mode: "production",
  base: "/thermoprops/",
  appType: "custom",
  server: { middlewareMode: true, hmr: false },
  logLevel: "error",
});
let prerender, PAGES;
try {
  ({ prerender } = await server.ssrLoadModule("/src/prerender.tsx"));
  ({ PAGES } = await server.ssrLoadModule("/src/pages.ts"));
} catch (error) {
  await server.close();
  throw error;
}

const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

function page(route) {
  let html = template.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${prerender(`/${route}`)}</div>`,
  );
  if (!html.includes(`<div id="root"><`)) {
    throw new Error('index.html has no empty <div id="root"></div>');
  }
  const meta = PAGES[route];
  if (meta) {
    // GitHub Pages serves a folder's page at its address with a slash.
    const url = `${SITE_URL}${route}/`;
    html = html
      .replace(/<title>[^<]*<\/title>/, `<title>${meta.title}</title>`)
      .replace(
        /(<meta\s+name="description"\s+content=")[^"]*"/,
        `$1${escape(meta.description)}"`,
      )
      .replace(
        /(<meta\s+(?:property|name)="(?:og|twitter):title"\s+content=")[^"]*"/g,
        `$1${escape(meta.title)}"`,
      )
      .replace(
        /(<meta\s+(?:property|name)="(?:og|twitter):description"\s+content=")[^"]*"/g,
        `$1${escape(meta.description)}"`,
      )
      .replace(/(<link rel="canonical" href=")[^"]*"/, `$1${url}"`)
      .replace(/(<meta\s+property="og:url"\s+content=")[^"]*"/, `$1${url}"`);
    // The app's own pages: not for search results.
    if (meta.noindex)
      html = html.replace(
        "</title>",
        '</title>\n    <meta name="robots" content="noindex" />',
      );
  }
  return html;
}

try {
  for (const route of APP_ROUTES) {
    const dir = join(DIST, route);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), page(route));
  }
  // Unknown addresses: the app renders them (and takes them to the landing)
  // from an empty page, as no built page matches them.
  writeFileSync(join(DIST, "404.html"), template);
} finally {
  await server.close();
}

// Only canonical, indexable URLs belong here.
const SITEMAP_PATHS = [
  "",
  ...Object.keys(PAGES).filter((route) => !PAGES[route].noindex),
];
const lastmod = new Date().toISOString().slice(0, 10);
const urls = SITEMAP_PATHS.map(
  (path) => `  <url>
    <loc>${SITE_URL}${path && `${path}/`}</loc>
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
  `postbuild: index.html, 404.html, ${APP_ROUTES.filter(Boolean)
    .map((r) => `${r}/index.html`)
    .join(", ")}, sitemap.xml (${SITEMAP_PATHS.length} URLs)`,
);
