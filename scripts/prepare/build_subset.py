#!/usr/bin/env python3
"""Build a real MaleCNS v1.0 SWC subset for male-cns-browser.

Reads public GCS annotations + connectome weights + per-body SWC skeletons.
Writes web/public/data/subset.json matching the SubsetFile schema.

Coordinate transform (documented in meta + docs/DATA.md):
  - SWC / somaLocation are 8 nm voxel units from MaleCNS v1.0
  - We center on the subset centroid, optionally flip so brain is +Y / VNC is -Y,
    then multiply by SCALE (0.001) so display coords fit roughly [-50, 50].
"""

from __future__ import annotations

import json
import math
import os
import random
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date
from pathlib import Path

import numpy as np
import pyarrow.feather as feather

_REPO = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("MALECNS_DATA_DIR", "/workspace/male-cns-data"))
REPO = Path(os.environ.get("MALECNS_REPO", str(_REPO)))
OUT_JSON = Path(os.environ.get("MALECNS_OUT", str(REPO / "web/public/data/subset.json")))
SWC_DIR = DATA_DIR / "swc"
WEIGHTS_PATH = DATA_DIR / "connectome-weights-male-cns-v1.0-minconf-0.5.feather"
ANN_PATH = DATA_DIR / "body-annotations.feather"

SWC_URL = (
    "https://storage.googleapis.com/flyem-male-cns/v1.0/segmentation/"
    "skeletons-malecns/skeletons-swc/{bodyId}.swc"
)
WEIGHTS_URL = (
    "https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/"
    "flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5.feather"
)

# Display scale: voxel * SCALE → scene units (~[-50, 50] after centering)
SCALE = 0.001
MAX_SKELETON_POINTS = 200  # as interleaved segment endpoints (pairs)
TARGET_NEURONS = 300
MAX_EDGES = 2500
RNG = random.Random(42)


def ensure_weights() -> None:
    if WEIGHTS_PATH.exists() and WEIGHTS_PATH.stat().st_size > 500_000_000:
        print(f"weights OK: {WEIGHTS_PATH} ({WEIGHTS_PATH.stat().st_size / 1e6:.0f} MB)")
        return
    print("downloading connectome weights (~1 GB)…")
    # resume-friendly via curl
    import subprocess

    subprocess.check_call(
        [
            "curl",
            "-L",
            "-C",
            "-",
            "-o",
            str(WEIGHTS_PATH),
            WEIGHTS_URL,
        ]
    )


def parse_soma(val):
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    if isinstance(val, (list, tuple, np.ndarray)) and len(val) >= 3:
        return [float(val[0]), float(val[1]), float(val[2])]
    if isinstance(val, str):
        s = val.strip().strip("[]")
        parts = [p.strip() for p in s.split(",")]
        if len(parts) >= 3:
            return [float(parts[0]), float(parts[1]), float(parts[2])]
    return None


def load_annotations():
    df = feather.read_table(ANN_PATH).to_pandas()
    df = df[df["status"] == "Traced"].copy()
    df["soma"] = df["somaLocation"].map(parse_soma)
    df["type_str"] = df["type"].fillna("unknown").astype(str)
    df["side"] = df["somaSide"].fillna("C").astype(str)
    df["superclass"] = df["superclass"].fillna("").astype(str)
    df["class_str"] = df["class"].fillna("").astype(str)
    df["instance_str"] = df["instance"].fillna("").astype(str)
    return df


def sample_group(df, n, prefer_soma=True):
    if df.empty:
        return []
    work = df
    if prefer_soma:
        with_soma = df[df["soma"].notna()]
        if len(with_soma) >= max(1, n // 2):
            work = with_soma
    ids = work["bodyId"].astype(int).tolist()
    RNG.shuffle(ids)
    return ids[:n]


def curate_body_ids(df) -> list[int]:
    selected: list[int] = []
    seen: set[int] = set()

    def add(ids, label=""):
        added = 0
        for i in ids:
            if i not in seen:
                seen.add(i)
                selected.append(i)
                added += 1
        if label:
            print(f"  +{added} {label} (total {len(selected)})")

    # Optic / visual types — several types, both sides
    optic_types = ["Mi1", "Mi4", "Mi9", "Tm1", "Tm2", "Tm3", "Tm9", "L1", "L2", "T4c", "T1", "C2", "C3"]
    for t in optic_types:
        sub = df[df["type_str"] == t]
        for side in ("L", "R"):
            add(sample_group(sub[sub["side"] == side], 3), f"optic {t}_{side}")

    # visual projection (e.g. LC-like)
    vp = df[df["superclass"] == "visual_projection"]
    for side in ("L", "R"):
        add(sample_group(vp[vp["side"] == side], 12), f"visual_projection_{side}")

    # Descending neurons
    dn = df[
        (df["superclass"] == "descending_neuron")
        | (df["type_str"].str.startswith("DN", na=False))
    ]
    add(sample_group(dn, 45), "descending")

    # Ascending (neck bridge)
    an = df[df["superclass"] == "ascending_neuron"]
    add(sample_group(an, 20), "ascending")

    # Central complex / Kenyon / MB
    cx = df[df["class_str"].isin(["CX", "Kenyon_Cell", "MBON", "DAN", "ALPN"])]
    # Prefer named CX types
    for tpat in ["EPG", "PEG", "PEN", "FB", "MBON", "KC"]:
        sub = df[df["type_str"].str.contains(tpat, na=False, regex=False)]
        add(sample_group(sub, 8 if tpat != "KC" else 15), f"CX/MB {tpat}")
    add(sample_group(cx, 25), "CX/MB class")

    # VNC-ish
    vnc = df[
        df["somaNeuromere"].notna()
        | df["mancType"].notna()
        | df["exitNerve"].notna()
        | (df["superclass"].str.startswith("vnc_", na=False))
    ]
    add(sample_group(vnc, 70), "VNC")

    # cb_intrinsic hubs (central brain)
    cb = df[df["superclass"] == "cb_intrinsic"]
    add(sample_group(cb, 30), "cb_intrinsic")

    # Trim / pad toward TARGET
    if len(selected) > TARGET_NEURONS + 40:
        selected = selected[: TARGET_NEURONS + 40]
    print(f"curated {len(selected)} candidate bodyIds")
    return selected


def download_swc(body_id: int) -> Path | None:
    SWC_DIR.mkdir(parents=True, exist_ok=True)
    path = SWC_DIR / f"{body_id}.swc"
    if path.exists() and path.stat().st_size > 50:
        return path
    url = SWC_URL.format(bodyId=body_id)
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "male-cns-browser/0.1"})
            with urllib.request.urlopen(req, timeout=60) as resp:
                data = resp.read()
            if len(data) < 30 or b"NoSuchKey" in data or data.startswith(b"<?xml"):
                return None
            path.write_bytes(data)
            return path
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(0.5 * (attempt + 1))
        except Exception:
            time.sleep(0.5 * (attempt + 1))
    return None


def parse_swc(path: Path):
    """Return list of (id, x, y, z, parent)."""
    nodes = []
    for line in path.read_text(errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split()
        if len(parts) < 7:
            continue
        nid = int(float(parts[0]))
        x, y, z = float(parts[2]), float(parts[3]), float(parts[4])
        parent = int(float(parts[6]))
        nodes.append((nid, x, y, z, parent))
    return nodes


def skeleton_segments(nodes, max_points=MAX_SKELETON_POINTS):
    """Downsample SWC to interleaved segment endpoint pairs (≤ max_points verts)."""
    if not nodes:
        return []
    by_id = {n[0]: (n[1], n[2], n[3]) for n in nodes}
    edges = [(n[4], n[0]) for n in nodes if n[4] != -1 and n[4] in by_id]
    if not edges:
        # isolated points — emit tiny stubs
        pts = list(by_id.values())
        if len(pts) == 1:
            x, y, z = pts[0]
            return [[x, y, z], [x + 1, y, z]]
        out = []
        for i in range(min(len(pts) - 1, max_points // 2)):
            out.append(list(pts[i]))
            out.append(list(pts[i + 1]))
        return out

    # Keep a subset of nodes by stride on SWC order, always keep roots
    n_nodes = len(nodes)
    max_edges = max_points // 2
    if n_nodes <= max_points // 2 + 5:
        keep = set(by_id.keys())
    else:
        stride = max(1, math.ceil(n_nodes / (max_points // 2)))
        keep = set()
        for i, n in enumerate(nodes):
            if n[4] == -1 or i % stride == 0:
                keep.add(n[0])
        # ensure endpoints of long chains
        children = defaultdict(list)
        for p, c in edges:
            children[p].append(c)
        for nid, (_, _, _, _, parent) in ((n[0], n) for n in nodes):
            if nid not in children and parent != -1:
                # leaf
                if RNG.random() < 0.3:
                    keep.add(nid)

    # Map each node to nearest kept ancestor; emit edges between kept pairs
    parent_map = {n[0]: n[4] for n in nodes}

    def nearest_kept_ancestor(nid):
        seen_local = set()
        cur = parent_map.get(nid, -1)
        while cur != -1 and cur not in seen_local:
            if cur in keep:
                return cur
            seen_local.add(cur)
            cur = parent_map.get(cur, -1)
        return None

    segs = []
    used = set()
    for p, c in edges:
        if c not in keep:
            continue
        if p in keep:
            a, b = p, c
        else:
            a = nearest_kept_ancestor(c)
            b = c
            if a is None:
                continue
        key = (a, b)
        if key in used:
            continue
        used.add(key)
        segs.append(list(by_id[a]))
        segs.append(list(by_id[b]))
        if len(segs) >= max_points:
            break

    if len(segs) < 2:
        # fallback: polyline of kept nodes in id order
        kept_pts = [by_id[n[0]] for n in nodes if n[0] in keep]
        segs = []
        for i in range(min(len(kept_pts) - 1, max_edges)):
            segs.append(list(kept_pts[i]))
            segs.append(list(kept_pts[i + 1]))
    return segs[:max_points]


def filter_edges(selected: set[int], max_edges=MAX_EDGES):
    print("loading weights table…")
    table = feather.read_table(WEIGHTS_PATH, columns=["body_pre", "body_post", "weight"])
    pre = table.column("body_pre").to_numpy()
    post = table.column("body_post").to_numpy()
    w = table.column("weight").to_numpy()
    print(f"  {len(pre):,} total edges")

    # boolean mask — selected is small, use np.isin
    sel = np.fromiter(selected, dtype=np.int64)
    mask = np.isin(pre, sel) & np.isin(post, sel)
    pre_f = pre[mask]
    post_f = post[mask]
    w_f = w[mask]
    print(f"  {len(pre_f):,} edges within subset")

    if len(w_f) == 0:
        return []

    # top by weight
    if len(w_f) > max_edges:
        idx = np.argpartition(-w_f, max_edges)[:max_edges]
        idx = idx[np.argsort(-w_f[idx])]
        pre_f, post_f, w_f = pre_f[idx], post_f[idx], w_f[idx]
    else:
        order = np.argsort(-w_f)
        pre_f, post_f, w_f = pre_f[order], post_f[order], w_f[order]

    edges = [
        {"from": int(a), "to": int(b), "weight": int(ww)}
        for a, b, ww in zip(pre_f, post_f, w_f)
    ]
    print(f"  kept {len(edges)} edges")
    return edges


def add_hubs_from_weights(df, selected: list[int], k=25) -> list[int]:
    """Add high-degree bodies that touch the current set."""
    sel = set(selected)
    table = feather.read_table(WEIGHTS_PATH, columns=["body_pre", "body_post", "weight"])
    pre = table.column("body_pre").to_numpy()
    post = table.column("body_post").to_numpy()
    w = table.column("weight").to_numpy()
    # degree within edges that touch selected
    touch = np.isin(pre, list(sel)) | np.isin(post, list(sel))
    pre_t, post_t, w_t = pre[touch], post[touch], w[touch]
    deg = defaultdict(float)
    for a, b, ww in zip(pre_t, post_t, w_t):
        a, b = int(a), int(b)
        if a in sel and b not in sel:
            deg[b] += ww
        elif b in sel and a not in sel:
            deg[a] += ww
    # prefer traced with type
    ranked = sorted(deg.items(), key=lambda x: -x[1])
    ann = df.set_index("bodyId")
    added = []
    for bid, _ in ranked:
        if bid in sel:
            continue
        if bid not in ann.index:
            continue
        row = ann.loc[bid]
        if isinstance(row, type(df)):
            row = row.iloc[0]
        if str(row.get("status", "")) != "Traced":
            continue
        added.append(bid)
        sel.add(bid)
        if len(added) >= k:
            break
    print(f"  +{len(added)} hubs from weights")
    return selected + added


def build_thoughts(neurons: list[dict], edges: list[dict]) -> list[dict]:
    by_id = {n["id"]: n for n in neurons}
    # adjacency undirected for path search
    adj = defaultdict(list)
    for e in edges:
        adj[e["from"]].append((e["to"], e["weight"]))
        adj[e["to"]].append((e["from"], e["weight"]))

    def bfs_path(start, goal_pred, max_depth=8):
        from collections import deque

        q = deque([(start, [start])])
        seen = {start}
        while q:
            cur, path = q.popleft()
            if len(path) > 1 and goal_pred(by_id[cur], path):
                return path
            if len(path) >= max_depth:
                continue
            nbrs = sorted(adj[cur], key=lambda x: -x[1])
            for nxt, _ in nbrs[:12]:
                if nxt in seen or nxt not in by_id:
                    continue
                seen.add(nxt)
                q.append((nxt, path + [nxt]))
        return None

    thoughts = []
    # Prefer visual_projection / optic → descending
    starts = [
        n["id"]
        for n in neurons
        if n["type"].startswith(("LC", "LPLC", "Lo", "Me", "Tm", "Mi", "L1", "L2"))
        or "visual" in n.get("_superclass", "")
    ]
    if not starts:
        starts = [n["id"] for n in neurons[:20]]

    dns = [
        n["id"]
        for n in neurons
        if n["type"].startswith("DN") or n.get("_superclass") == "descending_neuron"
    ]
    vncs = [
        n["id"]
        for n in neurons
        if n.get("_is_vnc")
    ]

    def find_path_to_set(start_ids, target_set, label, tid):
        for s in start_ids[:40]:
            path = bfs_path(s, lambda n, p: n["id"] in target_set and len(p) >= 4)
            if path and len(path) >= 4:
                return {
                    "id": tid,
                    "label": label,
                    "waypoints": path,
                }
        return None

    t1 = find_path_to_set(starts, set(dns) or set(vncs), "Visual → descending (escape-like)", "escape-demo")
    if t1:
        thoughts.append(t1)
    else:
        # fallback: heaviest chain of 4+ from any hub
        if edges:
            hub = max(neurons, key=lambda n: sum(1 for e in edges if e["from"] == n["id"] or e["to"] == n["id"]))
            path = bfs_path(hub["id"], lambda n, p: len(p) >= 5)
            if path:
                thoughts.append({"id": "escape-demo", "label": "Hub pathway demo", "waypoints": path})

    # Second thought: descending → VNC or reverse
    t2 = find_path_to_set(dns or starts, set(vncs) or set(n["id"] for n in neurons), "Descending → VNC", "descend-vnc")
    if t2 and (not thoughts or t2["waypoints"] != thoughts[0]["waypoints"]):
        thoughts.append(t2)
    else:
        # alternate path from another start
        for s in (dns or starts)[5:50]:
            path = bfs_path(s, lambda n, p: len(p) >= 4)
            if path and (not thoughts or path != thoughts[0]["waypoints"]):
                thoughts.append({"id": "descend-vnc", "label": "Secondary pathway", "waypoints": path})
                break

    if len(thoughts) < 2 and neurons:
        # fabricate waypoint lists along strongest edges if needed
        ids = [n["id"] for n in neurons]
        if len(ids) >= 4:
            if not thoughts:
                thoughts.append({"id": "escape-demo", "label": "Demo path A", "waypoints": ids[:5]})
            if len(thoughts) < 2:
                thoughts.append({"id": "descend-vnc", "label": "Demo path B", "waypoints": list(reversed(ids[:6]))})

    return thoughts


def transform_coords(neurons: list[dict]):
    """Center, orient brain=+Y / VNC=-Y, scale by SCALE. Mutates neurons."""
    all_pts = []
    for n in neurons:
        all_pts.append(n["soma"])
        all_pts.extend(n["skeleton"])
    arr = np.array(all_pts, dtype=np.float64)
    centroid = arr.mean(axis=0)

    # Orient: compare mean of VNC-tagged vs brain-tagged somas in raw Y and Z
    vnc_soma = np.array([n["soma"] for n in neurons if n.get("_is_vnc")], dtype=np.float64)
    brain_soma = np.array([n["soma"] for n in neurons if not n.get("_is_vnc")], dtype=np.float64)
    flip_y = False
    swap_yz = False
    if len(vnc_soma) > 5 and len(brain_soma) > 5:
        # Choose axis with largest separation between group means
        sep = np.abs(vnc_soma.mean(0) - brain_soma.mean(0))
        axis = int(np.argmax(sep))  # 0=x,1=y,2=z
        if axis == 2:
            swap_yz = True
            # after swap, Y gets old Z
            vnc_m = vnc_soma.mean(0)[2]
            brain_m = brain_soma.mean(0)[2]
            flip_y = vnc_m > brain_m
        elif axis == 1:
            flip_y = vnc_soma.mean(0)[1] > brain_soma.mean(0)[1]
        else:
            # separation mainly on X — rotate X→Y later via swap trick: treat as Y
            # map x into y for display silhouette
            swap_yz = False
            # We'll swap X and Y
            # handle below
            pass
        long_axis = axis
    else:
        long_axis = 1

    def xform(p):
        x, y, z = p[0] - centroid[0], p[1] - centroid[1], p[2] - centroid[2]
        if long_axis == 0:
            x, y = y, x  # long axis → Y
        if swap_yz:
            y, z = z, y
        if flip_y:
            y = -y
        return [x * SCALE, y * SCALE, z * SCALE]

    for n in neurons:
        n["soma"] = xform(n["soma"])
        n["skeleton"] = [xform(p) for p in n["skeleton"]]

    meta_xform = {
        "scale": SCALE,
        "centroid_voxel": [float(c) for c in centroid],
        "flip_y": bool(flip_y),
        "swap_yz": bool(swap_yz),
        "long_axis": int(long_axis) if len(vnc_soma) > 5 else 1,
        "voxel_nm": 8,
        "note": "display = (voxel - centroid) * scale after optional axis remap; brain≈+Y, VNC≈-Y",
    }
    return meta_xform


def main() -> int:
    ensure_weights()
    print("loading annotations…")
    df = load_annotations()
    print(f"  traced rows: {len(df)}")

    selected = curate_body_ids(df)
    selected = add_hubs_from_weights(df, selected, k=25)
    selected = list(dict.fromkeys(selected))  # unique preserve order
    print(f"final candidate count: {len(selected)}")

    # Download SWCs in parallel
    print("downloading SWCs…")
    ok_ids = []
    failed = 0
    with ThreadPoolExecutor(max_workers=16) as ex:
        futs = {ex.submit(download_swc, bid): bid for bid in selected}
        done = 0
        for fut in as_completed(futs):
            bid = futs[fut]
            done += 1
            path = fut.result()
            if path:
                ok_ids.append(bid)
            else:
                failed += 1
            if done % 50 == 0:
                print(f"  {done}/{len(selected)} ({len(ok_ids)} ok, {failed} fail)")
    print(f"SWC ok={len(ok_ids)} fail={failed}")

    if len(ok_ids) < 50:
        print("ERROR: too few SWCs downloaded", file=sys.stderr)
        return 1

    # Trim to ~TARGET if we have extras (prefer those with soma)
    ann = df.set_index("bodyId")
    ok_ids_sorted = sorted(
        ok_ids,
        key=lambda b: (
            0 if (b in ann.index and parse_soma(ann.loc[b]["somaLocation"] if "somaLocation" in ann.columns else None) or (b in ann.index and ann.loc[b]["soma"] is not None if hasattr(ann.loc[b], "soma") else False)) else 1,
            b,
        ),
    )
    # Simpler trim: keep first TARGET_NEURONS+20 that have files
    if len(ok_ids) > TARGET_NEURONS + 50:
        ok_ids = ok_ids[: TARGET_NEURONS + 50]
    selected_set = set(ok_ids)

    edges = filter_edges(selected_set, max_edges=MAX_EDGES)
    # Drop neurons with zero edges only if we still have enough connected — keep isolates for silhouette
    connected = set()
    for e in edges:
        connected.add(e["from"])
        connected.add(e["to"])
    # Ensure at least some connected; keep all with SWC for anatomy
    keep_ids = [i for i in ok_ids if i in selected_set]
    if len(connected) >= 80:
        # keep connected + a sample of anatomy fillers
        fillers = [i for i in keep_ids if i not in connected]
        keep_ids = list(connected) + fillers[: max(0, TARGET_NEURONS - len(connected))]
    keep_ids = keep_ids[: max(TARGET_NEURONS + 50, len(connected))]
    keep_set = set(keep_ids)
    edges = [e for e in edges if e["from"] in keep_set and e["to"] in keep_set]

    neurons = []
    for bid in keep_ids:
        path = SWC_DIR / f"{bid}.swc"
        nodes = parse_swc(path)
        sk = skeleton_segments(nodes)
        if len(sk) < 2:
            continue
        row = ann.loc[bid] if bid in ann.index else None
        if row is not None and hasattr(row, "iloc") and not isinstance(row, type(df.iloc[0])):
            # duplicate index edge case
            row = row.iloc[0] if len(row) else None
        soma = None
        type_str = "unknown"
        side = "C"
        name = str(bid)
        superclass = ""
        is_vnc = False
        if row is not None:
            soma = parse_soma(row["somaLocation"]) if "somaLocation" in row.index else None
            type_str = str(row["type"]) if row.get("type") == row.get("type") and row.get("type") is not None else "unknown"
            if type_str == "nan":
                type_str = "unknown"
            side = str(row["somaSide"]) if row.get("somaSide") == row.get("somaSide") and row.get("somaSide") else "C"
            if side not in ("L", "R", "C"):
                side = "C"
            inst = row.get("instance")
            name = str(inst) if inst == inst and inst else f"{type_str}_{bid}"
            superclass = str(row["superclass"]) if row.get("superclass") == row.get("superclass") else ""
            is_vnc = bool(
                (row.get("somaNeuromere") == row.get("somaNeuromere") and row.get("somaNeuromere") is not None)
                or (isinstance(superclass, str) and superclass.startswith("vnc_"))
            )
        if soma is None:
            # use first SWC node / mean
            xs = [n[1] for n in nodes]
            ys = [n[2] for n in nodes]
            zs = [n[3] for n in nodes]
            soma = [float(np.mean(xs)), float(np.mean(ys)), float(np.mean(zs))]
        neurons.append(
            {
                "id": int(bid),
                "name": name,
                "type": type_str,
                "side": side,
                "soma": soma,
                "skeleton": sk,
                "_superclass": superclass,
                "_is_vnc": is_vnc,
            }
        )

    print(f"neurons with skeletons: {len(neurons)}")
    xmeta = transform_coords(neurons)

    # strip private fields for JSON
    thoughts = build_thoughts(neurons, edges)
    for n in neurons:
        n.pop("_superclass", None)
        n.pop("_is_vnc", None)

    # Verify y span for silhouette
    ys = [n["soma"][1] for n in neurons]
    print(f"soma Y range: {min(ys):.2f} .. {max(ys):.2f}")
    print(f"thoughts: {[(t['id'], len(t['waypoints'])) for t in thoughts]}")

    subset = {
        "meta": {
            "dataset": "male-cns:v1.0",
            "source": "https://male-cns.janelia.org/",
            "license": "CC-BY (FlyEM / HHMI Janelia MaleCNS)",
            "neuronCount": len(neurons),
            "exportedAt": str(date.today()),
            "scale": xmeta,
            "edgeCount": len(edges),
            "skeletonFormat": "interleaved segment endpoint pairs (LineSegments stride 2)",
            "swcUrlTemplate": SWC_URL,
        },
        "neurons": neurons,
        "edges": edges,
        "thoughts": thoughts,
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(subset, separators=(",", ":"), default=lambda o: bool(o) if type(o).__name__ == "bool_" else int(o) if hasattr(o, "item") else str(o)))
    size_mb = OUT_JSON.stat().st_size / 1e6
    print(f"wrote {OUT_JSON} ({size_mb:.2f} MB)")
    print(f"counts: neurons={len(neurons)} edges={len(edges)} thoughts={len(thoughts)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
