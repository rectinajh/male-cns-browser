import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { SubsetFile } from "../types";
import type { LocalJsonSource } from "../data/LocalJsonSource";
import { useBrowserStore } from "../state/useBrowserStore";
import { NeuronLines } from "./NeuronLines";
import { KeyNodes } from "./KeyNodes";
import { ThoughtPulse } from "./ThoughtPulse";
import { buildThoughtConductancePath } from "./thoughtPath";

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
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.near = Math.max(radius * 0.001, 0.05);
    cam.far = radius * 40;
    cam.position.set(center.x + radius * 1.15, center.y + radius * 0.25, center.z + radius * 1.05);
    cam.lookAt(center);
    cam.updateProjectionMatrix();
  }, [camera, center, radius]);
  return null;
}

function SceneContent({ data, source }: Props) {
  const selectedId = useBrowserStore((s) => s.selectedId);
  const thoughtId = useBrowserStore((s) => s.thoughtId);
  const playing = useBrowserStore((s) => s.playing);
  const setPlaying = useBrowserStore((s) => s.setPlaying);

  const bounds = useMemo(() => computeBounds(data), [data]);
  const nodeRadius = Math.max(bounds.radius * 0.006, 0.25);
  // Small tip — electrical spark on the wire, not a floating ball.
  const tipSize = Math.max(bounds.radius * 0.007, 0.28);

  const neighborIds = useMemo(() => {
    if (selectedId == null) return new Set<number>();
    return new Set(source.neighbors(selectedId).map((n) => n.neuron.id));
  }, [selectedId, source]);

  const thought = useMemo(
    () => data.thoughts.find((t) => t.id === thoughtId) ?? data.thoughts[0],
    [data.thoughts, thoughtId],
  );

  const segmentPairs = Boolean(data.meta.skeletonFormat?.includes("segment"));

  const waypoints = useMemo(() => {
    if (!thought) return [];
    const chain = thought.waypoints
      .map((id) => source.getNeuron(id))
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map((n) => ({ soma: n.soma, skeleton: n.skeleton }));
    return buildThoughtConductancePath(chain);
  }, [thought, source]);

  return (
    <>
      <color attach="background" args={["#05070c"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[bounds.radius, bounds.radius, bounds.radius]} intensity={0.95} />
      <directionalLight position={[-bounds.radius, -bounds.radius * 0.4, -bounds.radius]} intensity={0.3} />
      <CameraFramer center={bounds.center} radius={bounds.radius} />
      <NeuronLines
        neurons={data.neurons}
        edges={data.edges}
        selectedId={selectedId}
        neighborIds={neighborIds}
        segmentPairs={segmentPairs || data.neurons.length > 20}
      />
      <KeyNodes neurons={data.neurons} neighborIds={neighborIds} nodeRadius={nodeRadius} />
      <ThoughtPulse
        waypoints={waypoints}
        playing={playing}
        color="#3BA7FF"
        tipSize={tipSize}
        onDone={() => setPlaying(false)}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={bounds.radius * 0.15}
        maxDistance={bounds.radius * 8}
        target={[bounds.center.x, bounds.center.y, bounds.center.z]}
      />
    </>
  );
}

export function NeuronScene({ data, source }: Props) {
  return (
    <Canvas
      camera={{ position: [80, 20, 80], fov: 45, near: 0.1, far: 5000 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => useBrowserStore.getState().setSelectedId(null)}
    >
      <SceneContent data={data} source={source} />
    </Canvas>
  );
}
