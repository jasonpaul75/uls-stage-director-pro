import { bulgeFromIncludedAngleRad } from "./stage-design-dxf-bulge";

/** Relative radius tolerance when verifying tessellated vertices lie on one circle. */
export const DXF_CIRCULAR_ARC_FIT_REL_TOL = 1e-4;

export type DxfCircularArcFit = {
  cx: number;
  cy: number;
  r: number;
  startDeg: number;
  endDeg: number;
};

function circleCenterFrom3Points(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): { x: number; y: number } | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-14) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}

function normalizeAngleRad(a: number): number {
  let x = a;
  while (x < 0) x += 2 * Math.PI;
  while (x >= 2 * Math.PI) x -= 2 * Math.PI;
  return x;
}

/** True when `testRad` lies on the CCW sweep from `startRad` through `sweepRad`. */
function angleOnCcwSweep(startRad: number, sweepRad: number, testRad: number): boolean {
  if (sweepRad >= 2 * Math.PI - 1e-6) return true;
  const s = normalizeAngleRad(startRad);
  const t = normalizeAngleRad(testRad);
  const e = normalizeAngleRad(startRad + sweepRad);
  if (s <= e) return t >= s - 1e-9 && t <= e + 1e-9;
  return t >= s - 1e-9 || t <= e + 1e-9;
}

/**
 * When an open polyline is a tessellated circular arc, recover center/radius and DXF degree endpoints.
 * Returns null for lines, full circles, or non-circular paths.
 */
export function fitOpenCircularArcFromVertices(
  verts: readonly { x: number; y: number }[],
): DxfCircularArcFit | null {
  if (verts.length < 4) return null;

  const p0 = verts[0]!;
  const pm = verts[Math.floor(verts.length / 2)]!;
  const pn = verts[verts.length - 1]!;

  if (Math.hypot(pn.x - p0.x, pn.y - p0.y) < 1e-12) return null;

  const center = circleCenterFrom3Points(p0, pm, pn);
  if (!center) return null;

  const r = Math.hypot(p0.x - center.x, p0.y - center.y);
  if (r <= 1e-9) return null;

  const tol = Math.max(1e-6, r * DXF_CIRCULAR_ARC_FIT_REL_TOL);
  for (const p of verts) {
    if (Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - r) > tol) return null;
  }

  const startRad = Math.atan2(p0.y - center.y, p0.x - center.x);
  const endRad = Math.atan2(pn.y - center.y, pn.x - center.x);
  let sweep = endRad - startRad;
  while (sweep <= 1e-15) sweep += 2 * Math.PI;
  while (sweep > 2 * Math.PI + 1e-12) sweep -= 2 * Math.PI;

  if (sweep < 1e-6 || sweep >= 2 * Math.PI - 0.02) return null;

  const midRad = Math.atan2(pm.y - center.y, pm.x - center.x);
  if (!angleOnCcwSweep(startRad, sweep, midRad)) return null;

  const startDeg = (startRad * 180) / Math.PI;
  const endDeg = (endRad * 180) / Math.PI;

  return { cx: center.x, cy: center.y, r, startDeg, endDeg };
}

function areCollinearXY(pts: readonly { x: number; y: number }[]): boolean {
  if (pts.length < 3) return true;
  const a = pts[0]!;
  const b = pts[1]!;
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLen2 = abx * abx + aby * aby;
  if (abLen2 < 1e-24) return true;
  for (let i = 2; i < pts.length; i++) {
    const p = pts[i]!;
    const cross = abx * (p.y - a.y) - aby * (p.x - a.x);
    if (Math.abs(cross) > Math.max(1e-9, Math.sqrt(abLen2) * 1e-6)) return false;
  }
  return true;
}

/**
 * DXF bulge for one chord **P0→Pn** when every vertex in `slice` lies on the same circular arc (or line).
 * Returns **0** for straight segments, **null** when the slice cannot be one segment.
 */
export function fitBulgeForArcVertexSlice(slice: readonly { x: number; y: number }[]): number | null {
  if (slice.length < 2) return null;
  const p0 = slice[0]!;
  const pn = slice[slice.length - 1]!;
  if (Math.hypot(pn.x - p0.x, pn.y - p0.y) < 1e-12) return null;
  if (slice.length === 2 || areCollinearXY(slice)) return 0;

  const pm = slice[Math.floor(slice.length / 2)]!;
  const center = circleCenterFrom3Points(p0, pm, pn);
  if (!center) return 0;

  const r = Math.hypot(p0.x - center.x, p0.y - center.y);
  if (r <= 1e-9) return null;
  const tol = Math.max(1e-6, r * DXF_CIRCULAR_ARC_FIT_REL_TOL);
  for (const p of slice) {
    if (Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - r) > tol) return null;
  }

  const startRad = Math.atan2(p0.y - center.y, p0.x - center.x);
  const endRad = Math.atan2(pn.y - center.y, pn.x - center.x);
  let sweep = endRad - startRad;
  while (sweep <= 1e-15) sweep += 2 * Math.PI;
  while (sweep > 2 * Math.PI + 1e-12) sweep -= 2 * Math.PI;

  if (sweep >= 2 * Math.PI - 0.02) return null;

  const midRad = Math.atan2(pm.y - center.y, pm.x - center.x);
  if (!angleOnCcwSweep(startRad, sweep, midRad)) {
    const cwSweep = 2 * Math.PI - sweep;
    if (cwSweep >= 2 * Math.PI - 0.02) return null;
    if (!angleOnCcwSweep(endRad, cwSweep, midRad)) return null;
    return bulgeFromIncludedAngleRad(-cwSweep);
  }

  if (sweep < 1e-6) return 0;
  return bulgeFromIncludedAngleRad(sweep);
}

export type CompressedDxfOpenPolyline = {
  vertices: { x: number; y: number }[];
  /** Outgoing bulge per vertex index (ignored on last vertex when open). */
  bulgesOut: number[];
};

const DXF_POLY_CORNER_MIN_TURN_RAD = (12 * Math.PI) / 180;

/** Vertex indices where incoming/outgoing segments turn sharply (line↔arc corners). */
function cornerVertexIndices(verts: readonly { x: number; y: number }[]): number[] {
  const corners: number[] = [];
  for (let i = 1; i < verts.length - 1; i++) {
    const prev = verts[i - 1]!;
    const cur = verts[i]!;
    const next = verts[i + 1]!;
    const ax = cur.x - prev.x;
    const ay = cur.y - prev.y;
    const bx = next.x - cur.x;
    const by = next.y - cur.y;
    const al = Math.hypot(ax, ay);
    const bl = Math.hypot(bx, by);
    if (al < 1e-12 || bl < 1e-12) continue;
    const cross = ax * by - ay * bx;
    const dot = ax * bx + ay * by;
    const turn = Math.abs(Math.atan2(cross, dot));
    if (turn >= DXF_POLY_CORNER_MIN_TURN_RAD) corners.push(i);
  }
  return corners;
}

function compressOpenVertexRun(
  verts: readonly { x: number; y: number }[],
): { vertices: { x: number; y: number }[]; bulgesOut: number[] } {
  if (verts.length < 2) {
    return { vertices: [...verts], bulgesOut: [] };
  }

  const vertices: { x: number; y: number }[] = [];
  const bulgesOut: number[] = [];
  let i = 0;

  while (i < verts.length - 1) {
    let bestJ = i + 1;
    let bestBulge = 0;
    for (let j = i + 1; j < verts.length; j++) {
      const b = fitBulgeForArcVertexSlice(verts.slice(i, j + 1));
      if (b === null) break;
      bestJ = j;
      bestBulge = b;
    }
    vertices.push(verts[i]!);
    bulgesOut.push(bestBulge);
    i = bestJ;
  }
  vertices.push(verts[verts.length - 1]!);
  return { vertices, bulgesOut };
}

/**
 * Collapse tessellated arc runs into chord+bulge pairs for compact LWPOLYLINE export.
 * Sharp corners (e.g. line→arc) are preserved before per-run compression.
 */
export function compressOpenPolylineForDxfExport(
  verts: readonly { x: number; y: number }[],
): CompressedDxfOpenPolyline {
  if (verts.length < 2) {
    return { vertices: [...verts], bulgesOut: [] };
  }

  const corners = cornerVertexIndices(verts);
  const breaks = [0, ...corners, verts.length - 1].filter((v, idx, arr) => idx === 0 || v !== arr[idx - 1]);

  const vertices: { x: number; y: number }[] = [];
  const bulgesOut: number[] = [];

  for (let s = 0; s < breaks.length - 1; s++) {
    const start = breaks[s]!;
    const end = breaks[s + 1]!;
    const part = compressOpenVertexRun(verts.slice(start, end + 1));
    if (vertices.length === 0) {
      vertices.push(...part.vertices);
      bulgesOut.push(...part.bulgesOut);
    } else {
      bulgesOut.push(...part.bulgesOut);
      vertices.push(...part.vertices.slice(1));
    }
  }

  return { vertices, bulgesOut };
}

function stripClosingDuplicateVertex(
  verts: readonly { x: number; y: number }[],
): { x: number; y: number }[] {
  if (verts.length < 2) return [...verts];
  const f = verts[0]!;
  const l = verts[verts.length - 1]!;
  if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-9) return verts.slice(0, -1);
  return [...verts];
}

/** Corner vertices on a closed ring (wraps at index 0). */
function cornerVertexIndicesClosed(ring: readonly { x: number; y: number }[]): number[] {
  const n = ring.length;
  if (n < 3) return [];
  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = ring[(i - 1 + n) % n]!;
    const cur = ring[i]!;
    const next = ring[(i + 1) % n]!;
    const ax = cur.x - prev.x;
    const ay = cur.y - prev.y;
    const bx = next.x - cur.x;
    const by = next.y - cur.y;
    const al = Math.hypot(ax, ay);
    const bl = Math.hypot(bx, by);
    if (al < 1e-12 || bl < 1e-12) continue;
    const cross = ax * by - ay * bx;
    const dot = ax * bx + ay * by;
    const turn = Math.abs(Math.atan2(cross, dot));
    if (turn >= DXF_POLY_CORNER_MIN_TURN_RAD) corners.push(i);
  }
  return corners;
}

/**
 * Tessellated closed loop on one circle — export as **CIRCLE** instead of dense LWPOLYLINE.
 * Requires enough samples so axis-aligned rectangles (four concyclic corners) are not mistaken for circles.
 */
export function fitClosedCircularLoopFromVertices(
  verts: readonly { x: number; y: number }[],
): { cx: number; cy: number; r: number } | null {
  const ring = stripClosingDuplicateVertex(verts);
  if (ring.length < 8) return null;

  const center = circleCenterFrom3Points(
    ring[0]!,
    ring[Math.floor(ring.length / 3)]!,
    ring[Math.floor((2 * ring.length) / 3)]!,
  );
  if (!center) return null;

  const r = Math.hypot(ring[0]!.x - center.x, ring[0]!.y - center.y);
  if (r <= 1e-9) return null;
  const tol = Math.max(1e-6, r * DXF_CIRCULAR_ARC_FIT_REL_TOL);
  for (const p of ring) {
    if (Math.abs(Math.hypot(p.x - center.x, p.y - center.y) - r) > tol) return null;
  }

  const angles = ring
    .map((p) => Math.atan2(p.y - center.y, p.x - center.x))
    .sort((a, b) => a - b);
  const n = angles.length;
  let maxGap = 0;
  for (let i = 0; i < n; i++) {
    const a0 = angles[i]!;
    const gap = i < n - 1 ? angles[i + 1]! - a0 : angles[0]! + 2 * Math.PI - a0;
    maxGap = Math.max(maxGap, gap);
  }
  if (maxGap > Math.PI - 0.15) return null;

  return { cx: center.x, cy: center.y, r };
}

function compressClosedRingWalk(ring: readonly { x: number; y: number }[]): CompressedDxfOpenPolyline {
  const n = ring.length;
  const vertices: { x: number; y: number }[] = [];
  const bulgesOut: number[] = [];
  let i = 0;
  let guard = 0;

  while (guard < n) {
    let bestLen = 1;
    let bestBulge = 0;
    for (let len = 1; len < n; len++) {
      const slice: { x: number; y: number }[] = [];
      for (let k = 0; k <= len; k++) slice.push(ring[(i + k) % n]!);
      const b = fitBulgeForArcVertexSlice(slice);
      if (b === null) break;
      bestLen = len;
      bestBulge = b;
    }
    vertices.push(ring[i]!);
    bulgesOut.push(bestBulge);
    i = (i + bestLen) % n;
    guard += bestLen;
  }

  return { vertices, bulgesOut };
}

/**
 * Collapse tessellated closed rings into compact LWPOLYLINE vertices + bulge **42** (one bulge per vertex).
 */
export function compressClosedPolylineForDxfExport(
  verts: readonly { x: number; y: number }[],
): CompressedDxfOpenPolyline {
  const ring = stripClosingDuplicateVertex(verts);
  if (ring.length < 3) return { vertices: ring, bulgesOut: [] };

  const corners = cornerVertexIndicesClosed(ring);
  if (corners.length === 0) return compressClosedRingWalk(ring);

  const vertices: { x: number; y: number }[] = [];
  const bulgesOut: number[] = [];

  for (let c = 0; c < corners.length; c++) {
    const start = corners[c]!;
    const end = corners[(c + 1) % corners.length]!;
    const run =
      start <= end ? ring.slice(start, end + 1) : [...ring.slice(start), ...ring.slice(0, end + 1)];
    const part = compressOpenVertexRun(run);
    if (vertices.length === 0) {
      vertices.push(...part.vertices);
      bulgesOut.push(...part.bulgesOut);
    } else {
      bulgesOut.push(...part.bulgesOut);
      vertices.push(...part.vertices.slice(1));
    }
  }

  while (bulgesOut.length < vertices.length) bulgesOut.push(0);
  if (bulgesOut.length > vertices.length) bulgesOut.length = vertices.length;

  if (vertices.length >= 2) {
    const f = vertices[0]!;
    const l = vertices[vertices.length - 1]!;
    if (Math.hypot(f.x - l.x, f.y - l.y) < 1e-9) {
      vertices.pop();
      if (bulgesOut.length > vertices.length) bulgesOut.pop();
    }
  }

  return { vertices, bulgesOut };
}
