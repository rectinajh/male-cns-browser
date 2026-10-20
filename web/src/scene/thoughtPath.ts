import * as THREE from "three";
import type { Vec3 } from "../types";

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
  const base = Math.max(pathLength * 0.018, 1.6);
  return THREE.MathUtils.clamp(base / Math.max(speed, 0.05), 1.4, 3.6);
}

/** Advance normalized progress; clamps huge dt (tab background) so one frame can't skip the whole flash. */
export function advanceProgress(progress: number, dt: number, durationSec: number): number {
  const step = Math.min(Math.max(dt, 0), 0.08) / Math.max(durationSec, 0.2);
  return Math.min(1, progress + step);
}
