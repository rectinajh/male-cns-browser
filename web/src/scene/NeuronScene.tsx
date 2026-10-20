import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo } from "react";
import type { SubsetFile } from "../types";
import type { LocalJsonSource } from "../data/LocalJsonSource";
import { useBrowserStore } from "../state/useBrowserStore";
import { NeuronLines } from "./NeuronLines";
import { KeyNodes } from "./KeyNodes";
import { ThoughtPulse } from "./ThoughtPulse";

type Props = {
  data: SubsetFile;
  source: LocalJsonSource;
};

function SceneContent({ data, source }: Props) {
  const selectedId = useBrowserStore((s) => s.selectedId);
  const thoughtId = useBrowserStore((s) => s.thoughtId);
  const playing = useBrowserStore((s) => s.playing);
  const setPlaying = useBrowserStore((s) => s.setPlaying);

  const neighborIds = useMemo(() => {
    if (selectedId == null) return new Set<number>();
    return new Set(source.neighbors(selectedId).map((n) => n.neuron.id));
  }, [selectedId, source]);

  const thought = useMemo(
    () => data.thoughts.find((t) => t.id === thoughtId) ?? data.thoughts[0],
    [data.thoughts, thoughtId],
  );

  const waypoints = useMemo(() => {
    if (!thought) return [];
    return thought.waypoints
      .map((id) => source.getNeuron(id)?.soma)
      .filter((s): s is [number, number, number] => !!s);
  }, [thought, source]);

  return (
    <>
      <color attach="background" args={["#070b12"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[2, 3, 2]} intensity={0.9} />
      <directionalLight position={[-2, -1, -2]} intensity={0.25} />
      <NeuronLines
        neurons={data.neurons}
        edges={data.edges}
        selectedId={selectedId}
        neighborIds={neighborIds}
      />
      <KeyNodes neurons={data.neurons} neighborIds={neighborIds} />
      <ThoughtPulse
        waypoints={waypoints}
        playing={playing}
        color="#3BA7FF"
        onDone={() => setPlaying(false)}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={0.8}
        maxDistance={6}
        target={[0, 0.1, 0]}
      />
    </>
  );
}

export function NeuronScene({ data, source }: Props) {
  return (
    <Canvas
      camera={{ position: [1.8, 0.4, 1.6], fov: 45, near: 0.01, far: 50 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onPointerMissed={() => useBrowserStore.getState().setSelectedId(null)}
    >
      <SceneContent data={data} source={source} />
    </Canvas>
  );
}
