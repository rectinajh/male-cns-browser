/**
 * Camera distance so a bounding sphere of `radius` fits in the viewport
 * with `padding` (>1 leaves margin). Uses the tighter of vertical/horizontal FOV
 * so a narrow center column (3-panel layout) does not clip the model.
 */
export function fitDistance(
  radius: number,
  fovDeg: number,
  aspect: number,
  padding = 1.25,
): number {
  const r = Math.max(radius, 1e-6);
  const vFov = (fovDeg * Math.PI) / 180;
  const safeAspect = Math.max(aspect, 0.05);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);
  const limiting = Math.min(vFov, hFov);
  return (r * padding) / Math.sin(limiting / 2);
}

/** Elevated three-quarter view direction (unit vector components). */
export const DEFAULT_VIEW_DIR = { x: 0.92, y: 0.28, z: 0.85 } as const;
