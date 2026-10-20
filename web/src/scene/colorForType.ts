import * as THREE from "three";

/** Stable HSL color from neuron type — muted so the blue pulse stays readable. */
export function colorForType(type: string): THREE.Color {
  let h = 2166136261;
  for (let i = 0; i < type.length; i++) {
    h ^= type.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = (h >>> 0) % 360;
  return new THREE.Color().setHSL(hue / 360, 0.55, 0.32);
}

export function dimColor(c: THREE.Color, amount = 0.55): THREE.Color {
  const out = c.clone();
  out.multiplyScalar(1 - amount);
  out.offsetHSL(0, -0.12, -0.08);
  return out;
}
