import type { StageDesignUnit } from "@prisma/client";

import { filterStageDesignDeckPolygonsForExport } from "./stage-design-placements-csv";

import type {
  StageDeckPoint,
  StageDesignCanvas,
  StageDesignFootprint,
  StageDesignPlacement,
  StageDesignShape,
} from "./stage-design-canvas";
import {
  clampFootprint,
  getPlotBoundsFromCanvas,
  resolvePlacementGlyphWorld,
  type PlotWorldBounds,
} from "./stage-design-canvas";
import { stagePlacementRotationPivotWorld, stageShapeRotationPivotWorld } from "./stage-design-shape-rotate";

const LYR_PLOT = "ULSD_PLOT_BND";
const LYR_DECK = "ULSD_DECK";
const LYR_SHAPE = "ULSD_SHAPE";
const LYR_SYM = "ULSD_SYMBOL";

function pushCode(out: string[], code: number, value: string | number): void {
  out.push(String(code));
  out.push(typeof value === "number" ? String(value) : value);
}

function fxy(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(6);
}

function rotateAbout(
  cx: number,
  cy: number,
  px: number,
  py: number,
  deg: number,
): { x: number; y: number } {
  if (deg === 0 || deg === undefined) return { x: px, y: py };
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

function dxfSafeSingleLine(raw: string, max: number): string {
  return raw.replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function dxfSafeMtext(raw: string, max: number): string {
  return raw
    .replace(/\r\n|\r/g, "\n")
    .replace(/\t/g, "\\t")
    .replace(/\n/g, "\\P")
    .replace(/\{/g, "")
    .replace(/\}/g, "")
    .trim()
    .slice(0, max);
}

function pushLongDxfText(out: string[], raw: string, finalCode = 1, extraCode = 3, chunkSize = 240): void {
  const chunks: string[] = [];
  for (let i = 0; i < raw.length; i += chunkSize) chunks.push(raw.slice(i, i + chunkSize));
  if (chunks.length === 0) return;
  for (let i = 0; i < chunks.length - 1; i++) pushCode(out, extraCode, chunks[i]!);
  pushCode(out, finalCode, chunks[chunks.length - 1]!);
}

/** Append DXF LINE in plot XY (linear units match diagram); Z=0. */
export function appendDxfLineWorld(
  out: string[],
  layer: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): void {
  pushCode(out, 0, "LINE");
  pushCode(out, 8, layer);
  pushCode(out, 10, fxy(x1));
  pushCode(out, 20, fxy(y1));
  pushCode(out, 30, "0");
  pushCode(out, 11, fxy(x2));
  pushCode(out, 21, fxy(y2));
  pushCode(out, 31, "0");
}

export function appendDxfCircleWorld(out: string[], layer: string, cx: number, cy: number, r: number): void {
  pushCode(out, 0, "CIRCLE");
  pushCode(out, 8, layer);
  pushCode(out, 10, fxy(cx));
  pushCode(out, 20, fxy(cy));
  pushCode(out, 30, "0");
  pushCode(out, 40, fxy(r));
}

function appendDxfTextWorld(
  out: string[],
  layer: string,
  x: number,
  y: number,
  height: number,
  rotationDeg: number,
  value: string,
): void {
  const t = dxfSafeSingleLine(value, 200);
  if (t.length === 0) return;
  pushCode(out, 0, "TEXT");
  pushCode(out, 8, layer);
  pushCode(out, 10, fxy(x));
  pushCode(out, 20, fxy(y));
  pushCode(out, 30, "0");
  pushCode(out, 40, fxy(height));
  const rotRad = ((rotationDeg ?? 0) * Math.PI) / 180;
  pushCode(out, 50, fxy(rotRad));
  pushCode(out, 1, t);
}

function appendDxfMtextWorld(
  out: string[],
  layer: string,
  x: number,
  y: number,
  height: number,
  rotationDeg: number,
  value: string,
): void {
  const t = dxfSafeMtext(value, 400);
  if (t.length === 0) return;
  pushCode(out, 0, "MTEXT");
  pushCode(out, 100, "AcDbEntity");
  pushCode(out, 8, layer);
  pushCode(out, 100, "AcDbMText");
  pushCode(out, 10, fxy(x));
  pushCode(out, 20, fxy(y));
  pushCode(out, 30, "0");
  pushCode(out, 40, fxy(height));
  pushCode(out, 71, "5");
  const rotRad = ((rotationDeg ?? 0) * Math.PI) / 180;
  pushCode(out, 50, fxy(rotRad));
  pushLongDxfText(out, t);
}

function rectCornersWorld(x: number, y: number, w: number, h: number): StageDeckPoint[] {
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
}

const LW_POLY_EXPORT_EPS = 1e-9;

/**
 * Emit LWPOLYLINE (XY only; bulge omitted). Requires AC1015-class DXF — use buildStageDesignDxf.
 * Closed rings omit the duplicated closing vertex; group 70 bit 1 signals closure.
 */
export function appendLwPolylineWorld(
  out: string[],
  layer: string,
  pts: readonly StageDeckPoint[],
  closed: boolean,
): void {
  const cleaned: StageDeckPoint[] = [];
  for (const p of pts) {
    const last = cleaned[cleaned.length - 1];
    if (
      last &&
      Math.abs(last.x - p.x) < LW_POLY_EXPORT_EPS &&
      Math.abs(last.y - p.y) < LW_POLY_EXPORT_EPS
    ) {
      continue;
    }
    cleaned.push({ x: p.x, y: p.y });
  }

  let verts = cleaned;
  if (closed && verts.length >= 2) {
    const f = verts[0]!;
    const l = verts[verts.length - 1]!;
    if (
      Math.abs(f.x - l.x) < LW_POLY_EXPORT_EPS &&
      Math.abs(f.y - l.y) < LW_POLY_EXPORT_EPS
    ) {
      verts = verts.slice(0, -1);
    }
  }

  if (!closed && verts.length < 2) return;
  if (closed && verts.length < 3) return;

  pushCode(out, 0, "LWPOLYLINE");
  pushCode(out, 100, "AcDbEntity");
  pushCode(out, 8, layer);
  pushCode(out, 100, "AcDbPolyline");
  pushCode(out, 90, verts.length);
  pushCode(out, 70, closed ? 1 : 0);
  for (const p of verts) {
    pushCode(out, 10, fxy(p.x));
    pushCode(out, 20, fxy(p.y));
  }
}

/** Closed polygon ring as one LWPOLYLINE (historical name — previously emitted LINE segments). */
export function appendClosedPolylineLinesWorld(
  out: string[],
  layer: string,
  pts: readonly StageDeckPoint[],
): void {
  appendLwPolylineWorld(out, layer, pts, true);
}

function appendRectRotatedWorld(
  out: string[],
  layer: string,
  x: number,
  y: number,
  w: number,
  h: number,
  rotDeg: number,
): void {
  const piv = stageShapeRotationPivotWorld({
    id: "_",
    kind: "RECT",
    x,
    y,
    width: w,
    height: h,
  } as StageDesignShape);
  const corners = rectCornersWorld(x, y, w, h).map((p) => rotateAbout(piv.wx, piv.wy, p.x, p.y, rotDeg ?? 0));
  appendClosedPolylineLinesWorld(out, layer, corners);
}

function appendEllipseApproxWorld(
  out: string[],
  layer: string,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotDeg: number,
  segments = 36,
): void {
  const rad = ((rotDeg ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const pts: StageDeckPoint[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const lx = rx * Math.cos(t);
    const ly = ry * Math.sin(t);
    const wx = cx + lx * cos - ly * sin;
    const wy = cy + lx * sin + ly * cos;
    pts.push({ x: wx, y: wy });
  }
  appendLwPolylineWorld(out, layer, pts.slice(0, segments), true);
}

function structureBoundsFromFootprint(footprint: StageDesignFootprint): PlotWorldBounds {
  const f = clampFootprint(footprint.width, footprint.depth);
  return { minX: 0, maxX: f.width, minY: 0, maxY: f.depth };
}

function appendPlotBoundsFrame(out: string[], b: PlotWorldBounds): void {
  appendClosedPolylineLinesWorld(out, LYR_PLOT, [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ]);
}

function appendDeckHull(out: string[], footprint: StageDesignFootprint): void {
  const b = structureBoundsFromFootprint(footprint);
  appendClosedPolylineLinesWorld(out, LYR_DECK, [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.maxX, y: b.maxY },
    { x: b.minX, y: b.maxY },
  ]);
}

function appendCustomDeckModules(
  out: string[],
  polys: ReturnType<typeof filterStageDesignDeckPolygonsForExport>,
): void {
  for (const d of polys) {
    const pts = d.points;
    if (!pts || pts.length < 2) continue;
    appendClosedPolylineLinesWorld(out, LYR_DECK, pts);
  }
}

function appendShapeWorld(out: string[], s: StageDesignShape, textHeight: number): void {
  const rot = s.rotationDeg ?? 0;
  switch (s.kind) {
    case "LINE": {
      const x2 = s.x2 ?? s.x;
      const y2 = s.y2 ?? s.y;
      const piv = stageShapeRotationPivotWorld(s);
      const a = rotateAbout(piv.wx, piv.wy, s.x, s.y, rot);
      const b = rotateAbout(piv.wx, piv.wy, x2, y2, rot);
      appendDxfLineWorld(out, LYR_SHAPE, a.x, a.y, b.x, b.y);
      break;
    }
    case "RECT": {
      const w = s.width ?? 6;
      const h = s.height ?? 4;
      appendRectRotatedWorld(out, LYR_SHAPE, s.x, s.y, w, h, rot);
      break;
    }
    case "ELLIPSE": {
      const rx = s.width ?? 4;
      const ry = s.height ?? 3;
      appendEllipseApproxWorld(out, LYR_SHAPE, s.x, s.y, rx, ry, rot);
      break;
    }
    case "POLYLINE": {
      const verts = s.vertices;
      if (!verts || verts.length < 2) break;
      const piv = stageShapeRotationPivotWorld(s);
      const wpts = verts.map((p) => rotateAbout(piv.wx, piv.wy, p.x, p.y, rot));
      appendLwPolylineWorld(out, LYR_SHAPE, wpts, false);
      break;
    }
    case "TEXT": {
      const lab = typeof s.label === "string" ? s.label : "Label";
      if (/\r|\n|\t/.test(lab)) appendDxfMtextWorld(out, LYR_SHAPE, s.x, s.y, textHeight, rot, lab);
      else appendDxfTextWorld(out, LYR_SHAPE, s.x, s.y, textHeight, rot, lab);
      break;
    }
    default:
      break;
  }
}

function appendPlacementWorld(out: string[], p: StageDesignPlacement, unit: StageDesignUnit): void {
  const piv = stagePlacementRotationPivotWorld(p);
  const cx = piv.wx;
  const cy = piv.wy;
  const rot = p.rotationDeg ?? 0;
  const ext = resolvePlacementGlyphWorld(p, unit);

  const mapLocal = (lx: number, ly: number) => rotateAbout(cx, cy, cx + lx, cy + ly, rot);

  switch (p.kind) {
    case "FIXTURE":
    case "WASH_MOVING":
    case "PAR_STATIC":
    case "UPLIGHT":
      appendDxfCircleWorld(out, LYR_SYM, cx, cy, Math.max(0.05, ext.fixtureR));
      break;
    case "BEAM_MOVING": {
      const rx = Math.max(0.05, ext.fixtureR);
      const ry = Math.max(0.04, ext.fixtureR * 0.52);
      appendEllipseApproxWorld(out, LYR_SYM, cx, cy, rx, ry, rot);
      break;
    }
    case "TRUSS": {
      const half = Math.max(0.25, ext.trussHalfLen);
      const a = mapLocal(-half, 0);
      const b = mapLocal(half, 0);
      appendDxfLineWorld(out, LYR_SYM, a.x, a.y, b.x, b.y);
      break;
    }
    case "POWER":
    case "POWER_DROP": {
      const H = Math.max(0.25, ext.powerTriH);
      const halfBase = H * 0.58;
      const p0 = mapLocal(0, -H * 0.65);
      const p1 = mapLocal(halfBase, H * 0.35);
      const p2 = mapLocal(-halfBase, H * 0.35);
      appendClosedPolylineLinesWorld(out, LYR_SYM, [p0, p1, p2]);
      break;
    }
    case "DECOR": {
      const h = Math.max(0.25, ext.decorHalf);
      const inner = h * 2;
      appendRectRotatedWorld(out, LYR_SYM, cx - h, cy - h, inner, inner, rot);
      break;
    }
    case "LED_WALL":
    case "STRIP_FIXED":
    case "PROJECTOR_SYM": {
      const hw = Math.max(0.25, ext.ledHalfW);
      const hh = Math.max(0.25, ext.ledHalfH);
      appendRectRotatedWorld(out, LYR_SYM, cx - hw, cy - hh, hw * 2, hh * 2, rot);
      if (p.kind === "PROJECTOR_SYM") {
        const rl = Math.max(0.06, Math.min(ext.ledHalfW, ext.ledHalfH) * 0.38);
        appendDxfCircleWorld(out, LYR_SYM, cx, cy, rl);
      }
      break;
    }
    default:
      break;
  }
}

/** Browser download for ASCII DXF (same UX as diagram CSV exports). */
export function triggerAsciiDxfDownload(body: string, filename: string): void {
  const blob = new Blob([body], { type: "application/dxf;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".dxf") ? filename : `${filename}.dxf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export type StageDesignDxfExportOptions = {
  unit: StageDesignUnit;
  canvas: StageDesignCanvas;
};

/**
 * ASCII DXF for CAD hand-off (AutoCAD AC1015-era subset): LINE, CIRCLE, TEXT, LWPOLYLINE entities.
 * XY uses the same diagram linear units (FEET / METERS); Z omitted on lw-polylines (implicit 0).
 * Layers: plot bounds, deck hull, shapes, symbols.
 */
export function buildStageDesignDxf(opts: StageDesignDxfExportOptions): string {
  const { canvas, unit } = opts;
  const margins = canvas.plotMargins;
  const plotB = getPlotBoundsFromCanvas(canvas, margins);
  const insUnits = unit === "METERS" ? 6 : 2;
  const textH = unit === "METERS" ? 0.18 : 0.55;

  const out: string[] = [];

  pushCode(out, 0, "SECTION");
  pushCode(out, 2, "HEADER");
  pushCode(out, 9, "$ACADVER");
  pushCode(out, 1, "AC1015");
  pushCode(out, 9, "$INSUNITS");
  pushCode(out, 70, insUnits);
  pushCode(out, 9, "$EXTMIN");
  pushCode(out, 10, fxy(plotB.minX));
  pushCode(out, 20, fxy(plotB.minY));
  pushCode(out, 30, "0");
  pushCode(out, 9, "$EXTMAX");
  pushCode(out, 10, fxy(plotB.maxX));
  pushCode(out, 20, fxy(plotB.maxY));
  pushCode(out, 30, "0");
  pushCode(out, 0, "ENDSEC");

  const layersMeta = [
    { name: LYR_PLOT, color: 8 },
    { name: LYR_DECK, color: 40 },
    { name: LYR_SHAPE, color: 131 },
    { name: LYR_SYM, color: 3 },
  ];

  pushCode(out, 0, "SECTION");
  pushCode(out, 2, "TABLES");

  pushCode(out, 0, "TABLE");
  pushCode(out, 2, "LTYPE");
  pushCode(out, 70, "1");
  pushCode(out, 0, "LTYPE");
  pushCode(out, 2, "CONTINUOUS");
  pushCode(out, 70, "0");
  pushCode(out, 3, "Solid line");
  pushCode(out, 72, "65");
  pushCode(out, 73, "0");
  pushCode(out, 40, "0");
  pushCode(out, 0, "ENDTAB");

  pushCode(out, 0, "TABLE");
  pushCode(out, 2, "LAYER");
  pushCode(out, 70, layersMeta.length);

  for (const L of layersMeta) {
    pushCode(out, 0, "LAYER");
    pushCode(out, 2, L.name);
    pushCode(out, 70, "0");
    pushCode(out, 62, L.color);
    pushCode(out, 6, "CONTINUOUS");
  }
  pushCode(out, 0, "ENDTAB");

  pushCode(out, 0, "ENDSEC");

  pushCode(out, 0, "SECTION");
  pushCode(out, 2, "BLOCKS");
  pushCode(out, 0, "ENDSEC");

  const ents: string[] = [];
  appendPlotBoundsFrame(ents, plotB);

  const deckExport = filterStageDesignDeckPolygonsForExport(canvas.deckPolygons);
  if (deckExport.length === 0) appendDeckHull(ents, canvas.footprint);
  else appendCustomDeckModules(ents, deckExport);

  const shapesSorted = [...canvas.shapes].sort((a, b) => a.id.localeCompare(b.id));
  for (const s of shapesSorted) appendShapeWorld(ents, s, textH);

  const plcSorted = [...canvas.placements].sort((a, b) =>
    `${a.kind}\t${a.id}`.localeCompare(`${b.kind}\t${b.id}`),
  );
  for (const p of plcSorted) appendPlacementWorld(ents, p, unit);

  pushCode(out, 0, "SECTION");
  pushCode(out, 2, "ENTITIES");
  out.push(...ents);
  pushCode(out, 0, "ENDSEC");

  pushCode(out, 0, "EOF");
  return `${out.join("\r\n")}\r\n`;
}
