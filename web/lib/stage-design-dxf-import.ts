import type { StageDesignShape } from "./stage-design-canvas";

import { expandVerticesWithBulges } from "./stage-design-dxf-bulge";
import { stripMinimalMtextMarkup } from "./stage-design-dxf-mtext";
import { tessellateDxfSplineToVertices } from "./stage-design-dxf-spline";
import {
  consumeDxfInsertAttribFollowersAt,
  parseDxfBlockCatalog,
  parseDxfAttribEntityAt,
  parseDxfInsertEntityAt,
  transformImportedShapeForBlockInsert,
  type DxfBlockDef,
  type DxfInsertTransform,
} from "./stage-design-dxf-blocks";
import { parseDxfHatchBoundaryLoops } from "./stage-design-dxf-hatch";
import { generateDxfHatchPatternLineSegments } from "./stage-design-dxf-hatch-pattern";
import { parseDxfFileToPairs } from "./stage-design-dxf-binary";
import {
  dxfDimensionTextFromFields,
  dxfFaceCornersFromFields,
} from "./stage-design-dxf-vendor-entities";
import {
  consumeDxfVertexChainEntityAt,
  dxfAnnotationLabelFromEntity,
  dxfAnnotationRotationDegFromFields,
  dxfAnnotationTextPositionFromEntity,
  dxfConstructionLineSegmentFromFields,
  dxfWipeoutCornersFromEntity,
} from "./stage-design-dxf-vendor-leader";
import {
  consumeDxfMleaderEntityAt,
  dxfMleaderLabelFromParse,
  dxfMleaderRotationDegFromFields,
  dxfMleaderTextPositionFromParse,
} from "./stage-design-dxf-mleader";
import {
  DXF_POLYLINE_FLAG_POLYGON_MESH,
  DXF_POLYLINE_FLAG_POLYFACE_MESH,
  DXF_VERTEX_FLAG_FACE_RECORD,
  faceIndicesFromVertexFields,
  polygonMeshGridLoops,
  resolvePolyfaceMeshLoops,
} from "./stage-design-dxf-polyline-mesh";

export type ParsedDxfPair = { code: number; value: string };

/** Split ASCII DXF into code/value pairs (one pair per two lines). */
export function parseDxfAsciiPairs(text: string): ParsedDxfPair[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: ParsedDxfPair[] = [];
  for (let i = 0; i < lines.length; ) {
    const rawCode = lines[i++] ?? "";
    const ct = rawCode.trim();
    if (ct.length === 0) break;
    const val = lines[i++] ?? "";
    const code = Number(ct);
    if (!Number.isFinite(code)) break;
    out.push({ code, value: val });
  }
  return out;
}

function findEntitiesSectionStart(pairs: ParsedDxfPair[]): number {
  for (let i = 0; i < pairs.length - 1; i++) {
    const a = pairs[i]!;
    const b = pairs[i + 1]!;
    if (a.code === 0 && a.value === "SECTION" && b.code === 2 && b.value === "ENTITIES") {
      return i + 2;
    }
  }
  return -1;
}

/** Collect DXF group codes until the next entity boundary (`code === 0`). */
function consumeEntityFieldsAt(
  pairs: ParsedDxfPair[],
  start: number,
): { fields: Map<number, string>; next: number } {
  const fields = new Map<number, string>();
  let j = start;
  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;
    fields.set(p.code, p.value);
    j++;
  }
  return { fields, next: j };
}

function num(fields: Map<number, string>, code: number): number | undefined {
  const raw = fields.get(code);
  if (raw === undefined) return undefined;
  const v = Number(String(raw).trim());
  return Number.isFinite(v) ? v : undefined;
}

function mergeMultilineText(fields: Map<number, string>): string {
  const primary = fields.get(1)?.trim() ?? "";
  const extra = fields.get(3)?.trim() ?? "";
  return `${primary}${extra}`.trim();
}

const LW_POLY_EPS = 1e-9;

function dedupeConsecutiveVerticesXY(
  verts: readonly { x: number; y: number }[],
): { x: number; y: number }[] {
  const deduped: { x: number; y: number }[] = [];
  for (const v of verts) {
    const last = deduped[deduped.length - 1];
    if (
      last &&
      Math.abs(last.x - v.x) < LW_POLY_EPS &&
      Math.abs(last.y - v.y) < LW_POLY_EPS
    ) {
      continue;
    }
    deduped.push(v);
  }
  return deduped;
}

/** Dedupe consecutive XY points; if closedFlag (DXF polyline flag bit 1), append first point when closing segment is missing. */
function finalizeImportedPolyVertices(
  verts: readonly { x: number; y: number }[],
  closedFlag: boolean,
): { vertices: { x: number; y: number }[]; ok: boolean } {
  let out = dedupeConsecutiveVerticesXY(verts);
  if (closedFlag && out.length >= 3) {
    const f = out[0]!;
    const l = out[out.length - 1]!;
    if (Math.hypot(f.x - l.x, f.y - l.y) > LW_POLY_EPS) {
      out = [...out, { x: f.x, y: f.y }];
    }
  }
  return { vertices: out, ok: out.length >= 2 };
}

function closedLoopFromVertices(verts: readonly { x: number; y: number }[]): boolean {
  if (verts.length < 3) return false;
  const f = verts[0]!;
  const l = verts[verts.length - 1]!;
  return Math.hypot(f.x - l.x, f.y - l.y) < LW_POLY_EPS;
}

const DXF_ARC_IMPORT_MAX_SEGMENTS = 48;

/**
 * DXF ARC: angles 50/51 are degrees, 0° = +X, CCW positive; arc runs CCW from start to end.
 * When start equals end, treat as a full circle (common convention).
 */
function dxfArcSweepRadians(startDeg: number, endDeg: number): number {
  if (!Number.isFinite(startDeg) || !Number.isFinite(endDeg)) return 0;
  if (Math.abs(startDeg - endDeg) < 1e-9) return 2 * Math.PI;
  const s = (startDeg * Math.PI) / 180;
  const e = (endDeg * Math.PI) / 180;
  let sweep = e - s;
  while (sweep <= 1e-15) sweep += 2 * Math.PI;
  while (sweep > 2 * Math.PI + 1e-12) sweep -= 2 * Math.PI;
  return sweep;
}

function tessellateDxfArcToVertices(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): { x: number; y: number }[] {
  if (!Number.isFinite(cx * cy * r) || r <= LW_POLY_EPS) return [];
  const startRad = (startDeg * Math.PI) / 180;
  const sweep = dxfArcSweepRadians(startDeg, endDeg);
  const steps = Math.max(
    2,
    Math.min(DXF_ARC_IMPORT_MAX_SEGMENTS, Math.ceil(Math.abs(sweep) / (Math.PI / 24))),
  );
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const ang = startRad + sweep * t;
    pts.push({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  }
  return dedupeConsecutiveVerticesXY(pts);
}

const DXF_ELLIPSE_FULL_SPAN_TOL = 0.08;

function normalizeEllipseParamSpan(paramStart: number, paramEnd: number): number {
  let span = paramEnd - paramStart;
  while (span <= 1e-15) span += 2 * Math.PI;
  while (span > 2 * Math.PI + 1e-12) span -= 2 * Math.PI;
  return span;
}

/** DXF ELLIPSE parametric spline: P(t) = center + cos(t)·major + sin(t)·ratio·(-majorY, majorX). */
function tessellateDxfEllipseArcToVertices(
  cx: number,
  cy: number,
  vx: number,
  vy: number,
  ratio: number,
  paramStart: number,
  paramEnd: number,
): { x: number; y: number }[] {
  const minorX = -vy * ratio;
  const minorY = vx * ratio;
  const span = normalizeEllipseParamSpan(paramStart, paramEnd);
  const steps = Math.max(
    2,
    Math.min(DXF_ARC_IMPORT_MAX_SEGMENTS, Math.ceil(Math.abs(span) / (Math.PI / 24))),
  );
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = paramStart + (span * i) / steps;
    const c = Math.cos(t);
    const s = Math.sin(t);
    pts.push({ x: cx + c * vx + s * minorX, y: cy + c * vy + s * minorY });
  }
  return dedupeConsecutiveVerticesXY(pts);
}

/** Advance from `j` (typically at a code-0 entity) to the pair index after the next SEQEND subgroup (or EOF). */
function skipPolylineTailToSeqEnd(pairs: ParsedDxfPair[], j: number): number {
  let k = j;
  while (k < pairs.length) {
    const p = pairs[k]!;
    if (p.code === 0 && p.value === "SEQEND") {
      return consumeEntityFieldsAt(pairs, k + 1).next;
    }
    k++;
  }
  return pairs.length;
}

/**
 * Scan ENTITIES subgroup for LWPOLYLINE (repeating codes 10/20 vertices; optional 42 bulge per outgoing segment).
 * Returns parsed vertices and index of the next code-0 entity opener (or EOF).
 */
function consumeLwPolylineVerticesAt(
  pairs: ParsedDxfPair[],
  start: number,
): { vertices: { x: number; y: number }[]; next: number; ok: boolean } {
  let j = start;
  let flags70 = 0;
  let pendingX: number | undefined;
  const verts: { x: number; y: number }[] = [];
  const bulges: number[] = [];

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;

    switch (p.code) {
      case 70:
        flags70 = Number(String(p.value).trim()) || 0;
        break;
      case 10: {
        const x = Number(String(p.value).trim());
        pendingX = Number.isFinite(x) ? x : undefined;
        break;
      }
      case 20: {
        if (pendingX !== undefined) {
          const y = Number(String(p.value).trim());
          if (Number.isFinite(y)) {
            verts.push({ x: pendingX, y });
            bulges.push(0);
          }
          pendingX = undefined;
        }
        break;
      }
      case 42: {
        const bv = Number(String(p.value).trim());
        if (verts.length > 0 && Number.isFinite(bv)) bulges[verts.length - 1] = bv;
        break;
      }
      default:
        break;
    }
    j++;
  }

  const closed = (flags70 & 1) !== 0;
  while (bulges.length < verts.length) bulges.push(0);
  const expanded = expandVerticesWithBulges(verts, bulges, closed);
  const fin = finalizeImportedPolyVertices(expanded, closed);
  return { vertices: fin.vertices, next: j, ok: fin.ok };
}

/** Classic POLYLINE header then VERTEX … VERTEX … SEQEND (path, polyface mesh, or polygon mesh). */
function consumeOldPolylineVertexSeqAt(
  pairs: ParsedDxfPair[],
  headerBodyStart: number,
): { loops: { x: number; y: number }[][]; next: number; ok: boolean; isMesh: boolean } {
  const header = consumeEntityFieldsAt(pairs, headerBodyStart);
  const flags70 = Number(String(header.fields.get(70) ?? "0").trim()) || 0;
  const closed = (flags70 & 1) !== 0;
  const isPolyface = (flags70 & DXF_POLYLINE_FLAG_POLYFACE_MESH) !== 0;
  const isPolygonMesh =
    !isPolyface && (flags70 & DXF_POLYLINE_FLAG_POLYGON_MESH) !== 0;

  const pathVerts: { x: number; y: number }[] = [];
  const bulges: number[] = [];
  const meshVerts: { x: number; y: number }[] = [];
  const faceGroups: number[][] = [];
  let j = header.next;

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code !== 0) {
      j++;
      continue;
    }
    if (p.value === "SEQEND") {
      j = consumeEntityFieldsAt(pairs, j + 1).next;
      break;
    }
    if (p.value === "VERTEX") {
      const vf = consumeEntityFieldsAt(pairs, j + 1);
      j = vf.next;
      const vf70 = Number(String(vf.fields.get(70) ?? "0").trim()) || 0;

      if (isPolyface && (vf70 & DXF_VERTEX_FLAG_FACE_RECORD) !== 0) {
        const face = faceIndicesFromVertexFields(vf.fields);
        if (face.length >= 3) faceGroups.push(face);
        continue;
      }

      const x = num(vf.fields, 10);
      const y = num(vf.fields, 20);
      if (x === undefined || y === undefined || !Number.isFinite(x * y)) continue;

      if (isPolyface || isPolygonMesh) {
        meshVerts.push({ x, y });
        continue;
      }

      const b = num(vf.fields, 42) ?? 0;
      pathVerts.push({ x, y });
      bulges.push(Number.isFinite(b) ? b : 0);
      continue;
    }
    j = skipPolylineTailToSeqEnd(pairs, j);
    break;
  }

  if (isPolyface) {
    const loops = resolvePolyfaceMeshLoops(meshVerts, faceGroups);
    return { loops, next: j, ok: loops.length > 0, isMesh: true };
  }

  if (isPolygonMesh) {
    const rows = num(header.fields, 71) ?? 2;
    const cols = num(header.fields, 72) ?? 2;
    const loops = polygonMeshGridLoops(rows, cols, meshVerts);
    return { loops, next: j, ok: loops.length > 0, isMesh: true };
  }

  while (bulges.length < pathVerts.length) bulges.push(0);
  const expanded = expandVerticesWithBulges(pathVerts, bulges, closed);
  const fin = finalizeImportedPolyVertices(expanded, closed);
  return {
    loops: fin.ok ? [fin.vertices] : [],
    next: j,
    ok: fin.ok,
    isMesh: false,
  };
}

function consumeMtextEntityAt(
  pairs: ParsedDxfPair[],
  start: number,
): { x?: number; y?: number; rotRad?: number; rawText: string; next: number } {
  let j = start;
  const chunks: string[] = [];
  let x: number | undefined;
  let y: number | undefined;
  let rotRad: number | undefined;
  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;
    switch (p.code) {
      case 1:
      case 3:
        chunks.push(p.value);
        break;
      case 10: {
        const v = Number(String(p.value).trim());
        if (Number.isFinite(v)) x = v;
        break;
      }
      case 20: {
        const v = Number(String(p.value).trim());
        if (Number.isFinite(v)) y = v;
        break;
      }
      case 50: {
        const v = Number(String(p.value).trim());
        if (Number.isFinite(v)) rotRad = v;
        break;
      }
      default:
        break;
    }
    j++;
  }
  return { x, y, rotRad, rawText: chunks.join(""), next: j };
}

/** Scan SPLINE subgroup: control points (10/20), fit points (11/21), knots (40), weights (42). */
function consumeSplineEntityAt(
  pairs: ParsedDxfPair[],
  start: number,
): {
  controlPoints: { x: number; y: number }[];
  fitPoints: { x: number; y: number }[];
  knots: number[];
  weights: number[];
  degree: number;
  closed: boolean;
  rational: boolean;
  next: number;
} {
  let j = start;
  let flags70 = 0;
  let degree = 3;
  let pendingCtrlX: number | undefined;
  let pendingFitX: number | undefined;
  const controlPoints: { x: number; y: number }[] = [];
  const fitPoints: { x: number; y: number }[] = [];
  const knots: number[] = [];
  const weights: number[] = [];

  while (j < pairs.length) {
    const p = pairs[j]!;
    if (p.code === 0) break;
    const v = Number(String(p.value).trim());
    switch (p.code) {
      case 70:
        if (Number.isFinite(v)) flags70 = v;
        break;
      case 71:
        if (Number.isFinite(v)) degree = v;
        break;
      case 10:
        if (Number.isFinite(v)) pendingCtrlX = v;
        break;
      case 20: {
        if (pendingCtrlX !== undefined && Number.isFinite(v)) {
          controlPoints.push({ x: pendingCtrlX, y: v });
          pendingCtrlX = undefined;
        }
        break;
      }
      case 11:
        if (Number.isFinite(v)) pendingFitX = v;
        break;
      case 21: {
        if (pendingFitX !== undefined && Number.isFinite(v)) {
          fitPoints.push({ x: pendingFitX, y: v });
          pendingFitX = undefined;
        }
        break;
      }
      case 40:
        if (Number.isFinite(v)) knots.push(v);
        break;
      case 42:
        if (Number.isFinite(v)) weights.push(v);
        break;
      default:
        break;
    }
    j++;
  }

  return {
    controlPoints,
    fitPoints,
    knots,
    weights,
    degree,
    closed: (flags70 & 1) !== 0,
    rational: (flags70 & 4) !== 0,
    next: j,
  };
}

/** Human-readable entity mix for producer import toast. */
export function formatDxfImportEntitySummary(ic: MinimalAsciiDxfImportedCounts): string | null {
  const parts: string[] = [];
  if (ic.line > 0) parts.push(`${ic.line} line${ic.line === 1 ? "" : "s"}`);
  if (ic.circle > 0) parts.push(`${ic.circle} circle${ic.circle === 1 ? "" : "s"}`);
  if (ic.arc > 0) parts.push(`${ic.arc} arc→polyline`);
  if (ic.ellipse > 0) parts.push(`${ic.ellipse} ellipse${ic.ellipse === 1 ? "" : "s"}`);
  if (ic.ellipseArc > 0) parts.push(`${ic.ellipseArc} ellipse arc→polyline`);
  if (ic.spline > 0) parts.push(`${ic.spline} spline→polyline`);
  if (ic.insert > 0) parts.push(`${ic.insert} INSERT→explode`);
  if (ic.polyface > 0) parts.push(`${ic.polyface} polyface mesh`);
  if (ic.hatch > 0) parts.push(`${ic.hatch} HATCH→polyline`);
  if (ic.hatchPatternLine > 0) parts.push(`${ic.hatchPatternLine} hatch pattern line${ic.hatchPatternLine === 1 ? "" : "s"}`);
  if (ic.face > 0) parts.push(`${ic.face} SOLID/3DFACE`);
  if (ic.dimension > 0) parts.push(`${ic.dimension} DIMENSION→TEXT`);
  if (ic.leader > 0) parts.push(`${ic.leader} LEADER/MLEADER`);
  if (ic.wipeout > 0) parts.push(`${ic.wipeout} WIPEOUT`);
  if (ic.constructionLine > 0)
    parts.push(`${ic.constructionLine} RAY/XLINE→line`);
  if (ic.attrib > 0) parts.push(`${ic.attrib} ATTRIB→TEXT`);
  if (ic.text > 0) parts.push(`${ic.text} TEXT`);
  if (ic.mtext > 0) parts.push(`${ic.mtext} MTEXT`);
  if (ic.lwPolyline > 0) parts.push(`${ic.lwPolyline} LWPOLYLINE`);
  if (ic.polyline > 0) parts.push(`${ic.polyline} POLYLINE`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Successful imports per DXF entity family (ARC / partial ELLIPSE tessellate to POLYLINE). */
export type MinimalAsciiDxfImportedCounts = {
  line: number;
  circle: number;
  arc: number;
  ellipse: number;
  ellipseArc: number;
  text: number;
  mtext: number;
  lwPolyline: number;
  polyline: number;
  spline: number;
  insert: number;
  hatch: number;
  hatchPatternLine: number;
  face: number;
  dimension: number;
  leader: number;
  wipeout: number;
  constructionLine: number;
  attrib: number;
  polyface: number;
};

export type MinimalAsciiDxfImportOk = {
  ok: true;
  shapes: Omit<StageDesignShape, "id">[];
  skippedAfterCap: number;
  skippedDegenerate: number;
  skippedUnsupportedEntities: number;
  importedCounts: MinimalAsciiDxfImportedCounts;
};

export type MinimalAsciiDxfImportFail = { ok: false; error: string };

export type MinimalAsciiDxfImportResult = MinimalAsciiDxfImportOk | MinimalAsciiDxfImportFail;

export type ImportMinimalAsciiDxfOpts = {
  maxShapes: number;
  /** Parsed BLOCK catalog — auto-loaded from full DXF when omitted. */
  blockCatalog?: ReadonlyMap<string, DxfBlockDef>;
  /** Block-local → world transform applied to every imported shape in this pass. */
  scopeTransform?: {
    blockBaseX: number;
    blockBaseY: number;
    insert: DxfInsertTransform;
  };
  /** Guards nested INSERT recursion. */
  insertDepth?: number;
};

type DxfImportScratch = {
  shapes: Omit<StageDesignShape, "id">[];
  skippedAfterCap: number;
};

function mergeImportedCounts(
  target: MinimalAsciiDxfImportedCounts,
  src: MinimalAsciiDxfImportedCounts,
): void {
  target.line += src.line;
  target.circle += src.circle;
  target.arc += src.arc;
  target.ellipse += src.ellipse;
  target.ellipseArc += src.ellipseArc;
  target.text += src.text;
  target.mtext += src.mtext;
  target.lwPolyline += src.lwPolyline;
  target.polyline += src.polyline;
  target.spline += src.spline;
  target.insert += src.insert;
  target.hatch += src.hatch;
  target.hatchPatternLine += src.hatchPatternLine;
  target.face += src.face;
  target.dimension += src.dimension;
  target.leader += src.leader;
  target.wipeout += src.wipeout;
  target.constructionLine += src.constructionLine;
  target.attrib += src.attrib;
  target.polyface += src.polyface;
}

function appendImportedDxfShape(
  scratch: DxfImportScratch,
  shape: Omit<StageDesignShape, "id">,
  maxShapes: number,
  scopeTransform: ImportMinimalAsciiDxfOpts["scopeTransform"],
): boolean {
  const out = scopeTransform
    ? transformImportedShapeForBlockInsert(
        shape,
        scopeTransform.blockBaseX,
        scopeTransform.blockBaseY,
        scopeTransform.insert,
      )
    : shape;
  if (scratch.shapes.length >= maxShapes) {
    scratch.skippedAfterCap++;
    return false;
  }
  scratch.shapes.push(out);
  return true;
}

/** ATTRIB followers are already in world coordinates — do not re-apply INSERT transforms. */
function appendImportedDxfAttribText(
  scratch: DxfImportScratch,
  label: string,
  x: number,
  y: number,
  rotationDeg: number,
  maxShapes: number,
): boolean {
  const trimmed = label.trim().slice(0, 400);
  if (trimmed.length === 0) return false;
  if (scratch.shapes.length >= maxShapes) {
    scratch.skippedAfterCap++;
    return false;
  }
  scratch.shapes.push({
    kind: "TEXT",
    x,
    y,
    label: trimmed,
    rotationDeg,
  });
  return true;
}

function appendImportedDxfFaceOutline(
  scratch: DxfImportScratch,
  corners: readonly { x: number; y: number }[],
  maxShapes: number,
  scopeTransform: ImportMinimalAsciiDxfOpts["scopeTransform"],
): boolean {
  if (corners.length < 2) return false;
  if (corners.length === 2) {
    const a = corners[0]!;
    const b = corners[1]!;
    if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < 1e-12) return false;
    appendImportedDxfShape(
      scratch,
      { kind: "LINE", x: a.x, y: a.y, x2: b.x, y2: b.y, rotationDeg: 0 },
      maxShapes,
      scopeTransform,
    );
    return true;
  }
  const fin = finalizeImportedPolyVertices([...corners], true);
  if (!fin.ok || fin.vertices.length < 3) return false;
  const v0 = fin.vertices[0]!;
  appendImportedDxfShape(
    scratch,
    {
      kind: "POLYLINE",
      x: v0.x,
      y: v0.y,
      rotationDeg: 0,
      vertices: fin.vertices.map((p) => ({ x: p.x, y: p.y })),
      fill: "rgba(148,163,184,0.08)",
    },
    maxShapes,
    scopeTransform,
  );
  return true;
}

function dxfEntityPairsToAsciiBody(pairs: readonly ParsedDxfPair[], start: number, end: number): string {
  const lines: string[] = [];
  for (let i = start; i < end; i++) {
    const p = pairs[i]!;
    lines.push(String(p.code));
    lines.push(p.value);
  }
  return lines.join("\r\n");
}

function wrapDxfEntitiesBodyAsMinimalFile(body: string): string {
  return ["0", "SECTION", "2", "ENTITIES", body, "0", "ENDSEC", "0", "EOF", ""].join("\r\n");
}

/**
 * Classic POLYLINE/VERTEX/SEQEND imports open paths, polyface meshes (face records → closed loops), and polygon meshes (M×N grid → quad faces).
 * Coordinates match diagram linear units (feet / meters) — same convention as {@link buildStageDesignDxf}.
 * Polyline entities map to POLYLINE shapes (DXF bulge 42 arcs tessellated to vertices).
 * ARC entities tessellate to open POLYLINE paths (degrees on codes 50/51).
 * SPLINE entities tessellate to POLYLINE (fit points when present, else B-spline through control points).
 * Full ELLIPSE spline (codes 41/42 omitted or spanning ~2π) maps to {@link StageDesignShape} **ELLIPSE**; partial elliptical arcs increment {@link MinimalAsciiDxfImportOk.skippedUnsupportedEntities}.
 * MTEXT maps to TEXT after normalizing markup (paragraph/tabs/fields — see stripMinimalMtextMarkup).
 * INSERT explodes BLOCK definitions (when a BLOCKS section is present) up to depth 2, including column/row arrays (codes 70/71 + spacing); visible **ATTRIB** followers import as **TEXT** (world coordinates).
 * HATCH boundary loops import as closed **POLYLINE** shapes (solid fills get a light default fill).
 * Binary DXF (AutoCAD sentinel) is decoded before entity import.
 * SOLID / TRACE / 3DFACE import as closed **POLYLINE** outlines (light fill) or **LINE** when only two corners.
 * DIMENSION imports override text (code 1) as **TEXT** at the text midpoint when present.
 * LEADER / MLEADER import vertex paths as open **POLYLINE** plus annotation **TEXT** when present
 * (MLEADER nested **LEADER_LINE** sections parsed separately).
 * WIPEOUT clip boundaries import as closed **POLYLINE** outlines.
 * RAY / XLINE import as finite **LINE** segments (clipped construction geometry).
 * Ignores layers and Z where XY geometry suffices.
 * Callers assign id, layerId, and run clampShape.
 */
export function importDxfEntities(
  input: string | ArrayBuffer | Uint8Array,
  opts: ImportMinimalAsciiDxfOpts,
): MinimalAsciiDxfImportResult {
  const parsedFile = parseDxfFileToPairs(input);
  if (!parsedFile.ok) return { ok: false, error: parsedFile.error };
  return importDxfEntitiesFromPairs(parsedFile.pairs, opts);
}

/** @deprecated Alias — accepts ASCII string; prefer {@link importDxfEntities} for binary files. */
export function importMinimalAsciiDxfEntities(
  text: string,
  opts: ImportMinimalAsciiDxfOpts,
): MinimalAsciiDxfImportResult {
  return importDxfEntities(text, opts);
}

function importDxfEntitiesFromPairs(
  pairs: ParsedDxfPair[],
  opts: ImportMinimalAsciiDxfOpts,
): MinimalAsciiDxfImportResult {
  if (pairs.length < 8) return { ok: false, error: "DXF file is too short to parse." };

  const blockCatalog = opts.blockCatalog ?? parseDxfBlockCatalog(pairs);
  const insertDepth = opts.insertDepth ?? 0;

  let i = findEntitiesSectionStart(pairs);
  if (i < 0) {
    /** Some exporters omit SECTION wrappers — scan for ENTITIES sentinel only. */
    const idx = pairs.findIndex((p) => p.code === 2 && p.value === "ENTITIES");
    i = idx >= 0 ? idx + 1 : -1;
  }
  if (i < 0)
    return { ok: false, error: "No ENTITIES section found (expects ASCII DXF with diagram entities)." };

  const scratch: DxfImportScratch = { shapes: [], skippedAfterCap: 0 };
  let skippedDegenerate = 0;
  let skippedUnsupportedEntities = 0;
  const importedCounts: MinimalAsciiDxfImportedCounts = {
    line: 0,
    circle: 0,
    arc: 0,
    ellipse: 0,
    ellipseArc: 0,
    text: 0,
    mtext: 0,
    lwPolyline: 0,
    polyline: 0,
    spline: 0,
    insert: 0,
    hatch: 0,
    hatchPatternLine: 0,
    face: 0,
    dimension: 0,
    leader: 0,
    wipeout: 0,
    constructionLine: 0,
    attrib: 0,
    polyface: 0,
  };

  while (i < pairs.length) {
    const ent = pairs[i]!;
    if (ent.code === 0 && ent.value === "ENDSEC") break;
    if (ent.code !== 0) {
      i++;
      continue;
    }
    const typ = ent.value;
    i++;

    if (typ === "ATTDEF" || typ === "SEQEND") {
      i = consumeEntityFieldsAt(pairs, i).next;
      continue;
    }

    if (typ === "ATTRIB") {
      const parsed = parseDxfAttribEntityAt(pairs, i);
      i = parsed.next;
      if (
        parsed.attrib?.visible &&
        appendImportedDxfAttribText(
          scratch,
          parsed.attrib.label,
          parsed.attrib.x,
          parsed.attrib.y,
          parsed.attrib.rotationDeg,
          opts.maxShapes,
        )
      ) {
        importedCounts.attrib++;
      }
      continue;
    }

    if (typ === "LWPOLYLINE") {
      const lw = consumeLwPolylineVerticesAt(pairs, i);
      i = lw.next;
      if (scratch.shapes.length >= opts.maxShapes) {
        scratch.skippedAfterCap++;
        continue;
      }
      if (!lw.ok) {
        skippedDegenerate++;
        continue;
      }
      const v0 = lw.vertices[0]!;
      appendImportedDxfShape(
        scratch,
        {
          kind: "POLYLINE",
          x: v0.x,
          y: v0.y,
          rotationDeg: 0,
          vertices: lw.vertices.map((p) => ({ x: p.x, y: p.y })),
        },
        opts.maxShapes,
        opts.scopeTransform,
      );
      importedCounts.lwPolyline++;
      continue;
    }

    if (typ === "POLYLINE") {
      const poly = consumeOldPolylineVertexSeqAt(pairs, i);
      i = poly.next;
      if (!poly.ok || poly.loops.length === 0) {
        skippedDegenerate++;
        continue;
      }
      let importedFromMesh = false;
      for (const loop of poly.loops) {
        if (scratch.shapes.length >= opts.maxShapes) {
          scratch.skippedAfterCap++;
          break;
        }
        const fin = finalizeImportedPolyVertices(loop, poly.isMesh || closedLoopFromVertices(loop));
        if (!fin.ok) continue;
        const v0 = fin.vertices[0]!;
        appendImportedDxfShape(
          scratch,
          {
            kind: "POLYLINE",
            x: v0.x,
            y: v0.y,
            rotationDeg: 0,
            vertices: fin.vertices.map((p) => ({ x: p.x, y: p.y })),
          },
          opts.maxShapes,
          opts.scopeTransform,
        );
        importedCounts.polyline++;
        importedFromMesh = poly.isMesh;
      }
      if (importedFromMesh) importedCounts.polyface++;
      continue;
    }

    if (typ === "SPLINE") {
      const sp = consumeSplineEntityAt(pairs, i);
      i = sp.next;
      if (scratch.shapes.length >= opts.maxShapes) {
        scratch.skippedAfterCap++;
        continue;
      }
      const rawVerts = tessellateDxfSplineToVertices({
        controlPoints: sp.controlPoints,
        fitPoints: sp.fitPoints,
        knots: sp.knots,
        weights: sp.weights,
        degree: sp.degree,
        closed: sp.closed,
        rational: sp.rational,
      });
      const fin = finalizeImportedPolyVertices(rawVerts, sp.closed);
      if (!fin.ok) {
        skippedDegenerate++;
        continue;
      }
      const v0 = fin.vertices[0]!;
      appendImportedDxfShape(
        scratch,
        {
          kind: "POLYLINE",
          x: v0.x,
          y: v0.y,
          rotationDeg: 0,
          vertices: fin.vertices.map((p) => ({ x: p.x, y: p.y })),
        },
        opts.maxShapes,
        opts.scopeTransform,
      );
      importedCounts.spline++;
      continue;
    }

    if (typ === "HATCH") {
      const hat = parseDxfHatchBoundaryLoops(pairs, i);
      i = hat.next;
      if (hat.loops.length === 0) {
        skippedDegenerate++;
        continue;
      }
      let importedLoop = false;
      for (const loop of hat.loops) {
        if (scratch.shapes.length >= opts.maxShapes) {
          scratch.skippedAfterCap++;
          break;
        }
        const fin = finalizeImportedPolyVertices(loop.vertices, loop.closed);
        if (!fin.ok) continue;
        const v0 = fin.vertices[0]!;
        const shape: Omit<StageDesignShape, "id"> = {
          kind: "POLYLINE",
          x: v0.x,
          y: v0.y,
          rotationDeg: 0,
          vertices: fin.vertices.map((p) => ({ x: p.x, y: p.y })),
        };
        if (hat.solidFill) shape.fill = "rgba(148,163,184,0.22)";
        else if (hat.pattern) shape.fill = "rgba(148,163,184,0.06)";
        appendImportedDxfShape(scratch, shape, opts.maxShapes, opts.scopeTransform);
        importedLoop = true;
        if (hat.pattern && fin.vertices.length >= 3) {
          const patternSegs = generateDxfHatchPatternLineSegments(fin.vertices, hat.pattern);
          for (const seg of patternSegs) {
            if (scratch.shapes.length >= opts.maxShapes) {
              scratch.skippedAfterCap++;
              break;
            }
            appendImportedDxfShape(
              scratch,
              {
                kind: "LINE",
                x: seg.x1,
                y: seg.y1,
                x2: seg.x2,
                y2: seg.y2,
                rotationDeg: 0,
                stroke: "rgba(100,116,139,0.65)",
              },
              opts.maxShapes,
              opts.scopeTransform,
            );
            importedCounts.hatchPatternLine++;
          }
        }
      }
      if (importedLoop) importedCounts.hatch++;
      else skippedDegenerate++;
      continue;
    }

    if (typ === "MTEXT") {
      const mt = consumeMtextEntityAt(pairs, i);
      i = mt.next;
      if (scratch.shapes.length >= opts.maxShapes) {
        scratch.skippedAfterCap++;
        continue;
      }
      const label = stripMinimalMtextMarkup(mt.rawText).slice(0, 400);
      const x = mt.x;
      const y = mt.y;
      if (x === undefined || y === undefined || !Number.isFinite(x * y) || label.length === 0) {
        skippedDegenerate++;
        continue;
      }
      const rotRad = mt.rotRad;
      const rotationDegRaw =
        rotRad !== undefined && Number.isFinite(rotRad) ? (rotRad * 180) / Math.PI : 0;
      const rotationDeg = Math.round(rotationDegRaw * 10_000) / 10_000;
      appendImportedDxfShape(
        scratch,
        {
          kind: "TEXT",
          x,
          y,
          label,
          rotationDeg,
        },
        opts.maxShapes,
        opts.scopeTransform,
      );
      importedCounts.mtext++;
      continue;
    }

    if (typ === "SOLID" || typ === "TRACE" || typ === "3DFACE") {
      const faceEnt = consumeEntityFieldsAt(pairs, i);
      i = faceEnt.next;
      if (scratch.shapes.length >= opts.maxShapes) {
        scratch.skippedAfterCap++;
        continue;
      }
      const corners = dxfFaceCornersFromFields(faceEnt.fields);
      if (appendImportedDxfFaceOutline(scratch, corners, opts.maxShapes, opts.scopeTransform)) {
        importedCounts.face++;
      } else skippedDegenerate++;
      continue;
    }

    if (typ === "DIMENSION") {
      const dimEnt = consumeEntityFieldsAt(pairs, i);
      i = dimEnt.next;
      if (scratch.shapes.length >= opts.maxShapes) {
        scratch.skippedAfterCap++;
        continue;
      }
      const dim = dxfDimensionTextFromFields(dimEnt.fields);
      if (
        dim &&
        appendImportedDxfShape(
          scratch,
          {
            kind: "TEXT",
            x: dim.x,
            y: dim.y,
            label: dim.label,
            rotationDeg: dim.rotationDeg,
          },
          opts.maxShapes,
          opts.scopeTransform,
        )
      ) {
        importedCounts.dimension++;
      } else skippedDegenerate++;
      continue;
    }

    if (typ === "LEADER") {
      const lead = consumeDxfVertexChainEntityAt(pairs, i);
      i = lead.next;
      if (scratch.shapes.length >= opts.maxShapes) {
        scratch.skippedAfterCap++;
        continue;
      }
      let importedLeader = false;
      if (lead.vertices.length >= 2) {
        const fin = finalizeImportedPolyVertices(lead.vertices, false);
        if (fin.ok) {
          const v0 = fin.vertices[0]!;
          if (
            appendImportedDxfShape(
              scratch,
              {
                kind: "POLYLINE",
                x: v0.x,
                y: v0.y,
                rotationDeg: 0,
                vertices: fin.vertices.map((p) => ({ x: p.x, y: p.y })),
              },
              opts.maxShapes,
              opts.scopeTransform,
            )
          ) {
            importedLeader = true;
          }
        }
      }
      const label = dxfAnnotationLabelFromEntity(lead.fields, lead.mtext304);
      const textPos = dxfAnnotationTextPositionFromEntity(lead.fields, lead.vertices);
      if (
        label.length > 0 &&
        textPos &&
        appendImportedDxfShape(
          scratch,
          {
            kind: "TEXT",
            x: textPos.x,
            y: textPos.y,
            label,
            rotationDeg: dxfAnnotationRotationDegFromFields(lead.fields),
          },
          opts.maxShapes,
          opts.scopeTransform,
        )
      ) {
        importedLeader = true;
      }
      if (importedLeader) importedCounts.leader++;
      else skippedDegenerate++;
      continue;
    }

    if (typ === "MLEADER") {
      const entityStart = i;
      const ml = consumeDxfMleaderEntityAt(pairs, i);
      i = ml.next;
      if (scratch.shapes.length >= opts.maxShapes) {
        scratch.skippedAfterCap++;
        continue;
      }
      let importedLeader = false;
      let pathSets = ml.leaderLines;
      let labelFields = ml.fields;
      let labelStrings = ml.labels;
      if (pathSets.length === 0) {
        const fb = consumeDxfVertexChainEntityAt(pairs, entityStart, { capture304: true });
        if (fb.vertices.length >= 2) pathSets = [fb.vertices];
        if (labelStrings.length === 0) {
          labelFields = fb.fields;
          labelStrings = fb.mtext304;
        }
      }
      for (const path of pathSets) {
        if (path.length < 2) continue;
        const fin = finalizeImportedPolyVertices(path, false);
        if (!fin.ok) continue;
        const v0 = fin.vertices[0]!;
        if (
          appendImportedDxfShape(
            scratch,
            {
              kind: "POLYLINE",
              x: v0.x,
              y: v0.y,
              rotationDeg: 0,
              vertices: fin.vertices.map((p) => ({ x: p.x, y: p.y })),
            },
            opts.maxShapes,
            opts.scopeTransform,
          )
        ) {
          importedLeader = true;
        }
      }
      const label =
        dxfMleaderLabelFromParse(labelStrings, labelFields) ||
        dxfAnnotationLabelFromEntity(labelFields, labelStrings);
      const textPos = dxfMleaderTextPositionFromParse(labelFields, pathSets);
      if (
        label.length > 0 &&
        textPos &&
        appendImportedDxfShape(
          scratch,
          {
            kind: "TEXT",
            x: textPos.x,
            y: textPos.y,
            label,
            rotationDeg: dxfMleaderRotationDegFromFields(labelFields),
          },
          opts.maxShapes,
          opts.scopeTransform,
        )
      ) {
        importedLeader = true;
      }
      if (importedLeader) importedCounts.leader++;
      else skippedDegenerate++;
      continue;
    }

    if (typ === "WIPEOUT") {
      const wipe = consumeDxfVertexChainEntityAt(pairs, i);
      i = wipe.next;
      if (scratch.shapes.length >= opts.maxShapes) {
        scratch.skippedAfterCap++;
        continue;
      }
      const corners = dxfWipeoutCornersFromEntity(wipe.fields, wipe.vertices);
      if (appendImportedDxfFaceOutline(scratch, corners, opts.maxShapes, opts.scopeTransform)) {
        importedCounts.wipeout++;
      } else skippedDegenerate++;
      continue;
    }

    if (typ === "INSERT") {
      const parsed = parseDxfInsertEntityAt(pairs, i);
      const followers = consumeDxfInsertAttribFollowersAt(pairs, parsed?.next ?? i);
      i = followers.next;
      if (!parsed || parsed.instances.length === 0 || !parsed.blockName || insertDepth >= 2) {
        skippedUnsupportedEntities++;
        continue;
      }
      const block = blockCatalog.get(parsed.blockName.toUpperCase());
      if (!block) {
        skippedUnsupportedEntities++;
        continue;
      }
      let explodedAny = false;
      for (const insert of parsed.instances) {
        if (scratch.shapes.length >= opts.maxShapes) {
          scratch.skippedAfterCap++;
          break;
        }
        const body = dxfEntityPairsToAsciiBody(pairs, block.entityStart, block.entityEnd);
        const sub = importMinimalAsciiDxfEntities(wrapDxfEntitiesBodyAsMinimalFile(body), {
          maxShapes: opts.maxShapes - scratch.shapes.length,
          blockCatalog,
          scopeTransform: {
            blockBaseX: block.baseX,
            blockBaseY: block.baseY,
            insert,
          },
          insertDepth: insertDepth + 1,
        });
        if (!sub.ok) continue;
        for (const s of sub.shapes) {
          if (scratch.shapes.length >= opts.maxShapes) {
            scratch.skippedAfterCap++;
            break;
          }
          scratch.shapes.push(s);
        }
        skippedDegenerate += sub.skippedDegenerate;
        skippedUnsupportedEntities += sub.skippedUnsupportedEntities;
        scratch.skippedAfterCap += sub.skippedAfterCap;
        mergeImportedCounts(importedCounts, sub.importedCounts);
        explodedAny = true;
      }
      for (const att of followers.attribs) {
        if (
          appendImportedDxfAttribText(
            scratch,
            att.label,
            att.x,
            att.y,
            att.rotationDeg,
            opts.maxShapes,
          )
        ) {
          importedCounts.attrib++;
        }
      }
      if (explodedAny) importedCounts.insert++;
      else skippedUnsupportedEntities++;
      continue;
    }

    const { fields, next } = consumeEntityFieldsAt(pairs, i);

    if (scratch.shapes.length >= opts.maxShapes) {
      if (typ !== "ENDSEC") scratch.skippedAfterCap++;
      i = next;
      continue;
    }

    switch (typ) {
      case "LINE": {
        const x1 = num(fields, 10);
        const y1 = num(fields, 20);
        const x2 = num(fields, 11);
        const y2 = num(fields, 21);
        if (
          x1 === undefined ||
          y1 === undefined ||
          x2 === undefined ||
          y2 === undefined ||
          !Number.isFinite(x1 * y1 * x2 * y2)
        ) {
          skippedDegenerate++;
          break;
        }
        const dx = x2 - x1;
        const dy = y2 - y1;
        if (dx * dx + dy * dy < 1e-12) {
          skippedDegenerate++;
          break;
        }
        appendImportedDxfShape(
          scratch,
          {
            kind: "LINE",
            x: x1,
            y: y1,
            x2,
            y2,
            rotationDeg: 0,
          },
          opts.maxShapes,
          opts.scopeTransform,
        );
        importedCounts.line++;
        break;
      }
      case "CIRCLE": {
        const cx = num(fields, 10);
        const cy = num(fields, 20);
        const r = num(fields, 40);
        if (cx === undefined || cy === undefined || r === undefined || !Number.isFinite(cx * cy * r) || r <= 1e-9) {
          skippedDegenerate++;
          break;
        }
        appendImportedDxfShape(
          scratch,
          {
            kind: "ELLIPSE",
            x: cx,
            y: cy,
            width: r,
            height: r,
            rotationDeg: 0,
          },
          opts.maxShapes,
          opts.scopeTransform,
        );
        importedCounts.circle++;
        break;
      }
      case "ARC": {
        const cx = num(fields, 10);
        const cy = num(fields, 20);
        const r = num(fields, 40);
        const startDeg = num(fields, 50);
        const endDeg = num(fields, 51);
        if (
          cx === undefined ||
          cy === undefined ||
          r === undefined ||
          startDeg === undefined ||
          endDeg === undefined ||
          !Number.isFinite(cx) ||
          !Number.isFinite(cy) ||
          !Number.isFinite(r) ||
          !Number.isFinite(startDeg) ||
          !Number.isFinite(endDeg) ||
          r <= LW_POLY_EPS
        ) {
          skippedDegenerate++;
          break;
        }
        const rawVerts = tessellateDxfArcToVertices(cx, cy, r, startDeg, endDeg);
        const fin = finalizeImportedPolyVertices(rawVerts, false);
        if (!fin.ok) {
          skippedDegenerate++;
          break;
        }
        const v0 = fin.vertices[0]!;
        appendImportedDxfShape(
          scratch,
          {
            kind: "POLYLINE",
            x: v0.x,
            y: v0.y,
            rotationDeg: 0,
            vertices: fin.vertices.map((p) => ({ x: p.x, y: p.y })),
          },
          opts.maxShapes,
          opts.scopeTransform,
        );
        importedCounts.arc++;
        break;
      }
      case "ELLIPSE": {
        const cx = num(fields, 10);
        const cy = num(fields, 20);
        const vx = num(fields, 11);
        const vy = num(fields, 21);
        const ratio = num(fields, 40);
        const paramStart = num(fields, 41);
        const paramEnd = num(fields, 42);
        if (
          cx === undefined ||
          cy === undefined ||
          vx === undefined ||
          vy === undefined ||
          ratio === undefined ||
          !Number.isFinite(cx) ||
          !Number.isFinite(cy) ||
          !Number.isFinite(vx) ||
          !Number.isFinite(vy) ||
          !Number.isFinite(ratio)
        ) {
          skippedDegenerate++;
          break;
        }
        const a = Math.hypot(vx, vy);
        if (a <= LW_POLY_EPS || ratio <= 1e-15 || ratio > 1 + 1e-6) {
          skippedDegenerate++;
          break;
        }
        const t0 = paramStart ?? 0;
        const t1 = paramEnd ?? 2 * Math.PI;
        const span =
          paramStart !== undefined && paramEnd !== undefined && Number.isFinite(t1 - t0)
            ? normalizeEllipseParamSpan(t0, t1)
            : 2 * Math.PI;

        if (Math.abs(span - 2 * Math.PI) > DXF_ELLIPSE_FULL_SPAN_TOL) {
          const rawVerts = tessellateDxfEllipseArcToVertices(cx, cy, vx, vy, ratio, t0, t1);
          const fin = finalizeImportedPolyVertices(rawVerts, false);
          if (!fin.ok) {
            skippedDegenerate++;
            break;
          }
          const v0 = fin.vertices[0]!;
          appendImportedDxfShape(
            scratch,
            {
              kind: "POLYLINE",
              x: v0.x,
              y: v0.y,
              rotationDeg: 0,
              vertices: fin.vertices.map((p) => ({ x: p.x, y: p.y })),
            },
            opts.maxShapes,
            opts.scopeTransform,
          );
          importedCounts.ellipseArc++;
          break;
        }

        const b = ratio * a;
        const rotationDeg = (Math.atan2(vy, vx) * 180) / Math.PI;
        appendImportedDxfShape(
          scratch,
          {
            kind: "ELLIPSE",
            x: cx,
            y: cy,
            width: a,
            height: b,
            rotationDeg,
          },
          opts.maxShapes,
          opts.scopeTransform,
        );
        importedCounts.ellipse++;
        break;
      }
      case "RAY":
      case "XLINE": {
        const seg = dxfConstructionLineSegmentFromFields(fields, typ === "XLINE");
        if (!seg) {
          skippedDegenerate++;
          break;
        }
        appendImportedDxfShape(
          scratch,
          {
            kind: "LINE",
            x: seg.x1,
            y: seg.y1,
            x2: seg.x2,
            y2: seg.y2,
            rotationDeg: 0,
            stroke: "rgba(100,116,139,0.55)",
          },
          opts.maxShapes,
          opts.scopeTransform,
        );
        importedCounts.constructionLine++;
        break;
      }
      case "TEXT": {
        const x = num(fields, 10);
        const y = num(fields, 20);
        const rotRad = num(fields, 50);
        const labelRaw = mergeMultilineText(fields);
        const label = labelRaw.slice(0, 400);
        if (x === undefined || y === undefined || !Number.isFinite(x * y) || label.length === 0) {
          skippedDegenerate++;
          break;
        }
        const rotationDegRaw =
          rotRad !== undefined && Number.isFinite(rotRad) ? (rotRad * 180) / Math.PI : 0;
        const rotationDeg = Math.round(rotationDegRaw * 10_000) / 10_000;
        appendImportedDxfShape(
          scratch,
          {
            kind: "TEXT",
            x,
            y,
            label,
            rotationDeg,
          },
          opts.maxShapes,
          opts.scopeTransform,
        );
        importedCounts.text++;
        break;
      }
      default:
        skippedUnsupportedEntities++;
        break;
    }

    i = next;
  }

  return {
    ok: true,
    shapes: scratch.shapes,
    skippedAfterCap: scratch.skippedAfterCap,
    skippedDegenerate,
    skippedUnsupportedEntities,
    importedCounts,
  };
}
