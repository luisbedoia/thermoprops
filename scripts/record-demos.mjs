// Records the landing's videos of the app in use, one per mode and device
// (desktop, tablet, phone), and the six charts of water, from a running build:
//
//   npm run build && npx vite preview --base=/thermoprops/ --port 5198 &
//   node scripts/record-demos.mjs http://localhost:5198/thermoprops
//
// ONLY=worksheet|explorer|charts and DEVICES=desktop,tablet,phone narrow it.
// Needs Chrome and ffmpeg (libx264). Writes public/demos/<mode>-<device>.mp4,
// its poster <mode>-<device>.jpg (the last frame), and chart-<diagram>.jpg.
//
// Each video is a person using the app: typing at a person's pace, taking
// the editor's suggestions (the keypad's, on touch screens), opening lists
// and choosing from them. Headless Chrome draws no native <select> list, so
// while recording the page shows one (a menu on desktop and tablet, a sheet
// on a phone) and the choice made in it is set on the real control.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://localhost:5198/thermoprops").replace(
  /\/$/,
  "",
);
const CHROME =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = "public/demos";
const ONLY = process.env.ONLY;
/** Played a little faster than recorded: the same moves, less waiting. */
const SPEED = 1.2;

/** The landing picks one by the visitor's screen (src/landing/DemoVideo.tsx). */
const DEVICES = {
  desktop: {
    context: { viewport: { width: 960, height: 600 }, deviceScaleFactor: 2 },
    out: [1440, 900],
  },
  tablet: {
    context: {
      viewport: { width: 768, height: 1024 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
    out: [1080, 1440],
  },
  phone: {
    context: {
      viewport: { width: 390, height: 780 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    },
    out: [780, 1560],
  },
};
const WANTED = (process.env.DEVICES ?? Object.keys(DEVICES).join(",")).split(
  ",",
);

// The same takes on every run: a fixed sequence of "random" pauses.
let seed = 7;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (min, max) => min + random() * (max - min);

/** In the page: the pointer or the touch, and the stand-in for lists. */
const STAGE = () => {
  addEventListener("DOMContentLoaded", () => {
    const css = document.createElement("style");
    css.textContent = `
      .demo-pointer { position: fixed; left: -40px; top: -40px; z-index: 2147483647;
        width: 20px; height: 20px; margin: -10px 0 0 -10px; border-radius: 50%;
        background: rgba(0,112,209,.3); border: 2px solid #0070d1;
        pointer-events: none; transition: transform .12s; }
      .demo-touch { position: fixed; z-index: 2147483647; width: 44px; height: 44px;
        margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(0,0,0,.18);
        pointer-events: none; animation: demo-touch .45s ease-out forwards; }
      @keyframes demo-touch { from { transform: scale(.5); opacity: 1 }
        to { transform: scale(1.25); opacity: 0 } }
      .demo-list { position: fixed; z-index: 2147483646; overflow-y: auto;
        background: #fff; color: #111; font: 15px/1.3 system-ui, sans-serif;
        border-radius: 8px; box-shadow: 0 10px 30px rgba(0,0,0,.22), 0 0 0 1px rgba(0,0,0,.08);
        padding: 4px 0; animation: demo-open .14s ease-out; }
      @keyframes demo-open { from { opacity: 0; transform: translateY(-4px) } }
      .demo-list div { padding: 8px 14px; white-space: nowrap; }
      .demo-list div.is-on { background: #0070d1; color: #fff; }
      .demo-list div.is-chosen::before { content: "✓"; margin-right: 8px; }
      .demo-scrim { position: fixed; inset: 0; z-index: 2147483645;
        background: rgba(0,0,0,.35); animation: demo-fade .2s ease-out; }
      @keyframes demo-fade { from { opacity: 0 } }
      .demo-sheet { position: fixed; left: 0; right: 0; bottom: 0; z-index: 2147483646;
        max-height: 60vh; overflow-y: auto; background: #fff; color: #111;
        font: 17px/1.3 system-ui, sans-serif; border-radius: 14px 14px 0 0;
        padding: 6px 0 18px; animation: demo-rise .25s ease-out; }
      @keyframes demo-rise { from { transform: translateY(100%) } }
      .demo-sheet h6 { margin: 0; padding: 12px 20px; font: 600 14px system-ui;
        color: #666; }
      .demo-sheet div { padding: 13px 20px; display: flex; justify-content: space-between; }
      .demo-sheet div.is-on { background: #eef4fb; }
      .demo-sheet div.is-chosen::after { content: "✓"; color: #0070d1; font-weight: 700; }
    `;
    document.head.append(css);
    const pointer = document.createElement("div");
    pointer.className = "demo-pointer";
    document.body.append(pointer);
    addEventListener("mousemove", (e) => {
      if (!window.__demoTouch) {
        pointer.style.left = `${e.clientX}px`;
        pointer.style.top = `${e.clientY}px`;
      }
    });
    addEventListener(
      "mousedown",
      () => (pointer.style.transform = "scale(.7)"),
    );
    addEventListener("mouseup", () => (pointer.style.transform = ""));
    addEventListener(
      "touchstart",
      (e) => {
        for (const t of e.touches) {
          const dot = document.createElement("div");
          dot.className = "demo-touch";
          dot.style.left = `${t.clientX}px`;
          dot.style.top = `${t.clientY}px`;
          document.body.append(dot);
          setTimeout(() => dot.remove(), 500);
        }
      },
      { capture: true, passive: true },
    );
  });

  window.__demoList = {
    /** Shows the select's options as a menu, or a sheet on a phone. */
    open(selector, sheet) {
      const select = document.querySelector(selector);
      const options = [...select.options];
      const box = document.createElement("div");
      box.className = sheet ? "demo-sheet" : "demo-list";
      if (sheet) {
        const scrim = document.createElement("div");
        scrim.className = "demo-scrim";
        document.body.append(scrim);
        const label = document.querySelector(`label[for="${select.id}"]`);
        const title = document.createElement("h6");
        title.textContent = label?.textContent ?? "";
        box.append(title);
      } else {
        const r = select.getBoundingClientRect();
        box.style.left = `${r.left}px`;
        box.style.minWidth = `${r.width}px`;
        const below = innerHeight - r.bottom - 12;
        box.style.maxHeight = `${Math.max(below, 220)}px`;
        box.style.top =
          below >= 220 ? `${r.bottom + 4}px` : `${Math.max(8, r.top - 224)}px`;
      }
      for (const o of options) {
        const row = document.createElement("div");
        row.textContent = o.textContent;
        row.dataset.value = o.value;
        if (o.selected) row.classList.add("is-chosen");
        box.append(row);
      }
      box.addEventListener("mousemove", (e) => {
        for (const row of box.querySelectorAll("div"))
          row.classList.toggle("is-on", row === e.target);
      });
      document.body.append(box);
      window.__demoBox = box;
    },
    /** Scrolls the option into view and says where it is. */
    reveal(value) {
      const row = [...window.__demoBox.querySelectorAll("div")].find(
        (r) => r.dataset.value === value,
      );
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      return new Promise((done) =>
        setTimeout(() => {
          const r = row.getBoundingClientRect();
          done({
            x: r.left + Math.min(60, r.width / 2),
            y: r.top + r.height / 2,
          });
        }, 550),
      );
    },
    mark(value) {
      for (const row of window.__demoBox.querySelectorAll("div"))
        row.classList.toggle("is-on", row.dataset.value === value);
    },
    close() {
      window.__demoBox?.remove();
      document.querySelector(".demo-scrim")?.remove();
    },
  };
};

async function record(name, device, act) {
  const spec = DEVICES[device];
  const touch = Boolean(spec.context.hasTouch);
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
  });
  const context = await browser.newContext({
    ...spec.context,
    serviceWorkers: "block",
  });
  const page = await context.newPage();
  // Never report these visits to analytics.
  await page.route(/google-analytics|googletagmanager|analytics\.google/, (r) =>
    r.abort(),
  );
  await page.addInitScript(STAGE);
  if (touch) await page.addInitScript(() => (window.__demoTouch = true));

  const frames = [];
  const cdp = await context.newCDPSession(page);
  cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
    frames.push({ data, at: metadata.timestamp });
    void cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  });

  const { width, height } = spec.context.viewport;
  let at = { x: width / 2, y: height - 40 };
  const wait = (ms) => page.waitForTimeout(ms);
  const pause = (min = 180, max = 420) => wait(between(min, max));

  /** A hand's path: a slight curve, slow at both ends. */
  async function glide(x, y) {
    const from = at;
    const bend = between(-0.18, 0.18);
    const steps = Math.round(between(16, 26));
    const cx = (from.x + x) / 2 - (y - from.y) * bend;
    const cy = (from.y + y) / 2 + (x - from.x) * bend;
    for (let i = 1; i <= steps; i++) {
      const t = 0.5 - Math.cos((Math.PI * i) / steps) / 2;
      const px = (1 - t) ** 2 * from.x + 2 * (1 - t) * t * cx + t * t * x;
      const py = (1 - t) ** 2 * from.y + 2 * (1 - t) * t * cy + t * t * y;
      await page.mouse.move(px, py);
      await wait(12);
    }
    at = { x, y };
  }

  async function centre(locator) {
    await locator.scrollIntoViewIfNeeded();
    const b = await locator.boundingBox();
    return {
      x: b.x + b.width * between(0.4, 0.6),
      y: b.y + b.height * between(0.4, 0.6),
    };
  }

  /** Clicks, or taps on a touch screen. */
  async function press(locator) {
    const p = await centre(locator);
    if (touch) {
      await page.touchscreen.tap(p.x, p.y);
    } else {
      await glide(p.x, p.y);
      await pause(90, 200);
      await page.mouse.down();
      await wait(70);
      await page.mouse.up();
    }
    at = p;
  }

  /** Types as a person does: unevenly, slower after a word. */
  async function type(text) {
    for (const ch of text) {
      await page.keyboard.type(ch);
      await wait(/[ ,]/.test(ch) ? between(120, 260) : between(55, 140));
    }
  }

  /**
   * Looks like a press, without one: a real press on a <select> opens the
   * native list, which headless Chrome keeps (unseen) on top of the page.
   */
  async function seemPress(locator) {
    const p = await centre(locator);
    if (!touch) {
      await glide(p.x, p.y);
      await pause(90, 200);
    }
    await page.evaluate(
      ([x, y, touch]) => {
        if (touch) {
          const dot = document.createElement("div");
          dot.className = "demo-touch";
          dot.style.left = `${x}px`;
          dot.style.top = `${y}px`;
          document.body.append(dot);
          setTimeout(() => dot.remove(), 500);
        } else {
          const pointer = document.querySelector(".demo-pointer");
          pointer.style.transform = "scale(.7)";
          setTimeout(() => (pointer.style.transform = ""), 120);
        }
      },
      [p.x, p.y, touch],
    );
    at = p;
  }

  /** Opens a select, looks through it, and chooses `value`. */
  async function choose(selector, value) {
    await seemPress(page.locator(selector));
    await pause(150, 260);
    await page.evaluate(
      ([s, sheet]) => window.__demoList.open(s, sheet),
      [selector, device === "phone"],
    );
    await pause(350, 600);
    const p = await page.evaluate((v) => window.__demoList.reveal(v), value);
    if (touch) {
      await page.evaluate((v) => window.__demoList.mark(v), value);
      await pause(250, 400);
      await page.touchscreen.tap(p.x, p.y);
    } else {
      await glide(p.x, p.y);
      await pause(200, 350);
      await page.mouse.down();
      await wait(70);
      await page.mouse.up();
      at = p;
    }
    await pause(120, 200);
    await page.evaluate(() => window.__demoList.close());
    await page.locator(selector).selectOption(value);
    await pause(300, 500);
  }

  const start = () =>
    cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 90,
      maxWidth: width * 2,
      maxHeight: height * 2,
    });

  await act({ page, wait, pause, press, type, choose, start, touch, device });
  // The pointer leaves the last frame (the poster) clear.
  if (!touch) await glide(width - 6, height - 6);
  await wait(900);
  const end = Date.now() / 1000;
  await cdp.send("Page.stopScreencast");
  await browser.close();

  // Each frame shown until the next one; the last for a moment more.
  const dir = mkdtempSync(join(tmpdir(), `demo-${name}-`));
  const list = frames.map((f, i) => {
    const file = join(dir, `${String(i).padStart(5, "0")}.jpg`);
    writeFileSync(file, Buffer.from(f.data, "base64"));
    const next = frames[i + 1]?.at ?? Math.max(end, f.at + 1.5);
    const shown = Math.max((next - f.at) / SPEED, 0.02);
    return `file '${file}'\nduration ${shown.toFixed(3)}`;
  });
  const last = join(dir, `${String(frames.length - 1).padStart(5, "0")}.jpg`);
  writeFileSync(join(dir, "list.txt"), `${list.join("\n")}\nfile '${last}'\n`);
  const [w, h] = spec.out;
  const file = `${name}-${device}`;
  mkdirSync(OUT, { recursive: true });
  execFileSync("ffmpeg", [
    ...["-y", "-loglevel", "error", "-f", "concat", "-safe", "0"],
    ...["-i", join(dir, "list.txt")],
    ...["-vf", `fps=30,scale=${w}:${h}:flags=lanczos,format=yuv420p`],
    ...["-c:v", "libx264", "-preset", "slow", "-crf", "27"],
    ...["-tune", "stillimage", "-movflags", "+faststart", "-an"],
    join(OUT, `${file}.mp4`),
  ]);
  execFileSync("ffmpeg", [
    ...["-y", "-loglevel", "error", "-i", last],
    ...["-vf", `scale=${w}:${h}:flags=lanczos`, "-q:v", "4"],
    join(OUT, `${file}.jpg`),
  ]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${file}: ${frames.length} frames`);
}

// ── The Worksheet ─────────────────────────────────────────────────────────

/** With a keyboard: typing, and taking the editor's suggestions. */
async function worksheetByKeyboard({ page, wait, pause, press, type }) {
  const editor = page.locator(".cm-content");
  /** Waits for the suggestion list, lets it be seen, and takes the one shown. */
  async function take() {
    const shown = page.locator(
      ".cm-tooltip-autocomplete li[aria-selected=true]",
    );
    // Slow to come: asked for, as a person who knows the shortcut does.
    if (
      !(await shown.waitFor({ timeout: 1500 }).then(
        () => true,
        () => false,
      ))
    ) {
      await page.keyboard.press("Control+Space");
      await shown.waitFor({ timeout: 3000 });
    }
    await pause(420, 700);
    await page.keyboard.press("Enter");
    await pause(220, 380);
  }
  const key = async (k) => {
    await page.keyboard.press(k);
    await pause(160, 300);
  };
  const close = () => page.keyboard.press("Escape");

  await press(editor);
  await pause(400, 600);
  await type("fl");
  await take(); // fluid Water, the fluid selected
  await type("R134");
  await take(); // R134a
  await key("End");
  await key("Enter");

  await type("1: T = -10 °C, sat v");
  await take(); // sat vapor
  await close();
  await key("Enter");

  await type("2: from 1, comp");
  await take(); // compressed to P = |, eta = 80%
  await type("1.2 MPa");
  await close();
  await key("End");
  await key("Enter");

  await type("3: P = P2, sat l");
  await take(); // sat liquid
  await close();
  await key("Enter");

  await type("4: from 3, thr");
  await take(); // throttled to P = |
  await type("P1");
  await close();
  await key("End");
  await key("Enter");

  await type("dr");
  await take(); // draw 1 -> 2 -> 1, its states to fill
  await key("Tab");
  await key("Tab");
  await type("3 -> 4 -> 1");
  await close();
  await key("End");
  await key("Enter");

  await type("COP = (h1 - h4) / (h2 - h1)");
  await close();
  await wait(1400);
}

/** On a touch screen: the page's keypad and its row of suggestions. */
async function worksheetByKeypad({ page, wait, pause, press }) {
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const chip = async (label) => {
    const c = page
      .locator(".keypad__chip")
      .filter({
        has: page.locator(".keypad__chip-label", {
          hasText: new RegExp(`^${escape(label)}$`),
        }),
      })
      .first();
    await c.waitFor({ timeout: 3000 });
    await pause(380, 650);
    await press(c);
    await pause(200, 340);
  };
  const key = async (label) => {
    await press(
      page
        .locator(".keypad__grid button")
        .filter({ hasText: new RegExp(`^${escape(label)}$`, "i") })
        .first(),
    );
    await pause(150, 300);
  };
  const named = async (aria) => {
    await press(page.locator(`.keypad button[aria-label="${aria}"]`).first());
    await pause(160, 320);
  };
  const keys = async (...labels) => {
    for (const l of labels) await key(l);
  };

  await press(page.locator(".cm-content"));
  await page.locator(".keypad").waitFor();
  await pause(600, 900);

  await chip("fluid"); // fluid Water, the fluid selected
  await keys("ABC");
  await named("Shift");
  await key("r");
  await chip("R134a");
  await named("New line");

  await keys("123", "1", ":");
  await chip("T");
  await keys("-", "1", "0");
  await chip("°C");
  await key(",");
  await chip("sat vapor");
  await named("New line");

  await keys("2", ":");
  await chip("from");
  await chip("1");
  await key(",");
  await chip("compressed");
  await keys("1", ".", "2");
  await chip("MPa");
  await named("Next field");
  await named("Next field");
  await named("New line");

  await keys("3", ":");
  await chip("P");
  await chip("P2");
  await key(",");
  await chip("sat liquid");
  await named("New line");

  await keys("4", ":");
  await chip("from");
  await chip("3");
  await key(",");
  await chip("throttled");
  await chip("P1");
  await named("Next field");
  await named("New line");

  await chip("draw"); // draw 1 -> 2 -> 1, its states to fill
  await named("Next field");
  await named("Next field");
  await keys("3", "->", "4", "->", "1");
  await wait(900);
  await named("Close keypad");
  await wait(900);
}

/** The worksheet each take must end with, whatever the device. */
const WORKSHEET = [
  "fluid R134a",
  /^1: T = +-? ?10 °C, sat vapor$/,
  "2: from 1, compressed to P = 1.2 MPa, eta = 80%",
  "3: P = P2, sat liquid",
  "4: from 3, throttled to P = P1",
  "draw 1 -> 2 -> 3 -> 4 -> 1",
];

async function worksheet(h) {
  const { page, wait, pause, press, start, touch } = h;
  await page.goto(`${BASE}/worksheet/?${new URLSearchParams({ s: "" })}`);
  await page.locator(".cm-content").waitFor();
  await wait(2500);
  await start();
  await wait(700);
  await (touch ? worksheetByKeypad(h) : worksheetByKeyboard(h));
  const lines = await page.$$eval(".cm-line", (l) =>
    l.map((x) => x.textContent).filter((t) => t.trim()),
  );
  WORKSHEET.forEach((want, i) => {
    const ok =
      typeof want === "string" ? lines[i] === want : want.test(lines[i]);
    if (!ok) throw new Error(`line ${i + 1}: "${lines[i]}", not ${want}`);
  });
  await press(page.getByRole("tab", { name: "Results" }));
  await wait(2800);
  await press(page.getByRole("tab", { name: "Chart" }));
  await page.locator(".plot-wrapper.is-ready").waitFor();
  await pause(900, 1100);
  await page.evaluate(() =>
    document
      .querySelector(".plot-wrapper")
      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
  await pause(3000, 3200);
}

// ── The State Explorer ────────────────────────────────────────────────────

async function explorer({ page, wait, pause, press, type, choose, start }) {
  await page.goto(`${BASE}/explorer/`);
  await page.locator("#fluid").waitFor();
  await wait(1500);
  await start();
  await wait(700);
  await choose("#fluid", "Water");
  await press(page.getByRole("button", { name: /workspace/ }));
  await page.locator("#plot-type").waitFor();
  await page.locator(".plot-wrapper.is-ready").waitFor();
  await pause(900, 1200);
  await choose("#plot-type", "temperature_entropy");
  await page.locator(".plot-wrapper.is-ready").waitFor();
  await pause(800, 1100);

  // Water at 25 °C and 100 kPa; saturated vapour at 1 MPa; steam at 400 °C.
  const states = [
    ["temperature", "25", "pressure", "100"],
    ["pressure", "1000", "quality", "1"],
    ["temperature", "400", "pressure", "1000"],
  ];
  for (const [p1, v1, p2, v2] of states) {
    await press(page.getByRole("button", { name: "Add state" }).first());
    await page.locator("#property1").waitFor();
    await pause(450, 700);
    if ((await page.locator("#property1").inputValue()) !== p1)
      await choose("#property1", p1);
    await press(page.locator("#value1"));
    await page.locator("#value1").fill("");
    await type(v1);
    await pause(250, 400);
    if ((await page.locator("#property2").inputValue()) !== p2)
      await choose("#property2", p2);
    await press(page.locator("#value2"));
    await page.locator("#value2").fill("");
    await type(v2);
    await pause(300, 500);
    await press(page.locator(".modal button[type=submit]").first());
    await page.locator("#property1").waitFor({ state: "detached" });
    await pause(900, 1200);
  }
  // Back up to the chart: the three states on it.
  await page.evaluate(() =>
    document
      .querySelector(".plot-wrapper")
      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
  );
  await wait(3600);
}

for (const device of WANTED) {
  if (!ONLY || ONLY === "worksheet")
    await record("worksheet", device, worksheet);
  if (!ONLY || ONLY === "explorer") await record("explorer", device, explorer);
}

// ── The six charts, as the State Explorer draws them for those states ─────

const DIAGRAMS = [
  "pressure_enthalpy",
  "temperature_entropy",
  "enthalpy_entropy",
  "pressure_specific_volume",
  "temperature_specific_volume",
  "pressure_temperature",
];
if (!ONLY || ONLY === "charts") {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
  });
  const page = await (
    await browser.newContext({
      viewport: { width: 1100, height: 900 },
      deviceScaleFactor: 2,
      serviceWorkers: "block",
    })
  ).newPage();
  await page.route(/google-analytics|googletagmanager|analytics\.google/, (r) =>
    r.abort(),
  );
  const state = (id, property1, value1, property2, value2) => ({
    id,
    label: `State ${id}`,
    property1,
    value1,
    property2,
    value2,
  });
  const states = Buffer.from(
    JSON.stringify([
      // A link keeps SI values (K, Pa): 25 °C and 100 kPa, and so on.
      state("1", "temperature", "298.15", "pressure", "100000"),
      state("2", "pressure", "1000000", "quality", "1"),
      state("3", "temperature", "673.15", "pressure", "1000000"),
    ]),
  ).toString("base64");
  const search = new URLSearchParams({
    fluid: "Water",
    units: "celsius",
    states,
  });
  await page.goto(`${BASE}/workspace?${search}`);
  await page.locator("#plot-type").waitFor();
  // The chart alone: not Plotly's tool bar.
  await page.addStyleTag({ content: ".modebar { display: none !important; }" });
  const dir = mkdtempSync(join(tmpdir(), "charts-"));
  for (const id of DIAGRAMS) {
    await page.locator("#plot-type").selectOption(id);
    await page.locator(".plot-wrapper.is-ready").waitFor();
    await page.waitForTimeout(1500);
    const shot = join(dir, `${id}.png`);
    await page
      .locator(".plot-container.js-plotly-plot")
      .screenshot({ path: shot });
    // 1200 px wide, at the chart's own proportions (the same for all six).
    execFileSync("ffmpeg", [
      ...["-y", "-loglevel", "error", "-i", shot],
      ...["-vf", "scale=1200:-2:flags=lanczos"],
      ...["-q:v", "4", join(OUT, `chart-${id}.jpg`)],
    ]);
  }
  rmSync(dir, { recursive: true, force: true });
  await browser.close();
  console.log(`charts: ${DIAGRAMS.length} → ${OUT}/chart-*.jpg`);
}
