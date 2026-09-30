# Thermoprops

**[Open Thermoprops → luisbedoia.github.io/thermoprops](https://luisbedoia.github.io/thermoprops/)**

[![Thermoprops – thermodynamic properties of fluids and refrigerants](public/og-image.png)](https://luisbedoia.github.io/thermoprops/)

Free online calculator for thermodynamic properties of fluids and refrigerants, powered by [CoolProp](https://coolprop.org/) compiled to WebAssembly. It runs entirely in the browser.

## Features

- 30 common fluids and refrigerants: water, air, ammonia, CO₂, nitrogen, R134a, R410A, R32, R1234yf, propane…
- Fix two independent properties (T, P, ρ, h, s, u, quality…) and get the full thermodynamic state.
- SI and imperial units, with temperature in °C, K or °F.
- P–h, T–s, P–T and ρ–h diagrams with saturation curves, isolines and multiple states plotted together.
- Shareable links: fluid, units and states are stored in the URL.

## Development

```bash
npm install
npm run dev
```

`@luisbedoia/coolprop-wasm` is published on GitHub Packages, so `npm install` needs a token with `read:packages` in `.npmrc`.

Releases are deployed to GitHub Pages when a `v*` tag is pushed.

## License

MIT
