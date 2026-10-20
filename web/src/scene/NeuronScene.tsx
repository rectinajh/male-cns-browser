import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { SubsetFile } from "../types";
import type { LocalJsonSource } from "../data/LocalJsonSource";
import { useBrowserStore } from "../state/useBrowserStore";
import { NeuronLines } from "./NeuronLines";
import { KeyNodes } from "./KeyNodes";
import { ThoughtPulse } from "./ThoughtPulse";
import { buildThoughtConductancePath } from "./thoughtPath";
import { DEFAULT_VIEW_DIR, fitDistance } from "./cameraFrame";

type Props = {
  data: SubsetFile;
  source: LocalJsonSource;
};

function computeBounds(data: SubsetFile) {
  const box = new THREE.Box3();
  for (const n of data.neurons) {
    box.expandByPoint(new THREE.Vector3(...n.soma));
    for (let i = 0; i < n.skeleton.length; i++) {
      box.expandByPoint(new THREE.Vector3(...n.skeleton[i]));
    }
  }
  if (box.isEmpty()) {
    box.set(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1));
  }
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  const radius = Math.max(size.length() * 0.5, 1);
  return { box, center, size, radius };
}

function CameraFramer({
  center,
  radius,
}: {
  center: THREE.Vector3;
  radius: number;
}) {
  const { camera, size, controls } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / Math.max(size.height, 1);
    const dist = fitDistance(radius, cam.fov, aspect, 1.25);
    const dir = new THREE.Vector3(
      DEFAULT_VIEW_DIR.x,
      DEFAULT_VIEW_DIR.y,
      DEFAULT_VIEW_DIR.z,
    ).normalize();
    cam.near = Math.max(radius * 0.001, 0.05);
    cam.far = Math.max(dist * 8, radius * 40);
    cam.position.copy(center).addScaledVector(dir, dist);
    cam.lookAt(center);
    cam.updateProjectionMatrix();
    const orbit = controls as (THREE.EventDispatcher & {
      target: THREE.Vector3;
      update: () => void;
    }) | null;
    if (orbit?.target) {
      orbit.target.copy(center);
      orbit.update();
    }
  }, [camera, center, radius, size.width, size.height, controls]);
  return null;
}

/** Gentle orbit; pauses while the user drags, resumes after a short idle. */
function AutoOrbit({
  center,
  radius,
}: {
  center: THREE.Vector3;
  radius: number;
}) {
  const [autoRotate, setAutoRotate] = useState(true);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, []);

  return (
    <OrbitControls
      makeDefault
      enableDamping
      dampingFactor={0.08}
      autoRotate={autoRotate}
      autoRotateSpeed={0.55}
      minDistance={radius * 0.2}
      maxDistance={radius * 12}
      target={[center.x, center.y, center.z]}
      onStart={() => {
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        setAutoRotate(false);
      }}
      onEnd={() => {
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        resumeTimer.current = setTimeout(() => setAutoRotate(true), 2500);
      }}
    />
  );
}

function SceneContent({ data, source }: Props) {
  const selectedId = useBrowserStore((s) => s.selectedId);
  const thoughtId = useBrowserStore((s) => s.thoughtId);
  const activeChain = useBrowserStore((s) => s.activeChain);
  const playing = useBrowserStore((s) => s.playing);
  const setPlaying = useBrowserStore((s) => s.setPlaying);

  const bounds = useMemo(() => computeBounds(data), [data]);
  const nodeRadius = Math.max(bounds.radius * 0.0045, 0.18);
  // Small tip — electrical spark / charge packet on the wire
  const tipSize = Math.max(bounds.radius * 0.006, 0.22);

  const neighborIds = useMemo(() => {
    if (selectedId == null) return new Set<number>();
    return new Set(source.neighbors(selectedId).map((n) => n.neuron.id));
  }, [selectedId, source]);

  const thought = useMemo(
    () => data.thoughts.find((t) => t.id === thoughtId) ?? data.thoughts[0],
    [data.thoughts, thoughtId],
  );

  const segmentPairs = Boolean(data.meta.skeletonFormat?.includes("segment"));

  const chainIds = useMemo(() => {
    if (activeChain && activeChain.length >= 2) return activeChain;
    return thought?.waypoints ?? [];
  }, [activeChain, thought]);

  const chainNeurons = useMemo(() => {
    return chainIds
      .map((id) => source.getNeuron(id))
      .filter((n): n is NonNullable<typeof n> => !!n);
  }, [chainIds, source]);

  const waypoints = useMemo(() => {
    return buildThoughtConductancePath(
      chainNeurons.map((n) => ({ soma: n.soma, skeleton: n.skeleton })),
    );
  }, [chainNeurons]);

  const chainSomas = useMemo(() => chainNeurons.map((n) => n.soma), [chainNeurons]);

  const chainIdSet = useMemo(() => new Set(chainIds), [chainIds]);

  return (
    <>
      <color attach="background" args={["#05070c"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[bounds.radius, bounds.radius, bounds.radius]} intensity={0.95} />
      <directionalLight position={[-bounds.radius, -bounds.radius * 0.4, -bounds.radius]} intensity={0.3} />
      <AutoOrbit center={bounds.center} radius={bounds.radius} />
      <CameraFramer center={bounds.center} radius={bounds.radius} />
      <NeuronLines
        neurons={data.neurons}
        edges={data.edges}
        selectedId={selectedId}
        neighborIds={neighborIds}
        chainIds={playing ? chainIdSet : undefined}
        segmentPairs={segmentPairs || data.neurons.length > 20}
      />
      <KeyNodes
        neurons={data.neurons}
        neighborIds={neighborIds}
        chainIds={playing ? chainIdSet : undefined}
        nodeRadius={nodeRadius}
      />
      <ThoughtPulse
        waypoints={waypoints}
        chainSomas={chainSomas}
        playing={playing}
        tipSize={tipSize}
        somaRadius={nodeRadius}
        onDone={() => setPlaying(false)}
      />
    </>
  );
}

export function NeuronScene({ data, source }: Props) {
  // Cap DPR a bit when the subset is dense so the browser stays interactive.
  const dense = data.neurons.length > 800;
  return (
    <Canvas
      camera={{ position: [80, 20, 80], fov: 45, near: 0.1, far: 5000 }}
      dpr={dense ? [1, 1.5] : [1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => useBrowserStore.getState().setSelectedId(null)}
    >
      <SceneContent data={data} source={source} />
    </Canvas>
  );
}
