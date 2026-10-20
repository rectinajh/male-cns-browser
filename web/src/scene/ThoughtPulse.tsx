import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "../types";
import { advanceProgress, buildPath, pulseDurationSeconds, sampleAt } from "./thoughtPath";

type Props = {
  waypoints: Vec3[];
  playing: boolean;
  color?: string;
  speed?: number;
  /** World-unit size for the pulse head (scales with scene extent). */
  size?: number;
  onDone?: () => void;
};

export function ThoughtPulse({
  waypoints,
  playing,
  color = "#3BA7FF",
  speed = 1,
  size = 0.8,
  onDone,
}: Props) {
  const head = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const trailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const progress = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const { points, total } = useMemo(() => buildPath(waypoints), [waypoints]);
  const duration = useMemo(() => pulseDurationSeconds(total, speed), [total, speed]);
  const trailCount = 14;

  const pathGeo = useMemo(() => {
    if (waypoints.length < 2) return null;
    const arr = new Float32Array(waypoints.length * 3);
    waypoints.forEach((w, i) => {
      arr[i * 3] = w[0];
      arr[i * 3 + 1] = w[1];
      arr[i * 3 + 2] = w[2];
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return geo;
  }, [waypoints]);

  useEffect(() => {
    if (playing) {
      progress.current = 0;
      doneRef.current = false;
    }
  }, [playing, waypoints]);

  useEffect(() => {
    return () => {
      pathGeo?.dispose();
    };
  }, [pathGeo]);

  useFrame((_, dt) => {
    if (!playing || waypoints.length < 2) return;
    progress.current = advanceProgress(progress.current, dt, duration);
    if (progress.current >= 1 && !doneRef.current) {
      doneRef.current = true;
      onDoneRef.current?.();
    }
    const pos = sampleAt(points, total, progress.current);
    if (head.current) head.current.position.copy(pos);
    if (glow.current) glow.current.position.copy(pos);
    if (light.current) light.current.position.copy(pos);

    // subtle head pulse (electrical flicker)
    const flicker = 1 + 0.18 * Math.sin(performance.now() * 0.025);
    if (head.current) head.current.scale.setScalar(flicker);
    if (glow.current) glow.current.scale.setScalar(flicker * 1.05);

    for (let i = 0; i < trailCount; i++) {
      const mesh = trailRefs.current[i];
      if (!mesh) continue;
      const tt = Math.max(0, progress.current - (i + 1) * 0.022);
      const p = sampleAt(points, total, tt);
      mesh.position.copy(p);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.75 - i * 0.045) * (playing ? 1 : 0);
    }
  });

  if (!playing || waypoints.length < 2) return null;

  return (
    <group>
      {/* Bright path guide so the route is obvious while the head travels */}
      {pathGeo && (
        <line geometry={pathGeo} renderOrder={996}>
          <lineBasicMaterial
            color={color}
            transparent
            opacity={0.9}
            depthTest={false}
            depthWrite={false}
            linewidth={2}
          />
        </line>
      )}

      <mesh ref={glow} renderOrder={998}>
        <sphereGeometry args={[size * 2.4, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.22}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={head} renderOrder={999}>
        <sphereGeometry args={[size, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={1} depthTest={false} depthWrite={false} />
      </mesh>
      {Array.from({ length: trailCount }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            trailRefs.current[i] = el;
          }}
          scale={1 - i * 0.05}
          renderOrder={997}
        >
          <sphereGeometry args={[size * 0.85, 12, 12]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.5}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}
      <pointLight ref={light} color={color} intensity={10} distance={size * 40} decay={2} />
    </group>
  );
}
