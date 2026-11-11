# Thermoprops

**[Open Thermoprops → luisbedoia.github.io/thermoprops](https://luisbedoia.github.io/thermoprops/)**

Free calculator for thermodynamic properties of fluids and refrigerants. It
runs entirely in the browser, on [CoolProp](https://coolprop.org/) compiled
to WebAssembly.

![A refrigeration cycle with R134a on the p–h diagram](docs/screenshots/desktop-diagram.png)

## Features

- 30 fluids and refrigerants: water, air, ammonia, CO₂, nitrogen, R134a,
  R410A, R32, R1234yf, propane…
- Fix any two independent properties (p, T, ρ, h, s, u, x) and get the full
  state, transport properties included.
- p–h, T–s, h–s, p–v, T–v and p–T diagrams, with the saturation dome,
  isolines and your states plotted together.
- °C, K or imperial units.
- A Worksheet that solves processes and whole cycles written as in a
  notebook (`2: from 1, compressed to P = 1.2 MPa, eta = 80%`).
- Saturation and superheated tables for every fluid, in English and Spanish:
  [steam tables](https://luisbedoia.github.io/thermoprops/fluids/water/),
  [R134a](https://luisbedoia.github.io/thermoprops/fluids/r134a/)…
- Shareable links: fluid, units and states are stored in the URL.
- Works on phones, offline once loaded, and can be installed as an app.

## For AI agents: MCP server and API

Agents can compute properties with CoolProp instead of interpolating tables.
Free, no key.

**MCP server** (Streamable HTTP): `https://thermoprops-api.luisbedoia.workers.dev/mcp`

- `fluid_state`: one state from two properties (`"T = -10 °C, sat vapor"`),
  in SI or imperial units, with the reference state textbooks use.
- `solve_worksheet`: a whole Worksheet script, from a single process to a
  combined cycle.

Every answer carries a link that opens the calculation solved, with its
diagrams, in the Worksheet.

Add it in Claude (Settings › Connectors › Add custom connector), ChatGPT
(developer mode), Cursor or VS Code with that address. It is listed in the
[MCP Registry](https://registry.modelcontextprotocol.io/) as
`io.github.luisbedoia/thermoprops`.

**HTTP API**: `GET https://thermoprops-api.luisbedoia.workers.dev/solve?s=<script>`
answers JSON. [The address without a path](https://thermoprops-api.luisbedoia.workers.dev/)
is its manual, and [Link to a calculation](https://luisbedoia.github.io/thermoprops/links/)
describes the script language.

![The same cycle on the T–s diagram, with isobars](docs/screenshots/desktop-ts.png)

![Every property of a tracked state](docs/screenshots/desktop-table.png)

<p align="center">
  <img src="docs/screenshots/phone-diagram.png" alt="The p–h diagram on a phone" width="260">
  &nbsp;&nbsp;
  <img src="docs/screenshots/phone-form.png" alt="Adding a state: any pair of properties" width="260">
</p>

## Development

Properties come from
[`@luisbedoia/coolprop-rs-wasm`](https://github.com/luisbedoia/coolprop-rs),
published on GitHub Packages: installing it needs a token with
`read:packages` in `NPM_TOKEN` (`.npmrc` reads it).

```bash
NPM_TOKEN=<token> npm ci
npm run dev       # development server
npm test          # unit tests
npm run build     # type check and production build
```

Pushing a `v*` tag deploys to GitHub Pages.

The API and MCP server ([`api/`](api/)) are a Cloudflare Worker that runs
the Worksheet's own script language (`src/dsl`) on the same wasm:

```bash
cd api && npm install
npm run dev       # local server on wrangler dev
npm run deploy    # needs `npx wrangler login`
```

## Credits

All property values are computed by CoolProp. If you use them in academic
work, please cite:

> Bell, I. H.; Wronski, J.; Quoilin, S.; Lemort, V. Pure and Pseudo-pure
> Fluid Thermophysical Property Evaluation and the Open-Source Thermophysical
> Property Library CoolProp. _Ind. Eng. Chem. Res._ **2014**, 53 (6),
> 2498–2508. [doi:10.1021/ie4033999](https://doi.org/10.1021/ie4033999)

Developed by the Department of Mechanical Engineering, Universidad de
Antioquia.

## License

MIT
