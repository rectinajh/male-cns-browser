# prepare — MaleCNS subset export

Builds a curated `subset.json` from neuPrint (`male-cns:v1.0`) for the browser.

## Status (v0.1)

`prepare.py` is a **stub**: it documents the intended workflow and exits successfully without a token so CI stays green. Real SWC/adjacency export is a follow-up once a neuPrint token is available.

## Usage (future)

```bash
export NEUPRINT_TOKEN=...   # or pass --token
python prepare.py --out ../../web/public/data/subset.json
```

Requires `neuprint-python` and network access to Janelia neuPrint.

## Output

Writes a `SubsetFile` JSON matching `web/src/types.ts` / the design spec, plus updates notes in `docs/DATA.md` (neuron ids, export date, scale).
