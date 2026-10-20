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

/** Design blue — filament, bloom, afterglow. */
const BOLT = "#3BA7FF";
/** Hot core of the lightning stroke. */
const CORE = "#5B9FFF";
/** Brief tip spark (still blue, not white). */
const SPARK = "#7EC8FF";

const BRANCH_COUNT = 3;
const BRANCH_SEGS = 5;
/** Tiny tip sparks instead of opaque white charge orbs. */
const TIP_SPARKS = 3;

type Props = {
  waypoints: Vec3[];
  /** Soma positions along the active thought chain (flash on arrival). */
  chainSomas?: Vec3[];
  playing: boolean;
  speed?: number;
  /** World-unit size for tip sparks. */
  tipSize?: number;
  somaRadius?: number;
  onDone?: () => void;
};

/** Fast hash noise in [0,1) — crackle without Math.random every vertex. */
function hash01(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Build a jagged lightning polyline along `smooth` up to progress `t`,
 * with perpendicular crackle offsets. Writes into `out` (xyz interleaved).
 * Returns vertex count.
 */
export function writeLightningBolt(
  smooth: THREE.Vector3[],
  total: number,
  t: number,
  out: Float32Array,
  opts: {
    maxVerts: number;
    amplitude: number;
    seed: number;
    /** Prefer denser samples near the tip for a hot dashed look. */
    tipBias?: boolean;
  },
): number {
  const maxVerts = opts.maxVerts;
  if (smooth.length < 2 || t <= 0 || maxVerts < 2) return 0;

  const tipBias = opts.tipBias ?? true;
  // More verts near tip → dashed/hot segmented feel
  const count = Math.min(maxVerts, Math.max(8, Math.ceil(24 + t * 48)));
  let prev = sampleAt(smooth, total, 0);
  out[0] = prev.x;
  out[1] = prev.y;
  out[2] = prev.z;
  let written = 1;

  for (let i = 1; i < count; i++) {
    const u = i / (count - 1);
    // Bias samples toward the tip so the leading stroke looks dashed/hot
    const tt = tipBias ? t * (u * u * 0.55 + u * 0.45) : t * u;
    const p = sampleAt(smooth, total, tt);

    // Tangent approx
    const nextT = Math.min(1, tt + 0.01);
    const ahead = sampleAt(smooth, total, nextT);
    const tx = ahead.x - p.x;
    const ty = ahead.y - p.y;
    const tz = ahead.z - p.z;
    const tlen = Math.hypot(tx, ty, tz) || 1;

    // Pick a stable-ish perpendicular via cross with up (or X if aligned)
    let px = -ty / tlen;
    let py = tx / tlen;
    let pz = 0;
    let plen = Math.hypot(px, py, pz);
    if (plen < 1e-4) {
      px = 0;
      py = -tz / tlen;
      pz = ty / tlen;
      plen = Math.hypot(px, py, pz) || 1;
    }
    px /= plen;
    py /= plen;
    pz /= plen;

    // Second perp for 3D crackle
    const qx = ty * pz - tz * py;
    const qy = tz * px - tx * pz;
    const qz = tx * py - ty * px;
    const qlen = Math.hypot(qx, qy, qz) || 1;

    const nearTip = u > 0.72;
    const amp = opts.amplitude * (nearTip ? 1.55 : 0.85) * (0.35 + 0.65 * u);
    const n1 = hash01(opts.seed * 0.01 + i * 19.7 + Math.floor(opts.seed) * 0.001) * 2 - 1;
    const n2 = hash01(opts.seed * 0.017 + i * 31.3 + 7.1) * 2 - 1;
    // Occasional hard zig (lightning kink)
    const kink = hash01(opts.seed + i * 3.9) > 0.78 ? 1.8 : 1;

    const ox = (px * n1 + (qx / qlen) * n2) * amp * kink;
    const oy = (py * n1 + (qy / qlen) * n2) * amp * kink;
    const oz = (pz * n1 + (qz / qlen) * n2) * amp * kink;

    // Keep endpoints on the true path
    const onPath = i === count - 1 || i === 1;
    out[written * 3] = p.x + (onPath ? 0 : ox);
    out[written * 3 + 1] = p.y + (onPath ? 0 : oy);
    out[written * 3 + 2] = p.z + (onPath ? 0 : oz);
    written++;
    prev = p;
  }
  return written;
}

/**
 * Short secondary fork near the tip — zig branch for crackle texture.
 * Returns vertex count written to `out`.
 */
export function writeLightningBranch(
  smooth: THREE.Vector3[],
  total: number,
  t: number,
  out: Float32Array,
  opts: { segs: number; amplitude: number; seed: number; side: number },
): number {
  if (smooth.length < 2 || t < 0.08) return 0;
  const startT = Math.max(0, t - 0.06 - hash01(opts.seed) * 0.05);
  const segs = Math.max(3, opts.segs);
  const root = sampleAt(smooth, total, startT);
  const tip = sampleAt(smooth, total, t);
  const dx = tip.x - root.x;
  const dy = tip.y - root.y;
  const dz = tip.z - root.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  // Branch sideways from the main stroke
  let px = -dy / len;
  let py = dx / len;
  let pz = 0;
  let plen = Math.hypot(px, py, pz);
  if (plen < 1e-4) {
    px = 0;
    py = -dz / len;
    pz = dy / len;
    plen = Math.hypot(px, py, pz) || 1;
  }
  px = (px / plen) * opts.side;
  py = (py / plen) * opts.side;
  pz = (pz / plen) * opts.side;

  for (let i = 0; i < segs; i++) {
    const u = i / (segs - 1);
    const along = startT + (t - startT) * u;
    const p = sampleAt(smooth, total, along);
    const flare = opts.amplitude * u * (0.6 + 0.8 * hash01(opts.seed + i * 11.3));
    const jag = (hash01(opts.seed * 0.3 + i * 5.7) * 2 - 1) * opts.amplitude * 0.45;
    out[i * 3] = p.x + px * flare + px * jag * 0.3;
    out[i * 3 + 1] = p.y + py * flare + py * jag * 0.3;
    out[i * 3 + 2] = p.z + pz * flare + pz * jag * 0.3;
  }
  return segs;
}

/**
 * Lightning-blue conduction along the skeleton: jagged bolt, rapid opacity
 * flicker, secondary zig branches, blue bloom tip — not steady white orbs.
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
  const crackleSeed = useRef(0);
  const branchLife = useRef(Float32Array.from({ length: BRANCH_COUNT }, () => 0));

  const sparkRefs = useRef<(THREE.Mesh | null)[]>([]);
  const bloomRefs = useRef<(THREE.Mesh | null)[]>([]);
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

  const amp = useMemo(() => {
    // Crackle scale relative to path length
    return Math.min(Math.max(total * 0.012, tipSize * 1.8), tipSize * 6);
  }, [total, tipSize]);

  const {
    trailLine,
    afterLine,
    boltLine,
    glowLine,
    hotLine,
    branchLines,
    boltArr,
    glowArr,
    hotArr,
    branchArrs,
    trailMat,
    afterMat,
    boltMat,
    glowMat,
    hotMat,
    branchMats,
    boltGeo,
    glowGeo,
    hotGeo,
    branchGeos,
  } = useMemo(() => {
    const MAX = 72;
    const boltA = new Float32Array(MAX * 3);
    const glowA = new Float32Array(MAX * 3);
    const hotA = new Float32Array(40 * 3);
    const bArrs = Array.from({ length: BRANCH_COUNT }, () => new Float32Array(BRANCH_SEGS * 3));

    const mkLine = (
      arr: Float32Array,
      color: string,
      opacity: number,
      order: number,
    ) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      geo.setDrawRange(0, 0);
      const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthTest: false,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      line.renderOrder = order;
      return { line, geo, mat };
    };

    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute("position", new THREE.BufferAttribute(pathPositions.slice(), 3));
    const trailMaterial = new THREE.LineBasicMaterial({
      color: BOLT,
      transparent: true,
      opacity: 0.1,
      depthTest: false,
      depthWrite: false,
    });
    const trail = new THREE.Line(trailGeometry, trailMaterial);
    trail.renderOrder = 994;

    const afterGeometry = new THREE.BufferGeometry();
    afterGeometry.setAttribute("position", new THREE.BufferAttribute(pathPositions.slice(), 3));
    const afterMaterial = new THREE.LineBasicMaterial({
      color: BOLT,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
    });
    const after = new THREE.Line(afterGeometry, afterMaterial);
    after.renderOrder = 995;

    const glow = mkLine(glowA, BOLT, 0.35, 996);
    const bolt = mkLine(boltA, CORE, 0.9, 997);
    const hot = mkLine(hotA, SPARK, 1, 998);
    const branches = bArrs.map((a, i) => mkLine(a, i % 2 === 0 ? CORE : BOLT, 0.75, 997));

    return {
      trailLine: trail,
      afterLine: after,
      boltLine: bolt.line,
      glowLine: glow.line,
      hotLine: hot.line,
      branchLines: branches.map((b) => b.line),
      boltArr: boltA,
      glowArr: glowA,
      hotArr: hotA,
      branchArrs: bArrs,
      trailMat: trailMaterial,
      afterMat: afterMaterial,
      boltMat: bolt.mat,
      glowMat: glow.mat,
      hotMat: hot.mat,
      branchMats: branches.map((b) => b.mat),
      boltGeo: bolt.geo,
      glowGeo: glow.geo,
      hotGeo: hot.geo,
      branchGeos: branches.map((b) => b.geo),
    };
  }, [pathPositions]);

  useEffect(() => {
    if (playing) {
      progress.current = 0;
      afterglow.current = 0;
      doneRef.current = false;
      crackleSeed.current = Math.floor(Math.random() * 1e6);
      branchLife.current.fill(0);
    }
  }, [playing, waypoints]);

  useEffect(() => {
    return () => {
      trailLine.geometry.dispose();
      afterLine.geometry.dispose();
      boltGeo.dispose();
      glowGeo.dispose();
      hotGeo.dispose();
      for (const g of branchGeos) g.dispose();
      trailMat.dispose();
      afterMat.dispose();
      boltMat.dispose();
      glowMat.dispose();
      hotMat.dispose();
      for (const m of branchMats) m.dispose();
    };
  }, [
    trailLine,
    afterLine,
    boltGeo,
    glowGeo,
    hotGeo,
    branchGeos,
    trailMat,
    afterMat,
    boltMat,
    glowMat,
    hotMat,
    branchMats,
  ]);

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
    const liveFade = 1 - ag;
    const tipPos = sampleAt(points, total, t);

    // Rapid crackle: refresh jagged seed several times per second
    crackleSeed.current += dt * 55 + hash01(performance.now() * 0.02) * 3;
    const seed = crackleSeed.current;

    // Soft trail under the true skeleton path (subtle)
    const trailFlick = 0.55 + 0.45 * hash01(seed * 0.11);
    trailMat.opacity = (0.08 + 0.07 * trailFlick) * Math.max(liveFade, 0.2 * (1 - ag));
    afterMat.opacity = ag > 0 ? 0.5 * (1 - ag) * trailFlick : 0.06 * t * trailFlick;

    // Main jagged bolt + wider glow twin (slightly different seed → bloom)
    const boltCount = writeLightningBolt(points, total, t, boltArr, {
      maxVerts: 72,
      amplitude: amp,
      seed,
      tipBias: true,
    });
    const glowCount = writeLightningBolt(points, total, t, glowArr, {
      maxVerts: 72,
      amplitude: amp * 1.65,
      seed: seed + 17.3,
      tipBias: true,
    });
    (boltGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    (glowGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    boltGeo.setDrawRange(0, boltCount);
    glowGeo.setDrawRange(0, glowCount);

    // Hot dashed tip segment (last ~18% of progress)
    const hotStart = Math.max(0, t - 0.18);
    let hotWritten = 0;
    if (t > 0.02 && liveFade > 0.05) {
      const hotVerts = 28;
      // Rebuild hot stroke as short jagged dashes near tip
      hotWritten = writeLightningBolt(points, total, t, hotArr, {
        maxVerts: hotVerts,
        amplitude: amp * 0.55,
        seed: seed * 1.3 + 9,
        tipBias: true,
      });
      // Drop early verts so only the leading stroke stays hot (dashed feel)
      const drop = Math.floor(hotWritten * (hotStart / Math.max(t, 1e-3)) * 0.85);
      const keep = Math.max(2, hotWritten - drop);
      // Shift kept verts to start of buffer for drawRange
      if (drop > 0) {
        hotArr.copyWithin(0, drop * 3, hotWritten * 3);
        hotWritten = keep;
      }
    }
    (hotGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
    hotGeo.setDrawRange(0, hotWritten);

    // Lightning opacity flicker (rapid, irregular — not a smooth sine)
    const flickA = hash01(seed * 0.37);
    const flickB = hash01(seed * 0.91 + 2.4);
    const flickC = hash01(performance.now() * 0.09);
    const crackle = flickA > 0.12 ? 0.55 + 0.45 * flickB : 0.12 + 0.2 * flickC;
    const strobe = flickC > 0.82 ? 1.15 : flickC < 0.08 ? 0.25 : 1;

    boltMat.opacity = Math.min(1, (0.75 + 0.25 * crackle) * liveFade * strobe);
    glowMat.opacity = Math.min(0.85, (0.28 + 0.35 * crackle) * liveFade * strobe);
    hotMat.opacity = Math.min(1, (0.85 + 0.15 * flickA) * liveFade * strobe);

    // Secondary zig branches near the tip — pop in/out
    for (let b = 0; b < BRANCH_COUNT; b++) {
      const life = branchLife.current;
      life[b] -= dt;
      // Retrigger randomly while the front is moving
      if (t > 0.1 && t < 0.98 && liveFade > 0.2 && life[b] <= 0 && hash01(seed + b * 13.1) > 0.72) {
        life[b] = 0.05 + hash01(seed + b) * 0.12;
      }
      const on = life[b] > 0;
      const side = b % 2 === 0 ? 1 : -1;
      let bc = 0;
      if (on) {
        bc = writeLightningBranch(points, total, t, branchArrs[b], {
          segs: BRANCH_SEGS,
          amplitude: amp * (1.1 + 0.4 * b),
          seed: seed + b * 29.7,
          side,
        });
      }
      (branchGeos[b].getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      branchGeos[b].setDrawRange(0, bc);
      branchMats[b].opacity = on
        ? Math.min(1, (0.55 + 0.4 * crackle) * liveFade * strobe * Math.min(1, life[b] * 14))
        : 0;
    }

    // Tiny blue tip sparks (low opacity — not opaque white balls)
    for (let i = 0; i < TIP_SPARKS; i++) {
      const lag = i * 0.012;
      const pt = Math.max(0, t - lag);
      const pos = sampleAt(points, total, pt);
      const mesh = sparkRefs.current[i];
      const bloom = bloomRefs.current[i];
      const visible = t > lag && liveFade > 0.05;
      const pulse = 0.65 + 0.55 * hash01(seed + i * 4.2);
      if (mesh) {
        mesh.visible = visible;
        mesh.position.copy(pos);
        mesh.scale.setScalar((1 - i * 0.22) * pulse * liveFade);
        const mat = mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (0.55 - i * 0.12) * liveFade * crackle;
      }
      if (bloom) {
        bloom.visible = visible;
        bloom.position.copy(pos);
        bloom.scale.setScalar((1.8 - i * 0.25) * pulse * liveFade);
        const mat = bloom.material as THREE.MeshBasicMaterial;
        mat.opacity = (0.22 - i * 0.04) * liveFade * crackle;
      }
    }

    if (light.current) {
      light.current.position.copy(tipPos);
      // Bright blue bloom at the tip
      light.current.intensity = (7.5 + 4.5 * crackle * strobe) * liveFade;
      light.current.color.set(strobe > 1 ? SPARK : BOLT);
    }

    // Soma flash + afterglow — bluer bolt colors
    for (let i = 0; i < chainSomas.length; i++) {
      const mesh = somaFlashRefs.current[i];
      if (!mesh) continue;
      const arrive = arrivals[i] ?? 0;
      let intensity = 0;
      if (t >= arrive) {
        const since = (t - arrive) / Math.max(1 - arrive, 0.05);
        const flash = Math.exp(-since * 6) * 1.25 + 0.4 * Math.exp(-since * 1.15);
        intensity = flash * (1 - ag * 0.85);
        if (ag > 0) intensity = Math.max(intensity, 0.5 * (1 - ag));
        // Extra crackle when just hit
        if (since < 0.08) intensity *= 0.85 + 0.4 * crackle;
      }
      mesh.visible = intensity > 0.02;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.min(1, intensity);
      mesh.scale.setScalar(1 + 0.6 * Math.min(1, intensity));
    }
  });

  if (!playing || waypoints.length < 2) return null;

  return (
    <group>
      <primitive object={trailLine} />
      <primitive object={afterLine} />
      <primitive object={glowLine} />
      <primitive object={boltLine} />
      <primitive object={hotLine} />
      {branchLines.map((bl, i) => (
        <primitive key={`branch-${i}`} object={bl} />
      ))}

      {Array.from({ length: TIP_SPARKS }, (_, i) => (
        <group key={`spark-${i}`}>
          <mesh
            ref={(el) => {
              bloomRefs.current[i] = el;
            }}
            renderOrder={998}
            visible={false}
          >
            <sphereGeometry args={[tipSize * 2.4, 8, 8]} />
            <meshBasicMaterial
              color={BOLT}
              transparent
              opacity={0.2}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              sparkRefs.current[i] = el;
            }}
            renderOrder={999}
            visible={false}
          >
            <sphereGeometry args={[tipSize * (i === 0 ? 0.55 : 0.35), 8, 8]} />
            <meshBasicMaterial
              color={i === 0 ? SPARK : CORE}
              transparent
              opacity={0.5}
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
          <sphereGeometry args={[somaRadius * 1.4, 12, 12]} />
          <meshBasicMaterial
            color={CORE}
            transparent
            opacity={0}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}

      <pointLight ref={light} color={BOLT} intensity={8} distance={tipSize * 48} decay={2} />
    </group>
  );
}
