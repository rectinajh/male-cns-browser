# Male CNS Browser — Design Spec (v0.1)

**Date:** 2026-10-20 (Asia/Shanghai)  
**Status:** Draft for user review  
**Repo (proposed):** `male-cns-browser` — new standalone open-source project (not part of counterfly / RWA)

## 1. Goal

Build an open-source **3D fruit-fly CNS neuron browser** that:

1. Renders a recognizable 3D MaleCNS-style nervous system (brain + neck connective + VNC silhouette from real morphology).
2. Lets users inspect **key nodes** (neurons): select, see type/side/id, and list neighbors.
3. Plays a **“think once”** visualization: blue electrical pulses travel along real connectivity paths to convey a decision process (visual demo, not biophysics).

Reference look: Janelia Male CNS connectome gallery / Neuroglancer-style dense fiber renderings (black or light background; cyan–blue current accents).

## 2. Non-goals (v0.1)

- Full ~166k-neuron interactive load in the browser.
- EM image volumes / Neuroglancer parity.
- Realistic membrane / Hodgkin–Huxley / detailed spiking models.
- RWA, Attestcoin, or counterfly product coupling.
- Requiring end users to obtain a neuPrint token just to run the demo.

## 3. Decisions (locked)

| Topic | Choice |
| --- | --- |
| Product shape | New independent OSS project |
| v0.1 feature set | 3D browse + key nodes + blue thought flash, with a **small real subset** |
| Frontend | Vite + React + React Three Fiber (Three.js) |
| Thought simulation | Visual demo: preset pulses along real edges |
| Subset size | ~200–400 real MaleCNS neurons |
| Data delivery | Static subset package in-repo; abstract `ConnectomeSource` for later neuPrint |
| Licenses | App code MIT; MaleCNS data attribution CC-BY |

## 4. Architecture

```text
scripts/prepare  →  public/data/subset.json (+ optional .bin/.glb)
                         ↓
                    ConnectomeSource (local JSON today)
                         ↓
              ┌──────────┴──────────┐
              │                     │
         Scene (R3F)          Sidebar browser
         - skeletons          - search / filter
         - key nodes          - selection details
         - blue pulse FX      - “Think once” + path pick
              │
         ThoughtPlayer (preset path playback)
```

### 4.1 Components

- **`scripts/prepare` (Python):** Authenticated neuPrint + optional SWC download; builds a curated subset circuit; writes `subset.json` and a short `DATA.md` (neuron ids, dataset `male-cns:v1.0`, export date).
- **`ConnectomeSource`:** Interface with `load()`, `getNeuron(id)`, `neighbors(id)`, `listThoughts()`. v0.1 implementation: `LocalJsonSource`. Stub / adapter shape reserved for `NeuPrintSource` later.
- **`NeuronScene`:** R3F canvas; orbit controls; LineSegments (or tube LOD) for skeletons; spheres for key nodes / somas; selection highlight + neighbor edge highlight.
- **`ThoughtPlayer`:** Given an ordered list of edges (or neuron waypoints), animates blue emissive particles / short trails along polyline samples. Color ≈ `#3BA7FF`. Triggered by “思考一次”.
- **`NeuronBrowser` sidebar:** Search by id/type; type chips; selected neuron card; neighbor list (click to jump); thought path selector + play button.

### 4.2 Success criteria (v0.1 Demo)

1. `npm i && npm run dev` works with **no neuPrint token**.
2. User can orbit/zoom a recognizable CNS-shaped subset within a few seconds of load.
3. Clicking a key node shows id/type and neighbors; neighbors are highlightable.
4. “思考一次” plays a blue pulse along a preset real path to a visible endpoint.
5. README attributes MaleCNS and links to https://male-cns.janelia.org/.

## 5. Data model

### 5.1 `subset.json` (conceptual schema)

```json
{
  "meta": {
    "dataset": "male-cns:v1.0",
    "source": "https://male-cns.janelia.org/",
    "license": "CC-BY",
    "neuronCount": 280,
    "exportedAt": "2026-10-20"
  },
  "neurons": [
    {
      "id": 12781,
      "name": "DNge104_R",
      "type": "DNge104",
      "side": "R",
      "soma": [x, y, z],
      "skeleton": [[x, y, z], "..."]
    }
  ],
  "edges": [
    { "from": 12781, "to": 556329, "weight": 42 }
  ],
  "thoughts": [
    {
      "id": "escape-demo",
      "label": "Escape-like path (demo)",
      "waypoints": [12781, 111, 222, 333]
    }
  ]
}
```

Coordinates: MaleCNS EM space scaled for display (document the scale factor in `DATA.md`). Skeletons may be downsampled for browser size.

### 5.2 Subset selection policy

Prefer a **connected circuit** with anatomical diversity (e.g. sensory → interneuron → descending / VNC-facing), not a random sample, so:

- Overall silhouette still reads as brain + neck + VNC fragment.
- Thought paths have meaningful length.
- Key hubs exist for neighbor browsing.

Exact cell-type list is chosen during prepare and recorded in `DATA.md`.

### 5.3 Future neuPrint

Same `ConnectomeSource` methods; live fetch of skeletons / adjacencies for a user-selected type or ROI. Not in v0.1 runtime path.

## 6. Rendering & UX

- Default camera: lateral-ish view similar to gallery shots; soft dark background.
- Neurons: muted multi-color by type or hemilineage (optional); selected = bright; inactive = dim.
- Key nodes: clickable spheres at soma or centroid; hover tooltip with type.
- Blue current: only during thought playback; trail fades; configurable speed.
- Performance budget: target 60fps on a mid laptop for the demo subset; if not, reduce tube complexity to lines first.

## 7. Repository layout

```text
male-cns-browser/
  README.md
  LICENSE                 # MIT
  package.json            # workspace root (optional) or web-only
  web/                    # Vite + React + R3F app
  scripts/prepare/        # Python export tooling
  public/data/            # committed demo subset
  docs/
    DATA.md
    superpowers/specs/2026-10-20-male-cns-browser-design.md
```

## 8. Attribution & compliance

- Data: MaleCNS v1.0, FlyEM / HHMI Janelia and collaborators; license **CC-BY**. Link project page and preprint/paper as appropriate.
- Code: **MIT**.
- Do not redistribute full multi-GB synapse tables in this repo; only the small demo subset needed to run.

## 9. Risks

| Risk | Mitigation |
| --- | --- |
| Subset too sparse → “not a brain” look | Curate connected circuit; include optic-lobe / central / neck fragments deliberately |
| SWC too heavy | Downsample polylines; pack binary later if needed |
| neuPrint rate limits during prepare | One-shot export; commit artifacts |
| Users expect biorealism | README clarifies visual demo vs physiology |

## 10. Implementation order (preview)

1. Scaffold Vite + R3F app with empty scene + sidebar shell.
2. Hand-authored mini fixture → prove selection + blue pulse.
3. `scripts/prepare` → real subset JSON.
4. Wire LocalJsonSource; polish README + attribution.
5. (Later) NeuPrintSource adapter.

## 11. Resolved defaults (v0.1)

- Repo name default: `male-cns-browser` (rename OK before first publish).
- Thought realism: visual preset only.
- Stack: R3F chosen by default for maintainability.
