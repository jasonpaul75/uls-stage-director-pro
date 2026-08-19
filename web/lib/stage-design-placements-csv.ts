import type { StageDesignUnit } from "@prisma/client";

import { DIAGRAM_LAYER_DEFAULT_ID, effectiveDiagramLayerIdForEntity } from "@/lib/stage-design-diagram-layers";

import type {
  StageDeckPolygon,
  StageDeckPoint,
  StageDesignPlacement,
  StageDesignPlacementKind,
  StageDesignShape,
  StagePlacementEquipment,
} from "@/lib/stage-design-canvas";
import {
  STAGE_DESIGN_FIXTURE_LIKE_KINDS,
  STAGE_DESIGN_KIND_LABELS,
  STAGE_SHAPE_KIND_LABELS,
  sanitizePeerSnapGroup,
  SYNTHETIC_DECK_RECT_POLYGON_ID,
} from "@/lib/stage-design-canvas";

/** RFC 4180-style field escape (quotes, commas, CR/LF). */
export function csvEscapeDiagramField(raw: string): string {
  const s = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvLine(cells: string[]): string {
  return `${cells.map(csvEscapeDiagramField).join(",")}\r\n`;
}

export type StageDesignPlacementsCsvOptions = {
  unit: StageDesignUnit;
  placements: StageDesignPlacement[];
};

function placementCsvHeaderCells(uLabel: "ft" | "m"): string[] {
  return [
    "id",
    "kind",
    "note",
    `position_x (${uLabel})`,
    `position_y (${uLabel})`,
    "rotation_deg",
    "diagram_layer_id",
    "peer_snap_group",
    "cue_role",
    "patch_note",
    "gel_note",
    "fixture_id",
    "fixture_profile",
    "fixture_preset_label",
    "dmx_universe",
    "dmx_channel",
  ];
}

function placementCsvDataCells(p: StageDesignPlacement): string[] {
  const lid = effectiveDiagramLayerIdForEntity(p.layerId);
  const tier = lid === DIAGRAM_LAYER_DEFAULT_ID ? "" : lid;
  const peers = sanitizePeerSnapGroup(p.peerSnapGroup) ?? "";
  const eq = p.equipment;
  return [
    p.id,
    STAGE_DESIGN_KIND_LABELS[p.kind],
    p.note ?? "",
    Number.isFinite(p.x) ? String(p.x) : "",
    Number.isFinite(p.y) ? String(p.y) : "",
    String(Math.round(p.rotationDeg ?? 0)),
    tier,
    peers,
    eq?.role ?? "",
    eq?.patch ?? "",
    eq?.gel ?? "",
    eq?.fixtureId ?? "",
    eq?.fixtureProfile ?? "",
    eq?.fixturePresetLabel ?? "",
    eq?.dmxUniverse !== undefined ? String(eq.dmxUniverse) : "",
    eq?.dmxChannel !== undefined ? String(eq.dmxChannel) : "",
  ];
}

/**
 * Floor-plot symbol table for spreadsheets (positions, rotation, tier id, optional `equipment`).
 * BOM-oriented v3.1 slice — same linear units as the diagram (`FEET` / `METERS`).
 */
export function buildStageDesignPlacementsCsv(opts: StageDesignPlacementsCsvOptions): string {
  const u = opts.unit === "METERS" ? "METERS" : "FEET";
  const uLabel = u === "METERS" ? "m" : "ft";
  const sorted = [...opts.placements].sort((a, b) =>
    `${a.kind}\t${a.id}`.localeCompare(`${b.kind}\t${b.id}`),
  );

  let out = csvLine(placementCsvHeaderCells(uLabel));
  for (const p of sorted) {
    out += csvLine(placementCsvDataCells(p));
  }

  return out;
}

/** Named preset row for BOM ↔ catalog joins (browser fixture library presets). */
export type FixtureCatalogPresetRow = {
  label: string;
  role?: string;
  patch?: string;
  gel?: string;
  fixtureId?: string;
  fixtureProfile?: string;
};

type FixtureCatalogEquipmentSource = Pick<
  StagePlacementEquipment,
  "role" | "patch" | "gel" | "fixtureId" | "fixtureProfile"
>;

export function fixturePresetCatalogRowsFromLabels(
  entries: readonly { label: string; equipment: FixtureCatalogEquipmentSource }[],
): FixtureCatalogPresetRow[] {
  return entries.map((e) => ({
    label: e.label,
    role: e.equipment.role,
    patch: e.equipment.patch,
    gel: e.equipment.gel,
    fixtureId: e.equipment.fixtureId,
    fixtureProfile: e.equipment.fixtureProfile,
  }));
}

/** Browser library rows override hosted presets when labels match (case-insensitive). */
export function fixtureCatalogRowsForBomJoin(
  browserEntries: readonly { label: string; equipment: FixtureCatalogEquipmentSource }[],
  hostedPresets?: readonly { label: string; equipment: FixtureCatalogEquipmentSource }[],
): FixtureCatalogPresetRow[] {
  const byKey = new Map<string, FixtureCatalogPresetRow>();
  for (const h of hostedPresets ?? []) {
    const label = h.label.trim();
    if (!label) continue;
    byKey.set(label.toLowerCase(), {
      label: h.label,
      role: h.equipment.role,
      patch: h.equipment.patch,
      gel: h.equipment.gel,
      fixtureId: h.equipment.fixtureId,
      fixtureProfile: h.equipment.fixtureProfile,
    });
  }
  for (const b of browserEntries) {
    const label = b.label.trim();
    if (!label) continue;
    byKey.set(label.toLowerCase(), {
      label: b.label,
      role: b.equipment.role,
      patch: b.equipment.patch,
      gel: b.equipment.gel,
      fixtureId: b.equipment.fixtureId,
      fixtureProfile: b.equipment.fixtureProfile,
    });
  }
  return Array.from(byKey.values());
}

export type FixtureCatalogJoinResolution =
  | { match: ""; row?: undefined }
  | { match: "fixture_preset_label"; row: FixtureCatalogPresetRow }
  | { match: "fixture_id"; row: FixtureCatalogPresetRow };

/**
 * Resolves at most one catalog row per placement: **`fixture_preset_label`** match first (case-insensitive),
 * else unique **`fixture_id`** match among catalog rows (ambiguous duplicates → no join).
 */
export function resolveFixtureCatalogJoin(
  equipment: StagePlacementEquipment | undefined,
  catalog: readonly FixtureCatalogPresetRow[],
): FixtureCatalogJoinResolution {
  if (!equipment || catalog.length === 0) return { match: "" };
  const preset = equipment.fixturePresetLabel?.trim();
  if (preset) {
    const pl = preset.toLowerCase();
    const hit = catalog.find((c) => c.label.trim().toLowerCase() === pl);
    if (hit) return { match: "fixture_preset_label", row: hit };
  }
  const fid = equipment.fixtureId?.trim();
  if (fid) {
    const hits = catalog.filter((c) => (c.fixtureId?.trim() ?? "") === fid);
    if (hits.length === 1) return { match: "fixture_id", row: hits[0]! };
  }
  return { match: "" };
}

export type StageDesignFixturesBomJoinedCsvOptions = {
  unit: StageDesignUnit;
  placements: StageDesignPlacement[];
  catalog: readonly FixtureCatalogPresetRow[];
};

/**
 * Fixture-pack symbols only — same geometry/equipment columns as {@link buildStageDesignPlacementsCsv}, plus catalog join columns.
 */
export function buildStageDesignFixturesBomJoinedCsv(opts: StageDesignFixturesBomJoinedCsvOptions): string {
  const u = opts.unit === "METERS" ? "METERS" : "FEET";
  const uLabel = u === "METERS" ? "m" : "ft";
  const fixtures = opts.placements.filter((p) => STAGE_DESIGN_FIXTURE_LIKE_KINDS.has(p.kind));
  const sorted = [...fixtures].sort((a, b) => `${a.kind}\t${a.id}`.localeCompare(`${b.kind}\t${b.id}`));

  const joinHeaders = [
    "bom_join_match",
    "catalog_label",
    "catalog_cue_role",
    "catalog_patch_note",
    "catalog_gel_note",
    "catalog_fixture_id",
    "catalog_fixture_profile",
  ];

  let out = csvLine([...placementCsvHeaderCells(uLabel), ...joinHeaders]);
  for (const p of sorted) {
    const j = resolveFixtureCatalogJoin(p.equipment, opts.catalog);
    const tail: string[] =
      j.match === ""
        ? ["", "", "", "", "", "", ""]
        : [
            j.match,
            j.row.label,
            j.row.role ?? "",
            j.row.patch ?? "",
            j.row.gel ?? "",
            j.row.fixtureId ?? "",
            j.row.fixtureProfile ?? "",
          ];
    out += csvLine([...placementCsvDataCells(p), ...tail]);
  }

  return out;
}

/** Vertices inlined into `geom_summary` for polygons / deck rows (spreadsheet‑friendly head + overflow count). */
const POLYLINE_CSV_PREVIEW_MAX_VERTICES = 16;
/** Cap polyline weld string so spreadsheet cells stay bounded. */
export const DIAGRAM_SHAPE_GEOM_SUMMARY_MAX_CHARS = 480 as const;

function shapeDiagramLayerTier(layerId: string | undefined): string {
  const lid = effectiveDiagramLayerIdForEntity(layerId);
  return lid === DIAGRAM_LAYER_DEFAULT_ID ? "" : lid;
}

export function diagramPolylineGeomSummaryCsv(vertices: readonly { x: number; y: number }[] | undefined): string {
  if (!vertices || vertices.length === 0) return "";
  const head = vertices.slice(0, POLYLINE_CSV_PREVIEW_MAX_VERTICES).map((v) => `${v.x}|${v.y}`);
  let out = head.join(" ");
  if (vertices.length > POLYLINE_CSV_PREVIEW_MAX_VERTICES) out += ` +${vertices.length - POLYLINE_CSV_PREVIEW_MAX_VERTICES}`;
  return out.length > DIAGRAM_SHAPE_GEOM_SUMMARY_MAX_CHARS
    ? out.slice(0, DIAGRAM_SHAPE_GEOM_SUMMARY_MAX_CHARS)
    : out;
}

export type StageDesignShapesCsvOptions = {
  unit: StageDesignUnit;
  shapes: StageDesignShape[];
};

/**
 * Authoring shapes (rectangles, annotations, paths) in the same coordinate system as symbols.
 */
export function buildStageDesignShapesCsv(opts: StageDesignShapesCsvOptions): string {
  const u = opts.unit === "METERS" ? "METERS" : "FEET";
  const uLabel = u === "METERS" ? "m" : "ft";
  const sorted = [...opts.shapes].sort((a, b) => `${a.kind}\t${a.id}`.localeCompare(`${b.kind}\t${b.id}`));

  let out = csvLine([
    "id",
    "shape_kind",
    "label",
    `anchor_x (${uLabel})`,
    `anchor_y (${uLabel})`,
    "rotation_deg",
    "diagram_layer_id",
    "peer_snap_group",
    "cable_run",
    "width_span",
    "height_span",
    `end_x (${uLabel})`,
    `end_y (${uLabel})`,
    "polyline_vertex_count",
    "geom_summary",
  ]);

  for (const s of sorted) {
    let widthSpan = "";
    let heightSpan = "";
    let endX = "";
    let endY = "";
    let polyCount = "";
    let geom = "";
    switch (s.kind) {
      case "RECT":
      case "ELLIPSE":
      case "TEXT":
        widthSpan = s.width !== undefined && Number.isFinite(s.width) ? String(s.width) : "";
        heightSpan = s.height !== undefined && Number.isFinite(s.height) ? String(s.height) : "";
        break;
      case "LINE":
        endX = s.x2 !== undefined && Number.isFinite(s.x2) ? String(s.x2) : "";
        endY = s.y2 !== undefined && Number.isFinite(s.y2) ? String(s.y2) : "";
        break;
      case "POLYLINE": {
        const n = Array.isArray(s.vertices) ? s.vertices.length : 0;
        polyCount = n > 0 ? String(n) : "";
        geom = diagramPolylineGeomSummaryCsv(s.vertices);
        break;
      }
      default:
        break;
    }

    const tier = shapeDiagramLayerTier(s.layerId);
    const peers = sanitizePeerSnapGroup(s.peerSnapGroup) ?? "";
    const cableRun = s.kind === "LINE" || s.kind === "POLYLINE" ? (s.cableRun ?? "") : "";
    out += csvLine([
      s.id,
      STAGE_SHAPE_KIND_LABELS[s.kind],
      s.label ?? "",
      Number.isFinite(s.x) ? String(s.x) : "",
      Number.isFinite(s.y) ? String(s.y) : "",
      String(Math.round(s.rotationDeg ?? 0)),
      tier,
      peers,
      cableRun,
      widthSpan,
      heightSpan,
      endX,
      endY,
      polyCount,
      geom,
    ]);
  }

  return out;
}

/** User-drawn deck modules only (omit preview-only nominal rectangle id). */
export function filterStageDesignDeckPolygonsForExport(polygons: readonly StageDeckPolygon[] | undefined): StageDeckPolygon[] {
  const list = polygons ?? [];
  return list.filter((p) => p.id !== SYNTHETIC_DECK_RECT_POLYGON_ID);
}

function deckPolygonBboxWorld(points: readonly StageDeckPoint[] | undefined): {
  minX: string;
  maxX: string;
  minY: string;
  maxY: string;
} {
  const empty = { minX: "", maxX: "", minY: "", maxY: "" };
  if (!points || points.length === 0) return empty;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of points) {
    if (!Number.isFinite(v.x) || !Number.isFinite(v.y)) continue;
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }
  if (!Number.isFinite(minX)) return empty;
  return {
    minX: String(minX),
    maxX: String(maxX),
    minY: String(minY),
    maxY: String(maxY),
  };
}

export type StageDesignDeckCsvOptions = {
  unit: StageDesignUnit;
  deckPolygons: StageDeckPolygon[];
};

/**
 * Modular deck hulls in plot space (vertex ring + axis-aligned bounds for quick takeoffs).
 */
export function buildStageDesignDeckCsv(opts: StageDesignDeckCsvOptions): string {
  const u = opts.unit === "METERS" ? "METERS" : "FEET";
  const uLabel = u === "METERS" ? "m" : "ft";
  const sorted = [...opts.deckPolygons].sort((a, b) => a.id.localeCompare(b.id));

  let out = csvLine([
    "id",
    "vertex_count",
    "diagram_layer_id",
    `bbox_min_x (${uLabel})`,
    `bbox_max_x (${uLabel})`,
    `bbox_min_y (${uLabel})`,
    `bbox_max_y (${uLabel})`,
    "geom_summary",
  ]);

  for (const d of sorted) {
    const pts = d.points;
    const n = Array.isArray(pts) ? pts.length : 0;
    const tier = shapeDiagramLayerTier(d.layerId);
    const bbox = deckPolygonBboxWorld(pts);
    out += csvLine([
      d.id,
      n > 0 ? String(n) : "",
      tier,
      bbox.minX,
      bbox.maxX,
      bbox.minY,
      bbox.maxY,
      diagramPolylineGeomSummaryCsv(pts),
    ]);
  }

  return out;
}

export type StageDesignDiagramBomCsvOptions = {
  unit: StageDesignUnit;
  placements: StageDesignPlacement[];
  shapes: StageDesignShape[];
  /** Custom deck modules; synthetic nominal-deck id is ignored. */
  deckPolygons?: StageDeckPolygon[];
  /**
   * When non-empty, the symbol BOM table keeps only placements whose **`kind`** is listed (order irrelevant).
   * Omit — include all placements (full BOM).
   */
  placementKindsFilter?: readonly StageDesignPlacementKind[];
  /**
   * When **`true`** with a non-empty **`placementKindsFilter`**, shapes and deck blocks
   * are omitted (single-table slice for truss/electrical spreadsheets, etc.). When **`false`**, auxiliary blocks behave as normal.
   */
  focusedSlice?: boolean;
};

/**
 * Combined BOM: symbol table ({@link buildStageDesignPlacementsCsv}), optional shapes ({@link buildStageDesignShapesCsv}),
 * optional deck modules ({@link buildStageDesignDeckCsv}). Each non-empty block is separated by a blank line.
 *
 * Optionally filter symbol rows via **`placementKindsFilter`**; **`focusedSlice`** trims to symbols only when filtering.
 */
export function buildStageDesignDiagramBomCsv(opts: StageDesignDiagramBomCsvOptions): string {
  const kindFilter =
    opts.placementKindsFilter && opts.placementKindsFilter.length > 0 ? new Set(opts.placementKindsFilter) : null;
  const placementsForSym =
    kindFilter !== null ? opts.placements.filter((p) => kindFilter.has(p.kind)) : opts.placements;
  const omitAuxBlocks = Boolean(kindFilter !== null && opts.focusedSlice);
  const deckForCsv = omitAuxBlocks ? [] : filterStageDesignDeckPolygonsForExport(opts.deckPolygons);
  const shapesForCsv = omitAuxBlocks ? [] : opts.shapes;

  const parts: string[] = [];

  if (placementsForSym.length > 0) {
    parts.push(buildStageDesignPlacementsCsv({ unit: opts.unit, placements: placementsForSym }).trimEnd());
  }
  if (shapesForCsv.length > 0) {
    parts.push(buildStageDesignShapesCsv({ unit: opts.unit, shapes: shapesForCsv }).trimEnd());
  }
  if (deckForCsv.length > 0) {
    parts.push(buildStageDesignDeckCsv({ unit: opts.unit, deckPolygons: deckForCsv }).trimEnd());
  }

  if (parts.length > 0) {
    return `${parts.join("\r\n\r\n")}\r\n`;
  }

  return buildStageDesignPlacementsCsv({ unit: opts.unit, placements: [] });
}

/** Download UTF-8 CSV in the browser (same pattern as vector/raster diagram exports). */
export function triggerUtf8CsvDownload(body: string, filename: string): void {
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
