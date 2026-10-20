import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Neuron } from "../types";
import { useBrowserStore } from "../state/useBrowserStore";

type Props = {
  neurons: Neuron[];
  neighborIds: Set<number>;
};

const TYPE_COLORS: Record<string, string> = {
  SensA: "#6ec6ff",
  LC10: "#5bb8e8",
  IN: "#8ab4f8",
  DNge104: "#4aa3de",
  DNg02: "#4aa3de",
  VNCi: "#7a9ec4",
  Mot: "#9bc4e8",
};

export function KeyNodes({ neurons, neighborIds }: Props) {
  const selectedId = useBrowserStore((s) => s.selectedId);
  const setSelectedId = useBrowserStore((s) => s.setSelectedId);
  const setHoveredId = useBrowserStore((s) => s.setHoveredId);

  const items = useMemo(() => neurons, [neurons]);

  return (
    <group>
      {items.map((n) => {
        const selected = n.id === selectedId;
        const neighbor = neighborIds.has(n.id);
        const color = TYPE_COLORS[n.type] ?? "#88aacc";
        const scale = selected ? 1.45 : neighbor ? 1.15 : 1;
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
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={selected ? "#3BA7FF" : neighbor ? "#1a4a70" : "#000000"}
              emissiveIntensity={selected ? 0.85 : neighbor ? 0.35 : 0}
              roughness={0.45}
              metalness={0.15}
            />
          </mesh>
        );
      })}
    </group>
  );
}
