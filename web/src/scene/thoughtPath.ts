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
 * Playback duration in seconds. Real MaleCNS paths are long; keep the flash
 * snappy so the #3BA7FF pulse is readable in a demo (not proportional forever).
 */
export function pulseDurationSeconds(pathLength: number, speed = 1): number {
  const base = Math.max(pathLength * 0.012, 1.8);
  return THREE.MathUtils.clamp(base / Math.max(speed, 0.05), 1.6, 4.2);
}

/** Advance normalized progress; clamps huge dt (tab background) so one frame can't skip the whole flash. */
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
