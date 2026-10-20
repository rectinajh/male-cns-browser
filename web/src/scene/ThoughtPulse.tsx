import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "../types";

type Props = {
  waypoints: Vec3[];
  playing: boolean;
  color?: string;
  speed?: number;
  /** World-unit size for the pulse head (scales with scene extent). */
  size?: number;
  onDone?: () => void;
};

function buildPath(waypoints: Vec3[]): { points: THREE.Vector3[]; total: number } {
  const points = waypoints.map((w) => new THREE.Vector3(...w));
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += points[i].distanceTo(points[i + 1]);
  }
  return { points, total: Math.max(total, 1e-6) };
}

function sampleAt(points: THREE.Vector3[], total: number, t: number): THREE.Vector3 {
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

export function ThoughtPulse({
  waypoints,
  playing,
  color = "#3BA7FF",
  speed = 0.45,
  size = 0.8,
  onDone,
}: Props) {
  const head = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const trailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const progress = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const { points, total } = useMemo(() => buildPath(waypoints), [waypoints]);
  const trailCount = 10;

  useEffect(() => {
    if (playing) {
      progress.current = 0;
      doneRef.current = false;
    }
  }, [playing, waypoints]);

  useFrame((_, dt) => {
    if (!playing || waypoints.length < 2) return;
    progress.current += (dt * speed) / Math.max(total * 0.12, 0.35);
    if (progress.current >= 1) {
      progress.current = 1;
      if (!doneRef.current) {
        doneRef.current = true;
        onDoneRef.current?.();
      }
    }
    const pos = sampleAt(points, total, progress.current);
    if (head.current) head.current.position.copy(pos);
    if (light.current) light.current.position.copy(pos);

    for (let i = 0; i < trailCount; i++) {
      const mesh = trailRefs.current[i];
      if (!mesh) continue;
      const tt = Math.max(0, progress.current - (i + 1) * 0.028);
      const p = sampleAt(points, total, tt);
      mesh.position.copy(p);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.6 - i * 0.05) * (playing ? 1 : 0);
    }
  });

  if (!playing || waypoints.length < 2) return null;

  return (
    <group>
      <mesh ref={head}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={1} />
      </mesh>
      {Array.from({ length: trailCount }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            trailRefs.current[i] = el;
          }}
          scale={1 - i * 0.07}
        >
          <sphereGeometry args={[size * 0.7, 12, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
      <pointLight ref={light} color={color} intensity={4} distance={size * 25} />
    </group>
  );
}
