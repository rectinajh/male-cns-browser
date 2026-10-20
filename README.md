# Male CNS Browser

Open-source **3D fruit-fly CNS neuron browser** for exploring a MaleCNS-shaped connectome subset, inspecting key nodes, and playing a blue “think once” pulse along preset decision paths.

> Visual demo only — not a biophysical spike model. No neuPrint token required to run the shipped fixture.

## Quick start

```bash
cd web
npm install
npm run dev
```

Then open the printed local URL (usually `http://localhost:5173`).

```bash
npm test    # Vitest
npm run build
```

## Features (v0.1)

- Orbit a dark-background 3D scene (brain blob + neck + VNC stub fixture)
- Click key nodes (somas) to see id / type / side and neighbors
- Choose a thought path and press **思考一次** for a `#3BA7FF` pulse along waypoints
- `ConnectomeSource` abstraction with `LocalJsonSource` today; neuPrint reserved for later

## Data & attribution

- **Code:** MIT (see [`LICENSE`](./LICENSE))
- **MaleCNS data:** CC-BY — [FlyEM / HHMI Janelia Male CNS](https://male-cns.janelia.org/) (`male-cns:v1.0`)
- The committed `web/public/data/subset.json` is a **synthetic fixture** shaped like brain + neck + VNC so CI and first-time clones work offline. Real SWC/neuPrint export is documented under [`scripts/prepare`](./scripts/prepare) and [`docs/DATA.md`](./docs/DATA.md).

## Docs

- Design: [`docs/superpowers/specs/2026-10-20-male-cns-browser-design.md`](./docs/superpowers/specs/2026-10-20-male-cns-browser-design.md)
- Plan: [`docs/superpowers/plans/2026-10-20-male-cns-browser.md`](./docs/superpowers/plans/2026-10-20-male-cns-browser.md)
- Data notes: [`docs/DATA.md`](./docs/DATA.md)

## Repo layout

```text
web/                 Vite + React + R3F app
scripts/prepare/     neuPrint export stub (token optional)
docs/                Design, plan, data notes
```

## Non-goals (v0.1)

Full ~166k-neuron load, EM volumes, Hodgkin–Huxley / detailed spiking, or coupling to other products.
