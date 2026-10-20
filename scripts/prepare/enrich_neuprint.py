#!/usr/bin/env python3
"""Enrich subset.json edges/thoughts via neuPrint (token required).

Keeps existing real SWC morphology; replaces edges with neuPrint adjacencies
among the same body IDs (plus optional extra partners already in the subset).
"""
from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import date
from pathlib import Path

from neuprint import Client, fetch_adjacencies

REPO = Path(__file__).resolve().parents[2]
SUBSET = REPO / "web/public/data/subset.json"
TOKEN_PATH = Path(
    os.environ.get(
        "NEUPRINT_TOKEN_FILE",
        str(Path.home() / ".config/male-cns-browser/neuprint.token"),
    )
)


def main() -> None:
    token = TOKEN_PATH.read_text().strip()
    if not token:
        raise SystemExit(f"empty token at {TOKEN_PATH}")

    data = json.loads(SUBSET.read_text())
    neurons = data["neurons"]
    ids = [int(n["id"]) for n in neurons]
    id_set = set(ids)
    print(f"subset neurons: {len(ids)}")

    client = Client("https://neuprint.janelia.org", dataset="male-cns:v1.0", token=token)

    # Fetch all outgoing adjacencies for the subset; filter to within-subset.
    _neurons_df, conn = fetch_adjacencies(ids, ids, client=client)
    print(f"raw within-subset rows: {len(conn)}")

    edges = []
    # Expected columns: bodyId_pre, bodyId_post, weight (neuprint naming)
    cols = {c.lower(): c for c in conn.columns}
    pre_c = cols.get("bodyid_pre") or cols.get("bodyid") or "bodyId_pre"
    post_c = cols.get("bodyid_post") or "bodyId_post"
    w_c = cols.get("weight") or "weight"
    for _, row in conn.iterrows():
        a, b = int(row[pre_c]), int(row[post_c])
        if a in id_set and b in id_set and a != b:
            edges.append({"from": a, "to": b, "weight": int(row[w_c])})

    # Dedup keep max weight
    best: dict[tuple[int, int], int] = {}
    for e in edges:
        k = (e["from"], e["to"])
        best[k] = max(best.get(k, 0), e["weight"])
    edges = [{"from": a, "to": b, "weight": w} for (a, b), w in best.items()]
    edges.sort(key=lambda e: -e["weight"])
    print(f"unique directed edges: {len(edges)}")

    # Build adjacency for thought paths (strongest BFS-ish)
    out_map: dict[int, list[tuple[int, int]]] = defaultdict(list)
    for e in edges:
        out_map[e["from"]].append((e["to"], e["weight"]))
    for k in out_map:
        out_map[k].sort(key=lambda t: -t[1])

    def longest_path(start: int, max_hops: int = 8) -> list[int]:
        path = [start]
        seen = {start}
        cur = start
        for _ in range(max_hops):
            nxts = [n for n, _w in out_map.get(cur, []) if n not in seen]
            if not nxts:
                break
            cur = nxts[0]
            path.append(cur)
            seen.add(cur)
        return path

    # Prefer DN / VNC-ish starts if present
    by_type = {int(n["id"]): n.get("type", "") for n in neurons}
    starts = [i for i in ids if str(by_type[i]).startswith("DN")] or ids[:5]
    p1 = longest_path(starts[0])
    p2 = longest_path(starts[min(1, len(starts) - 1)])
    if len(p2) < 3:
        p2 = longest_path(ids[len(ids) // 3])

    thoughts = [
        {
            "id": "escape-demo",
            "label": "Strong-path demo (neuPrint)",
            "waypoints": p1 if len(p1) >= 3 else ids[:5],
        },
        {
            "id": "descend-vnc",
            "label": "Second strong path (neuPrint)",
            "waypoints": p2 if len(p2) >= 3 else ids[5:10],
        },
    ]

    data["edges"] = edges[:5000]
    data["thoughts"] = thoughts
    data["meta"]["edgeCount"] = len(data["edges"])
    data["meta"]["exportedAt"] = date.today().isoformat()
    data["meta"]["connectivitySource"] = "neuprint male-cns:v1.0 fetch_adjacencies"
    data["meta"]["neuronCount"] = len(neurons)

    SUBSET.write_text(json.dumps(data, separators=(",", ":")))
    print(f"wrote {SUBSET} edges={len(data['edges'])} thoughts={[len(t['waypoints']) for t in thoughts]}")


if __name__ == "__main__":
    main()
