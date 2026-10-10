// Renders public/og-image.png (1200x630) used by Open Graph / Twitter cards.
// Run with `npm run og-image` after changing the design.
import sharp from "sharp";

const W = 1200;
const H = 630;

// Stylized saturation dome on a T–s diagram, drawn in the plot area.
const plot = { x: 700, y: 120, w: 420, h: 380 };
const dome = [];
for (let i = 0; i <= 60; i++) {
  const t = i / 60;
  const x = plot.x + 40 + t * (plot.w - 80);
  const y = plot.y + plot.h - 30 - Math.sin(Math.PI * t) ** 0.7 * (plot.h - 90);
  dome.push(`${x.toFixed(1)},${y.toFixed(1)}`);
}
const states = [
  [plot.x + 95, plot.y + 290],
  [plot.x + 150, plot.y + 170],
  [plot.x + 320, plot.y + 150],
  [plot.x + 360, plot.y + 70],
];

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#eef2f7"/>
  <rect x="40" y="40" width="${W - 80}" height="${H - 80}" rx="28" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>

  <text x="100" y="200" font-family="Inter, Helvetica, Arial, sans-serif" font-size="76" font-weight="700" fill="#0f172a">Thermoprops</text>
  <text x="100" y="270" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" fill="#1f2937">Thermodynamic properties</text>
  <text x="100" y="314" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" fill="#1f2937">of fluids and refrigerants</text>
  <text x="100" y="390" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" fill="#64748b">T · P · h · s · ρ · u · x  —  powered by CoolProp</text>
  <rect x="100" y="440" width="300" height="56" rx="28" fill="#2563eb"/>
  <text x="250" y="477" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" font-weight="600" fill="#ffffff">Free · runs in browser</text>
  <text x="100" y="550" font-family="Inter, Helvetica, Arial, sans-serif" font-size="22" fill="#64748b">luisbedoia.github.io/thermoprops</text>

  <rect x="${plot.x}" y="${plot.y}" width="${plot.w}" height="${plot.h}" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
  <line x1="${plot.x + 30}" y1="${plot.y + plot.h - 20}" x2="${plot.x + plot.w - 20}" y2="${plot.y + plot.h - 20}" stroke="#cbd5f5" stroke-width="2"/>
  <line x1="${plot.x + 30}" y1="${plot.y + 20}" x2="${plot.x + 30}" y2="${plot.y + plot.h - 20}" stroke="#cbd5f5" stroke-width="2"/>
  <text x="${plot.x + plot.w - 30}" y="${plot.y + plot.h - 30}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="20" fill="#64748b">s</text>
  <text x="${plot.x + 40}" y="${plot.y + 44}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="20" fill="#64748b">T</text>
  <polyline points="${dome.join(" ")}" fill="rgba(37,99,235,0.08)" stroke="#2563eb" stroke-width="4" stroke-linejoin="round"/>
  <polyline points="${states.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#0f172a" stroke-width="2.5" stroke-dasharray="7 6"/>
  ${states.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="#ffffff" stroke="#0f172a" stroke-width="3"/>`).join("\n  ")}
</svg>`;

await sharp(Buffer.from(svg))
  .png({ compressionLevel: 9 })
  .toFile("public/og-image.png");
console.log("Wrote public/og-image.png");
