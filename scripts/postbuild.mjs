// Post-build steps for GitHub Pages:
// - Writes each client route's page into its own folder, so direct visits get
//   HTTP 200 instead of being served by 404.html (which GitHub Pages returns
//   with status 404). Each page is rendered in advance (src/prerender.tsx):
//   its HTML holds what React then shows, for search engines and without a
//   change on screen when the app starts. Each has its own title and
//   description.
// - Writes the landing again in Spanish, at /es/: the same page in the other
//   language, linked to the English one (hreflang) for search engines. The
//   rest of the app has no Spanish address: it follows the visitor's choice
//   (src/i18n/index.ts), which /es/ sets.
// - Generates sitemap.xml with the build date.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer } from "vite";

const DIST = "dist";
const SITE_URL = "https://luisbedoia.github.io/thermoprops/";

// Keep in sync with the routes in src/Router.tsx, and with the pages the
// service worker keeps for offline use (public/sw-pages.js). "" is the landing.
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

/**
 * The app's modules in one language: `prerender` and the pages' texts. The
 * language is read once, as the modules load (src/i18n/index.ts), from the
 * name of the context they run in, so each language loads them apart.
 */
async function app(locale) {
  globalThis.name = `prerender:${locale}`;
  const server = await createServer({
    mode: "production",
    base: "/thermoprops/",
    appType: "custom",
    server: { middlewareMode: true, hmr: false },
    logLevel: "error",
  });
  try {
    const { prerender } = await server.ssrLoadModule("/src/prerender.tsx");
    const { PAGES, LANDING } = await server.ssrLoadModule("/src/pages.ts");
    return { server, prerender, PAGES, LANDING };
  } catch (error) {
    await server.close();
    throw error;
  }
}

const en = await app("en");
const { prerender, PAGES } = en;

const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** The landing's two addresses, each naming the other, for search engines. */
const ALTERNATES = `<link rel="alternate" hreflang="en" href="${SITE_URL}" />
    <link rel="alternate" hreflang="es" href="${SITE_URL}es/" />
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}" />`;

function withAlternates(html, locale) {
  return html
    .replace(
      /(<link rel="canonical" href="[^"]*" \/>)/,
      `$1\n    ${ALTERNATES}`,
    )
    .replace(
      /(<meta property="og:locale" content="[^"]*" \/>)/,
      `$1\n    <meta property="og:locale:alternate" content="${locale === "es" ? "en_US" : "es_ES"}" />`,
    );
}

/** The page's meta tags set to `meta`'s title, summary and address. */
function withMeta(html, meta, url) {
  return html
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
}

function page(route, render = prerender) {
  let html = template.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${render(`/${route}`)}</div>`,
  );
  if (!html.includes(`<div id="root"><`)) {
    throw new Error('index.html has no empty <div id="root"></div>');
  }
  const meta = PAGES[route];
  if (meta) {
    // GitHub Pages serves a folder's page at its address with a slash.
    html = withMeta(html, meta, `${SITE_URL}${route}/`);
    // The app's own pages: not for search results.
    if (meta.noindex)
      html = html.replace(
        "</title>",
        '</title>\n    <meta name="robots" content="noindex" />',
      );
  }
  return html;
}

/** The Spanish landing: the landing rendered with the Spanish modules. */
async function spanishLanding() {
  const es = await app("es");
  try {
    const html = withMeta(
      page("es", es.prerender),
      es.LANDING,
      `${SITE_URL}es/`,
    )
      .replace(/<html lang="en">/, '<html lang="es">')
      .replace(/(<meta property="og:locale" content=")[^"]*"/, '$1es_ES"');
    if (!html.includes('<html lang="es">'))
      throw new Error('index.html has no <html lang="en">');
    return withAlternates(html, "es");
  } finally {
    await es.server.close();
  }
}

try {
  for (const route of APP_ROUTES) {
    const dir = join(DIST, route);
    mkdirSync(dir, { recursive: true });
    const html = page(route);
    writeFileSync(
      join(dir, "index.html"),
      route === "" ? withAlternates(html, "en") : html,
    );
  }
  // Unknown addresses: the app renders them (and takes them to the landing)
  // from an empty page, as no built page matches them.
  writeFileSync(join(DIST, "404.html"), template);
} finally {
  await en.server.close();
}
mkdirSync(join(DIST, "es"), { recursive: true });
writeFileSync(join(DIST, "es", "index.html"), await spanishLanding());

// Only canonical, indexable URLs belong here.
const SITEMAP_PATHS = [
  "",
  "es",
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
  `postbuild: index.html, 404.html, ${[...APP_ROUTES.filter(Boolean), "es"]
    .map((r) => `${r}/index.html`)
    .join(", ")}, sitemap.xml (${SITEMAP_PATHS.length} URLs)`,
);
