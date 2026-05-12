import type { StageDesignShape } from "./stage-design-canvas";

export type ResizeCornerId = "nw" | "ne" | "sw" | "se";

export type ShapeResizeHandleEncoded =
  | `RECT:${ResizeCornerId}`
  | `ELLIPSE:${ResizeCornerId}`
  | "LINE:a"
  | "LINE:b"
  /** Vertex index in {@link StageDesignShape.vertices} (POLYLINE kind). */
  | `POLYLINE:${number}`;

export function encodeRectResize(corner: ResizeCornerId): `RECT:${ResizeCornerId}` {
  return `RECT:${corner}`;
}

export function encodeEllipseResize(corner: ResizeCornerId): `ELLIPSE:${ResizeCornerId}` {
  return `ELLIPSE:${corner}`;
}

export function encodeLineResize(end: "a" | "b"): "LINE:a" | "LINE:b" {
  return end === "a" ? "LINE:a" : "LINE:b";
}

export function encodePolylineVertexResize(vertexIndex: number): `POLYLINE:${number}` {
  const k = Math.floor(vertexIndex);
  if (!Number.isFinite(k) || k < 0) return "POLYLINE:0";
  return `POLYLINE:${k}`;
}

export function decodeShapeResizeHandle(raw: string): ShapeResizeHandleEncoded | null {
  if (raw === "LINE:a" || raw === "LINE:b") return raw;
  if (/^POLYLINE:\d+$/.test(raw)) return raw as ShapeResizeHandleEncoded;
  if (raw.startsWith("RECT:") || raw.startsWith("ELLIPSE:")) {
    const suf = raw.slice(raw.indexOf(":") + 1);
    if (suf === "nw" || suf === "ne" || suf === "sw" || suf === "se") return raw as ShapeResizeHandleEncoded;
  }
  return null;
}

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

function rectCornersFromOrigin(x: number, y: number, w: number, h: number): Record<ResizeCornerId, { x: number; y: number }> {
  const x2 = x + w;
  const y2 = y + h;
  const minX = Math.min(x, x2);
  const maxX = Math.max(x, x2);
  const minY = Math.min(y, y2);
  const maxY = Math.max(y, y2);
  return {
    nw: { x: minX, y: minY },
    ne: { x: maxX, y: minY },
    sw: { x: minX, y: maxY },
    se: { x: maxX, y: maxY },
  };
}

function ellipseBBoxCorners(cx: number, cy: number, rx: number, ry: number) {
  return rectCornersFromOrigin(cx - rx, cy - ry, rx * 2, ry * 2);
}

/** World-fixed anchor opposite the dragged diagonal corner / line endpoint */
export function shapeResizeAnchorWorld(shape: StageDesignShape, encoded: ShapeResizeHandleEncoded): { wx: number; wy: number } {
  const dec = encoded;
  if (dec.startsWith("POLYLINE:")) {
    return { wx: shape.x, wy: shape.y };
  }
  if (dec.startsWith("LINE:")) {
    const end = dec === "LINE:a" ? "a" : "b";
    if (shape.kind !== "LINE") return { wx: shape.x, wy: shape.y };
    const xa = shape.x;
    const ya = shape.y;
    const xb = shape.x2 ?? shape.x;
    const yb = shape.y2 ?? shape.y;
    return end === "a" ? { wx: xb, wy: yb } : { wx: xa, wy: ya };
  }
  const [, corner] = dec.split(":") as [string, ResizeCornerId];
  if (!corner) return { wx: shape.x, wy: shape.y };

  if (shape.kind === "RECT") {
    const w = shape.width ?? 6;
    const h = shape.height ?? 4;
    const corners = rectCornersFromOrigin(shape.x, shape.y, w, h);
    const oppId = oppositeCorner(corner);
    const c = corners[oppId];
    return { wx: c.x, wy: c.y };
  }
  if (shape.kind === "ELLIPSE") {
    const cx = shape.x;
    const cy = shape.y;
    const rx = shape.width ?? 4;
    const ry = shape.height ?? 3;
    const bbox = ellipseBBoxCorners(cx, cy, rx, ry);
    const oppId = oppositeCorner(corner);
    const c = bbox[oppId];
    return { wx: c.x, wy: c.y };
  }
  return { wx: shape.x, wy: shape.y };
}

function diagonalToRectCorners(
  a: { x: number; y: number },
  b: { x: number; y: number },
  minDim: number,
): { x: number; y: number; width: number; height: number } {
  const xMin = Math.min(a.x, b.x);
  let xMax = Math.max(a.x, b.x);
  const yMin = Math.min(a.y, b.y);
  let yMax = Math.max(a.y, b.y);
  let width = xMax - xMin;
  let height = yMax - yMin;
  if (width < minDim) {
    width = minDim;
    xMax = xMin + minDim;
  }
  if (height < minDim) {
    height = minDim;
    yMax = yMin + minDim;
  }
  return { x: xMin, y: yMin, width, height };
}

function diagonalEllipseFromCorners(
  a: { x: number; y: number },
  b: { x: number; y: number },
  minDimHalf: number,
): { cx: number; cy: number; rx: number; ry: number } {
  const xMin = Math.min(a.x, b.x);
  const xMax = Math.max(a.x, b.x);
  const yMin = Math.min(a.y, b.y);
  const yMax = Math.max(a.y, b.y);
  let rx = (xMax - xMin) / 2;
  let ry = (yMax - yMin) / 2;
  if (rx < minDimHalf) rx = minDimHalf;
  if (ry < minDimHalf) ry = minDimHalf;
  const cx = (xMin + xMax) / 2;
  const cy = (yMin + yMax) / 2;
  return { cx, cy, rx, ry };
}

const MIN_RECT_W = 0.5;
const MIN_ELLIPSE_R = 0.25;

/**
 * Uses `baselineShape` (frozen at pointer-down) together with snapped free cursor position.
 */
export function applyShapeResize(
  baselineShape: StageDesignShape,
  encoded: ShapeResizeHandleEncoded,
  freeWx: number,
  freeWy: number,
): StageDesignShape {
  if (encoded.startsWith("POLYLINE:")) {
    const idx = Number.parseInt(encoded.slice("POLYLINE:".length), 10);
    const verts = baselineShape.vertices;
    if (baselineShape.kind !== "POLYLINE" || !verts?.length || !Number.isFinite(idx)) return baselineShape;
    if (idx < 0 || idx >= verts.length) return baselineShape;
    const nextVerts = verts.map((p, j) => (j === idx ? { x: freeWx, y: freeWy } : { x: p.x, y: p.y }));
    return {
      ...baselineShape,
      x: nextVerts[0]!.x,
      y: nextVerts[0]!.y,
      vertices: nextVerts,
    };
  }

  const pivot = shapeResizeAnchorWorld(baselineShape, encoded);
  const pivotPt = { x: pivot.wx, y: pivot.wy };
  const FREE = { x: freeWx, y: freeWy };

  if (encoded.startsWith("LINE:")) {
    if (baselineShape.kind !== "LINE") return baselineShape;
    const end = encoded === "LINE:a" ? "a" : "b";
    if (end === "a") return { ...baselineShape, x: freeWx, y: freeWy };
    return { ...baselineShape, x2: freeWx, y2: freeWy };
  }

  if (baselineShape.kind === "RECT") {
    const { x, y, width, height } = diagonalToRectCorners(pivotPt, FREE, MIN_RECT_W);
    return { ...baselineShape, x, y, width, height };
  }
  if (baselineShape.kind === "ELLIPSE") {
    const { cx, cy, rx, ry } = diagonalEllipseFromCorners(pivotPt, FREE, MIN_ELLIPSE_R);
    return { ...baselineShape, x: cx, y: cy, width: rx, height: ry };
  }
  return baselineShape;
}
