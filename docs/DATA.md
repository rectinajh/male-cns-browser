# Data notes

## Runtime demo (`web/public/data/subset.json`)

| Field | Value |
| --- | --- |
| Dataset | `male-cns:v1.0` |
| Source | https://male-cns.janelia.org/ (public GCS SWC + flat connectome) |
| License | **CC-BY** — attribute FlyEM / HHMI Janelia and MaleCNS collaborators |
| Geometry | **Real** MaleCNS SWC skeletons (downsampled), not synthetic |
| Counts | **1136** real SWC neurons, **5000** neuPrint edges (dense curated; not full ~140k CNS), ≥2 thought paths |
| SWC URL | `https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/skeletons-malecns/skeletons-swc/{bodyId}.swc` |
| Weights | `connectome-weights-male-cns-v1.0-minconf-0.5.feather` (body_pre, body_post, weight) |
| Annotations | `body-annotations-male-cns-v1.0-minconf-0.5.feather` |

### Coordinate scale

MaleCNS SWC / `somaLocation` are in **8 nm voxel** units.

Display transform (see `meta.scale` in `subset.json`):

1. Subtract the subset centroid (voxel space)
2. Remap axes so the brain↔VNC long axis is **+Y** (brain) / **−Y** (VNC) when possible
3. Multiply by **`0.001`** so scene units sit roughly in **[-50, 50]** (outliers may extend further)

`neurons[].skeleton` is stored as **interleaved segment endpoint pairs** (parent→child after downsample). The renderer steps by 2 when drawing `LineSegments`.

### Subset curation

`scripts/prepare/build_subset.py` (also runnable from a data cache dir) selects Traced bodies spanning:

- optic / visual types (both sides)
- descending & ascending neurons
- central complex / Kenyon / MBON
- VNC-ish (`somaNeuromere` / `mancType` / `exitNerve` / `vnc_*` superclass)
- high-weight hubs touching the set

Do **not** commit full multi-GB synapse tables — only this small demo subset.

## Regenerating

```bash
# annotations + weights + SWC cache live outside the repo by default
python scripts/prepare/build_subset.py
# or: /workspace/male-cns-data/build_subset.py
```

Requires Python 3.10+, `pyarrow`, `pandas`, `numpy`, and network access to GCS.

## Schema

See design spec §5.1 (`meta`, `neurons`, `edges`, `thoughts`).
