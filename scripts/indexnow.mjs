// Tells the search engines that take IndexNow (Bing, which ChatGPT's search
// reads, Yandex, Naver, Seznam…) which addresses a release published, so
// they crawl them in hours instead of weeks. Run by the deploy workflow,
// after the site is up: node scripts/indexnow.mjs [--dry-run]
//
// Every address of the sitemap goes, each release: few enough, and releases
// are rare. The key proves the site is ours: the engines read it back from
// public/<key>.txt, so the script first waits until the release serves it.
import { readFileSync } from "node:fs";

const SITE_URL = "https://luisbedoia.github.io/thermoprops/";
const KEY = "c302bcf5b0af07e54940405088424fac";
const KEY_URL = `${SITE_URL}${KEY}.txt`;
const dryRun = process.argv.includes("--dry-run");

const urlList = [
  ...readFileSync("dist/sitemap.xml", "utf8").matchAll(/<loc>([^<]+)<\/loc>/g),
].map((m) => m[1]);
if (urlList.length === 0) throw new Error("dist/sitemap.xml lists no address");

const body = {
  host: new URL(SITE_URL).host,
  key: KEY,
  keyLocation: KEY_URL,
  urlList,
};

if (dryRun) {
  console.log(JSON.stringify(body, null, 2));
  process.exit(0);
}

// GitHub Pages serves a release a minute or two after it is pushed.
const deadline = Date.now() + 10 * 60_000;
for (;;) {
  const res = await fetch(KEY_URL, { cache: "no-store" }).catch(() => null);
  if (res?.ok && (await res.text()).trim() === KEY) break;
  if (Date.now() > deadline)
    throw new Error(`${KEY_URL} is not served yet: IndexNow not told`);
  await new Promise((r) => setTimeout(r, 15_000));
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
// 200: received; 202: received, the key still to be checked.
if (res.status !== 200 && res.status !== 202)
  throw new Error(`IndexNow answered ${res.status}: ${await res.text()}`);
console.log(`IndexNow: ${urlList.length} addresses sent (${res.status}).`);
