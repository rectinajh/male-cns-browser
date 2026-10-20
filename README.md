# Male CNS Browser

Open-source **3D fruit-fly CNS neuron browser** for exploring a MaleCNS-shaped connectome subset, inspecting key nodes, and playing a blue “think once” pulse along a fresh random connectome walk each click.

> Visual demo only — not a biophysical spike model. Ships a **real MaleCNS v1.0 SWC subset** (no neuPrint token required).

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

- Orbit a dark-background 3D scene of **real MaleCNS skeletons** (rainbow by type)
- Click key nodes (somas) to see id / type / side and neighbors
- Press **思考一次** for a `#3BA7FF` pulse along a **random** edge walk (new route each click)
- `ConnectomeSource` abstraction with `LocalJsonSource` today; neuPrint reserved for later

## Data & attribution

- **Code:** MIT (see [`LICENSE`](./LICENSE))
- **MaleCNS data:** CC-BY — [FlyEM / HHMI Janelia Male CNS](https://male-cns.janelia.org/) (`male-cns:v1.0`)
- Committed `web/public/data/subset.json` is a curated **real SWC** subset (~300 neurons) from public GCS. Rebuild with [`scripts/prepare/build_subset.py`](./scripts/prepare/build_subset.py); see [`docs/DATA.md`](./docs/DATA.md).

## Reference images (local)

The right-hand panel expects two Janelia reference renders under `web/public/reference/` (not committed — ~12MB each):

```bash
mkdir -p web/public/reference
cp dimorphic-brain-only.png \
  web/public/reference/dimorphic-brain-only.png
cp mcns-median-size-per-type-40-0626-3840x2160-white.png \
  web/public/reference/mcns-median-size-per-type-40-0626-3840x2160-white.png
```

Vite serves them at `/reference/...`. Without the copies the panel frames stay empty.

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
