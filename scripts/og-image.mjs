// Draws public/og-image.png and public/og-image-es.png (1200 × 630), the
// picture a shared link shows, in English and in Spanish (the build gives the
// Spanish pages theirs: scripts/postbuild.mjs). In the landing's look: its
// black opening, its headline, and the cycle the landing solves
// (src/landing/cycle.json, solved by CoolProp), with its COP.
//
//   node scripts/og-image.mjs
//
// Needs Chrome. Nothing is fetched: the font comes from node_modules.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const CHROME =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const { dome, cycle } = JSON.parse(
  readFileSync("src/landing/cycle.json", "utf8"),
);
const font = pathToFileURL(
  "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
).href;

// The chart's frame, as on the landing (src/landing/LiveCycle.tsx).
const VIEW = { s: [0.7, 1.9], t: [-45, 110] };
const W = 420;
const H = 300;
const PAD = { left: 30, right: 14, top: 16, bottom: 30 };
const x = (s) =>
  PAD.left +
  ((s - VIEW.s[0]) / (VIEW.s[1] - VIEW.s[0])) * (W - PAD.left - PAD.right);
const y = (t) =>
  H -
  PAD.bottom -
  ((t - VIEW.t[0]) / (VIEW.t[1] - VIEW.t[0])) * (H - PAD.top - PAD.bottom);
const line = (points) =>
  points
    .filter(([, t]) => t >= VIEW.t[0])
    .map(([s, t], i) => `${i ? "L" : "M"}${x(s).toFixed(1)} ${y(t).toFixed(1)}`)
    .join(" ");
const LABEL = {
  1: [10, 20],
  2: [10, -10],
  3: [-22, -10],
  4: [-22, 20],
};

const chart = `
  <svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
    <path d="M${PAD.left} ${PAD.top} V${H - PAD.bottom} H${W - PAD.right}"
      fill="none" stroke="rgba(255,255,255,.28)" stroke-width="1.5"/>
    <text x="6" y="${PAD.top + 12}" class="axis">T</text>
    <text x="${W - 18}" y="${H - 6}" class="axis">s</text>
    <path d="${line([...dome.liquid, ...[...dome.vapor].reverse()])}"
      fill="none" stroke="rgba(255,255,255,.62)" stroke-width="2.5"/>
    ${cycle.paths
      .map(
        (p) =>
          `<path d="${line(p.points)}" fill="none" stroke="#53b1ff" stroke-width="4" stroke-linejoin="round"/>`,
      )
      .join("")}
    ${cycle.states
      .map(({ name, at: [s, t] }) => {
        const [dx, dy] = LABEL[name] ?? [10, -10];
        return `<circle cx="${x(s)}" cy="${y(t)}" r="7.5" fill="#fff"/>
          <text x="${x(s) + dx}" y="${y(t) + dy}" class="state">${name}</text>`;
      })
      .join("")}
  </svg>`;

/**
 * The words of each picture: what the app is, as the landing says it over
 * its headline (src/landing), and a short line. Few and large: a shared
 * link's preview is often 300 px wide, and the platforms print the title
 * and the address under it. The cycle is the same in both.
 */
const PICTURES = [
  {
    file: "public/og-image.png",
    lang: "en",
    headline: "Thermodynamic<br>properties<br>calculator",
    // What it costs and where it runs, apart from how many fluids (in the
    // description under it): "Free · 30 fluids" read as a free tier.
    line: "Free, in your browser",
  },
  {
    file: "public/og-image-es.png",
    lang: "es",
    headline: "Calculadora de<br>propiedades<br>termodinámicas",
    line: "Gratuita, en tu navegador",
  },
];

const html = ({
  lang,
  headline,
  line,
}) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
  @font-face { font-family: Inter; src: url("${font}") format("woff2");
    font-weight: 100 900; }
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; background: #000;
    color: #fff; font-family: Inter, sans-serif; }
  .page { display: grid; grid-template-columns: minmax(0, 1fr) 460px; gap: 40px;
    align-items: center; height: 100%; padding: 60px 60px 60px 68px; }
  .words { display: flex; flex-direction: column; justify-content: center;
    height: 100%; }
  .brand { font-size: 32px; font-weight: 600; letter-spacing: .01em; }
  h1 { margin-top: auto; font-size: 68px; font-weight: 300; line-height: 1.04;
    letter-spacing: -.02em; }
  p { margin-top: 30px; margin-bottom: auto; font-size: 32px; line-height: 1.3;
    color: #ccc; text-wrap: balance; }
  .card { border-radius: 14px; overflow: hidden; background: #181818; }
  .card svg { display: block; padding: 18px 18px 8px 22px; }
  .axis { font-size: 18px; fill: #ccc; }
  .state { font-size: 22px; font-weight: 600; fill: #fff; }
</style></head><body><div class="page">
  <div class="words">
    <div class="brand">Thermoprops</div>
    <h1>${headline}</h1>
    <p>${line}</p>
  </div>
  <div class="card">${chart}</div>
</div></body></html>`;

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// From a file, so the page may load the font from node_modules.
const dir = mkdtempSync(join(tmpdir(), "og-"));
for (const picture of PICTURES) {
  writeFileSync(join(dir, "og.html"), html(picture));
  await page.goto(pathToFileURL(join(dir, "og.html")).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: picture.file });
  console.log(picture.file);
}
await browser.close();
rmSync(dir, { recursive: true, force: true });
