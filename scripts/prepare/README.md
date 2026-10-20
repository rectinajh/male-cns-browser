# Prepare / export

- **`build_subset.py`** — builds `web/public/data/subset.json` from public MaleCNS GCS
  (annotations feather, connectome-weights feather, per-body SWC). No neuPrint token required.
- **`prepare.py`** — legacy neuPrint stub (optional token path; not used for the committed subset).

```bash
export MALECNS_DATA_DIR=/path/to/cache   # annotations + weights + swc/
python scripts/prepare/build_subset.py
```

See `docs/DATA.md`.
