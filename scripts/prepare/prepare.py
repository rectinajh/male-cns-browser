#!/usr/bin/env python3
"""Stub exporter for MaleCNS subset JSON.

v0.1: documents the neuPrint workflow and exits 0 without a token so CI passes.
Replace the stub body with a real Client(...) export when credentials are available.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Export a MaleCNS connectome subset for male-cns-browser"
    )
    parser.add_argument(
        "--token",
        default=None,
        help="neuPrint auth token (or set NEUPRINT_TOKEN). Optional for this stub.",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("../../web/public/data/subset.json"),
        help="Output SubsetFile JSON path",
    )
    parser.add_argument(
        "--dataset",
        default="male-cns:v1.0",
        help="neuPrint dataset name",
    )
    args = parser.parse_args()

    print("male-cns-browser prepare.py (stub)")
    print(f"  dataset: {args.dataset}")
    print(f"  out:     {args.out}")
    print()
    print("Intended workflow (not executed in v0.1 stub):")
    print("  from neuprint import Client")
    print(f"  c = Client('neuprint.janelia.org', dataset='{args.dataset}', token=TOKEN)")
    print("  # query a connected sensory→IN→DN/VNC circuit")
    print("  # fetch / downsample SWC skeletons")
    print("  # write SubsetFile JSON (meta, neurons, edges, thoughts)")
    print()
    print("Runtime demo uses the committed real MaleCNS SWC subset (see build_subset.py / docs/DATA.md).")
    print("See docs/DATA.md and https://male-cns.janelia.org/")
    if not args.token:
        print()
        print("No --token provided; stub exits successfully without writing.")
        return 0

    print()
    print("Token provided, but real export is not implemented yet — refusing to overwrite fixture.")
    print("Keep using the synthetic subset until prepare is completed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
