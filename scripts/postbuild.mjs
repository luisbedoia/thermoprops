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
// - Writes a page for each fluid, and their index, in both languages
//   (/fluids/r134a/, /es/fluidos/r134a/): its constants, saturation table and
//   diagrams, worked out here with CoolProp and written into the page with
//   the data it was rendered from (src/fluids).
// - Generates sitemap.xml with the build date.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";

const DIST = "dist";
const SITE_URL = "https://luisbedoia.github.io/thermoprops/";

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
    const { PAGES, LANDING, BUILT_PAGES } =
      await server.ssrLoadModule("/src/pages.ts");
    const { setPageData, pageDataScript } = await server.ssrLoadModule(
      "/src/fluids/pageData.ts",
    );
    const fluidsMeta = await server.ssrLoadModule("/src/fluids/meta.ts");
    return {
      locale,
      server,
      prerender,
      PAGES,
      LANDING,
      BUILT_PAGES,
      setPageData,
      pageDataScript,
      fluidsMeta,
    };
  } catch (error) {
    await server.close();
    throw error;
  }
}

const en = await app("en");
const { prerender, PAGES, BUILT_PAGES } = en;
// The English pages; the Spanish landing is written apart.
const APP_ROUTES = BUILT_PAGES.filter((route) => route !== "es");

const escape = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/**
 * A page with an address in each language (folders under the site, e.g.
 * "" and "es/"), each naming the other for search engines; English as the
 * default.
 */
function withAlternates(html, locale, { en = "", es = "es/" } = {}) {
  const alternates = `<link rel="alternate" hreflang="en" href="${SITE_URL}${en}" />
    <link rel="alternate" hreflang="es" href="${SITE_URL}${es}" />
    <link rel="alternate" hreflang="x-default" href="${SITE_URL}${en}" />`;
  return html
    .replace(
      /(<link rel="canonical" href="[^"]*" \/>)/,
      `$1\n    ${alternates}`,
    )
    .replace(
      /(<meta property="og:locale" content="[^"]*" \/>)/,
      `$1\n    <meta property="og:locale:alternate" content="${locale === "es" ? "en_US" : "es_ES"}" />`,
    );
}

/** The page's meta tags set to `meta`'s title, summary and address. */
/**
 * The page's meta tags set to `meta`'s title, summary and address; its
 * picture's words too (`imageAlt`), and the app's summary in its
 * structured data (`app`), in the page's language.
 */
function withMeta(html, meta, url) {
  let out = html
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
  if (meta.imageAlt)
    out = out.replace(
      /(<meta\s+(?:property|name)="(?:og|twitter):image:alt"\s+content=")[^"]*"/g,
      `$1${escape(meta.imageAlt)}"`,
    );
  if (meta.app) {
    const ld = /("@type": "WebApplication",[\s\S]*?"description": ")[^"]*"/;
    if (!ld.test(out)) throw new Error("index.html has no WebApplication data");
    out = out.replace(ld, `$1${meta.app.replace(/"/g, '\\"')}"`);
  }
  return out;
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

/** A page built in Spanish: its language, for browsers and search engines. */
/** The shared links' picture in Spanish (scripts/og-image.mjs), and its words. */
/**
 * A page built in Spanish: its language, for browsers and search engines,
 * and the picture its shared links show (its words come with its meta).
 */
function inSpanish(html) {
  const out = html
    .replace(/<html lang="en">/, '<html lang="es">')
    .replace(/(<meta property="og:locale" content=")[^"]*"/, '$1es_ES"')
    .replace(
      /(<meta\s+(?:property|name)="(?:og|twitter):image"\s+content="[^"]*)og-image\.png"/g,
      '$1og-image-es.png"',
    );
  if (!out.includes('<html lang="es">'))
    throw new Error('index.html has no <html lang="en">');
  if ((out.match(/og-image-es\.png/g) ?? []).length !== 2)
    throw new Error(
      "index.html has no og:image and twitter:image to translate",
    );
  return out;
}

/**
 * A page rendered from `data` (src/fluids/pageData.ts): rendered with it,
 * and carrying it for the browser to render the same.
 */
function dataPage(app, route, data, meta) {
  const path = `/${route}`;
  app.setPageData(path, data);
  const html = template.replace(
    /<div id="root"><\/div>/,
    `${app.pageDataScript(path, data)}\n    <div id="root">${app.prerender(path)}</div>`,
  );
  if (!html.includes('<div id="root"><'))
    throw new Error('index.html has no empty <div id="root"></div>');
  // The landing's picture, and its words in the page's language.
  const out = withMeta(
    html,
    {
      ...meta,
      imageAlt: app.LANDING.imageAlt,
      app: app.LANDING.description,
    },
    `${SITE_URL}${route}/`,
  );
  return app.locale === "es" ? inSpanish(out) : out;
}

/** Writes `html` as the page of the folder `route`. */
function write(route, html) {
  mkdirSync(join(DIST, route), { recursive: true });
  writeFileSync(join(DIST, route, "index.html"), html);
}

/** The fluids' addresses: the index's folder, and each fluid's, by language. */
const fluidsRoute = (locale, slug) =>
  (locale === "es" ? "es/fluidos" : "fluids") + (slug ? `/${slug}` : "");

/** Every fluid's page and their index, in `app`'s language. */
function fluidPages(app, summaries, pages) {
  const { fluidsMeta } = app;
  const pair = (slug) => ({
    en: `${fluidsRoute("en", slug)}/`,
    es: `${fluidsRoute("es", slug)}/`,
  });
  const index = fluidsRoute(app.locale);
  write(
    index,
    withAlternates(
      dataPage(app, index, summaries, {
        title: fluidsMeta.FLUIDS_TITLE,
        description: fluidsMeta.FLUIDS_DESCRIPTION,
      }),
      app.locale,
      pair(),
    ),
  );
  for (const data of pages) {
    const route = fluidsRoute(app.locale, data.fluid.slug);
    const meta = {
      title: fluidsMeta.fluidTitle(data),
      description: fluidsMeta.fluidDescription(data),
    };
    write(
      route,
      withAlternates(
        dataPage(app, route, data, meta),
        app.locale,
        pair(data.fluid.slug),
      ),
    );
  }
}

/**
 * Every fluid's data, worked out with the real CoolProp (its wasm loaded by
 * file: URL, which Node's fetch lacks): in English, and the display names in
 * Spanish too.
 */
async function fluidData(app) {
  const nodeFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    if (!href.startsWith("file:")) return nodeFetch(url, init);
    return new Response(await readFile(new URL(href)), {
      headers: { "content-type": "application/wasm" },
    });
  };
  const { loadCoolProp } = await import("@luisbedoia/coolprop-rs-wasm");
  const [cpEn, cpEs] = await Promise.all([
    loadCoolProp({ locale: "en" }),
    loadCoolProp({ locale: "es" }),
  ]);
  const names = (cp) =>
    new Map(cp.catalog().map((f) => [f.name, f.display_name]));
  const { fluidSummaries, fluidPage } = await app.server.ssrLoadModule(
    "/src/fluids/data.ts",
  );
  const summaries = await fluidSummaries(cpEn, {
    en: names(cpEn),
    es: names(cpEs),
  });
  const pages = [];
  for (const summary of summaries)
    pages.push(await fluidPage(cpEn, summary, summaries));
  return { summaries, pages };
}

let fluids;
try {
  for (const route of APP_ROUTES) {
    const html = page(route);
    write(
      route,
      route === ""
        ? withAlternates(
            withMeta(
              html,
              { ...en.LANDING, app: en.LANDING.description },
              SITE_URL,
            ),
            "en",
          )
        : html,
    );
  }
  // Unknown addresses: the app renders them (and takes them to the landing)
  // from an empty page, as no built page matches them.
  writeFileSync(join(DIST, "404.html"), template);
  fluids = await fluidData(en);
  fluidPages(en, fluids.summaries, fluids.pages);
} finally {
  await en.server.close();
}

// The Spanish pages: the landing, and the fluids'.
const es = await app("es");
try {
  write(
    "es",
    withAlternates(
      inSpanish(
        withMeta(
          page("es", es.prerender),
          { ...es.LANDING, app: es.LANDING.description },
          `${SITE_URL}es/`,
        ),
      ),
      "es",
    ),
  );
  fluidPages(es, fluids.summaries, fluids.pages);
} finally {
  await es.server.close();
}

// The pages the service worker keeps for offline use, by their address
// under its scope (public/sw-pages.js).
writeFileSync(
  join(DIST, "pages.json"),
  JSON.stringify(BUILT_PAGES.map((route) => route && `${route}/`)),
);

// Only canonical, indexable URLs belong here.
const SITEMAP_PATHS = [
  "",
  "es",
  ...Object.keys(PAGES).filter((route) => !PAGES[route].noindex),
  ...["en", "es"].flatMap((locale) => [
    fluidsRoute(locale),
    ...fluids.summaries.map((f) => fluidsRoute(locale, f.slug)),
  ]),
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
  `postbuild: index.html, 404.html, ${BUILT_PAGES.filter(Boolean)
    .map((r) => `${r}/index.html`)
    .join(
      ", ",
    )}, ${fluids.pages.length} fluids' pages in each language, pages.json, sitemap.xml (${SITEMAP_PATHS.length} URLs)`,
);
