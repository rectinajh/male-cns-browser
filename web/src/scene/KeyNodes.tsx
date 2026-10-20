import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Neuron } from "../types";
import { useBrowserStore } from "../state/useBrowserStore";
import { colorForType } from "./colorForType";

type Props = {
  neurons: Neuron[];
  neighborIds: Set<number>;
  nodeRadius: number;
};

export function KeyNodes({ neurons, neighborIds, nodeRadius }: Props) {
  const selectedId = useBrowserStore((s) => s.selectedId);
  const setSelectedId = useBrowserStore((s) => s.setSelectedId);
  const setHoveredId = useBrowserStore((s) => s.setHoveredId);

  const items = useMemo(() => neurons, [neurons]);

  return (
    <group>
      {items.map((n) => {
        const selected = n.id === selectedId;
        const neighbor = neighborIds.has(n.id);
        const color = colorForType(n.type);
        const scale = selected ? 1.55 : neighbor ? 1.2 : 1;
        const dimmed = selectedId != null && !selected && !neighbor;
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
            <sphereGeometry args={[nodeRadius, 12, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={selected ? "#3BA7FF" : neighbor ? color : "#000000"}
              emissiveIntensity={selected ? 0.9 : neighbor ? 0.25 : 0}
              roughness={0.4}
              metalness={0.12}
              transparent={dimmed}
              opacity={dimmed ? 0.35 : 1}
            />
          </mesh>
        );
      })}
    </group>
  );
}
