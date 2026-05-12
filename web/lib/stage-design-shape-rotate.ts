import type { StageDesignPlacement, StageDesignShape } from "./stage-design-canvas";

/** Symbol anchor (plot world); matches {@link PlacementGlyph} pivot in the preview SVG. */
export function stagePlacementRotationPivotWorld(p: StageDesignPlacement): { wx: number; wy: number } {
  return { wx: p.x, wy: p.y };
}

/** Pivot (plot world coordinates) aligned with SVG rotation transforms for authoring. */
export function stageShapeRotationPivotWorld(shape: StageDesignShape): { wx: number; wy: number } {
  switch (shape.kind) {
    case "RECT": {
      const w = shape.width ?? 6;
      const h = shape.height ?? 4;
      return { wx: shape.x + w / 2, wy: shape.y + h / 2 };
    }
    case "ELLIPSE":
    case "TEXT":
      return { wx: shape.x, wy: shape.y };
    case "LINE": {
      const x2 = shape.x2 ?? shape.x;
      const y2 = shape.y2 ?? shape.y;
      return { wx: (shape.x + x2) / 2, wy: (shape.y + y2) / 2 };
    }
    case "POLYLINE": {
      const v = shape.vertices;
      if (!v?.length) return { wx: shape.x, wy: shape.y };
      let sx = 0;
      let sy = 0;
      for (const p of v) {
        sx += p.x;
        sy += p.y;
      }
      const n = v.length;
      return { wx: sx / n, wy: sy / n };
    }
    default:
      return { wx: shape.x, wy: shape.y };
  }
}

export function plotPointerAngleDegrees(pivotWx: number, pivotWy: number, wx: number, wy: number): number {
  return (Math.atan2(wy - pivotWy, wx - pivotWx) * 180) / Math.PI;
}

/** Shortest signed delta (−180, 180] from `fromDeg` to `toDeg`. */
export function shortestAngleDegreesDelta(fromDeg: number, toDeg: number): number {
  let d = toDeg - fromDeg;
  while (d > 180) d -= 360;
  while (d <= -180) d += 360;
  return d;
}

/** Combine baseline rotation + pointer delta; snap for CAD-style stepping (Shift = 15°). */
export function authoringRotationDegreesAtPointer(
  baseRotationDegAtPointerDown: number,
  pointerDegreesAtDown: number,
  pointerDegreesNow: number,
  coarseSnap: boolean,
): number {
  const step = coarseSnap ? 15 : 1;
  const delta = shortestAngleDegreesDelta(pointerDegreesAtDown, pointerDegreesNow);
  let combined = baseRotationDegAtPointerDown + delta;
  combined = ((combined % 360) + 360) % 360;
  const snapped = Math.round(combined / step) * step;
  return snapped % 360;
}
