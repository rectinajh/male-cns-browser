import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Neuron } from "../types";
import { useBrowserStore } from "../state/useBrowserStore";
import { colorForType } from "./colorForType";

type Props = {
  neurons: Neuron[];
  neighborIds: Set<number>;
  /** Active thought-chain ids — soft cyan emissive while pulse plays. */
  chainIds?: Set<number>;
  nodeRadius: number;
};

/**
 * Soma markers. For dense subsets (>600) only draw selected / neighbor / chain
 * / a sparse sample so the browser stays interactive while NeuronLines carries
 * the real MaleCNS silhouette.
 */
export function KeyNodes({ neurons, neighborIds, chainIds, nodeRadius }: Props) {
  const selectedId = useBrowserStore((s) => s.selectedId);
  const setSelectedId = useBrowserStore((s) => s.setSelectedId);
  const setHoveredId = useBrowserStore((s) => s.setHoveredId);

  const items = useMemo(() => {
    if (neurons.length <= 600) return neurons;
    const keep = new Set<number>();
    if (selectedId != null) keep.add(selectedId);
    for (const id of neighborIds) keep.add(id);
    if (chainIds) for (const id of chainIds) keep.add(id);
    // Sparse sample for picking landmarks across the CNS silhouette
    const stride = Math.max(1, Math.ceil(neurons.length / 400));
    for (let i = 0; i < neurons.length; i += stride) keep.add(neurons[i].id);
    return neurons.filter((n) => keep.has(n.id));
  }, [neurons, selectedId, neighborIds, chainIds]);

  return (
    <group>
      {items.map((n) => {
        const selected = n.id === selectedId;
        const neighbor = neighborIds.has(n.id);
        const onChain = chainIds?.has(n.id) ?? false;
        const color = colorForType(n.type);
        const scale = selected ? 1.55 : onChain ? 1.35 : neighbor ? 1.2 : 1;
        const dimmed =
          (selectedId != null && !selected && !neighbor && !onChain) ||
          (chainIds != null && chainIds.size > 0 && !onChain && !selected && !neighbor);
        const onClick = (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          setSelectedId(n.id);
        };
        return (
          <mesh
            key={n.id}
            position={n.soma}
            scale={scale}
            onClick={onClick}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredId(n.id);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHoveredId(null);
              document.body.style.cursor = "default";
            }}
          >
            <sphereGeometry args={[nodeRadius, 10, 10]} />
            <meshStandardMaterial
              color={color}
              emissive={
                selected || onChain ? "#5CE1FF" : neighbor ? color : "#000000"
              }
              emissiveIntensity={selected ? 0.95 : onChain ? 0.7 : neighbor ? 0.25 : 0}
              roughness={0.4}
              metalness={0.12}
              transparent={dimmed}
              opacity={dimmed ? 0.28 : 1}
            />
          </mesh>
        );
      })}
    </group>
  );
}
