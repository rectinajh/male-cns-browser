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
  /** World-unit size for the bright tip (keep small — current, not cartoon ball). */
  tipSize?: number;
  onDone?: () => void;
};

/**
 * Electrical conduction along a polyline: progressive bright wire + dim trail
 * + tiny flickering tip. No stacked opaque spheres in empty space.
 */
export function ThoughtPulse({
  waypoints,
  playing,
  color = "#3BA7FF",
  speed = 1,
  tipSize = 0.45,
  onDone,
}: Props) {
  const tip = useRef<THREE.Mesh>(null);
  const tipGlow = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const progress = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const { points, total } = useMemo(() => buildPath(waypoints), [waypoints]);
  const duration = useMemo(() => pulseDurationSeconds(total, speed), [total, speed]);

  const pathPositions = useMemo(() => {
    const arr = new Float32Array(Math.max(waypoints.length, 2) * 3);
    for (let i = 0; i < waypoints.length; i++) {
      arr[i * 3] = waypoints[i][0];
      arr[i * 3 + 1] = waypoints[i][1];
      arr[i * 3 + 2] = waypoints[i][2];
    }
    return arr;
  }, [waypoints]);

  const { litLine, trailLine, litGeo, trailMat, litMat } = useMemo(() => {
    const litArr = new Float32Array((waypoints.length + 1) * 3);
    litArr.set(pathPositions.subarray(0, waypoints.length * 3));
    const litGeometry = new THREE.BufferGeometry();
    litGeometry.setAttribute("position", new THREE.BufferAttribute(litArr, 3));
    litGeometry.setDrawRange(0, 0);

    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(pathPositions.slice(), 3));

    const trailMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      depthTest: false,
      depthWrite: false,
    });
    const litMaterial = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    });

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    trail.renderOrder = 994;
    const lit = new THREE.Line(litGeometry, litMaterial);
    lit.renderOrder = 996;

    return {
      litLine: lit,
      trailLine: trail,
      litGeo: litGeometry,
      trailMat: trailMaterial,
      litMat: litMaterial,
    };
  }, [pathPositions, waypoints.length, color]);

  useEffect(() => {
    if (playing) {
      progress.current = 0;
      doneRef.current = false;
    }
  }, [playing, waypoints]);

  useEffect(() => {
    return () => {
      litLine.geometry.dispose();
      trailLine.geometry.dispose();
      litMat.dispose();
      trailMat.dispose();
    };
  }, [litLine, trailLine, litMat, trailMat]);

  useFrame((_, dt) => {
    if (!playing || waypoints.length < 2) return;
    progress.current = advanceProgress(progress.current, dt, duration);
    if (progress.current >= 1 && !doneRef.current) {
      doneRef.current = true;
      onDoneRef.current?.();
    }

    const t = progress.current;
    const n = waypoints.length;
    const pos = sampleAt(points, total, t);

    const segIdx = Math.min(n - 1, Math.floor(t * (n - 1)));
    const attr = litGeo.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const tipSlot = segIdx + 1;
    arr[tipSlot * 3] = pos.x;
    arr[tipSlot * 3 + 1] = pos.y;
    arr[tipSlot * 3 + 2] = pos.z;
    attr.needsUpdate = true;
    litGeo.setDrawRange(0, tipSlot + 1);

    if (tip.current) tip.current.position.copy(pos);
    if (tipGlow.current) tipGlow.current.position.copy(pos);
    if (light.current) light.current.position.copy(pos);

    const flicker = 0.72 + 0.28 * (0.5 + 0.5 * Math.sin(performance.now() * 0.045));
    const spark = 0.85 + 0.15 * Math.sin(performance.now() * 0.09);
    if (tip.current) tip.current.scale.setScalar(spark);
    if (tipGlow.current) tipGlow.current.scale.setScalar(1.15 + 0.2 * Math.sin(performance.now() * 0.06));

    litMat.opacity = 0.55 + 0.4 * flicker;
    trailMat.opacity = 0.18 + 0.08 * flicker;
  });

  if (!playing || waypoints.length < 2) return null;

  return (
    <group>
      <primitive object={trailLine} />
      <primitive object={litLine} />

      <mesh ref={tipGlow} renderOrder={997}>
        <sphereGeometry args={[tipSize * 1.8, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.28}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={tip} renderOrder={999}>
        <sphereGeometry args={[tipSize, 12, 12]} />
        <meshBasicMaterial color="#d8efff" transparent opacity={0.95} depthTest={false} depthWrite={false} />
      </mesh>
      <pointLight ref={light} color={color} intensity={4.5} distance={tipSize * 28} decay={2} />
    </group>
  );
}
