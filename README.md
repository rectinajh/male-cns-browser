# Male CNS Browser

Open-source **3D fruit-fly CNS neuron browser** for exploring a dense MaleCNS-shaped connectome subset, inspecting key nodes, and playing a cyan-white “think once” charge pulse along a fresh random connectome walk each click.

> Visual demo only — not a biophysical spike model. Ships a **real MaleCNS v1.0 SWC subset** (no neuPrint token required at runtime).

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

- Orbit a dark-background 3D scene of **real MaleCNS SWC skeletons** (rainbow by type), auto-fitted and slowly auto-rotating
- Click key nodes (somas) to see id / type / side and neighbors
- Press **思考一次** for a random edge walk: **cyan-white charge packets** (`#E8FFFF`) race along real arbors, somas flash on arrival, then a short afterglow (~0.75s); demo window about **4–8s** (not biophysics)
- Right-hand panel: Janelia reference renders (local copies; see below)
- `ConnectomeSource` abstraction with `LocalJsonSource` today; optional neuPrint enrich via `scripts/prepare/enrich_neuprint.py`

## Shipped subset (current)

Committed `web/public/data/subset.json` meta (exported 2026-10-20):

| | |
| --- | --- |
| Dataset | `male-cns:v1.0` |
| Neurons | **1136** real SWC bodies (dense curated optic / DN / AN / CX / MB / VNC / hubs) |
| Edges | **5000** (neuPrint `male-cns:v1.0` adjacencies) |
| Skeleton | interleaved segment endpoint pairs, ~320 points per neuron after downsample |
| Scope | **not** the full MaleCNS (~140k CNS neurons) — sized for browser WebGL |

Rebuild with [`scripts/prepare/build_subset.py`](./scripts/prepare/build_subset.py); optionally enrich edges with [`scripts/prepare/enrich_neuprint.py`](./scripts/prepare/enrich_neuprint.py). Details: [`docs/DATA.md`](./docs/DATA.md).

## Data & attribution

- **Code:** MIT (see [`LICENSE`](./LICENSE))
- **MaleCNS data:** CC-BY — [FlyEM / HHMI Janelia Male CNS](https://male-cns.janelia.org/) (`male-cns:v1.0`)
- Do **not** commit neuPrint tokens, full synapse tables, or large reference PNGs

## Reference images (local)

The right-hand panel expects two Janelia reference renders under `web/public/reference/` (not committed — ~12MB each):

```bash
mkdir -p web/public/reference
cp dimorphic-brain-only.png \
  web/public/reference/dimorphic-brain-only.png
cp mcns-median-size-per-type-40-0626-3840x2160.png \
  web/public/reference/mcns-median-size-per-type-40-0626-3840x2160.png
```

Vite serves them at `/reference/...`. Without the copies the panel frames stay empty.

## Docs

- Design: [`docs/superpowers/specs/2026-10-20-male-cns-browser-design.md`](./docs/superpowers/specs/2026-10-20-male-cns-browser-design.md)
- Plan: [`docs/superpowers/plans/2026-10-20-male-cns-browser.md`](./docs/superpowers/plans/2026-10-20-male-cns-browser.md)
- Data notes: [`docs/DATA.md`](./docs/DATA.md)

## Repo layout

```text
web/                 Vite + React + R3F app
scripts/prepare/     SWC subset builder + optional neuPrint enrich
docs/                Design, plan, data notes
```

## Non-goals (v0.1)

Full ~140k-neuron load, EM volumes, Hodgkin–Huxley / detailed spiking, or coupling to other products.
