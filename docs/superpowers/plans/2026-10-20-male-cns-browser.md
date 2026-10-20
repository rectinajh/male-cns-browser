# Male CNS Browser v0.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a runnable Vite + React + R3F demo that loads a MaleCNS-shaped neuron subset, lets users pick key nodes, and plays blue thought pulses along preset paths — with no neuPrint token required at runtime.

**Architecture:** Static `public/data/subset.json` (fixture first, real export later) behind a `ConnectomeSource` interface; R3F scene for skeletons/nodes/pulses; React sidebar for browse + “Think once”.

**Tech Stack:** Vite, React 18, TypeScript, `@react-three/fiber`, `@react-three/drei`, Three.js, Vitest; Python prepare scripts deferred until fixture path works.

## Global Constraints

- Repo: https://github.com/rectinajh/male-cns-browser (public, MIT app code).
- Spec: `docs/superpowers/specs/2026-10-20-male-cns-browser-design.md`.
- Blue pulse color ≈ `#3BA7FF`; dark background.
- Runtime must work offline from committed data (no neuPrint token).
- Attribute MaleCNS CC-BY in README.
- YAGNI: no EM volumes, no biophysics, no counterfly/RWA coupling.
- Prefer small focused files; frequent commits; open a PR with working demo.

---

## File map (v0.1)

```text
web/
  package.json
  vite.config.ts
  index.html
  src/
    main.tsx
    App.tsx
    styles.css
    types.ts
    data/
      ConnectomeSource.ts
      LocalJsonSource.ts
    scene/
      NeuronScene.tsx
      NeuronLines.tsx
      KeyNodes.tsx
      ThoughtPulse.tsx
    ui/
      Sidebar.tsx
      NeuronDetails.tsx
      ThoughtControls.tsx
    state/
      useBrowserStore.ts
  public/data/
    subset.json          # hand fixture until prepare lands
  src/data/LocalJsonSource.test.ts
scripts/prepare/         # Task 5 — after fixture demo works
  README.md
  prepare.py             # stub OK if real export blocked on token
LICENSE
```

---

### Task 1: Scaffold web app + types + fixture

**Files:**
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/main.tsx`, `web/src/App.tsx`, `web/src/styles.css`, `web/src/types.ts`, `web/public/data/subset.json`, `LICENSE`, update root `README.md`

**Interfaces:**
- Produces: `Neuron`, `Edge`, `Thought`, `SubsetFile` types; tiny fixture with ≥8 neurons, ≥10 edges, ≥1 thought path.

- [ ] **Step 1:** Create Vite React-TS app under `web/` with deps: `react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `zustand`; devDeps: `typescript`, `vite`, `vitest`, `@types/react`, `@types/three`.

- [ ] **Step 2:** Add `web/src/types.ts`:

```ts
export type Vec3 = [number, number, number];

export type Neuron = {
  id: number;
  name: string;
  type: string;
  side: "L" | "R" | "C" | string;
  soma: Vec3;
  skeleton: Vec3[];
};

export type Edge = { from: number; to: number; weight: number };

export type Thought = {
  id: string;
  label: string;
  waypoints: number[];
};

export type SubsetMeta = {
  dataset: string;
  source: string;
  license: string;
  neuronCount: number;
  exportedAt: string;
};

export type SubsetFile = {
  meta: SubsetMeta;
  neurons: Neuron[];
  edges: Edge[];
  thoughts: Thought[];
};
```

- [ ] **Step 3:** Write `web/public/data/subset.json` — synthetic but anatomically flavored points forming a rough brain blob + neck + VNC stub (scale ~[-1,1] or tens of units). Include one thought `escape-demo` with 4–6 waypoints that follow existing edges.

- [ ] **Step 4:** Root `LICENSE` MIT; README: how to `cd web && npm i && npm run dev`, link spec, MaleCNS attribution.

- [ ] **Step 5:** Commit `chore: scaffold web app and fixture subset`.

---

### Task 2: ConnectomeSource + LocalJsonSource (TDD)

**Files:**
- Create: `web/src/data/ConnectomeSource.ts`, `web/src/data/LocalJsonSource.ts`, `web/src/data/LocalJsonSource.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ConnectomeSource {
  load(): Promise<SubsetFile>;
  getNeuron(id: number): Neuron | undefined;
  neighbors(id: number): { neuron: Neuron; weight: number; direction: "in" | "out" }[];
  listThoughts(): Thought[];
}
```

- [ ] **Step 1:** Write failing Vitest for `LocalJsonSource` — load fixture (import JSON or fetch `/data/subset.json` in node with readFile), assert neuron count, `getNeuron`, `neighbors`, `listThoughts`.

- [ ] **Step 2:** Run `cd web && npm test` — expect fail.

- [ ] **Step 3:** Implement `LocalJsonSource` implementing `ConnectomeSource`; build adjacency maps on load.

- [ ] **Step 4:** Tests pass; commit `feat: add LocalJsonSource connectome loader`.

---

### Task 3: Scene — lines, key nodes, selection store

**Files:**
- Create: `web/src/state/useBrowserStore.ts`, `web/src/scene/NeuronScene.tsx`, `web/src/scene/NeuronLines.tsx`, `web/src/scene/KeyNodes.tsx`
- Modify: `web/src/App.tsx`, `web/src/styles.css`

**Interfaces:**
- Consumes: `ConnectomeSource` / loaded `SubsetFile`
- Produces: zustand store `{ selectedId, setSelectedId, hoveredId, thoughtId, playing }`

- [ ] **Step 1:** Implement `useBrowserStore` with the fields above.

- [ ] **Step 2:** `NeuronLines` — one `THREE.LineSegments` (or multiple) from all `neuron.skeleton` polylines; dim color; selected neuron brighter.

- [ ] **Step 3:** `KeyNodes` — spheres at `soma`; onClick → `setSelectedId`; neighbor edges of selected neuron highlighted (thicker/brighter lines between selected and neighbor somas if full edge geometry is heavy).

- [ ] **Step 4:** `NeuronScene` — Canvas, dark bg, `OrbitControls`, ambient + directional light, Suspense load data via `LocalJsonSource`.

- [ ] **Step 5:** Wire App layout: full-viewport canvas + empty sidebar slot. Manual check: orbit works, click selects.

- [ ] **Step 6:** Commit `feat: 3D neuron scene with selection`.

---

### Task 4: Sidebar + ThoughtPulse (blue current)

**Files:**
- Create: `web/src/ui/Sidebar.tsx`, `web/src/ui/NeuronDetails.tsx`, `web/src/ui/ThoughtControls.tsx`, `web/src/scene/ThoughtPulse.tsx`
- Modify: `App.tsx`, styles

**Interfaces:**
- Consumes: store + source neighbors/thoughts
- `ThoughtPulse`: props `{ waypoints: Vec3[]; playing: boolean; color?: string; onDone?: () => void }` — animate a point along concatenated polyline; color default `#3BA7FF`.

- [ ] **Step 1:** Sidebar: search input filters by id/name/type; list clickable neurons; `NeuronDetails` shows id, type, side, neighbor list.

- [ ] **Step 2:** `ThoughtControls`: select thought, button「思考一次」sets `playing` true.

- [ ] **Step 3:** `ThoughtPulse` — sample positions along waypoint somas (or skeletons if available); use `useFrame` to advance `t`; draw glowing sprite/sphere + short trail; call `onDone` at end.

- [ ] **Step 4:** Manual demo path: load → select neuron → play thought → see blue flash. Commit `feat: neuron browser sidebar and blue thought pulse`.

---

### Task 5: Prepare script stub + data docs + PR polish

**Files:**
- Create: `scripts/prepare/README.md`, `scripts/prepare/prepare.py` (stub that documents neuPrint token + future export), `docs/DATA.md`
- Modify: README with screenshots placeholder / GIF if feasible

- [ ] **Step 1:** `docs/DATA.md` — fixture is synthetic for CI; real subset will use `male-cns:v1.0`, CC-BY, link Janelia download page.

- [ ] **Step 2:** `prepare.py` stub: argparse for `--token` / `--out`, print instructions to use neuprint-python `Client(..., dataset='male-cns:v1.0')` and write SubsetFile schema; exit 0 with message if no token (do not fail CI).

- [ ] **Step 3:** Ensure `npm test` and `npm run build` succeed in `web/`.

- [ ] **Step 4:** Open PR summarizing demo instructions; leave note that real SWC subset export is follow-up once token available.

- [ ] **Step 5:** Commit `docs: prepare stub and DATA attribution`.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| 3D browse subset | 3 |
| Key nodes + neighbors | 3–4 |
| Blue thought pulse | 4 |
| Static data / no token | 1–2 |
| ConnectomeSource + neuPrint reserved | 2 (+ stub Task 5) |
| Attribution / MIT | 1, 5 |
| ~200–400 real neurons | Follow-up after prepare (fixture first) |

## Follow-up (not this PR)

- Run real `prepare.py` against neuPrint; replace fixture with ~280-neuron connected circuit.
- Optional `NeuPrintSource` adapter behind same interface.
