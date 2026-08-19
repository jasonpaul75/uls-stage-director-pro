/** Max tessellation segments when sampling DXF SPLINE curves for diagram POLYLINE import. */
export const DXF_SPLINE_IMPORT_MAX_SEGMENTS = 48;

/** Open/closed POLYLINE shapes with at least this many vertices may re-export as **SPLINE** fit points. */
export const DXF_SPLINE_EXPORT_MIN_VERTICES = 5;

const SPLINE_EPS = 1e-9;

export type DxfSplineTessellateInput = {
  controlPoints: readonly { x: number; y: number }[];
  fitPoints: readonly { x: number; y: number }[];
  knots: readonly number[];
  weights: readonly number[];
  degree: number;
  closed: boolean;
  rational: boolean;
  maxSegments?: number;
};

function dedupeConsecutiveXY(verts: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const v of verts) {
    const last = out[out.length - 1];
    if (last && Math.hypot(last.x - v.x, last.y - v.y) < 1e-9) continue;
    out.push(v);
  }
  return out;
}

/** Clamped uniform knot vector when DXF omits explicit knots. */
export function buildClampedUniformKnots(controlCount: number, degree: number): number[] {
  const d = Math.max(1, Math.min(5, Math.floor(degree)));
  const n = controlCount;
  if (n <= d) return [];
  const m = n + d + 1;
  const knots: number[] = [];
  for (let i = 0; i < m; i++) {
    if (i <= d) knots.push(0);
    else if (i >= n) knots.push(1);
    else knots.push((i - d) / (n - d));
  }
  return knots;
}

function findKnotSpan(knots: readonly number[], degree: number, t: number): number {
  const n = knots.length - degree - 1;
  if (n <= degree) return degree;
  if (t >= knots[n]!) return n - 1;
  if (t <= knots[degree]!) return degree;
  let low = degree;
  let high = n;
  let mid = Math.floor((low + high) / 2);
  while (t < knots[mid]! || t >= knots[mid + 1]!) {
    if (t < knots[mid]!) high = mid;
    else low = mid;
    mid = Math.floor((low + high) / 2);
  }
  return mid;
}

type HomogPt = { x: number; y: number; w: number };

function deBoorXY(
  knots: readonly number[],
  degree: number,
  points: readonly { x: number; y: number }[],
  weights: readonly number[] | undefined,
  t: number,
): { x: number; y: number } | null {
  const d = degree;
  if (points.length <= d) return null;
  const k = findKnotSpan(knots, d, t);
  const work: HomogPt[] = [];
  for (let j = 0; j <= d; j++) {
    const idx = k - d + j;
    const p = points[idx];
    if (!p) return null;
    const w = weights?.[idx] ?? 1;
    work.push({ x: p.x * w, y: p.y * w, w });
  }
  for (let r = 1; r <= d; r++) {
    for (let j = d; j >= r; j--) {
      const idx = k - d + j;
      const denom = knots[idx + d + 1 - r]! - knots[idx]!;
      const alpha = denom <= 1e-15 ? 0 : (t - knots[idx]!) / denom;
      const a = work[j - r]!;
      const b = work[j]!;
      work[j] = {
        x: (1 - alpha) * a.x + alpha * b.x,
        y: (1 - alpha) * a.y + alpha * b.y,
        w: (1 - alpha) * a.w + alpha * b.w,
      };
    }
  }
  const last = work[d]!;
  if (Math.abs(last.w) <= 1e-15) return { x: last.x, y: last.y };
  return { x: last.x / last.w, y: last.y / last.w };
}

function tessellateFromControlPoints(input: DxfSplineTessellateInput): { x: number; y: number }[] {
  const ctrl = input.controlPoints;
  const degree = Math.max(1, Math.min(5, Math.floor(input.degree) || 3));
  if (ctrl.length <= degree) return [];

  let knots = input.knots;
  if (knots.length < ctrl.length + degree + 1) {
    knots = buildClampedUniformKnots(ctrl.length, degree);
  }
  if (knots.length < ctrl.length + degree + 1) return [];

  const weights =
    input.rational && input.weights.length === ctrl.length
      ? input.weights
      : undefined;

  const tMin = knots[degree]!;
  const tMax = knots[knots.length - degree - 1]!;
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax) || tMax <= tMin + 1e-15) return [];

  const maxSeg = input.maxSegments ?? DXF_SPLINE_IMPORT_MAX_SEGMENTS;
  const steps = Math.max(2, Math.min(maxSeg, maxSeg));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = tMin + ((tMax - tMin) * i) / steps;
    const p = deBoorXY(knots, degree, ctrl, weights, t);
    if (p) pts.push(p);
  }
  return dedupeConsecutiveXY(pts);
}

/**
 * Tessellate a DXF **SPLINE** entity to diagram POLYLINE vertices.
 * Prefer explicit fit points when present; otherwise sample the B-spline through control points.
 */
export function tessellateDxfSplineToVertices(input: DxfSplineTessellateInput): { x: number; y: number }[] {
  if (input.fitPoints.length >= 2) {
    let pts = dedupeConsecutiveXY(input.fitPoints);
    if (input.closed && pts.length >= 3) {
      const f = pts[0]!;
      const l = pts[pts.length - 1]!;
      if (Math.hypot(f.x - l.x, f.y - l.y) > 1e-9) pts = [...pts, { x: f.x, y: f.y }];
    }
    return pts;
  }
  return tessellateFromControlPoints(input);
}

function pushDxfPair(out: string[], code: number, value: string | number): void {
  out.push(String(code));
  out.push(typeof value === "number" ? String(value) : value);
}

function fxyExport(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(6);
}

export type DxfPolylineSplineExportHint = {
  vertices: readonly { x: number; y: number }[];
  bulgesOut?: readonly number[];
};

/**
 * Prefer SPLINE fit points over LWPOLYLINE when the path has enough samples to represent a smooth curve.
 * Aggressively bulge-compacted paths (fewer than {@link DXF_SPLINE_EXPORT_MIN_VERTICES} vertices) stay LWPOLYLINE.
 */
export function shouldExportPolylineAsSpline(
  worldVerts: readonly { x: number; y: number }[],
  compressed: DxfPolylineSplineExportHint,
): boolean {
  if (worldVerts.length < DXF_SPLINE_EXPORT_MIN_VERTICES) return false;

  const f = worldVerts[0]!;
  const l = worldVerts[worldVerts.length - 1]!;
  const closed = Math.hypot(f.x - l.x, f.y - l.y) < SPLINE_EPS;
  const effectiveCount = closed ? worldVerts.length - 1 : worldVerts.length;
  if (effectiveCount < DXF_SPLINE_EXPORT_MIN_VERTICES) return false;

  return compressed.vertices.length >= DXF_SPLINE_EXPORT_MIN_VERTICES;
}

/**
 * Emit a planar SPLINE through fit points (group codes 11/21), matching consumeSplineEntityAt import.
 */
export function appendDxfSplineFitPointsWorld(
  out: string[],
  layer: string,
  fitPoints: readonly { x: number; y: number }[],
  closed = false,
  degree = 3,
): void {
  let pts = [...fitPoints];
  if (pts.length < 2) return;
  if (closed && pts.length >= 3) {
    const f = pts[0]!;
    const l = pts[pts.length - 1]!;
    if (Math.hypot(f.x - l.x, f.y - l.y) < SPLINE_EPS) pts = pts.slice(0, -1);
  }
  if (pts.length < 2) return;

  const deg = Math.min(Math.max(1, Math.floor(degree)), pts.length - 1);
  const flags70 = 8 | (closed ? 1 : 0);

  pushDxfPair(out, 0, "SPLINE");
  pushDxfPair(out, 100, "AcDbEntity");
  pushDxfPair(out, 8, layer);
  pushDxfPair(out, 100, "AcDbSpline");
  pushDxfPair(out, 210, "0");
  pushDxfPair(out, 220, "0");
  pushDxfPair(out, 230, "1");
  pushDxfPair(out, 70, flags70);
  pushDxfPair(out, 74, deg);
  pushDxfPair(out, 91, pts.length);
  for (const p of pts) {
    pushDxfPair(out, 11, fxyExport(p.x));
    pushDxfPair(out, 21, fxyExport(p.y));
  }
}
