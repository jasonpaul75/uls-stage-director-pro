import { rectangleDeckPolygonFromCorners, type PlotWorldBounds, type StageDeckPolygon } from "./stage-design-canvas";
import type { ResizeCornerId } from "./stage-design-shape-resize";

const MIN_DECK_SIDE = 0.5;

function oppositeCorner(c: ResizeCornerId): ResizeCornerId {
  switch (c) {
    case "nw":
      return "se";
    case "ne":
      return "sw";
    case "sw":
      return "ne";
    case "se":
      return "nw";
    default:
      return "nw";
  }
}

function diagonalToAABRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  minDim: number,
): { x0: number; y0: number; x1: number; y1: number } {
  let xMin = Math.min(a.x, b.x);
  let xMax = Math.max(a.x, b.x);
  let yMin = Math.min(a.y, b.y);
  let yMax = Math.max(a.y, b.y);
  let w = xMax - xMin;
  let h = yMax - yMin;
  if (w < minDim) {
    w = minDim;
    xMax = xMin + minDim;
  }
  if (h < minDim) {
    h = minDim;
    yMax = yMin + minDim;
  }
  return { x0: xMin, y0: yMin, x1: xMax, y1: yMax };
}

function approxEq(a: number, b: number, eps = 1e-3): boolean {
  return Math.abs(a - b) < eps;
}

/** True iff four vertices are the corners of one axis-aligned rectangle (order-independent). */
export function deckPolygonApproxAxisAlignedRectCorners(
  poly: StageDeckPolygon,
): { corners: Record<ResizeCornerId, { x: number; y: number }>; xMin: number; xMax: number; yMin: number; yMax: number } | null {
  if (poly.points.length !== 4) return null;
  const pts = poly.points;
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const p of pts) {
    xMin = Math.min(xMin, p.x);
    xMax = Math.max(xMax, p.x);
    yMin = Math.min(yMin, p.y);
    yMax = Math.max(yMax, p.y);
  }
  const need = [
    { x: xMin, y: yMin },
    { x: xMax, y: yMin },
    { x: xMax, y: yMax },
    { x: xMin, y: yMax },
  ];
  for (const c of need) {
    const hit = pts.some((p) => approxEq(p.x, c.x) && approxEq(p.y, c.y));
    if (!hit) return null;
  }
  return {
    xMin,
    xMax,
    yMin,
    yMax,
    corners: {
      nw: { x: xMin, y: yMin },
      ne: { x: xMax, y: yMin },
      se: { x: xMax, y: yMax },
      sw: { x: xMin, y: yMax },
    },
  };
}

/** Dragging `corner` toward (wx,wy) keeps the opposite corner fixed (deck-only, axis-aligned rects). */
export function applyDeckAxisAlignedRectangleCornerResize(
  baseline: StageDeckPolygon,
  corner: ResizeCornerId,
  wx: number,
  wy: number,
): StageDeckPolygon {
  const info = deckPolygonApproxAxisAlignedRectCorners(baseline);
  if (!info) return baseline;
  const pivot = info.corners[oppositeCorner(corner)];
  const r = diagonalToAABRect({ x: pivot.x, y: pivot.y }, { x: wx, y: wy }, MIN_DECK_SIDE);
  return rectangleDeckPolygonFromCorners(baseline.id, r.x0, r.y0, r.x1, r.y1);
}

export function translateDeckPolygon(poly: StageDeckPolygon, dx: number, dy: number): StageDeckPolygon {
  if (!Number.isFinite(dx)) dx = 0;
  if (!Number.isFinite(dy)) dy = 0;
  return {
    ...poly,
    points: poly.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  };
}

/** Keep every vertex inside the plot bounds (clips axis-aligned rects to an AABB; otherwise per-vertex clamps). */
export function clampDeckPolygonToPlotBounds(poly: StageDeckPolygon, bounds: PlotWorldBounds): StageDeckPolygon {
  const bx0 = bounds.minX;
  const bx1 = bounds.maxX;
  const by0 = bounds.minY;
  const by1 = bounds.maxY;
  const info = deckPolygonApproxAxisAlignedRectCorners(poly);
  if (info) {
    let xMin = Math.max(bx0, Math.min(bx1, info.xMin));
    let xMax = Math.max(bx0, Math.min(bx1, info.xMax));
    let yMin = Math.max(by0, Math.min(by1, info.yMin));
    let yMax = Math.max(by0, Math.min(by1, info.yMax));
    if (xMax - xMin < MIN_DECK_SIDE) {
      xMax = Math.min(bx1, xMin + MIN_DECK_SIDE);
      xMin = Math.max(bx0, xMax - MIN_DECK_SIDE);
    }
    if (yMax - yMin < MIN_DECK_SIDE) {
      yMax = Math.min(by1, yMin + MIN_DECK_SIDE);
      yMin = Math.max(by0, yMax - MIN_DECK_SIDE);
    }
    return rectangleDeckPolygonFromCorners(poly.id, xMin, yMin, xMax, yMax);
  }
  return {
    ...poly,
    points: poly.points.map((p) => ({
      x: Math.min(bx1, Math.max(bx0, p.x)),
      y: Math.min(by1, Math.max(by0, p.y)),
    })),
  };
}
