import * as THREE from "three";
import type { Vec3 } from "../types";

export type PathNeuron = {
  soma: Vec3;
  skeleton: Vec3[];
};

/** Build a polyline and its arc length from waypoint positions. */
export function buildPath(waypoints: Vec3[]): { points: THREE.Vector3[]; total: number } {
  const points = waypoints.map((w) => new THREE.Vector3(...w));
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += points[i].distanceTo(points[i + 1]);
  }
  return { points, total: Math.max(total, 1e-6) };
}

/** Sample a point at normalized progress t ∈ [0, 1] along the path. */
export function sampleAt(points: THREE.Vector3[], total: number, t: number): THREE.Vector3 {
  const dist = THREE.MathUtils.clamp(t, 0, 1) * total;
  let acc = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const seg = points[i].distanceTo(points[i + 1]);
    if (acc + seg >= dist || i === points.length - 2) {
      const local = seg > 0 ? (dist - acc) / seg : 0;
      return new THREE.Vector3().lerpVectors(points[i], points[i + 1], THREE.MathUtils.clamp(local, 0, 1));
    }
    acc += seg;
  }
  return points[points.length - 1].clone();
}

/**
 * Playback duration in seconds — long enough to read blue charge packets
 * traveling along real MaleCNS arbors (demo window, not biophysics).
 */
export function pulseDurationSeconds(pathLength: number, speed = 1): number {
  const base = Math.max(pathLength * 0.028, 4.2);
  return THREE.MathUtils.clamp(base / Math.max(speed, 0.05), 4.0, 8.0);
}

/** Seconds the filament / soma afterglow lingers after the tip lands. */
export const PULSE_AFTERGLOW_SECONDS = 0.75;

/** Advance normalized progress; clamps huge dt (tab background). */
export function advanceProgress(progress: number, dt: number, durationSec: number): number {
  const step = Math.min(Math.max(dt, 0), 0.08) / Math.max(durationSec, 0.2);
  return Math.min(1, progress + step);
}

function keyOf(p: Vec3): string {
  return `${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`;
}

/** Unique skeleton endpoints (MaleCNS stores interleaved segment pairs). */
export function uniqueSkeletonPoints(skeleton: Vec3[]): Vec3[] {
  const out: Vec3[] = [];
  const seen = new Set<string>();
  for (const p of skeleton) {
    const k = keyOf(p);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(p);
  }
  return out;
}

function dist2(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function nearestPoint(cloud: Vec3[], p: Vec3): Vec3 {
  let best = cloud[0];
  let bestD = Infinity;
  for (const q of cloud) {
    const d = dist2(q, p);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/** Closest pair of points between two clouds (O(n·m); clouds are ~100 pts). */
export function closestPair(a: Vec3[], b: Vec3[]): { a: Vec3; b: Vec3; dist: number } {
  let bestA = a[0];
  let bestB = b[0];
  let bestD = Infinity;
  for (const pa of a) {
    for (const pb of b) {
      const d = dist2(pa, pb);
      if (d < bestD) {
        bestD = d;
        bestA = pa;
        bestB = pb;
      }
    }
  }
  return { a: bestA, b: bestB, dist: Math.sqrt(bestD) };
}

/**
 * Greedy walk on a skeleton point cloud from near `start` toward `target`.
 * Prefers local steps that reduce distance to the target (hugs the arbor).
 */
export function walkSkeletonToward(
  cloud: Vec3[],
  start: Vec3,
  target: Vec3,
  opts?: { maxSteps?: number; localRadius?: number },
): Vec3[] {
  if (cloud.length === 0) return [start];
  const maxSteps = opts?.maxSteps ?? 64;
  const localRadius = opts?.localRadius ?? 8;
  const localR2 = localRadius * localRadius;
  const jumpR2 = (localRadius * 3.2) ** 2;

  let cur = nearestPoint(cloud, start);
  const path: Vec3[] = [cur];
  const used = new Set<string>([keyOf(cur)]);

  for (let step = 0; step < maxSteps; step++) {
    const curToTarget = dist2(cur, target);
    if (curToTarget < 2.25) break; // ~1.5 units

    type Cand = { score: number; q: Vec3 };
    const local: Cand[] = [];
    const jump: Cand[] = [];

    for (const q of cloud) {
      const k = keyOf(q);
      if (used.has(k)) continue;
      const dCur = dist2(cur, q);
      const improve = curToTarget - dist2(q, target);
      if (dCur <= localR2) {
        local.push({ score: improve * 4 - Math.sqrt(dCur), q });
      } else if (dCur <= jumpR2 && improve > 0) {
        jump.push({ score: improve - Math.sqrt(dCur) * 0.15, q });
      }
    }

    const pool = local.length > 0 ? local : jump;
    if (pool.length === 0) break;
    pool.sort((x, y) => y.score - x.score);
    const nxt = pool[0].q;
    if (dist2(nxt, target) > curToTarget && local.length === 0) break;
    used.add(keyOf(nxt));
    path.push(nxt);
    cur = nxt;
  }

  return path;
}

/**
 * Polyline that hugs neuron skeletons along a thought chain, with short
 * synaptic hops at closest approach between consecutive neurons — not
 * empty mid-air soma-to-soma chords.
 */
export function buildThoughtConductancePath(chain: PathNeuron[]): Vec3[] {
  if (chain.length === 0) return [];
  if (chain.length === 1) return [chain[0].soma];

  const out: Vec3[] = [];
  const push = (p: Vec3) => {
    const last = out[out.length - 1];
    if (last && keyOf(last) === keyOf(p)) return;
    out.push(p);
  };

  let entry: Vec3 = chain[0].soma;
  push(entry);

  for (let i = 0; i < chain.length; i++) {
    const n = chain[i];
    const cloud = uniqueSkeletonPoints(n.skeleton);
    if (cloud.length === 0) {
      push(n.soma);
      entry = n.soma;
      continue;
    }

    if (i === chain.length - 1) {
      for (const p of walkSkeletonToward(cloud, entry, n.soma)) push(p);
      push(n.soma);
      break;
    }

    const nextCloud = uniqueSkeletonPoints(chain[i + 1].skeleton);
    if (nextCloud.length === 0) {
      for (const p of walkSkeletonToward(cloud, entry, chain[i + 1].soma)) push(p);
      push(chain[i + 1].soma);
      entry = chain[i + 1].soma;
      continue;
    }

    const contact = closestPair(cloud, nextCloud);
    for (const p of walkSkeletonToward(cloud, entry, contact.a)) push(p);
    push(contact.a);
    // short synaptic hop onto the next arbor
    push(contact.b);
    entry = contact.b;
  }

  return out.length >= 2 ? out : chain.map((n) => n.soma);
}

/**
 * Map each chain soma to the nearest path progress t ∈ [0,1] so somas can
 * flash when the charge front arrives.
 */
export function somaArrivalProgress(
  waypoints: Vec3[],
  somas: Vec3[],
): number[] {
  if (waypoints.length < 2 || somas.length === 0) return somas.map(() => 0);
  const { points, total } = buildPath(waypoints);
  // Pre-sample path at fine steps for nearest lookup
  const samples: { t: number; p: THREE.Vector3 }[] = [];
  const steps = Math.min(400, Math.max(80, Math.ceil(total * 2)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    samples.push({ t, p: sampleAt(points, total, t) });
  }
  return somas.map((s) => {
    let bestT = 0;
    let bestD = Infinity;
    const sv = new THREE.Vector3(...s);
    for (const s0 of samples) {
      const d = s0.p.distanceToSquared(sv);
      if (d < bestD) {
        bestD = d;
        bestT = s0.t;
      }
    }
    return bestT;
  });
}

export type EdgeLike = { from: number; to: number; weight: number };

export type RandomThoughtOptions = {
  /** Inclusive min neuron count in the chain (default 3). */
  minLen?: number;
  /** Inclusive max neuron count in the chain (default 6). */
  maxLen?: number;
  /** Attempts to find a long-enough walk before accepting a shorter one. */
  attempts?: number;
  /** RNG in [0, 1); inject for tests. */
  rng?: () => number;
};

function weightedPick<T extends { weight: number }>(items: T[], rng: () => number): T {
  const total = items.reduce((s, x) => s + Math.max(x.weight, 0), 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let r = rng() * total;
  for (const item of items) {
    r -= Math.max(item.weight, 0);
    if (r <= 0) return item;
  }
  return items[items.length - 1];
}

/**
 * Pick a fresh random directed walk on the connectome edges so each
 * 「思考一次」 can flash a different route / direction.
 * Prefers stronger synapses (weight-biased), never revisits a neuron.
 */
export function pickRandomThoughtChain(
  edges: EdgeLike[],
  opts?: RandomThoughtOptions,
): number[] {
  const rng = opts?.rng ?? Math.random;
  const minLen = Math.max(2, opts?.minLen ?? 3);
  const maxLen = Math.max(minLen, opts?.maxLen ?? 6);
  const attempts = opts?.attempts ?? 32;

  const adj = new Map<number, { to: number; weight: number }[]>();
  for (const e of edges) {
    if (e.from === e.to) continue;
    const list = adj.get(e.from) ?? [];
    list.push({ to: e.to, weight: e.weight });
    adj.set(e.from, list);
  }

  const starts = [...adj.keys()];
  if (starts.length === 0) return [];

  let best: number[] = [];

  for (let attempt = 0; attempt < attempts; attempt++) {
    const targetLen = minLen + Math.floor(rng() * (maxLen - minLen + 1));
    const start = starts[Math.floor(rng() * starts.length)];
    const path = [start];
    const used = new Set<number>([start]);
    let cur = start;

    while (path.length < targetLen) {
      const outs = (adj.get(cur) ?? []).filter((x) => !used.has(x.to));
      if (outs.length === 0) break;
      const next = weightedPick(outs, rng).to;
      path.push(next);
      used.add(next);
      cur = next;
    }

    if (path.length > best.length) best = path;
    if (path.length >= minLen) return path;
  }

  return best.length >= 2 ? best : [];
}
