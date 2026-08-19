import { expandVerticesWithBulges } from "./stage-design-dxf-bulge";
import {
  createPatternParserState,
  feedDxfHatchPatternPair,
  finishDxfHatchPatternParser,
  resolveImportedDxfHatchPattern,
  type DxfHatchPatternDef,
} from "./stage-design-dxf-hatch-pattern";
import { tessellateDxfSplineToVertices } from "./stage-design-dxf-spline";

export type DxfPair = { code: number; value: string };

export type DxfHatchBoundaryLoop = {
  vertices: { x: number; y: number }[];
  closed: boolean;
};

const LW_EPS = 1e-9;

function parseNum(raw: string): number | undefined {
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

function tessellateArcEdge(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
  ccw: boolean,
): { x: number; y: number }[] {
  if (r <= LW_EPS) return [];
  let startRad = (startDeg * Math.PI) / 180;
  let endRad = (endDeg * Math.PI) / 180;
  let sweep = endRad - startRad;
  if (!ccw) {
    if (sweep >= 0) sweep -= 2 * Math.PI;
    while (sweep >= -1e-15) sweep -= 2 * Math.PI;
  } else {
    while (sweep <= 1e-15) sweep += 2 * Math.PI;
    while (sweep > 2 * Math.PI + 1e-12) sweep -= 2 * Math.PI;
  }
  const steps = Math.max(4, Math.min(32, Math.ceil(Math.abs(sweep) / (Math.PI / 16))));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = startRad + sweep * t;
    pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return pts;
}

function appendEdgePointsToChain(
  chain: { x: number; y: number }[],
  pts: readonly { x: number; y: number }[],
): void {
  for (let ai = 0; ai < pts.length; ai++) {
    const pt = pts[ai]!;
    if (ai === 0 && chain.length > 0) {
      const last = chain[chain.length - 1]!;
      if (Math.hypot(last.x - pt.x, last.y - pt.y) < LW_EPS) continue;
    }
    chain.push(pt);
  }
}

/** Hatch elliptic-arc edge (type 3): major axis endpoint relative to center; angles in degrees. */
function tessellateEllipticArcEdge(
  cx: number,
  cy: number,
  majorX: number,
  majorY: number,
  ratio: number,
  startDeg: number,
  endDeg: number,
  ccw: boolean,
): { x: number; y: number }[] {
  if (Math.hypot(majorX, majorY) <= LW_EPS || ratio <= LW_EPS) return [];

  let startRad = (startDeg * Math.PI) / 180;
  let endRad = (endDeg * Math.PI) / 180;
  let sweep = endRad - startRad;
  if (!ccw) {
    if (sweep >= 0) sweep -= 2 * Math.PI;
    while (sweep >= -1e-15) sweep -= 2 * Math.PI;
  } else {
    while (sweep <= 1e-15) sweep += 2 * Math.PI;
    while (sweep > 2 * Math.PI + 1e-12) sweep -= 2 * Math.PI;
  }

  const minorX = -majorY * ratio;
  const minorY = majorX * ratio;
  const steps = Math.max(4, Math.min(32, Math.ceil(Math.abs(sweep) / (Math.PI / 16))));
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = startRad + (sweep * i) / steps;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push({ x: cx + c * majorX + s * minorX, y: cy + c * majorY + s * minorY });
  }
  return pts;
}

function consumeHatchSplineEdgeAt(
  pairs: readonly DxfPair[],
  start: number,
): { vertices: { x: number; y: number }[]; next: number } {
  let j = start;
  let degree = 3;
  let rational = false;
  let periodic = false;
  let pendingCtrlX: number | undefined;
  let pendingFitX: number | undefined;
  const controlPoints: { x: number; y: number }[] = [];
  const fitPoints: { x: number; y: number }[] = [];
  const knots: number[] = [];
  const weights: number[] = [];

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0 || p.code === 72 || p.code === 92 || p.code === 91) break;
    const v = parseNum(p.value);
    switch (p.code) {
      case 94:
        if (v !== undefined) degree = v;
        break;
      case 73:
        if (v !== undefined) rational = v !== 0;
        break;
      case 75:
        if (v !== undefined) periodic = v !== 0;
        break;
      case 10:
        if (v !== undefined) pendingCtrlX = v;
        break;
      case 20:
        if (pendingCtrlX !== undefined && v !== undefined) {
          controlPoints.push({ x: pendingCtrlX, y: v });
          pendingCtrlX = undefined;
        }
        break;
      case 11:
        if (v !== undefined) pendingFitX = v;
        break;
      case 21:
        if (pendingFitX !== undefined && v !== undefined) {
          fitPoints.push({ x: pendingFitX, y: v });
          pendingFitX = undefined;
        }
        break;
      case 40:
        if (v !== undefined) knots.push(v);
        break;
      case 42:
        if (v !== undefined) weights.push(v);
        break;
      default:
        break;
    }
    j++;
  }

  const vertices = tessellateDxfSplineToVertices({
    controlPoints,
    fitPoints,
    knots,
    weights,
    degree,
    closed: periodic,
    rational,
    maxSegments: 32,
  });
  return { vertices, next: j };
}

function parsePolylineHatchBoundary(pairs: readonly DxfPair[], start: number): { loop: DxfHatchBoundaryLoop | null; next: number } {
  let j = start;
  let hasBulge = false;
  let closed = false;
  let vertCount: number | undefined;
  let pendingX: number | undefined;
  const verts: { x: number; y: number }[] = [];
  const bulges: number[] = [];

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0 || p.code === 92 || p.code === 91) break;
    const v = parseNum(p.value);
    switch (p.code) {
      case 72:
        if (v !== undefined) hasBulge = v !== 0;
        break;
      case 73:
        if (v !== undefined) closed = v !== 0;
        break;
      case 93:
        if (v !== undefined) vertCount = v;
        break;
      case 10:
        if (v !== undefined) pendingX = v;
        break;
      case 20: {
        if (pendingX !== undefined && v !== undefined) {
          verts.push({ x: pendingX, y: v });
          bulges.push(0);
          pendingX = undefined;
        }
        break;
      }
      case 42: {
        if (verts.length > 0 && v !== undefined) bulges[verts.length - 1] = v;
        break;
      }
      default:
        break;
    }
    j++;
    if (vertCount !== undefined && verts.length >= vertCount) break;
  }

  if (verts.length < 2) return { loop: null, next: j };

  while (bulges.length < verts.length) bulges.push(0);
  const expanded = expandVerticesWithBulges(verts, bulges, closed);
  return { loop: { vertices: expanded, closed }, next: j };
}

function parseEdgeHatchBoundary(pairs: readonly DxfPair[], start: number): { loop: DxfHatchBoundaryLoop | null; next: number } {
  let j = start;
  let edgeCount: number | undefined;
  const chain: { x: number; y: number }[] = [];

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0 || p.code === 92 || p.code === 91) break;
    if (p.code === 93 && edgeCount === undefined) {
      edgeCount = parseNum(p.value);
      j++;
      continue;
    }
    if (edgeCount === undefined) {
      j++;
      continue;
    }

    if (p.code === 72) {
      const edgeType = parseNum(p.value);
      j++;
      if (edgeType === 1) {
        let x1: number | undefined;
        let y1: number | undefined;
        let x2: number | undefined;
        let y2: number | undefined;
        while (j < pairs.length) {
          const e = pairs[j]!;
          if (e.code === 0 || e.code === 72 || e.code === 92 || e.code === 91) break;
          const ev = parseNum(e.value);
          if (e.code === 10 && ev !== undefined) x1 = ev;
          else if (e.code === 20 && ev !== undefined) y1 = ev;
          else if (e.code === 11 && ev !== undefined) x2 = ev;
          else if (e.code === 21 && ev !== undefined) y2 = ev;
          else if (e.code === 72) break;
          j++;
        }
        if (x1 !== undefined && y1 !== undefined && x2 !== undefined && y2 !== undefined) {
          const last = chain[chain.length - 1];
          if (!last || Math.hypot(last.x - x1, last.y - y1) > LW_EPS) chain.push({ x: x1, y: y1 });
          chain.push({ x: x2, y: y2 });
        }
      } else if (edgeType === 2) {
        let cx: number | undefined;
        let cy: number | undefined;
        let r: number | undefined;
        let startDeg: number | undefined;
        let endDeg: number | undefined;
        let ccw = true;
        while (j < pairs.length) {
          const e = pairs[j]!;
          if (e.code === 0 || e.code === 72 || e.code === 92 || e.code === 91) break;
          const ev = parseNum(e.value);
          if (e.code === 10 && ev !== undefined) cx = ev;
          else if (e.code === 20 && ev !== undefined) cy = ev;
          else if (e.code === 40 && ev !== undefined) r = ev;
          else if (e.code === 50 && ev !== undefined) startDeg = ev;
          else if (e.code === 51 && ev !== undefined) endDeg = ev;
          else if (e.code === 73 && ev !== undefined) ccw = ev !== 0;
          else if (e.code === 72) break;
          j++;
        }
        if (
          cx !== undefined &&
          cy !== undefined &&
          r !== undefined &&
          startDeg !== undefined &&
          endDeg !== undefined
        ) {
          appendEdgePointsToChain(chain, tessellateArcEdge(cx, cy, r, startDeg, endDeg, ccw));
        }
      } else if (edgeType === 3) {
        let cx: number | undefined;
        let cy: number | undefined;
        let majorX: number | undefined;
        let majorY: number | undefined;
        let ratio: number | undefined;
        let startDeg: number | undefined;
        let endDeg: number | undefined;
        let ccw = true;
        while (j < pairs.length) {
          const e = pairs[j]!;
          if (e.code === 0 || e.code === 72 || e.code === 92 || e.code === 91) break;
          const ev = parseNum(e.value);
          if (e.code === 10 && ev !== undefined) cx = ev;
          else if (e.code === 20 && ev !== undefined) cy = ev;
          else if (e.code === 11 && ev !== undefined) majorX = ev;
          else if (e.code === 21 && ev !== undefined) majorY = ev;
          else if (e.code === 40 && ev !== undefined) ratio = ev;
          else if (e.code === 50 && ev !== undefined) startDeg = ev;
          else if (e.code === 51 && ev !== undefined) endDeg = ev;
          else if (e.code === 73 && ev !== undefined) ccw = ev !== 0;
          else if (e.code === 72) break;
          j++;
        }
        if (
          cx !== undefined &&
          cy !== undefined &&
          majorX !== undefined &&
          majorY !== undefined &&
          ratio !== undefined &&
          startDeg !== undefined &&
          endDeg !== undefined
        ) {
          appendEdgePointsToChain(
            chain,
            tessellateEllipticArcEdge(cx, cy, majorX, majorY, ratio, startDeg, endDeg, ccw),
          );
        }
      } else if (edgeType === 4) {
        const sp = consumeHatchSplineEdgeAt(pairs, j);
        j = sp.next;
        appendEdgePointsToChain(chain, sp.vertices);
      } else {
        while (j < pairs.length) {
          const e = pairs[j]!;
          if (e.code === 0 || e.code === 72 || e.code === 92 || e.code === 91) break;
          j++;
        }
      }
      edgeCount--;
      if (edgeCount <= 0) break;
      continue;
    }
    j++;
  }

  if (chain.length < 2) return { loop: null, next: j };
  const f = chain[0]!;
  const l = chain[chain.length - 1]!;
  const closed = Math.hypot(f.x - l.x, f.y - l.y) < Math.max(LW_EPS, 1e-6);
  return { loop: { vertices: chain, closed: closed || chain.length >= 3 }, next: j };
}

function parseOneHatchBoundaryPath(
  pairs: readonly DxfPair[],
  start: number,
): { loop: DxfHatchBoundaryLoop | null; next: number } {
  let j = start;
  if (pairs[j]?.code !== 92) return { loop: null, next: start };
  const flags = parseNum(pairs[j]!.value) ?? 0;
  j++;
  // DXF boundary path flag bit 4 = polyline; otherwise line/arc/spline edges.
  if ((flags & 4) !== 0) return parsePolylineHatchBoundary(pairs, j);
  return parseEdgeHatchBoundary(pairs, j);
}

/**
 * Parse DXF HATCH boundary loops (polyline paths and line/arc/elliptic/spline edge paths)
 * plus pattern metadata (52/41/78/53…) when present.
 */
export function parseDxfHatchBoundaryLoops(pairs: readonly DxfPair[], start: number): {
  loops: DxfHatchBoundaryLoop[];
  solidFill: boolean;
  patternName: string | null;
  pattern: DxfHatchPatternDef | null;
  next: number;
} {
  let j = start;
  let pathCount: number | undefined;
  let solidFill = false;
  let patternName: string | null = null;
  const loops: DxfHatchBoundaryLoop[] = [];
  const patternState = createPatternParserState();
  let sawPatternCode = false;

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;
    if (p.code === 2) {
      const name = p.value.trim();
      if (name.length > 0 && name.toUpperCase() !== "SOLID") patternName = name;
      j++;
      continue;
    }
    if (p.code === 70) {
      const v = parseNum(p.value);
      if (v === 1) solidFill = true;
      j++;
      continue;
    }
    if (p.code === 91 && pathCount === undefined) {
      pathCount = parseNum(p.value);
      j++;
      continue;
    }
    if (pathCount !== undefined && loops.length < pathCount && p.code === 92) {
      const part = parseOneHatchBoundaryPath(pairs, j);
      if (part.loop && part.loop.vertices.length >= 2) loops.push(part.loop);
      j = part.next;
      continue;
    }
    if (feedDxfHatchPatternPair(patternState, p)) {
      sawPatternCode = true;
      j++;
      continue;
    }
    j++;
  }

  const parsedPattern = sawPatternCode ? finishDxfHatchPatternParser(patternState, patternName) : null;
  const pattern = resolveImportedDxfHatchPattern(parsedPattern, patternName, solidFill);

  return { loops, solidFill, patternName, pattern, next: j };
}

function pushDxfPair(out: string[], code: number, value: string | number): void {
  out.push(String(code));
  out.push(typeof value === "number" ? String(value) : value);
}

function fxyExport(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(6);
}

/**
 * Emit a solid **HATCH** with one polyline boundary loop (matches {@link parseDxfHatchBoundaryLoops} import).
 */
export function appendDxfSolidHatchPolylineBoundary(
  out: string[],
  layer: string,
  vertices: readonly { x: number; y: number }[],
  bulgesOut?: readonly number[],
): void {
  let verts = [...vertices];
  const bulges = [...(bulgesOut ?? verts.map(() => 0))];
  if (verts.length >= 2) {
    const f = verts[0]!;
    const l = verts[verts.length - 1]!;
    if (Math.hypot(f.x - l.x, f.y - l.y) < LW_EPS) {
      verts = verts.slice(0, -1);
      if (bulges.length > verts.length) bulges.length = verts.length;
    }
  }
  if (verts.length < 3) return;
  while (bulges.length < verts.length) bulges.push(0);
  if (bulges.length > verts.length) bulges.length = verts.length;
  const hasBulge = bulges.some((b) => Math.abs(b) > 1e-9);

  pushDxfPair(out, 0, "HATCH");
  pushDxfPair(out, 100, "AcDbEntity");
  pushDxfPair(out, 8, layer);
  pushDxfPair(out, 100, "AcDbHatch");
  pushDxfPair(out, 10, "0");
  pushDxfPair(out, 20, "0");
  pushDxfPair(out, 30, "0");
  pushDxfPair(out, 210, "0");
  pushDxfPair(out, 220, "0");
  pushDxfPair(out, 230, "1");
  pushDxfPair(out, 2, "SOLID");
  pushDxfPair(out, 70, 1);
  pushDxfPair(out, 71, 0);
  pushDxfPair(out, 91, 1);
  pushDxfPair(out, 92, 6);
  if (hasBulge) pushDxfPair(out, 72, 1);
  pushDxfPair(out, 73, 1);
  pushDxfPair(out, 93, verts.length);
  for (let i = 0; i < verts.length; i++) {
    const p = verts[i]!;
    pushDxfPair(out, 10, fxyExport(p.x));
    pushDxfPair(out, 20, fxyExport(p.y));
    if (hasBulge) pushDxfPair(out, 42, fxyExport(bulges[i] ?? 0));
  }
  pushDxfPair(out, 75, 0);
  pushDxfPair(out, 76, 1);
  pushDxfPair(out, 98, 0);
}
