import { StageDesignUnit } from "@prisma/client";

import type { StageDiagramCableRunKind } from "./stage-design-cable-run";
import { sanitizeDiagramCableRunKind } from "./stage-design-cable-run";

import type { StageDiagramLayer } from "./stage-design-diagram-layers";
import { parseDiagramLayersField, reconcileDiagramLayersOnCanvas, sanitizeDiagramEntityLayerId } from "./stage-design-diagram-layers";

/** Stage diagram snapshot — forward-versioned as the editor grows toward full 2D CAD-class capability. */

export const STAGE_DESIGN_SCHEMA_VERSION = 4 as const;

export const STAGE_DESIGN_KIND_LABELS: Record<StageDesignPlacementKind, string> = {
  FIXTURE: "Lighting fixture (generic)",
  WASH_MOVING: "Wash / zoom mover",
  BEAM_MOVING: "Beam / profile mover",
  PAR_STATIC: "PAR / COB static",
  UPLIGHT: "Uplight / ground fixture",
  STRIP_FIXED: "LED strip / batten",
  LED_WALL: "LED surface",
  POWER_DROP: "120V distro drop",
  POWER: "Power / distro hub",
  TRUSS: "Truss segment",
  DECOR: "Décor / scenic block",
  PROJECTOR_SYM: "Video projector",
};

export type StageDesignPlacementKind =
  | "FIXTURE"
  | "WASH_MOVING"
  | "BEAM_MOVING"
  | "PAR_STATIC"
  | "UPLIGHT"
  | "STRIP_FIXED"
  | "LED_WALL"
  | "POWER_DROP"
  | "POWER"
  | "TRUSS"
  | "DECOR"
  | "PROJECTOR_SYM";

const PLACEMENT_KINDS = new Set<StageDesignPlacementKind>([
  "FIXTURE",
  "WASH_MOVING",
  "BEAM_MOVING",
  "PAR_STATIC",
  "UPLIGHT",
  "STRIP_FIXED",
  "LED_WALL",
  "POWER_DROP",
  "POWER",
  "TRUSS",
  "DECOR",
  "PROJECTOR_SYM",
]);

/** Stable palette / legend order — hotkeys **5–9** address the **first five** (`Symbols` toolbar). */
export const STAGE_DESIGN_PLACEMENT_KIND_ORDER = [
  "FIXTURE",
  "WASH_MOVING",
  "BEAM_MOVING",
  "PAR_STATIC",
  "UPLIGHT",
  "STRIP_FIXED",
  "LED_WALL",
  "POWER_DROP",
  "POWER",
  "TRUSS",
  "DECOR",
  "PROJECTOR_SYM",
] as const satisfies readonly StageDesignPlacementKind[];

/** Fixture-style symbols for Fixtures-only BOM CSV slices. */
export const STAGE_DESIGN_FIXTURE_LIKE_KINDS: ReadonlySet<StageDesignPlacementKind> = new Set([
  "FIXTURE",
  "WASH_MOVING",
  "BEAM_MOVING",
  "PAR_STATIC",
  "UPLIGHT",
  "STRIP_FIXED",
  "LED_WALL",
  "PROJECTOR_SYM",
]);

/** Glyph sizing shares circular **fixture radius** extents. */
export const STAGE_DESIGN_KINDS_USING_FIXTURE_GLYPH_RADIUS: ReadonlySet<StageDesignPlacementKind> = new Set([
  "FIXTURE",
  "WASH_MOVING",
  "BEAM_MOVING",
  "PAR_STATIC",
  "UPLIGHT",
]);

/** DMX universe/channel pair is allowed on automated-lights / LED strip / LED surfaces — not power‑only or projector rows. */
export function placementKindAllowsDmxEquipment(kind: StageDesignPlacementKind): boolean {
  return (
    STAGE_DESIGN_KINDS_USING_FIXTURE_GLYPH_RADIUS.has(kind) ||
    kind === "STRIP_FIXED" ||
    kind === "LED_WALL"
  );
}

/** Max length for optional cue / purpose / circuit label on symbols (`canvasJson` only). */
export const STAGE_PLACEMENT_EQUIPMENT_ROLE_MAX_CHARS = 96;

/** Max length for optional patch/bay/rack metadata (`canvasJson`). */
export const STAGE_PLACEMENT_EQUIPMENT_PATCH_MAX_CHARS = 64;

/** Max length for optional gel / color metadata (`canvasJson`). */
export const STAGE_PLACEMENT_EQUIPMENT_GEL_MAX_CHARS = 48;

/** Max length for optional fixture inventory / asset id (`canvasJson`). */
export const STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS = 64;

/** Max length for optional beam / personality / data payload note (`canvasJson`). */
export const STAGE_PLACEMENT_EQUIPMENT_FIXTURE_PROFILE_MAX_CHARS = 96;

/**
 * Optional cue or DMX addressing for floor-plot symbols — **v3.1 typed equipment** slice.
 * Persisted on each {@link StageDesignPlacement} as `equipment` in `canvasJson` (no DB column).
 */
export type StagePlacementEquipment = {
  /** Cue, purpose, circuit, or rigging note (all symbol kinds). */
  role?: string;
  /** Patch bay, distro slot, dimmer rack label, etc. */
  patch?: string;
  /** Gel / color / fixture color documentation. */
  gel?: string;
  /** Fixture inventory barcode / rental asset id (all symbol kinds). */
  fixtureId?: string;
  /** Beam angle, personality name, mode, or short data payload note (all symbol kinds). */
  fixtureProfile?: string;
  /** DMX universe 1…256 (fixtures & LED surfaces only; pair with `dmxChannel`). */
  dmxUniverse?: number;
  /** DMX channel 1…512 within `dmxUniverse`. */
  dmxChannel?: number;
};

export type PlacementGlyphExtents = {
  /** FIXTURE — circle radius */
  fixtureRadius?: number;
  /** POWER — upward triangle height */
  powerTriHeight?: number;
  /** DECOR — half-side of centered square */
  decorHalf?: number;
  /** TRUSS — horizontal half-length from placement center to one end */
  trussHalfLength?: number;
  /** LED_WALL — half width (stage X) / half thickness (stage Y) */
  ledHalfWidth?: number;
  ledHalfHeight?: number;
};

export type StageDesignPlacement = {
  id: string;
  kind: StageDesignPlacementKind;
  /** Plot coordinates: stage deck is [0,width]×[0,depth]; negative Y is downstage (FOH); X can extend past deck with margins. */
  x: number;
  y: number;
  rotationDeg?: number;
  note?: string;
  glyphExtents?: PlacementGlyphExtents;
  /** Optional drafting-style layer (see `diagramLayers` on canvas). Omitted = default “Main” stack. */
  layerId?: string;
  /** Optional cue / DMX metadata (see {@link StagePlacementEquipment}). */
  equipment?: StagePlacementEquipment;
  /**
   * Optional peer magnet isolation tag (see **`peerSnapGroupFilterForManipulator`**).
   * When every moving primitive in a gesture shares exactly one sanitized group and none are untagged,
   * peer-axis snaps latch only to matching peers (cross‑tier compatible).
   */
  peerSnapGroup?: string;
};

export type StageDesignFootprint = {
  width: number;
  depth: number;
};

export type StageDeckPoint = {
  x: number;
  y: number;
};

/** Closed polygon in plot coordinates (deck plane). Vertices ordered; first vertex need not repeat at end. */
export type StageDeckPolygon = {
  id: string;
  points: StageDeckPoint[];
  /** Optional drafting layer for modular deck geometry (synthetic deck rect omits this). */
  layerId?: string;
};

/** Normalized preview-only polygon id when no custom deck modules exist. Never persisted as user-authored. */
export const SYNTHETIC_DECK_RECT_POLYGON_ID = "__deck_rect__" as const;

/** Extra working area around the deck (same units as footprint). */
export type StageDesignPlotMargins = {
  /** Toward audience from downstage edge (FOH, front truss, etc.). */
  downstage: number;
  upstage: number;
  /** Stage left (house right from audience). */
  stageLeft: number;
  /** Stage right (house left). */
  stageRight: number;
};

export type PlotWorldBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

export type StageDesignShapeKind = "RECT" | "ELLIPSE" | "LINE" | "POLYLINE" | "TEXT";

export const STAGE_SHAPE_KIND_LABELS: Record<StageDesignShapeKind, string> = {
  RECT: "Rectangle",
  ELLIPSE: "Ellipse",
  LINE: "Line",
  POLYLINE: "Polyline",
  TEXT: "Text label",
};

export const STAGE_DESIGN_SHAPE_KIND_ORDER = ["RECT", "ELLIPSE", "LINE", "POLYLINE", "TEXT"] as const satisfies readonly StageDesignShapeKind[];

const SHAPE_KINDS = new Set<StageDesignShapeKind>(["RECT", "ELLIPSE", "LINE", "POLYLINE", "TEXT"]);

export type StageDesignShape = {
  id: string;
  kind: StageDesignShapeKind;
  /** Anchor / start (see kind). */
  x: number;
  y: number;
  rotationDeg?: number;
  /** For RECT: size from (x,y) toward +X / +Y (upstage). For ELLIPSE: radii. For LINE: end point. */
  width?: number;
  height?: number;
  x2?: number;
  y2?: number;
  label?: string;
  /** Optional SVG/CSS hex fill (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`). Rect/ellipse/text body; line ignores. */
  fill?: string;
  /** Optional SVG/CSS hex stroke. Line and shape outlines when not selecting. */
  stroke?: string;
  /** POLYLINE — ordered bend points in plot world (≥2 total after clamp); `x`/`y` mirror `vertices[0]`. */
  vertices?: StageDeckPoint[];
  /** Optional cabling class for **`LINE`** / **`POLYLINE`** path shapes (spreadsheet-style rigging/power runs). */
  cableRun?: StageDiagramCableRunKind;
  /** Optional drafting-style layer (see `diagramLayers`). */
  layerId?: string;
  /** Optional isolate tag shared with placements for peer snapping (sanitized **`[\w-]+`** subset). */
  peerSnapGroup?: string;
};

/** Cross-category diagram paint token (`diagramPaintOrder` in persisted JSON). */
export type StageDiagramPaintKind = "deck" | "shape" | "placement";

export type StageDiagramPaintRef = Readonly<{ kind: StageDiagramPaintKind; id: string }>;

export type StageDesignCanvas = {
  version: number;
  footprint: StageDesignFootprint;
  /** When non-empty, deck outline is the union of these polygons (modular platforms, wings). When empty/omitted, deck is the axis-aligned rectangle [0,width]×[0,depth]. */
  deckPolygons?: StageDeckPolygon[];
  plotMargins: StageDesignPlotMargins;
  placements: StageDesignPlacement[];
  shapes: StageDesignShape[];
  /**
   * Optional unified SVG paint order across deck modules, shapes, and symbols.
   * When omitted, legacy ordering applies: all deck (normalized) → shapes → placements.
   */
  diagramPaintOrder?: StageDiagramPaintRef[];
  /**
   * Drafting-style layer stack (bottom → top). When omitted, implicit single “Main” layer.
   * Persisted only when multi-layer / visibility / assignments exist (see `reconcileDiagramLayersOnCanvas`).
   */
  diagramLayers?: StageDiagramLayer[];
};

/** Max POST body size guard for producer `diagramPaintOrderJson`. */
export const MAX_DIAGRAM_PAINT_ORDER_JSON_CHARS = 96_000;

const DIM_MIN = 1;
const DIM_HARD_MAX = 500;
const MARGIN_MAX = 400;

export const MAX_STAGE_PLACEMENTS = 120;
export const MAX_STAGE_SHAPES = 80;
/** Max vertices persisted on one polyline shape (inclusive). */
export const MAX_STAGE_SHAPE_POLYLINE_VERTICES = 48;

/**
 * Insert `point` between `vertices[segmentStartIndex]` and `vertices[segmentStartIndex + 1]` (snap/clamp upstream).
 * Returns null when the segment index is out of range or inserting would exceed {@link MAX_STAGE_SHAPE_POLYLINE_VERTICES}.
 */
export function insertPolylineVertexOnSegment(
  vertices: readonly StageDeckPoint[],
  segmentStartIndex: number,
  point: StageDeckPoint,
): StageDeckPoint[] | null {
  if (segmentStartIndex < 0 || segmentStartIndex >= vertices.length - 1) return null;
  if (vertices.length >= MAX_STAGE_SHAPE_POLYLINE_VERTICES) return null;
  const next = [...vertices];
  next.splice(segmentStartIndex + 1, 0, { x: point.x, y: point.y });
  return next;
}

/** Remove vertex at `vertexIndex`; returns null if invalid or fewer than three vertices would remain. */
export function removePolylineVertexAtIndex(
  vertices: readonly StageDeckPoint[],
  vertexIndex: number,
): StageDeckPoint[] | null {
  if (vertexIndex < 0 || vertexIndex >= vertices.length) return null;
  if (vertices.length <= 2) return null;
  return vertices.filter((_, j) => j !== vertexIndex);
}

export const MAX_STAGE_DECK_MODULES = 36;
export const MAX_DECK_POLY_VERTICES = 48;

const NOTE_MAX_CHARS = 220;
const LABEL_MAX_CHARS = 400;

function clampIntEquipment(n: unknown, lo: number, hi: number): number | undefined {
  const v =
    typeof n === "number" && Number.isFinite(n)
      ? Math.round(n)
      : typeof n === "string"
        ? ((): number => {
            const t = n.trim();
            if (!/^-?\d+$/.test(t)) return Number.NaN;
            return Number.parseInt(t, 10);
          })()
        : Number.NaN;
  if (!Number.isFinite(v)) return undefined;
  if (v < lo || v > hi) return undefined;
  return v;
}

export function sanitizeStagePlacementEquipment(
  partial: StagePlacementEquipment | undefined,
  kind: StageDesignPlacementKind,
): StagePlacementEquipment | undefined {
  if (!partial) return undefined;
  const out: StagePlacementEquipment = {};
  if (typeof partial.role === "string") {
    const t = partial.role.trim();
    if (t.length > 0) out.role = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_ROLE_MAX_CHARS);
  }
  if (typeof partial.patch === "string") {
    const t = partial.patch.trim();
    if (t.length > 0) out.patch = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_PATCH_MAX_CHARS);
  }
  if (typeof partial.gel === "string") {
    const t = partial.gel.trim();
    if (t.length > 0) out.gel = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_GEL_MAX_CHARS);
  }
  if (typeof partial.fixtureId === "string") {
    const t = partial.fixtureId.trim();
    if (t.length > 0) out.fixtureId = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS);
  }
  if (typeof partial.fixtureProfile === "string") {
    const t = partial.fixtureProfile.trim();
    if (t.length > 0) out.fixtureProfile = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_FIXTURE_PROFILE_MAX_CHARS);
  }
  const allowDmx = placementKindAllowsDmxEquipment(kind);
  if (allowDmx) {
    const uRaw =
      typeof partial.dmxUniverse === "number" && Number.isInteger(partial.dmxUniverse) ? partial.dmxUniverse : undefined;
    const chRaw =
      typeof partial.dmxChannel === "number" && Number.isInteger(partial.dmxChannel)
        ? partial.dmxChannel
        : undefined;
    if (uRaw !== undefined && uRaw >= 1 && uRaw <= 256) out.dmxUniverse = uRaw;
    if (chRaw !== undefined && chRaw >= 1 && chRaw <= 512) out.dmxChannel = chRaw;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseStagePlacementEquipmentRaw(
  kind: StageDesignPlacementKind,
  raw: unknown,
): StagePlacementEquipment | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  let role: string | undefined;
  if (typeof o.role === "string") {
    const t = o.role.trim();
    if (t.length > 0) role = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_ROLE_MAX_CHARS);
  }
  let patch: string | undefined;
  const patchRaw = o.patch ?? o.patch_label ?? o.patchNote;
  if (typeof patchRaw === "string") {
    const t = patchRaw.trim();
    if (t.length > 0) patch = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_PATCH_MAX_CHARS);
  }
  let gel: string | undefined;
  const gelRaw = o.gel ?? o.gel_note ?? o.gelNote;
  if (typeof gelRaw === "string") {
    const t = gelRaw.trim();
    if (t.length > 0) gel = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_GEL_MAX_CHARS);
  }
  let fixtureId: string | undefined;
  const fixtureIdRaw = o.fixtureId ?? o.fixture_id;
  if (typeof fixtureIdRaw === "string") {
    const t = fixtureIdRaw.trim();
    if (t.length > 0) fixtureId = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS);
  }
  let fixtureProfile: string | undefined;
  const fixtureProfileRaw = o.fixtureProfile ?? o.fixture_profile;
  if (typeof fixtureProfileRaw === "string") {
    const t = fixtureProfileRaw.trim();
    if (t.length > 0) fixtureProfile = t.slice(0, STAGE_PLACEMENT_EQUIPMENT_FIXTURE_PROFILE_MAX_CHARS);
  }
  const allowDmx = placementKindAllowsDmxEquipment(kind);
  const dmxU = allowDmx ? clampIntEquipment(o.dmxUniverse ?? o.dmx_universe, 1, 256) : undefined;
  const dmxCh = allowDmx ? clampIntEquipment(o.dmxChannel ?? o.dmx_channel, 1, 512) : undefined;
  return sanitizeStagePlacementEquipment(
    { role, patch, gel, fixtureId, fixtureProfile, dmxUniverse: dmxU, dmxChannel: dmxCh },
    kind,
  );
}

/** Readable fragment for SVG `<title>` accessibility (exports include this). */
export function placementEquipmentSvgTitleSuffix(placement: StageDesignPlacement): string {
  const eq = placement.equipment;
  if (!eq) return "";
  const bits: string[] = [];
  if (eq.role) bits.push(eq.role);
  if (eq.patch) bits.push(`patch ${eq.patch}`);
  if (eq.gel) bits.push(`gel ${eq.gel}`);
  if (eq.fixtureId) bits.push(`fixture ${eq.fixtureId}`);
  if (eq.fixtureProfile) bits.push(`profile ${eq.fixtureProfile}`);
  if (
    placementKindAllowsDmxEquipment(placement.kind) &&
    eq.dmxUniverse !== undefined &&
    eq.dmxChannel !== undefined
  ) {
    bits.push(`U${eq.dmxUniverse}.${eq.dmxChannel}`);
  }
  return bits.length > 0 ? ` · ${bits.join(" · ")}` : "";
}

/**
 * Max glyph count for on-plot captions (RECT / ELLIPSE / LINE / POLYLINE / TEXT). Full label remains in data + `<title>`.
 */
export const STAGE_DIAGRAM_LABEL_ABBREV_MAX = 6 as const;

/**
 * Short caption for the diagram: multi-word → consecutive initials (e.g. `Front Truss` → `FT`);
 * single token → uppercase prefix. Empty/whitespace-only → `""` (caller may skip drawing).
 */
export function abbreviateStageDiagramLabel(raw: string | undefined | null): string {
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return "";
  const words = t.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  if (words.length === 0) return "";
  const max = STAGE_DIAGRAM_LABEL_ABBREV_MAX;
  if (words.length === 1) {
    const w = words[0] ?? "";
    return w.length <= max ? w.toUpperCase() : w.slice(0, max).toUpperCase();
  }
  let ini = "";
  for (const w of words) {
    const m = w.match(/[A-Za-z0-9]/);
    if (m) ini += m[0].toUpperCase();
    if (ini.length >= max) break;
  }
  return ini.slice(0, max);
}

/**
 * Canonical stage diagram colors stored as lowercase `#` + hex (3 / 4 / 6 / 8 nibbles).
 * Accepts `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`; rejects injections / malformed strings.
 */
export function sanitizeStageSvgColor(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().slice(0, 12);
  if (!t.startsWith("#")) return undefined;
  const hex = t.slice(1);
  const n = hex.length;
  if (n !== 3 && n !== 4 && n !== 6 && n !== 8) return undefined;
  if (!/^[0-9a-fA-F]+$/.test(hex)) return undefined;
  return `#${hex.toLowerCase()}`;
}

export const DEFAULT_PLOT_MARGINS: StageDesignPlotMargins = {
  downstage: 72,
  upstage: 28,
  stageLeft: 24,
  stageRight: 24,
};

export function clampPlotMargins(raw: Partial<StageDesignPlotMargins> | undefined): StageDesignPlotMargins {
  const d = DEFAULT_PLOT_MARGINS;
  const n = (v: unknown) => {
    const x = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(x)) return 0;
    return Math.min(MARGIN_MAX, Math.max(0, x));
  };
  if (!raw || typeof raw !== "object") return { ...d };
  const o = raw as Record<string, unknown>;
  return {
    downstage: n(o.downstage ?? d.downstage),
    upstage: n(o.upstage ?? d.upstage),
    stageLeft: n(o.stageLeft ?? d.stageLeft),
    stageRight: n(o.stageRight ?? d.stageRight),
  };
}

export function getPlotBoundsFromCanvas(
  canvas: Pick<StageDesignCanvas, "footprint" | "deckPolygons">,
  m: StageDesignPlotMargins,
): PlotWorldBounds {
  const struct = structureBoundsFromPolygons(normalizeDeckPolygons(canvas));
  return {
    minX: struct.minX - m.stageLeft,
    maxX: struct.maxX + m.stageRight,
    minY: struct.minY - m.downstage,
    maxY: struct.maxY + m.upstage,
  };
}

/** Plot bounds using legacy single-rectangle deck (same as `{ footprint }` with no deck polygons). */
export function getPlotBounds(footprint: StageDesignFootprint, m: StageDesignPlotMargins): PlotWorldBounds {
  return getPlotBoundsFromCanvas({ footprint, deckPolygons: undefined }, m);
}

export function defaultLegacyDeckPolygon(footprint: StageDesignFootprint): StageDeckPolygon {
  const f = clampFootprint(footprint.width, footprint.depth);
  const w = f.width;
  const d = f.depth;
  return {
    id: SYNTHETIC_DECK_RECT_POLYGON_ID,
    points: [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: w, y: d },
      { x: 0, y: d },
    ],
  };
}

/** Axis-aligned rectangular deck module from two corners (snap before calling). */
export function rectangleDeckPolygonFromCorners(
  id: string,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): StageDeckPolygon {
  const x0 = Math.min(ax, bx);
  const y0 = Math.min(ay, by);
  const x1 = Math.max(ax, bx);
  const y1 = Math.max(ay, by);
  const minSz = 0.5;
  const w = Math.max(minSz, x1 - x0);
  const h = Math.max(minSz, y1 - y0);
  return {
    id,
    points: [
      { x: x0, y: y0 },
      { x: x0 + w, y: y0 },
      { x: x0 + w, y: y0 + h },
      { x: x0, y: y0 + h },
    ],
  };
}

function clampDeckCoordinate(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.min(DIM_HARD_MAX, Math.max(-DIM_HARD_MAX, v));
}

function parseDeckPolygonOne(raw: unknown): StageDeckPolygon | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim().length > 0 ? o.id.trim().slice(0, 128) : null;
  const ptsRaw = o.points;
  if (!id || !Array.isArray(ptsRaw) || ptsRaw.length < 3) return null;
  const pts: StageDeckPoint[] = [];
  for (const row of ptsRaw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const x = typeof r.x === "number" ? r.x : Number(r.x);
    const y = typeof r.y === "number" ? r.y : Number(r.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    pts.push({ x: clampDeckCoordinate(x), y: clampDeckCoordinate(y) });
    if (pts.length >= MAX_DECK_POLY_VERTICES) break;
  }
  if (pts.length < 3) return null;
  const layerId = sanitizeDiagramEntityLayerId(typeof o.layerId === "string" ? o.layerId : null);
  return layerId !== undefined ? { id, points: pts, layerId } : { id, points: pts };
}

export function clampDeckPolygon(poly: StageDeckPolygon, footprint: StageDesignFootprint): StageDeckPolygon {
  const pts = poly.points
    .map((p) => ({ x: clampDeckCoordinate(p.x), y: clampDeckCoordinate(p.y) }))
    .slice(0, MAX_DECK_POLY_VERTICES);
  return { ...poly, id: poly.id.slice(0, 128), points: pts.length >= 3 ? pts : defaultLegacyDeckPolygon(footprint).points };
}

export function normalizeDeckPolygons(
  canvas: Pick<StageDesignCanvas, "footprint" | "deckPolygons">,
): StageDeckPolygon[] {
  const fp = clampFootprint(canvas.footprint.width, canvas.footprint.depth);
  const raw = canvas.deckPolygons;
  if (!Array.isArray(raw) || raw.length === 0) {
    return [defaultLegacyDeckPolygon(fp)];
  }
  const out: StageDeckPolygon[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    const p = typeof row === "object" && row !== null && !Array.isArray(row) ? parseDeckPolygonOne(row) : null;
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(clampDeckPolygon(p, fp));
    if (out.length >= MAX_STAGE_DECK_MODULES) break;
  }
  if (out.length === 0) return [defaultLegacyDeckPolygon(fp)];
  return out;
}

export function stageDiagramPaintRefKey(ref: StageDiagramPaintRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function defaultDiagramPaintOrder(
  canvas: Pick<StageDesignCanvas, "footprint" | "deckPolygons" | "shapes" | "placements">,
): StageDiagramPaintRef[] {
  const polys = normalizeDeckPolygons({
    footprint: canvas.footprint,
    deckPolygons: canvas.deckPolygons,
  });
  return [
    ...polys.map((p) => ({ kind: "deck" as const, id: p.id })),
    ...canvas.shapes.map((s) => ({ kind: "shape" as const, id: s.id })),
    ...canvas.placements.map((p) => ({ kind: "placement" as const, id: p.id })),
  ];
}

export function paintDiagramOrdersEqual(a: StageDiagramPaintRef[], b: StageDiagramPaintRef[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (!x || !y || x.kind !== y.kind || x.id !== y.id) return false;
  }
  return true;
}

/**
 * Moves `sel` to the paint extreme: **`back`** = index 0 (drawn before / beneath siblings); **`front`** =
 * last index (drawn after / on top).
 * Returns `null` when `sel` is missing or already at that extreme.
 */
export function moveDiagramPaintRefToPaintExtreme(
  order: readonly StageDiagramPaintRef[],
  sel: StageDiagramPaintRef,
  extreme: "back" | "front",
): StageDiagramPaintRef[] | null {
  const idx = order.findIndex((r) => r.kind === sel.kind && r.id === sel.id);
  if (idx < 0) return null;
  if (extreme === "back" && idx === 0) return null;
  if (extreme === "front" && idx === order.length - 1) return null;
  const picked = order[idx]!;
  const rest = order.filter((_, i) => i !== idx);
  return extreme === "back" ? [picked, ...rest] : [...rest, picked];
}

/** Merge persisted order with canonical items; drops stale ids and appends missing ones (legacy bucket fill). */
export function repairDiagramPaintOrder(canvas: StageDesignCanvas): StageDiagramPaintRef[] {
  const canonical = defaultDiagramPaintOrder(canvas);
  const want = new Set(canonical.map(stageDiagramPaintRefKey));
  const ordered: StageDiagramPaintRef[] = [];
  const seen = new Set<string>();
  const raw = canvas.diagramPaintOrder;
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const rec = row as Record<string, unknown>;
      const kind = rec.kind;
      const id = rec.id;
      if (kind !== "deck" && kind !== "shape" && kind !== "placement") continue;
      if (typeof id !== "string" || id.length === 0 || id.length > 200) continue;
      const ref: StageDiagramPaintRef = { kind, id };
      const k = stageDiagramPaintRefKey(ref);
      if (seen.has(k) || !want.has(k)) continue;
      ordered.push(ref);
      seen.add(k);
    }
  }
  for (const ref of canonical) {
    const k = stageDiagramPaintRefKey(ref);
    if (!seen.has(k)) {
      ordered.push(ref);
      seen.add(k);
    }
  }
  return ordered;
}

function parseDiagramPaintOrderField(raw: unknown): StageDiagramPaintRef[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const cap = MAX_STAGE_DECK_MODULES + MAX_STAGE_PLACEMENTS + MAX_STAGE_SHAPES + 24;
  const out: StageDiagramPaintRef[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (out.length >= cap) break;
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const rec = row as Record<string, unknown>;
    const kind = rec.kind;
    const id = rec.id;
    if (kind !== "deck" && kind !== "shape" && kind !== "placement") continue;
    if (typeof id !== "string" || id.length === 0 || id.length > 200) continue;
    const ref: StageDiagramPaintRef = { kind, id };
    const k = stageDiagramPaintRefKey(ref);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(ref);
  }
  return out.length > 0 ? out : undefined;
}

/** Parses optional `diagramPaintOrder` POST JSON blob (producer save). */
export function parseDiagramPaintOrderJsonString(raw: string): StageDiagramPaintRef[] | undefined {
  const t = raw.trim().slice(0, MAX_DIAGRAM_PAINT_ORDER_JSON_CHARS);
  if (t.length === 0 || t === "null") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(t) as unknown;
  } catch {
    return undefined;
  }
  return parseDiagramPaintOrderField(parsed);
}

export function structureBoundsFromPolygons(polygons: StageDeckPolygon[]): PlotWorldBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polygons) {
    for (const pt of poly.points) {
      if (!Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minY = Math.min(minY, pt.y);
      maxY = Math.max(maxY, pt.y);
    }
  }
  if (!Number.isFinite(minX) || minX === Infinity) {
    return { minX: 0, maxX: DIM_MIN, minY: 0, maxY: DIM_MIN };
  }
  return { minX, maxX: Math.max(maxX, minX + 1e-6), minY, maxY: Math.max(maxY, minY + 1e-6) };
}

/** Span of deck structure — used when persisting nominal footprint for multi-module decks. */
export function footprintFromDeckStructure(canvas: Pick<StageDesignCanvas, "footprint" | "deckPolygons">): StageDesignFootprint {
  const fp = clampFootprint(canvas.footprint.width, canvas.footprint.depth);
  const polys = normalizeDeckPolygons(canvas);
  const legacyOnly =
    canvas.deckPolygons === undefined || (Array.isArray(canvas.deckPolygons) && canvas.deckPolygons.length === 0);
  if (legacyOnly) return fp;
  const b = structureBoundsFromPolygons(polys);
  return clampFootprint(b.maxX - b.minX, b.maxY - b.minY);
}

/** World-space magnet tolerance (mult × grid step) for deck corners and plot frame while grid snap is active. */
const STAGE_MAGNET_TOL_GRID_MULT = 1 as const;

/**
 * Largest linear distance between pointer world coords and an axis boundary or polygon vertex before the editor
 * pulls XY into alignment (producer UI only — applied after {@link snapStageCoordinate} unless Alt disables snap).
 */
export function snapStageMagnetToleranceWorld(unitFeetOrMeters: "FEET" | "METERS"): number {
  return snapStageCoordinateStep(unitFeetOrMeters) * STAGE_MAGNET_TOL_GRID_MULT;
}

/**
 * Structural magnets: strongest at **deck polygon vertices** within tolerance, else nearest point along any **deck edge
 * segment**, else orthogonal snaps toward **plot bounds**. Run after grid quantization (unless Alt skips snap in the UI).
 */
export function snapPlotWorldXYToStructuralGuides(
  wx: number,
  wy: number,
  plotBounds: PlotWorldBounds,
  deckPolygons: StageDeckPolygon[],
  unitFeetOrMeters: "FEET" | "METERS",
): { wx: number; wy: number } {
  const r = snapPlotWorldXYToStructuralGuidesWithMeta(wx, wy, plotBounds, deckPolygons, unitFeetOrMeters);
  return { wx: r.wx, wy: r.wy };
}

/** Like {@link snapPlotWorldXYToStructuralGuides} plus optional dashed guide axes for producer overlay. */
export function snapPlotWorldXYToStructuralGuidesWithMeta(
  wx: number,
  wy: number,
  plotBounds: PlotWorldBounds,
  deckPolygons: StageDeckPolygon[],
  unitFeetOrMeters: "FEET" | "METERS",
): Pick<
  PeerAlignSnapResult,
  | "wx"
  | "wy"
  | "structuralGuideVerticalWorldX"
  | "structuralGuideHorizontalWorldY"
  | "structuralGuideEdgeWorld"
> {
  if (!Number.isFinite(wx)) wx = 0;
  if (!Number.isFinite(wy)) wy = 0;
  const tol = snapStageMagnetToleranceWorld(unitFeetOrMeters);
  const tolSq = tol * tol;
  const { minX, maxX, minY, maxY } = plotBounds;

  let vtxFx = 0;
  let vtxFy = 0;
  let bestVtxD2 = Infinity;
  for (const pt of iterateDeckVertices(deckPolygons)) {
    const dx = wx - pt.x;
    const dy = wy - pt.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > tolSq) continue;
    if (
      bestVtxD2 === Infinity ||
      d2 + 1e-15 < bestVtxD2 ||
      (Math.abs(d2 - bestVtxD2) <= 1e-14 && lexKey(pt.x, pt.y) < lexKey(vtxFx, vtxFy))
    ) {
      bestVtxD2 = d2;
      vtxFx = pt.x;
      vtxFy = pt.y;
    }
  }

  let segFx = 0;
  let segFy = 0;
  let segAx = 0;
  let segAy = 0;
  let segBx = 0;
  let segBy = 0;
  let bestSegD2 = Infinity;
  if (!(Number.isFinite(bestVtxD2) && bestVtxD2 <= tolSq)) {
    for (const seg of iterateDeckSegments(deckPolygons)) {
      const { fx, fy, d2 } = nearestSquaredDistanceFootOnSegment(wx, wy, seg.ax, seg.ay, seg.bx, seg.by);
      if (d2 > tolSq) continue;
      if (
        bestSegD2 === Infinity ||
        d2 + 1e-15 < bestSegD2 ||
        (Math.abs(d2 - bestSegD2) <= 1e-14 && lexKey(fx, fy) < lexKey(segFx, segFy))
      ) {
        bestSegD2 = d2;
        segFx = fx;
        segFy = fy;
        segAx = seg.ax;
        segAy = seg.ay;
        segBx = seg.bx;
        segBy = seg.by;
      }
    }
  }

  if (Number.isFinite(bestVtxD2) && bestVtxD2 <= tolSq) {
    return {
      wx: vtxFx,
      wy: vtxFy,
      structuralGuideVerticalWorldX: vtxFx,
      structuralGuideHorizontalWorldY: vtxFy,
    };
  }
  if (Number.isFinite(bestSegD2) && bestSegD2 <= tolSq) {
    return {
      wx: segFx,
      wy: segFy,
      structuralGuideVerticalWorldX: segFx,
      structuralGuideHorizontalWorldY: segFy,
      structuralGuideEdgeWorld: { x1: segAx, y1: segAy, x2: segBx, y2: segBy },
    };
  }

  const axMeta = snapScalarTowardAxisGuidesMeta(wx, [minX, maxX], tol);
  const ayMeta = snapScalarTowardAxisGuidesMeta(wy, [minY, maxY], tol);
  return {
    wx: axMeta.value,
    wy: ayMeta.value,
    ...(axMeta.snapped ? { structuralGuideVerticalWorldX: axMeta.value } : {}),
    ...(ayMeta.snapped ? { structuralGuideHorizontalWorldY: ayMeta.value } : {}),
  };
}

/** Producer drag/nudge excludes so items do not magnetize to themselves. */
export type PeerSnapExclude = {
  placementId?: string;
  shapeId?: string;
  /** Exclude every listed placement anchor from peer snapping (mixed selection / group moves). */
  excludePlacementIds?: ReadonlySet<string>;
  excludeShapeIds?: ReadonlySet<string>;
  /** When sanitized to a nonempty token, peers without the same sanitized tag contribute no magnet samples (see **`sanitizePeerSnapGroup`**). */
  peerSnapGroup?: string;
};

/** Persisted **`peerSnapGroup`** max length (`canvasJson`). */
export const PEER_SNAP_GROUP_MAX_CHARS = 48;

/**
 * Normalize optional peer snap affinity tags (letters, digits, underscores, hyphen).
 * Rejects slashes/spaces/control chars so BOM / tooling can treat ids as opaque tokens.
 */
export function sanitizePeerSnapGroup(raw: string | undefined | null): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim().slice(0, PEER_SNAP_GROUP_MAX_CHARS);
  if (t.length === 0) return undefined;
  if (!/^[\w-]+$/.test(t)) return undefined;
  return t;
}

/**
 * Decide whether every moving primitive unanimously shares exactly one sanitized {@link StageDesignPlacement.peerSnapGroup} /
 * {@link StageDesignShape.peerSnapGroup} token (every participant tagged, no mixtures).
 */
export function peerSnapGroupFilterForManipulator(args: {
  placements: readonly StageDesignPlacement[];
  shapes: readonly StageDesignShape[];
  movingPlacementIds: readonly string[];
  movingShapeIds: readonly string[];
}): string | undefined {
  let unique: string | undefined;
  let anyUngrouped = false;
  let mixedDistinct = false;

  const consider = (g: string | undefined) => {
    const s = sanitizePeerSnapGroup(g);
    if (s === undefined) {
      anyUngrouped = true;
      return;
    }
    if (unique === undefined) unique = s;
    else if (unique !== s) mixedDistinct = true;
  };

  for (const id of args.movingPlacementIds) {
    consider(args.placements.find((p) => p.id === id)?.peerSnapGroup);
  }
  for (const id of args.movingShapeIds) {
    consider(args.shapes.find((s) => s.id === id)?.peerSnapGroup);
  }

  if (anyUngrouped || mixedDistinct || unique === undefined) return undefined;
  return unique;
}

/** Plot affine used to match SVG CW rotation semantics (flip-Y world→SVG) for peer magnets. Omit only when peers have no rotation or for trivial tests. */
export type PeerSnapRotationPlotLayout = PlotWorldBounds & {
  rx: number;
  ry: number;
  rectW: number;
  rectH: number;
  worldW: number;
  worldH: number;
};

/** Build peer snap rotation layout from `plotLayoutForCanvas(...).lay` (stage plot preview). */
export function peerSnapRotationLayoutFromPlotView(lay: {
  bounds: PlotWorldBounds;
  rx: number;
  ry: number;
  rectW: number;
  rectH: number;
  worldW: number;
  worldH: number;
}): PeerSnapRotationPlotLayout {
  const b = lay.bounds;
  return {
    minX: b.minX,
    maxX: b.maxX,
    minY: b.minY,
    maxY: b.maxY,
    rx: lay.rx,
    ry: lay.ry,
    rectW: lay.rectW,
    rectH: lay.rectH,
    worldW: lay.worldW,
    worldH: lay.worldH,
  };
}

/** Result of peer-axis snapping including optional authoring guide axes (producer UI may draw rulers). */
export type PeerAlignSnapResult = {
  wx: number;
  wy: number;
  /** Draw a vertical line at this plot-world X while this peer snap stays active on X. */
  peerGuideVerticalWorldX?: number;
  /** Draw a horizontal line at this plot-world Y while this peer snap stays active on Y. */
  peerGuideHorizontalWorldY?: number;
  /** Deck vertex / edge foot / plot rim: vertical guide at this world X. */
  structuralGuideVerticalWorldX?: number;
  /** Deck vertex / edge foot / plot rim: horizontal guide at this world Y. */
  structuralGuideHorizontalWorldY?: number;
  /** When the magnet clamps to a deck **edge segment**, the polyline endpoints of that perimeter edge (world). */
  structuralGuideEdgeWorld?: { x1: number; y1: number; x2: number; y2: number };
};

function collectPeerAxisSamples(
  placements: readonly StageDesignPlacement[],
  shapes: readonly StageDesignShape[],
  exclude: PeerSnapExclude | null | undefined,
  designUnit: StageDesignUnit,
  rotationLayout: PeerSnapRotationPlotLayout | null | undefined,
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const exPid = exclude?.placementId;
  const exSid = exclude?.shapeId;
  const exPl = exclude?.excludePlacementIds;
  const exSh = exclude?.excludeShapeIds;
  const groupOnly = sanitizePeerSnapGroup(exclude?.peerSnapGroup);

  for (const p of placements) {
    if (!p) continue;
    if (exPl?.has(p.id)) continue;
    if (exPid && p.id === exPid) continue;
    if (groupOnly !== undefined && sanitizePeerSnapGroup(p.peerSnapGroup) !== groupOnly) continue;
    const { xr: pxr, yr: pyr } = placementPeerScalars(p, designUnit, rotationLayout);
    xs.push(...pxr);
    ys.push(...pyr);
  }

  for (const s of shapes) {
    if (!s) continue;
    if (exSh?.has(s.id)) continue;
    if (exSid && s.id === exSid) continue;
    if (groupOnly !== undefined && sanitizePeerSnapGroup(s.peerSnapGroup) !== groupOnly) continue;
    const { xr, yr } = shapePeerScalars(s, rotationLayout);
    xs.push(...xr);
    ys.push(...yr);
  }

  return { xs, ys };
}

/**
 * Like {@link snapPlotWorldXYToPeerAlign} but reports which plot axes latched to a peer target for guide rendering.
 */
export function snapPlotWorldXYToPeerAlignWithMeta(
  wx: number,
  wy: number,
  placements: readonly StageDesignPlacement[],
  shapes: readonly StageDesignShape[],
  unitFeetOrMeters: "FEET" | "METERS",
  exclude: PeerSnapExclude | null | undefined,
  designUnit: StageDesignUnit,
  rotationLayout?: PeerSnapRotationPlotLayout | null,
): PeerAlignSnapResult {
  if (!Number.isFinite(wx)) wx = 0;
  if (!Number.isFinite(wy)) wy = 0;
  const tol = snapStageMagnetToleranceWorld(unitFeetOrMeters);
  const { xs, ys } = collectPeerAxisSamples(placements, shapes, exclude, designUnit, rotationLayout ?? null);
  const sx = nearestPeerScalarSnapMeta(wx, xs, tol);
  const sy = nearestPeerScalarSnapMeta(wy, ys, tol);
  return {
    wx: sx.value,
    wy: sy.value,
    ...(sx.snappedToPeer ? { peerGuideVerticalWorldX: sx.value } : {}),
    ...(sy.snappedToPeer ? { peerGuideHorizontalWorldY: sy.value } : {}),
  };
}

/**
 * Per-axis snapping to nearest peer geometry: placement anchors **and** bbox samples from glyph
 * defaults/extents ({@link resolvePlacementGlyphWorld}); shape corners / axes (rotation-aware when
 * {@link PeerSnapRotationPlotLayout} is passed). **TEXT** shapes contribute an estimated label AABB
 * (font-size–driven, plot-scaled) when `rotationLayout` is present; otherwise only the anchor center.
 * Applies after structural passes in authoring.
 */
export function snapPlotWorldXYToPeerAlign(
  wx: number,
  wy: number,
  placements: readonly StageDesignPlacement[],
  shapes: readonly StageDesignShape[],
  unitFeetOrMeters: "FEET" | "METERS",
  exclude: PeerSnapExclude | null | undefined,
  designUnit: StageDesignUnit,
  rotationLayout?: PeerSnapRotationPlotLayout | null,
): { wx: number; wy: number } {
  const r = snapPlotWorldXYToPeerAlignWithMeta(
    wx,
    wy,
    placements,
    shapes,
    unitFeetOrMeters,
    exclude,
    designUnit,
    rotationLayout,
  );
  return { wx: r.wx, wy: r.wy };
}

function peerWorldPointToSvg(wx: number, wy: number, lay: PeerSnapRotationPlotLayout): { sx: number; sy: number } {
  const worldW = Math.max(1e-9, lay.worldW);
  const worldH = Math.max(1e-9, lay.worldH);
  const rectW = Math.max(1e-9, lay.rectW);
  const rectH = Math.max(1e-9, lay.rectH);
  const tX = (wx - lay.minX) / worldW;
  const tY = (wy - lay.minY) / worldH;
  const sx = lay.rx + tX * rectW;
  const sy = lay.ry + rectH - tY * rectH;
  return { sx, sy };
}

function peerSvgPointToWorld(sx: number, sy: number, lay: PeerSnapRotationPlotLayout): { wx: number; wy: number } {
  const relX = sx - lay.rx;
  const relY = sy - lay.ry;
  const worldW = Math.max(1e-9, lay.worldW);
  const worldH = Math.max(1e-9, lay.worldH);
  const rectW = Math.max(1e-9, lay.rectW);
  const rectH = Math.max(1e-9, lay.rectH);
  return {
    wx: lay.minX + (relX / rectW) * worldW,
    wy: lay.minY + ((rectH - relY) / rectH) * worldH,
  };
}

/** SVG / CSS positive angle: clockwise in screen space (+y down). */
function rotateSvgDeltaCwDeg(dx: number, dy: number, degCw: number): { dx: number; dy: number } {
  if (!(Number.isFinite(degCw) && Math.abs(degCw) > 1e-12)) return { dx, dy };
  let d = degCw % 360;
  if (d < 0) d += 360;
  if (d < 1e-9 || d > 360 - 1e-9) return { dx, dy };
  const rad = (degCw * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return { dx: dx * c + dy * s, dy: -dx * s + dy * c };
}

/**
 * Match producer SVG `rotate(deg, pivot)`: map to SVG, rotate CW, map back.
 * Without layout, falls back to clockwise rotation in the raw world plane (differs under anisotropic scale / flip-Y SVG mapping).
 */
function rotatePeerWorldPointLikeSvg(
  wx: number,
  wy: number,
  pivotWx: number,
  pivotWy: number,
  rotationDeg: number | undefined,
  rotationLayout: PeerSnapRotationPlotLayout | null | undefined,
): { wx: number; wy: number } {
  const deg = rotationDeg ?? 0;
  if (!(Number.isFinite(deg) && Math.abs(deg) > 1e-12)) return { wx, wy };
  let d = deg % 360;
  if (d < 0) d += 360;
  if (d < 1e-9 || d > 360 - 1e-9) return { wx, wy };

  if (
    rotationLayout &&
    rotationLayout.rectW > 0 &&
    rotationLayout.rectH > 0 &&
    rotationLayout.worldW > 0 &&
    rotationLayout.worldH > 0
  ) {
    const pivS = peerWorldPointToSvg(pivotWx, pivotWy, rotationLayout);
    const pS = peerWorldPointToSvg(wx, wy, rotationLayout);
    const r = rotateSvgDeltaCwDeg(pS.sx - pivS.sx, pS.sy - pivS.sy, deg);
    return peerSvgPointToWorld(pivS.sx + r.dx, pivS.sy + r.dy, rotationLayout);
  }

  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const dx = wx - pivotWx;
  const dy = wy - pivotWy;
  return { wx: pivotWx + dx * c + dy * s, wy: pivotWy - dx * s + dy * c };
}

function pushRotatedPeerSamples(
  xr: number[],
  yr: number[],
  pivotWx: number,
  pivotWy: number,
  rotationDeg: number | undefined,
  rotationLayout: PeerSnapRotationPlotLayout | null | undefined,
  samples: readonly { wx: number; wy: number }[],
): void {
  for (const q of samples) {
    const p = rotatePeerWorldPointLikeSvg(q.wx, q.wy, pivotWx, pivotWy, rotationDeg, rotationLayout);
    if (Number.isFinite(p.wx)) xr.push(p.wx);
    if (Number.isFinite(p.wy)) yr.push(p.wy);
  }
}

function placementPeerScalars(
  placement: StageDesignPlacement,
  unit: StageDesignUnit,
  rotationLayout: PeerSnapRotationPlotLayout | null | undefined,
): { xr: number[]; yr: number[] } {
  const px = placement.x;
  const py = placement.y;
  const ext = resolvePlacementGlyphWorld(placement, unit);
  const xr: number[] = [];
  const yr: number[] = [];
  const rot = placement.rotationDeg;

  switch (placement.kind) {
    case "FIXTURE":
    case "WASH_MOVING":
    case "PAR_STATIC":
    case "UPLIGHT": {
      const r = ext.fixtureR;
      const samples = [
        { wx: px - r, wy: py },
        { wx: px + r, wy: py },
        { wx: px, wy: py - r },
        { wx: px, wy: py + r },
        { wx: px, wy: py },
      ];
      pushRotatedPeerSamples(xr, yr, px, py, rot, rotationLayout, samples);
      break;
    }
    case "BEAM_MOVING": {
      const rx = ext.fixtureR;
      const ry = Math.max(ext.fixtureR * 0.55, ext.fixtureR * 0.35);
      const samples = [
        { wx: px - rx, wy: py },
        { wx: px + rx, wy: py },
        { wx: px, wy: py - ry },
        { wx: px, wy: py + ry },
        { wx: px, wy: py },
      ];
      pushRotatedPeerSamples(xr, yr, px, py, rot, rotationLayout, samples);
      break;
    }
    case "POWER":
    case "POWER_DROP": {
      const h = ext.powerTriH;
      const halfBase = h * 0.58;
      const samples = [
        { wx: px, wy: py - 0.65 * h },
        { wx: px + halfBase, wy: py + 0.35 * h },
        { wx: px - halfBase, wy: py + 0.35 * h },
      ];
      pushRotatedPeerSamples(xr, yr, px, py, rot, rotationLayout, samples);
      break;
    }
    case "DECOR": {
      const d = ext.decorHalf;
      const samples = [
        { wx: px - d, wy: py - d },
        { wx: px + d, wy: py - d },
        { wx: px + d, wy: py + d },
        { wx: px - d, wy: py + d },
        { wx: px, wy: py },
      ];
      pushRotatedPeerSamples(xr, yr, px, py, rot, rotationLayout, samples);
      break;
    }
    case "TRUSS": {
      const L = ext.trussHalfLen;
      const samples = [
        { wx: px - L, wy: py },
        { wx: px + L, wy: py },
        { wx: px, wy: py },
      ];
      pushRotatedPeerSamples(xr, yr, px, py, rot, rotationLayout, samples);
      break;
    }
    case "LED_WALL":
    case "STRIP_FIXED":
    case "PROJECTOR_SYM": {
      const hw = ext.ledHalfW;
      const hh = ext.ledHalfH;
      const samples = [
        { wx: px - hw, wy: py - hh },
        { wx: px + hw, wy: py - hh },
        { wx: px + hw, wy: py + hh },
        { wx: px - hw, wy: py + hh },
        { wx: px, wy: py },
      ];
      pushRotatedPeerSamples(xr, yr, px, py, rot, rotationLayout, samples);
      break;
    }
    default:
      pushRotatedPeerSamples(xr, yr, px, py, rot, rotationLayout, [{ wx: px, wy: py }]);
  }

  return { xr, yr };
}

/** Assumed on-plot caption `fontSize` (px) for peer bbox heuristics — match `StageFootprintPreview` inline labels. */
const STAGE_DIAGRAM_LABEL_FONT_PX_ASSUMED = 10;
/** Heuristic horizontal advance per glyph (peer magnets). */
const STAGE_TEXT_PEER_ADV_PER_EM = 0.1;
/** Vertical span vs font size for TEXT peer AABB (baseline middle). */
const STAGE_TEXT_PEER_HEIGHT_FRAC = 0.92;

/** Visible / peer-sampled TEXT line (abbreviated, same as canvas caption). */
function displayTextLabelForPeerSamples(label: string | undefined): string {
  const t = typeof label === "string" ? label.trim() : "";
  const base = t.length > 0 ? t : "Label";
  return abbreviateStageDiagramLabel(base) || "LB";
}

function textLabelPeerWorldHalfExtents(
  shape: StageDesignShape,
  rotationLayout: PeerSnapRotationPlotLayout | null | undefined,
): { hw: number; hh: number } | null {
  if (shape.kind !== "TEXT") return null;
  const lay = rotationLayout;
  if (!lay || lay.rectW <= 0 || lay.rectH <= 0 || lay.worldW <= 0 || lay.worldH <= 0) return null;

  const display = displayTextLabelForPeerSamples(shape.label);
  const n = Math.max(1, display.length);
  const widthSvg = Math.max(
    STAGE_DIAGRAM_LABEL_FONT_PX_ASSUMED * STAGE_TEXT_PEER_ADV_PER_EM * n,
    STAGE_DIAGRAM_LABEL_FONT_PX_ASSUMED * 0.42,
  );
  const heightSvg = STAGE_DIAGRAM_LABEL_FONT_PX_ASSUMED * STAGE_TEXT_PEER_HEIGHT_FRAC;
  const hw = ((widthSvg * 0.5) * lay.worldW) / lay.rectW;
  const hh = ((heightSvg * 0.5) * lay.worldH) / lay.rectH;
  const eps = 1e-9;
  return { hw: Math.max(hw, eps), hh: Math.max(hh, eps) };
}

/** X/Y samples from a shape usable as alignment guides on each axis independently. */
function shapePeerScalars(
  shape: StageDesignShape,
  rotationLayout: PeerSnapRotationPlotLayout | null | undefined,
): { xr: number[]; yr: number[] } {
  const xr: number[] = [];
  const yr: number[] = [];
  const rot = shape.rotationDeg;

  switch (shape.kind) {
    case "TEXT": {
      const cx = shape.x;
      const cy = shape.y;
      const ext = textLabelPeerWorldHalfExtents(shape, rotationLayout);
      if (!ext) {
        xr.push(cx);
        yr.push(cy);
        break;
      }
      const { hw, hh } = ext;
      pushRotatedPeerSamples(xr, yr, cx, cy, rot, rotationLayout, [
        { wx: cx, wy: cy },
        { wx: cx - hw, wy: cy },
        { wx: cx + hw, wy: cy },
        { wx: cx, wy: cy - hh },
        { wx: cx, wy: cy + hh },
        { wx: cx - hw, wy: cy - hh },
        { wx: cx + hw, wy: cy - hh },
        { wx: cx - hw, wy: cy + hh },
        { wx: cx + hw, wy: cy + hh },
      ]);
      break;
    }
    case "ELLIPSE": {
      let rx = typeof shape.width === "number" ? shape.width : 4;
      let ry = typeof shape.height === "number" ? shape.height : 3;
      if (!Number.isFinite(rx)) rx = 4;
      if (!Number.isFinite(ry)) ry = 3;
      const cx = shape.x;
      const cy = shape.y;
      const samples = [
        { wx: cx, wy: cy },
        { wx: cx + rx, wy: cy },
        { wx: cx - rx, wy: cy },
        { wx: cx, wy: cy + ry },
        { wx: cx, wy: cy - ry },
      ];
      pushRotatedPeerSamples(xr, yr, cx, cy, rot, rotationLayout, samples);
      break;
    }
    case "LINE": {
      const xb = shape.x;
      const yb = shape.y;
      const x2 = shape.x2 ?? xb;
      const y2 = shape.y2 ?? yb;
      const mx = (xb + x2) / 2;
      const my = (yb + y2) / 2;
      pushRotatedPeerSamples(xr, yr, mx, my, rot, rotationLayout, [
        { wx: xb, wy: yb },
        { wx: x2, wy: y2 },
        { wx: mx, wy: my },
      ]);
      break;
    }
    case "POLYLINE": {
      const vts = shape.vertices;
      if (!vts?.length) break;
      let cx = 0;
      let cy = 0;
      for (const p of vts) {
        cx += p.x;
        cy += p.y;
      }
      cx /= vts.length;
      cy /= vts.length;
      const samples = vts.map((p) => ({ wx: p.x, wy: p.y }));
      for (let i = 0; i + 1 < vts.length; i++) {
        const a = vts[i];
        const b = vts[i + 1];
        if (a && b) {
          samples.push({ wx: (a.x + b.x) / 2, wy: (a.y + b.y) / 2 });
        }
      }
      pushRotatedPeerSamples(xr, yr, cx, cy, rot, rotationLayout, samples);
      break;
    }
    case "RECT": {
      let w = typeof shape.width === "number" ? shape.width : 6;
      let h = typeof shape.height === "number" ? shape.height : 4;
      if (!Number.isFinite(w)) w = 6;
      if (!Number.isFinite(h)) h = 4;
      const x0 = shape.x;
      const y0 = shape.y;
      const x1 = x0 + w;
      const y1 = y0 + h;
      const cx = x0 + w / 2;
      const cy = y0 + h / 2;
      const samples = [
        { wx: x0, wy: y0 },
        { wx: x1, wy: y0 },
        { wx: x1, wy: y1 },
        { wx: x0, wy: y1 },
        { wx: (x0 + x1) / 2, wy: y0 },
        { wx: (x0 + x1) / 2, wy: y1 },
        { wx: x0, wy: (y0 + y1) / 2 },
        { wx: x1, wy: (y0 + y1) / 2 },
      ];
      pushRotatedPeerSamples(xr, yr, cx, cy, rot, rotationLayout, samples);
      break;
    }
    default:
      break;
  }
  return { xr, yr };
}

function nearestPeerScalarSnapMeta(
  scalar: number,
  peers: readonly number[],
  tol: number,
): { value: number; snappedToPeer: boolean } {
  let out = scalar;
  let bestD = Infinity;
  for (const p of peers) {
    if (!Number.isFinite(p)) continue;
    const d = Math.abs(p - scalar);
    if (!(d <= tol)) continue;
    if (bestD === Infinity || d + 1e-15 < bestD || (Math.abs(d - bestD) <= 1e-14 && p < out)) {
      bestD = d;
      out = p;
    }
  }
  return { value: out, snappedToPeer: bestD !== Infinity };
}

function iterateDeckVertices(polygons: StageDeckPolygon[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const poly of polygons) {
    for (const p of poly.points) {
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      out.push({ x: p.x, y: p.y });
    }
  }
  return out;
}

function lexKey(x: number, y: number): string {
  return `${x.toFixed(9)},${y.toFixed(9)}`;
}

type DeckSegment = { ax: number; ay: number; bx: number; by: number };

/** Closed-ring edges across all deck polygons. */
function iterateDeckSegments(polygons: StageDeckPolygon[]): DeckSegment[] {
  const out: DeckSegment[] = [];
  for (const poly of polygons) {
    const pts = poly.points;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % n];
      if (!a || !b) continue;
      if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) continue;
      const len2 = (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
      if (!(len2 > 1e-12)) continue;
      out.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y });
    }
  }
  return out;
}

/** Closest squared distance from P to clamped segment AB, and the clamped foot. */
function nearestSquaredDistanceFootOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { fx: number; fy: number; d2: number } {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 > 0 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2)) : 0;
  const fx = ax + abx * t;
  const fy = ay + aby * t;
  const dx = px - fx;
  const dy = py - fy;
  return { fx, fy, d2: dx * dx + dy * dy };
}

/** Linear snap to whichever guide lies within tol (nearest on tie under strict inequality). */
function snapScalarTowardAxisGuidesMeta(
  scalar: number,
  guides: readonly number[],
  tol: number,
): { value: number; snapped: boolean } {
  let picked = scalar;
  let bestD = Infinity;
  for (const g of guides) {
    const d = Math.abs(scalar - g);
    if (d <= tol && d + 1e-12 < bestD) {
      bestD = d;
      picked = g;
    }
  }
  return { value: picked, snapped: bestD !== Infinity };
}

/** Round to canonical grid spacing (½′ or ¼ m). The producer plot UI holds Alt to bypass this on drag/resize/place clicks. */
export function snapStageCoordinate(value: number, unitFeetOrMeters: "FEET" | "METERS"): number {
  const step = unitFeetOrMeters === "FEET" ? 0.5 : 0.25;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value / step) * step;
}

/** World-units Δ for one snapped keyboard nudge; matches {@link snapStageCoordinate} grid spacing. */
export function snapStageCoordinateStep(unitFeetOrMeters: "FEET" | "METERS"): number {
  return unitFeetOrMeters === "FEET" ? 0.5 : 0.25;
}

export function defaultStageDesignCanvas(): StageDesignCanvas {
  return {
    version: STAGE_DESIGN_SCHEMA_VERSION,
    footprint: { width: 40, depth: 24 },
    plotMargins: { ...DEFAULT_PLOT_MARGINS },
    placements: [],
    shapes: [],
  };
}

export function clampFootprint(width: number, depth: number): StageDesignFootprint {
  const w = Number.isFinite(width) ? width : DIM_MIN;
  const d = Number.isFinite(depth) ? depth : DIM_MIN;
  return {
    width: Math.min(DIM_HARD_MAX, Math.max(DIM_MIN, w)),
    depth: Math.min(DIM_HARD_MAX, Math.max(DIM_MIN, d)),
  };
}

function clampRotation(rotationDeg: number | undefined): number | undefined {
  if (rotationDeg === undefined || rotationDeg === null) return undefined;
  let r = Number(rotationDeg);
  if (!Number.isFinite(r)) r = 0;
  r %= 360;
  if (r < 0) r += 360;
  return r;
}

const GLYPH_CLAMP = {
  FEET: {
    fixtureRadius: [0.25, 72] as const,
    powerTriHeight: [0.5, 120] as const,
    decorHalf: [0.25, 160] as const,
    trussHalfLength: [0.5, 320] as const,
    ledHalfWidth: [0.5, 320] as const,
    ledHalfHeight: [0.15, 96] as const,
  },
  METERS: {
    fixtureRadius: [0.08, 22] as const,
    powerTriHeight: [0.15, 40] as const,
    decorHalf: [0.08, 52] as const,
    trussHalfLength: [0.15, 100] as const,
    ledHalfWidth: [0.15, 100] as const,
    ledHalfHeight: [0.05, 30] as const,
  },
} as const;

function clampGlyphScalar(unit: StageDesignUnit, key: keyof PlacementGlyphExtents, v: number): number {
  const b = unit === StageDesignUnit.METERS ? GLYPH_CLAMP.METERS : GLYPH_CLAMP.FEET;
  const [lo, hi] = b[key];
  return Math.min(hi, Math.max(lo, v));
}

function normalizePlacementGlyphExtents(
  kind: StageDesignPlacementKind,
  raw: PlacementGlyphExtents | undefined,
  unit: StageDesignUnit,
): PlacementGlyphExtents | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: PlacementGlyphExtents = {};
  const set = (key: keyof PlacementGlyphExtents, enabled: boolean, v: unknown) => {
    if (!enabled) return;
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return;
    out[key] = clampGlyphScalar(unit, key, n);
  };
  set("fixtureRadius", STAGE_DESIGN_KINDS_USING_FIXTURE_GLYPH_RADIUS.has(kind), raw.fixtureRadius);
  set("powerTriHeight", kind === "POWER" || kind === "POWER_DROP", raw.powerTriHeight);
  set("decorHalf", kind === "DECOR" || kind === "PROJECTOR_SYM", raw.decorHalf);
  set("trussHalfLength", kind === "TRUSS", raw.trussHalfLength);
  const ledExtentsKind = kind === "LED_WALL" || kind === "STRIP_FIXED" || kind === "PROJECTOR_SYM";
  set("ledHalfWidth", ledExtentsKind, raw.ledHalfWidth);
  set("ledHalfHeight", ledExtentsKind, raw.ledHalfHeight);
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Effective symbol draw sizes in canvas units (for preview geometry). */
export function resolvePlacementGlyphWorld(placement: StageDesignPlacement, unit: StageDesignUnit) {
  const g = placement.glyphExtents;
  const M = unit === StageDesignUnit.METERS;
  const base =
    placement.kind === "STRIP_FIXED"
      ? M
        ? { fixtureR: 0.42, powerTriH: 0.82, decorHalf: 0.95, trussHalfLen: 1.25, ledHalfW: 1.6, ledHalfH: 0.12 }
        : { fixtureR: 1.35, powerTriH: 2.65, decorHalf: 3.05, trussHalfLen: 4.25, ledHalfW: 5.2, ledHalfH: 0.4 }
      : placement.kind === "PROJECTOR_SYM"
        ? M
          ? { fixtureR: 0.42, powerTriH: 0.82, decorHalf: 0.95, trussHalfLen: 1.25, ledHalfW: 1.05, ledHalfH: 0.65 }
          : { fixtureR: 1.35, powerTriH: 2.65, decorHalf: 3.05, trussHalfLen: 4.25, ledHalfW: 3.4, ledHalfH: 2.1 }
        : M
          ? { fixtureR: 0.42, powerTriH: 0.82, decorHalf: 0.95, trussHalfLen: 1.25, ledHalfW: 2.1, ledHalfH: 0.55 }
          : { fixtureR: 1.35, powerTriH: 2.65, decorHalf: 3.05, trussHalfLen: 4.25, ledHalfW: 6.75, ledHalfH: 1.75 };
  return {
    fixtureR: g?.fixtureRadius ?? base.fixtureR,
    powerTriH: g?.powerTriHeight ?? base.powerTriH,
    decorHalf: g?.decorHalf ?? base.decorHalf,
    trussHalfLen: g?.trussHalfLength ?? base.trussHalfLen,
    ledHalfW: g?.ledHalfWidth ?? base.ledHalfW,
    ledHalfH: g?.ledHalfHeight ?? base.ledHalfH,
  };
}

function finalizeEntityPeerSnapGroup<T extends { peerSnapGroup?: string }>(row: T): T {
  const g = sanitizePeerSnapGroup(row.peerSnapGroup);
  if (g !== undefined) return { ...row, peerSnapGroup: g };
  const copy = { ...row };
  delete (copy as { peerSnapGroup?: string }).peerSnapGroup;
  return copy;
}

export function clampPlacement(
  placement: StageDesignPlacement,
  footprint: StageDesignFootprint,
  margins: StageDesignPlotMargins,
  unit: StageDesignUnit = StageDesignUnit.FEET,
  deckPolygons?: StageDeckPolygon[],
): StageDesignPlacement {
  const b = getPlotBoundsFromCanvas({ footprint, deckPolygons }, margins);
  let x = placement.x;
  let y = placement.y;
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  x = Math.min(b.maxX, Math.max(b.minX, x));
  y = Math.min(b.maxY, Math.max(b.minY, y));
  if (Object.is(x, -0)) x = 0;
  if (Object.is(y, -0)) y = 0;
  let note = placement.note ?? "";
  if (note.length > NOTE_MAX_CHARS) note = note.slice(0, NOTE_MAX_CHARS);
  const glyphExtents = normalizePlacementGlyphExtents(placement.kind, placement.glyphExtents, unit);
  const equipment = sanitizeStagePlacementEquipment(placement.equipment, placement.kind);
  const out: StageDesignPlacement = {
    ...placement,
    kind: placement.kind,
    id: placement.id,
    x,
    y,
    rotationDeg: clampRotation(placement.rotationDeg),
    note: note.length > 0 ? note : undefined,
    glyphExtents,
  };
  if (equipment !== undefined) out.equipment = equipment;
  else delete out.equipment;
  return finalizeEntityPeerSnapGroup(out);
}

export function clampShape(
  shape: StageDesignShape,
  footprint: StageDesignFootprint,
  margins: StageDesignPlotMargins,
  deckPolygons?: StageDeckPolygon[],
): StageDesignShape {
  const b = getPlotBoundsFromCanvas({ footprint, deckPolygons }, margins);
  const clampPt = (px: number, py: number) => ({
    x: Math.min(b.maxX, Math.max(b.minX, Number.isFinite(px) ? px : 0)),
    y: Math.min(b.maxY, Math.max(b.minY, Number.isFinite(py) ? py : 0)),
  });

  const minDim = 0.25;

  const cableRunSanitized =
    shape.kind === "LINE" || shape.kind === "POLYLINE" ? sanitizeDiagramCableRunKind(shape.cableRun) : undefined;

  const stampCableMetadata = <R extends StageDesignShape>(row: R): R => {
    if (cableRunSanitized !== undefined) return { ...row, cableRun: cableRunSanitized };
    const rowCopy = { ...row };
    delete (rowCopy as { cableRun?: StageDiagramCableRunKind }).cableRun;
    return rowCopy;
  };

  if (shape.kind === "POLYLINE") {
    const cleaned: StageDeckPoint[] = [];
    const src = shape.vertices;
    if (Array.isArray(src)) {
      for (const raw of src) {
        if (cleaned.length >= MAX_STAGE_SHAPE_POLYLINE_VERTICES) break;
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
        const vx = (raw as Record<string, unknown>).x;
        const vy = (raw as Record<string, unknown>).y;
        if (typeof vx !== "number" || typeof vy !== "number" || !Number.isFinite(vx) || !Number.isFinite(vy)) continue;
        const c = clampPt(vx, vy);
        const last = cleaned[cleaned.length - 1];
        if (last && last.x === c.x && last.y === c.y) continue;
        cleaned.push(c);
      }
    }
    const seed = clampPt(shape.x, shape.y);
    while (cleaned.length < 2) {
      if (cleaned.length === 1) {
        const a = cleaned[0]!;
        cleaned.push(clampPt(a.x + minDim, a.y));
      } else {
        cleaned.push(seed);
        cleaned.push(clampPt(seed.x + minDim, seed.y));
      }
    }
    let outPoly: StageDesignShape = {
      ...shape,
      kind: "POLYLINE",
      x: cleaned[0]!.x,
      y: cleaned[0]!.y,
      rotationDeg: clampRotation(shape.rotationDeg),
      vertices: cleaned,
    };
    delete (outPoly as { width?: unknown }).width;
    delete (outPoly as { height?: unknown }).height;
    delete (outPoly as { x2?: unknown }).x2;
    delete (outPoly as { y2?: unknown }).y2;
    const labp = typeof shape.label === "string" ? shape.label.trim().slice(0, LABEL_MAX_CHARS) : "";
    if (labp) outPoly = { ...outPoly, label: labp };
    else delete (outPoly as { label?: unknown }).label;

    const fc = sanitizeStageSvgColor(shape.fill);
    const sc = sanitizeStageSvgColor(shape.stroke);
    if (fc !== undefined) (outPoly as StageDesignShape & { fill?: string }).fill = fc;
    else delete (outPoly as { fill?: string }).fill;
    if (sc !== undefined) (outPoly as StageDesignShape & { stroke?: string }).stroke = sc;
    else delete (outPoly as { stroke?: string }).stroke;

    return finalizeEntityPeerSnapGroup(stampCableMetadata(outPoly));
  }

  const p0 = clampPt(shape.x, shape.y);
  let out: StageDesignShape = {
    ...shape,
    x: p0.x,
    y: p0.y,
    rotationDeg: clampRotation(shape.rotationDeg),
  };

  delete (out as { vertices?: unknown }).vertices;

  if (shape.kind === "RECT") {
    let w = typeof shape.width === "number" ? shape.width : 6;
    let h = typeof shape.height === "number" ? shape.height : 4;
    if (!Number.isFinite(w)) w = 6;
    if (!Number.isFinite(h)) h = 4;
    w = Math.max(minDim, Math.min(b.maxX - p0.x, w));
    h = Math.max(minDim, Math.min(b.maxY - p0.y, h));
    out = { ...out, width: w, height: h };
  } else if (shape.kind === "ELLIPSE") {
    let rx = typeof shape.width === "number" ? shape.width : 4;
    let ry = typeof shape.height === "number" ? shape.height : 3;
    if (!Number.isFinite(rx)) rx = 4;
    if (!Number.isFinite(ry)) ry = 3;
    const maxRx = Math.min(p0.x - b.minX, b.maxX - p0.x);
    const maxRy = Math.min(p0.y - b.minY, b.maxY - p0.y);
    rx = Math.max(minDim, Math.min(Math.max(minDim, maxRx), rx));
    ry = Math.max(minDim, Math.min(Math.max(minDim, maxRy), ry));
    out = { ...out, width: rx, height: ry };
  } else if (shape.kind === "LINE") {
    const p1 = clampPt(shape.x2 ?? shape.x, shape.y2 ?? shape.y);
    out = { ...out, x2: p1.x, y2: p1.y };
  } else if (shape.kind === "TEXT") {
    const lab = typeof shape.label === "string" ? shape.label.trim().slice(0, LABEL_MAX_CHARS) : "";
    out = { ...out, label: lab.length ? lab : "Label" };
  }

  const fc = sanitizeStageSvgColor(shape.fill);
  const sc = sanitizeStageSvgColor(shape.stroke);
  if (fc !== undefined) (out as StageDesignShape & { fill?: string }).fill = fc;
  else delete (out as { fill?: string }).fill;
  if (sc !== undefined) (out as StageDesignShape & { stroke?: string }).stroke = sc;
  else delete (out as { stroke?: string }).stroke;

  return finalizeEntityPeerSnapGroup(stampCableMetadata(out));
}

function readGlyphExtentsFromRaw(o: Record<string, unknown>): PlacementGlyphExtents | undefined {
  const gRaw = o.glyphExtents;
  if (!gRaw || typeof gRaw !== "object" || Array.isArray(gRaw)) return undefined;
  const g = gRaw as Record<string, unknown>;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) ? v : undefined;
  const out: PlacementGlyphExtents = {};
  const fr = num(g.fixtureRadius);
  const pth = num(g.powerTriHeight);
  const dh = num(g.decorHalf);
  const th = num(g.trussHalfLength);
  const lww = num(g.ledHalfWidth);
  const lwh = num(g.ledHalfHeight);
  if (fr !== undefined) out.fixtureRadius = fr;
  if (pth !== undefined) out.powerTriHeight = pth;
  if (dh !== undefined) out.decorHalf = dh;
  if (th !== undefined) out.trussHalfLength = th;
  if (lww !== undefined) out.ledHalfWidth = lww;
  if (lwh !== undefined) out.ledHalfHeight = lwh;
  return Object.keys(out).length > 0 ? out : undefined;
}

function parsePlacementOne(
  raw: unknown,
  footprint: StageDesignFootprint,
  margins: StageDesignPlotMargins,
  unit: StageDesignUnit,
  deckPolygons?: StageDeckPolygon[],
): StageDesignPlacement | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim().length > 0 ? o.id.trim().slice(0, 128) : null;
  const kindRaw = typeof o.kind === "string" ? o.kind.trim() : "";
  if (!PLACEMENT_KINDS.has(kindRaw as StageDesignPlacementKind)) return null;
  const kind = kindRaw as StageDesignPlacementKind;
  if (!id) return null;

  const x = typeof o.x === "number" ? o.x : Number.NaN;
  const y = typeof o.y === "number" ? o.y : Number.NaN;

  let rotationDeg = o.rotationDeg;
  if (rotationDeg !== undefined && rotationDeg !== null) {
    const r =
      typeof rotationDeg === "number" ? rotationDeg : Number(typeof o.rotation_deg === "number" ? o.rotation_deg : NaN);
    rotationDeg = Number.isFinite(r) ? r : 0;
  } else rotationDeg = undefined;

  let note: string | undefined;
  if (typeof o.note === "string") {
    const t = o.note.trim();
    note = t.length > 0 ? t.slice(0, NOTE_MAX_CHARS) : undefined;
  }

  const glyphExtents = readGlyphExtentsFromRaw(o);

  const layerId = sanitizeDiagramEntityLayerId(typeof o.layerId === "string" ? o.layerId : null);

  const peerSnapGroup = sanitizePeerSnapGroup(typeof o.peerSnapGroup === "string" ? o.peerSnapGroup : undefined);

  const equipRaw = o.equipment ?? o.equipment_meta ?? o.equipmentMeta;
  const equipment = equipRaw !== undefined ? parseStagePlacementEquipmentRaw(kind, equipRaw) : undefined;

  return clampPlacement(
    {
      id,
      kind,
      x,
      y,
      rotationDeg: rotationDeg !== undefined ? (rotationDeg as number) : undefined,
      note,
      glyphExtents,
      ...(layerId !== undefined ? { layerId } : {}),
      ...(peerSnapGroup !== undefined ? { peerSnapGroup } : {}),
      ...(equipment !== undefined ? { equipment } : {}),
    },
    footprint,
    margins,
    unit,
    deckPolygons,
  );
}

export function parsePlacementsFromJsonString(
  raw: string,
  footprint: StageDesignFootprint,
  margins: StageDesignPlotMargins,
  unit: StageDesignUnit = StageDesignUnit.FEET,
  deckPolygons?: StageDeckPolygon[],
): StageDesignPlacement[] {
  const out: StageDesignPlacement[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return out;
  }
  if (!Array.isArray(parsed)) return out;

  const seenIds = new Set<string>();
  for (const row of parsed) {
    const p = parsePlacementOne(row, footprint, margins, unit, deckPolygons);
    if (!p || seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    out.push(p);
    if (out.length >= MAX_STAGE_PLACEMENTS) break;
  }
  return out;
}

function parseShapeOne(
  raw: unknown,
  footprint: StageDesignFootprint,
  margins: StageDesignPlotMargins,
  deckPolygons?: StageDeckPolygon[],
): StageDesignShape | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim().length > 0 ? o.id.trim().slice(0, 128) : null;
  const kindRaw = typeof o.kind === "string" ? o.kind.trim() : "";
  if (!SHAPE_KINDS.has(kindRaw as StageDesignShapeKind)) return null;
  const kind = kindRaw as StageDesignShapeKind;
  if (!id) return null;

  const x = typeof o.x === "number" ? o.x : Number.NaN;
  const y = typeof o.y === "number" ? o.y : Number.NaN;
  const width = typeof o.width === "number" ? o.width : undefined;
  const height = typeof o.height === "number" ? o.height : undefined;
  const x2 = typeof o.x2 === "number" ? o.x2 : undefined;
  const y2 = typeof o.y2 === "number" ? o.y2 : undefined;
  let label: string | undefined;
  if (typeof o.label === "string") label = o.label.slice(0, LABEL_MAX_CHARS);

  let rotationDeg = o.rotationDeg;
  if (rotationDeg !== undefined && rotationDeg !== null) {
    const r = typeof rotationDeg === "number" ? rotationDeg : Number.NaN;
    rotationDeg = Number.isFinite(r) ? r : 0;
  } else rotationDeg = undefined;

  const fillRaw =
    typeof o.fill === "string"
      ? o.fill
      : typeof o.fillColor === "string"
        ? o.fillColor
        : typeof o.fill_color === "string"
          ? o.fill_color
          : undefined;
  const strokeRaw =
    typeof o.stroke === "string"
      ? o.stroke
      : typeof o.strokeColor === "string"
        ? o.strokeColor
        : typeof o.stroke_color === "string"
          ? o.stroke_color
          : undefined;

  let vertices: StageDeckPoint[] | undefined;
  if (kind === "POLYLINE") {
    vertices = [];
    const vr = o.vertices;
    if (Array.isArray(vr)) {
      for (const it of vr) {
        if (vertices.length >= MAX_STAGE_SHAPE_POLYLINE_VERTICES) break;
        if (!it || typeof it !== "object" || Array.isArray(it)) continue;
        const ox = (it as Record<string, unknown>).x;
        const oy = (it as Record<string, unknown>).y;
        if (typeof ox === "number" && typeof oy === "number" && Number.isFinite(ox) && Number.isFinite(oy)) {
          vertices.push({ x: ox, y: oy });
        }
      }
    }
  }

  const shapeLayerId = sanitizeDiagramEntityLayerId(typeof o.layerId === "string" ? o.layerId : null);

  const shapePeerSnapGroup = sanitizePeerSnapGroup(typeof o.peerSnapGroup === "string" ? o.peerSnapGroup : undefined);

  const cableParsed =
    kind === "LINE" || kind === "POLYLINE"
      ? sanitizeDiagramCableRunKind(o.cableRun ?? o.cable_run)
      : undefined;

  return clampShape(
    {
      id,
      kind,
      x,
      y,
      width,
      height,
      x2,
      y2,
      ...(vertices && vertices.length > 0 ? { vertices } : {}),
      label,
      fill: fillRaw,
      stroke: strokeRaw,
      rotationDeg: rotationDeg !== undefined ? (rotationDeg as number) : undefined,
      ...(shapeLayerId !== undefined ? { layerId: shapeLayerId } : {}),
      ...(shapePeerSnapGroup !== undefined ? { peerSnapGroup: shapePeerSnapGroup } : {}),
      ...(cableParsed !== undefined ? { cableRun: cableParsed } : {}),
    },
    footprint,
    margins,
    deckPolygons,
  );
}

export function parseShapesFromJsonString(
  raw: string,
  footprint: StageDesignFootprint,
  margins: StageDesignPlotMargins,
  deckPolygons?: StageDeckPolygon[],
): StageDesignShape[] {
  const out: StageDesignShape[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return out;
  }
  if (!Array.isArray(parsed)) return out;

  const seenIds = new Set<string>();
  for (const row of parsed) {
    const s = parseShapeOne(row, footprint, margins, deckPolygons);
    if (!s || seenIds.has(s.id)) continue;
    seenIds.add(s.id);
    out.push(s);
    if (out.length >= MAX_STAGE_SHAPES) break;
  }
  return out;
}

export const MAX_DECK_POLYGONS_JSON_CHARS = 512_000;

export function parseDeckPolygonsFromJsonString(raw: string, footprint: StageDesignFootprint): StageDeckPolygon[] {
  const fp = clampFootprint(footprint.width, footprint.depth);
  const out: StageDeckPolygon[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return out;
  }
  if (!Array.isArray(parsed)) return out;
  const seenIds = new Set<string>();
  for (const row of parsed) {
    const p = parseDeckPolygonOne(row);
    if (!p || seenIds.has(p.id)) continue;
    seenIds.add(p.id);
    out.push(clampDeckPolygon(p, fp));
    if (out.length >= MAX_STAGE_DECK_MODULES) break;
  }
  return out;
}

export function parseStageDesignCanvas(
  raw: unknown,
  designUnit: StageDesignUnit = StageDesignUnit.FEET,
): StageDesignCanvas {
  const fallback = defaultStageDesignCanvas();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;

  const root = raw as Record<string, unknown>;
  const vn = typeof root.version === "number" && Number.isFinite(root.version) ? root.version : 1;

  let width = fallback.footprint.width;
  let depth = fallback.footprint.depth;
  const fpRaw = root.footprint;
  if (fpRaw && typeof fpRaw === "object" && !Array.isArray(fpRaw)) {
    const f = fpRaw as Record<string, unknown>;
    width = typeof f.width === "number" ? f.width : width;
    depth = typeof f.depth === "number" ? f.depth : depth;
  }

  const cfp = clampFootprint(width, depth);
  const plotMarginsSource: Partial<StageDesignPlotMargins> | undefined =
    root.plotMargins != null && typeof root.plotMargins === "object" && !Array.isArray(root.plotMargins)
      ? (root.plotMargins as Partial<StageDesignPlotMargins>)
      : undefined;
  const plotMargins = clampPlotMargins(plotMarginsSource);
  const hadExplicitPlotMargins = plotMarginsSource !== undefined;

  let deckPolygonsStored: StageDeckPolygon[] | undefined = undefined;
  if (Array.isArray(root.deckPolygons)) {
    const dps: StageDeckPolygon[] = [];
    const seenPolyIds = new Set<string>();
    for (const row of root.deckPolygons) {
      const poly = typeof row === "object" && row !== null && !Array.isArray(row) ? parseDeckPolygonOne(row) : null;
      if (!poly || seenPolyIds.has(poly.id)) continue;
      seenPolyIds.add(poly.id);
      dps.push(clampDeckPolygon(poly, cfp));
      if (dps.length >= MAX_STAGE_DECK_MODULES) break;
    }
    if (dps.length > 0) deckPolygonsStored = dps;
  }
  const deckForClamp =
    deckPolygonsStored !== undefined && deckPolygonsStored.length > 0 ? deckPolygonsStored : undefined;

  const placements: StageDesignPlacement[] = [];
  if (Array.isArray(root.placements)) {
    const seenIds = new Set<string>();
    for (const row of root.placements) {
      const p = parsePlacementOne(row, cfp, plotMargins, designUnit, deckForClamp);
      if (!p || seenIds.has(p.id)) continue;
      seenIds.add(p.id);
      placements.push(p);
      if (placements.length >= MAX_STAGE_PLACEMENTS) break;
    }
  }

  const shapes: StageDesignShape[] = [];
  if (Array.isArray(root.shapes)) {
    const seenIds = new Set<string>();
    for (const row of root.shapes) {
      const s = parseShapeOne(row, cfp, plotMargins, deckForClamp);
      if (!s || seenIds.has(s.id)) continue;
      seenIds.add(s.id);
      shapes.push(s);
      if (shapes.length >= MAX_STAGE_SHAPES) break;
    }
  }

  const hasRichContent =
    placements.length > 0 ||
    shapes.length > 0 ||
    hadExplicitPlotMargins ||
    (deckPolygonsStored !== undefined && deckPolygonsStored.length > 0);
  const version: number =
    hasRichContent ? STAGE_DESIGN_SCHEMA_VERSION : vn === 1 ? 1 : STAGE_DESIGN_SCHEMA_VERSION;

  const initDiagramLayers = parseDiagramLayersField(root.diagramLayers);
  const baseCanvas: StageDesignCanvas = {
    version,
    footprint: cfp,
    plotMargins,
    ...(deckPolygonsStored !== undefined && deckPolygonsStored.length > 0
      ? { deckPolygons: deckPolygonsStored }
      : {}),
    placements,
    shapes,
    ...(initDiagramLayers && initDiagramLayers.length > 0 ? { diagramLayers: initDiagramLayers } : {}),
  };

  const parsedPaintOrder = parseDiagramPaintOrderField(root.diagramPaintOrder);
  const canvasWithMaybeOrder: StageDesignCanvas = parsedPaintOrder
    ? { ...baseCanvas, diagramPaintOrder: parsedPaintOrder }
    : baseCanvas;
  const repairedPaint = repairDiagramPaintOrder(canvasWithMaybeOrder);
  const withoutLayerReconcile: StageDesignCanvas = paintDiagramOrdersEqual(repairedPaint, defaultDiagramPaintOrder(baseCanvas))
    ? baseCanvas
    : { ...baseCanvas, diagramPaintOrder: repairedPaint };
  return reconcileDiagramLayersOnCanvas(withoutLayerReconcile);
}

export type StageDesignCanvasV1 = StageDesignCanvas;
