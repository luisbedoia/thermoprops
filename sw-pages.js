// The site's pages (HTML), for the service worker (imported by the one
// vite-plugin-pwa generates; see vite.config.ts). Network first: a reload
// after a deploy gets the new page, and with it the new app, at once. Each
// page answered is kept, and every built page is fetched when this service
// worker installs, so the app opens offline on any of them. Offline (or on a
// network slower than NETWORK_MS) a page is the kept one; an address never
// kept is the landing's, which the app takes where it belongs.
//
// The app's code, styles, wasm and fonts are precached by Workbox apart:
// hashed, they never go stale.

const PAGES = "thermoprops-pages";
const NETWORK_MS = 4000;

const scope = self.registration.scope;

/**
 * Every built page, by its address under the scope ("explorer/"), as the
 * build lists them (scripts/postbuild.mjs); the landing at least.
 */
async function builtPages() {
  try {
    const response = await fetch(scope + "pages.json", { cache: "reload" });
    const pages = await response.json();
    if (Array.isArray(pages)) return pages;
  } catch {
    // Offline or no list: the landing alone.
  }
  return [""];
}

/** A page's key: its address without query, folder-style ("explorer/"). */
function pageKey(url) {
  const { origin, pathname } = new URL(url);
  return origin + (pathname.endsWith("/") ? pathname : `${pathname}/`);
}

/** Keeps a good answer for `key`, never a redirect or an error page. */
async function keep(key, response) {
  if (!response.ok || response.redirected || response.type !== "basic") return;
  const cache = await caches.open(PAGES);
  await cache.put(key, response);
}

self.addEventListener("install", (event) => {
  // Each page on its own: one that fails must not stop the update.
  event.waitUntil(
    builtPages().then((pages) =>
      Promise.all(
        pages.map((page) =>
          fetch(new Request(scope + page, { cache: "reload" }))
            .then((response) => keep(scope + page, response))
            .catch(() => {}),
        ),
      ),
    ),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate" || !request.url.startsWith(scope)) return;
  const key = pageKey(request.url);

  const network = fetch(request);
  // Kept as it arrives, even when the kept page answered first.
  event.waitUntil(
    network.then((response) => keep(key, response.clone())).catch(() => {}),
  );
  // Answered by the network, by the kept page once the network is slow, or,
  // offline, by the kept page or else the landing.
  event.respondWith(
    (async () => {
      const kept = caches
        .open(PAGES)
        .then(async (cache) => (await cache.match(key)) ?? cache.match(scope));
      const slow = new Promise((resolve) =>
        setTimeout(resolve, NETWORK_MS, "slow"),
      );
      const first = await Promise.race([network.catch(() => "offline"), slow]);
      if (first !== "slow" && first !== "offline") return first;
      const page = await kept;
      if (page) return page;
      // Nothing kept: wait for the network, whatever it says.
      return network.catch(() => Response.error());
    })(),
  );
});
