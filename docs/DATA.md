# Data notes

## Runtime demo (`web/public/data/subset.json`)

| Field | Value |
| --- | --- |
| Purpose | Offline CI / first-run fixture |
| Geometry | Synthetic, anatomically flavored: upper brain blob, mid neck, lower VNC stub |
| Scale | Display units roughly in `[-1, 1]` (not raw MaleCNS EM voxels) |
| Counts | ≥8 neurons, ≥10 edges, ≥1 thought path (`escape-demo`) |
| License note | Schema & attribution follow MaleCNS CC-BY; **geometry itself is synthetic** and not redistributed Janelia SWC |

## Target production subset (follow-up)

| Field | Value |
| --- | --- |
| Dataset | `male-cns:v1.0` |
| Source | https://male-cns.janelia.org/ |
| License | CC-BY (attribute FlyEM / HHMI Janelia and collaborators) |
| Size | ~200–400 connected neurons (sensory → interneuron → descending / VNC) |
| Tooling | `scripts/prepare/prepare.py` + neuPrint token |

Do **not** commit full multi-GB synapse tables. Only the small demo subset needed to run belongs in-repo.

## Schema

See design spec §5.1 (`meta`, `neurons`, `edges`, `thoughts`). Coordinates for a real export should document the EM→display scale factor here when prepare lands.
