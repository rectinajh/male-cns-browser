import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Vec3 } from "../types";
import {
  advanceProgress,
  buildPath,
  PULSE_AFTERGLOW_SECONDS,
  pulseDurationSeconds,
  sampleAt,
  somaArrivalProgress,
} from "./thoughtPath";

const PACKET_COUNT = 7;
/** Bright cyan-white charge core. */
const CORE = "#E8FFFF";
/** Hot cyan filament. */
const FILAMENT = "#5CE1FF";

type Props = {
  waypoints: Vec3[];
  /** Soma positions along the active thought chain (flash on arrival). */
  chainSomas?: Vec3[];
  playing: boolean;
  speed?: number;
  /** World-unit size for charge packets (keep small — current, not cartoon ball). */
  tipSize?: number;
  somaRadius?: number;
  onDone?: () => void;
};

/**
 * High-firing electrical conduction: cyan-white charge packets race along the
 * skeleton polyline, somas flash on arrival, filament / soma afterglow fades
 * briefly after the tip lands.
 */
export function ThoughtPulse({
  waypoints,
  chainSomas = [],
  playing,
  speed = 1,
  tipSize = 0.45,
  somaRadius = 0.55,
  onDone,
}: Props) {
  const progress = useRef(0);
  const afterglow = useRef(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const packetRefs = useRef<(THREE.Mesh | null)[]>([]);
  const glowRefs = useRef<(THREE.Mesh | null)[]>([]);
  const somaFlashRefs = useRef<(THREE.Mesh | null)[]>([]);
  const light = useRef<THREE.PointLight>(null);

  const { points, total } = useMemo(() => buildPath(waypoints), [waypoints]);
  const duration = useMemo(() => pulseDurationSeconds(total, speed), [total, speed]);
  const arrivals = useMemo(
    () => somaArrivalProgress(waypoints, chainSomas),
    [waypoints, chainSomas],
  );

  const pathPositions = useMemo(() => {
    const arr = new Float32Array(Math.max(waypoints.length, 2) * 3);
    for (let i = 0; i < waypoints.length; i++) {
      arr[i * 3] = waypoints[i][0];
      arr[i * 3 + 1] = waypoints[i][1];
      arr[i * 3 + 2] = waypoints[i][2];
    }
    return arr;
  }, [waypoints]);

  const { litLine, trailLine, afterLine, litGeo, trailMat, litMat, afterMat } = useMemo(() => {
    const litArr = new Float32Array((waypoints.length + 1) * 3);
    litArr.set(pathPositions.subarray(0, waypoints.length * 3));
    const litGeometry = new THREE.BufferGeometry();
    litGeometry.setAttribute("position", new THREE.BufferAttribute(litArr, 3));
    litGeometry.setDrawRange(0, 0);

    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(pathPositions.slice(), 3));

    const afterGeometry = new THREE.BufferGeometry();
    afterGeometry.setAttribute("position", new THREE.BufferAttribute(pathPositions.slice(), 3));

    const trailMaterial = new THREE.LineBasicMaterial({
      color: FILAMENT,
      transparent: true,
      opacity: 0.14,
      depthTest: false,
      depthWrite: false,
    });
    const litMaterial = new THREE.LineBasicMaterial({
      color: CORE,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
      depthWrite: false,
    });
    const afterMaterial = new THREE.LineBasicMaterial({
      color: FILAMENT,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });

    const trail = new THREE.Line(trailGeometry, trailMaterial);
    trail.renderOrder = 994;
    const lit = new THREE.Line(litGeometry, litMaterial);
    lit.renderOrder = 996;
    const after = new THREE.Line(afterGeometry, afterMaterial);
    after.renderOrder = 995;

    return {
      litLine: lit,
      trailLine: trail,
      afterLine: after,
      litGeo: litGeometry,
      trailMat: trailMaterial,
      litMat: litMaterial,
      afterMat: afterMaterial,
    };
  }, [pathPositions, waypoints.length]);

  useEffect(() => {
    if (playing) {
      progress.current = 0;
      afterglow.current = 0;
      doneRef.current = false;
    }
  }, [playing, waypoints]);

  useEffect(() => {
    return () => {
      litLine.geometry.dispose();
      trailLine.geometry.dispose();
      afterLine.geometry.dispose();
      litMat.dispose();
      trailMat.dispose();
      afterMat.dispose();
    };
  }, [litLine, trailLine, afterLine, litMat, trailMat, afterMat]);

  useFrame((_, dt) => {
    if (!playing || waypoints.length < 2) return;

    if (progress.current < 1) {
      progress.current = advanceProgress(progress.current, dt, duration);
    } else {
      afterglow.current = Math.min(1, afterglow.current + dt / PULSE_AFTERGLOW_SECONDS);
      if (afterglow.current >= 1 && !doneRef.current) {
        doneRef.current = true;
        onDoneRef.current?.();
      }
    }

    const t = progress.current;
    const ag = afterglow.current;
    const n = waypoints.length;
    const tipPos = sampleAt(points, total, t);

    // Progressive bright filament up to tip
    const segIdx = Math.min(n - 1, Math.floor(t * (n - 1)));
    const attr = litGeo.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const tipSlot = segIdx + 1;
    arr[tipSlot * 3] = tipPos.x;
    arr[tipSlot * 3 + 1] = tipPos.y;
    arr[tipSlot * 3 + 2] = tipPos.z;
    attr.needsUpdate = true;
    litGeo.setDrawRange(0, tipSlot + 1);

    const flicker = 0.7 + 0.3 * (0.5 + 0.5 * Math.sin(performance.now() * 0.055));
    const liveFade = 1 - ag;
    litMat.opacity = (0.55 + 0.4 * flicker) * liveFade;
    trailMat.opacity = (0.12 + 0.1 * flicker) * Math.max(liveFade, 0.25 * (1 - ag));
    // Afterglow wire: full path, fading out after land
    afterMat.opacity = ag > 0 ? 0.55 * (1 - ag) * flicker : 0.08 * t * flicker;

    // Charge packets trailing behind the tip (high firing rate look)
    for (let i = 0; i < PACKET_COUNT; i++) {
      const lag = i * 0.028;
      const pt = Math.max(0, t - lag);
      const pos = sampleAt(points, total, pt);
      const mesh = packetRefs.current[i];
      const glow = glowRefs.current[i];
      const visible = t > lag && liveFade > 0.05;
      const scale = (1 - i * 0.09) * (0.85 + 0.2 * Math.sin(performance.now() * 0.08 + i));
      if (mesh) {
        mesh.visible = visible;
        mesh.position.copy(pos);
        mesh.scale.setScalar(scale * liveFade);
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (0.95 - i * 0.08) * liveFade;
      }
      if (glow) {
        glow.visible = visible;
        glow.position.copy(pos);
        glow.scale.setScalar((1.4 - i * 0.08) * liveFade);
        const mat = glow.material as THREE.MeshBasicMaterial;
        mat.opacity = (0.35 - i * 0.03) * liveFade;
      }
    }

    if (light.current) {
      light.current.position.copy(tipPos);
      light.current.intensity = 5.5 * liveFade * flicker;
    }

    // Soma flash + brief afterglow when the front arrives
    for (let i = 0; i < chainSomas.length; i++) {
      const mesh = somaFlashRefs.current[i];
      if (!mesh) continue;
      const arrive = arrivals[i] ?? 0;
      let intensity = 0;
      if (t >= arrive) {
        const since = (t - arrive) / Math.max(1 - arrive, 0.05);
        // sharp flash then hold a soft glow, then afterglow fade
        const flash = Math.exp(-since * 6) * 1.2 + 0.35 * Math.exp(-since * 1.2);
        intensity = flash * (1 - ag * 0.85);
        if (ag > 0) intensity = Math.max(intensity, 0.55 * (1 - ag));
      }
      mesh.visible = intensity > 0.02;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.min(1, intensity);
      mesh.scale.setScalar(1 + 0.55 * Math.min(1, intensity));
    }
  });

  if (!playing || waypoints.length < 2) return null;

  return (
    <group>
      <primitive object={trailLine} />
      <primitive object={afterLine} />
      <primitive object={litLine} />

      {Array.from({ length: PACKET_COUNT }, (_, i) => (
        <group key={`pkt-${i}`}>
          <mesh
            ref={(el) => {
              glowRefs.current[i] = el;
            }}
            renderOrder={997}
            visible={false}
          >
            <sphereGeometry args={[tipSize * 2.1, 10, 10]} />
            <meshBasicMaterial
              color={FILAMENT}
              transparent
              opacity={0.3}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              packetRefs.current[i] = el;
            }}
            renderOrder={999}
            visible={false}
          >
            <sphereGeometry args={[tipSize * (i === 0 ? 1 : 0.72), 10, 10]} />
            <meshBasicMaterial
              color={i === 0 ? CORE : FILAMENT}
              transparent
              opacity={0.95}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}

      {chainSomas.map((s, i) => (
        <mesh
          key={`soma-flash-${i}`}
          ref={(el) => {
            somaFlashRefs.current[i] = el;
          }}
          position={s}
          renderOrder={998}
          visible={false}
        >
          <sphereGeometry args={[somaRadius * 1.35, 12, 12]} />
          <meshBasicMaterial
            color={CORE}
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      <pointLight ref={light} color={FILAMENT} intensity={5.5} distance={tipSize * 36} decay={2} />
    </group>
  );
}
