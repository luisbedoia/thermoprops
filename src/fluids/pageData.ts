/**
 * Data a built page was rendered from, handed to it the same way in the
 * build and in the browser, so the first render matches the built page:
 * the build sets it before rendering (scripts/postbuild.mjs) and writes it
 * into the page as `<script id="page-data">`, which the browser reads back.
 */
type PageData = { path: string; data: unknown };

let rendering: PageData | null = null;

/** The build: `data` for the page at `path`, rendered next. */
export function setPageData(path: string, data: unknown) {
  rendering = { path: normalize(path), data };
}

/** The data written into the page by the build, read once. */
const embedded: PageData | null = (() => {
  if (typeof document === "undefined") return null;
  try {
    const text = document.getElementById("page-data")?.textContent;
    return text ? (JSON.parse(text) as PageData) : null;
  } catch {
    return null;
  }
})();

/** The data the page at `path` was built with; null for none (or another page). */
export function pageData<T>(path: string): T | null {
  const d = rendering ?? embedded;
  return d && d.path === normalize(path) ? (d.data as T) : null;
}

/** "/fluids/r134a/" as "/fluids/r134a": the router's path either way. */
function normalize(path: string) {
  return path.replace(/\/+$/, "") || "/";
}

/** The `<script>` that carries `data` for `path` in a built page. */
export function pageDataScript(path: string, data: unknown): string {
  // "<" escaped: no "</script>" inside can end it early.
  const json = JSON.stringify({ path: normalize(path), data }).replace(
    /</g,
    "\\u003c",
  );
  return `<script id="page-data" type="application/json">${json}</script>`;
}
