"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";

import {
  clampPlacement,
  clampShape,
  defaultDiagramPaintOrder,
  getPlotBoundsFromCanvas,
  MAX_STAGE_PLACEMENTS,
  insertPolylineVertexOnSegment,
  MAX_STAGE_SHAPE_POLYLINE_VERTICES,
  MAX_STAGE_SHAPES,
  MAX_STAGE_DECK_MODULES,
  paintDiagramOrdersEqual,
  peerSnapGroupFilterForManipulator,
  removePolylineVertexAtIndex,
  resolvePlacementGlyphWorld,
  rectangleDeckPolygonFromCorners,
  sanitizePeerSnapGroup,
  sanitizeStagePlacementEquipment,
  sanitizeStageSvgColor,
  normalizeDeckPolygons,
  peerSnapRotationLayoutFromPlotView,
  repairDiagramPaintOrder,
  type PeerAlignSnapResult,
  type PeerSnapExclude,
  snapPlotWorldXYToPeerAlignWithMeta,
  snapPlotWorldXYToStructuralGuidesWithMeta,
  snapStageCoordinate,
  snapStageCoordinateStep,
  STAGE_DESIGN_KIND_LABELS,
  STAGE_DESIGN_PLACEMENT_KIND_ORDER,
  placementKindAllowsDmxEquipment,
  STAGE_DESIGN_FIXTURE_LIKE_KINDS,
  STAGE_DESIGN_KINDS_USING_FIXTURE_GLYPH_RADIUS,
  STAGE_DESIGN_SCHEMA_VERSION,
  STAGE_SHAPE_KIND_LABELS,
  STAGE_PLACEMENT_EQUIPMENT_ROLE_MAX_CHARS,
  STAGE_PLACEMENT_EQUIPMENT_PATCH_MAX_CHARS,
  STAGE_PLACEMENT_EQUIPMENT_GEL_MAX_CHARS,
  STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS,
  STAGE_PLACEMENT_EQUIPMENT_FIXTURE_PROFILE_MAX_CHARS,
  PEER_SNAP_GROUP_MAX_CHARS,
  SYNTHETIC_DECK_RECT_POLYGON_ID,
  type StageDiagramPaintRef,
  type StageDeckPoint,
  type StageDeckPolygon,
  type StageDesignFootprint,
  type StageDesignCanvas,
  type PlacementGlyphExtents,
  type StageDesignPlotMargins,
  type StageDesignPlacement,
  type StageDesignPlacementKind,
  type StageDesignShape,
  type StagePlacementEquipment,
  type StageDesignShapeKind,
} from "@/lib/stage-design-canvas";
import type { StageDesignUnit } from "@prisma/client";
import { StageDiagramDimensionReadouts } from "@/components/stage-design/stage-diagram-dimension-readouts";
import { StageDiagramLegend } from "@/components/stage-design/stage-diagram-legend";
import { StageFootprintPreview } from "@/components/stage-design/stage-footprint-preview";
import { Button } from "@/components/ui";
import {
  sanitizeDiagramSvgFilenameSlug,
  svgDiagramSerializedForExport,
  triggerPdfDiagramDownload,
  triggerPngDiagramDownload,
  triggerSvgDiagramDownload,
} from "@/lib/stage-design-svg-export";
import {
  buildStageDesignDiagramBomCsv,
  filterStageDesignDeckPolygonsForExport,
  triggerUtf8CsvDownload,
} from "@/lib/stage-design-placements-csv";
import { buildStageDesignDxf, triggerAsciiDxfDownload } from "@/lib/stage-design-dxf-export";
import { importMinimalAsciiDxfEntities } from "@/lib/stage-design-dxf-import";
import {
  applyDeckAxisAlignedRectangleCornerResize,
  clampDeckPolygonToPlotBounds,
  translateDeckPolygon,
} from "@/lib/stage-design-deck-resize";
import { applyShapeResize, type ResizeCornerId, type ShapeResizeHandleEncoded } from "@/lib/stage-design-shape-resize";
import {
  authoringRotationDegreesAtPointer,
  plotPointerAngleDegrees,
  stagePlacementRotationPivotWorld,
  stageShapeRotationPivotWorld,
} from "@/lib/stage-design-shape-rotate";
import { plotLayoutForCanvas, svgScreenPointToPlotWorld } from "@/lib/stage-design-svg-layout";
import type { ProducerDiagramHistoryCallbacks } from "@/lib/stage-design-diagram-history";
import {
  assignDiagramTierUnderFolderPrefix,
  bumpDiagramPaintOrderWithinDiagramLayer,
  collectDiagramLayerNestTierIndices,
  DIAGRAM_LAYER_DEFAULT_ID,
  diagramLayerPrimitiveIdsTsv,
  diagramLayersListPaneItems,
  diagramPaintLeadRefFromSelectionSets,
  diagramPaintRefsForPresentation,
  diagramTierBracketReorderLocked,
  listPrimitiveIdsOnDiagramLayer,
  MAX_DIAGRAM_LAYERS,
  MAX_DIAGRAM_LAYER_GROUP_CHARS,
  effectiveDiagramLayerIdForPaintRef,
  effectiveDiagramLayerIdForEntity,
  moveDiagramPaintRefToDiagramLayerPaintExtreme,
  reorderDiagramLayerStackRow,
  sanitizeDiagramLayerGroup,
  type DiagramLayerNestNode,
  type StageDiagramLayer,
} from "@/lib/stage-design-diagram-layers";
import {
  appendDiagramLayerTemplateTiers,
  diagramCustomTiersToTemplateRows,
  diagramLayersToTemplateJson,
  parseDiagramLayerTemplateEnvelope,
  triggerUtf8JsonDownload,
} from "@/lib/stage-diagram-layer-template";
import {
  addDiagramLayerLocalPreset,
  loadDiagramLayerLocalPresets,
  maxDiagramLayerLocalPresets,
  removeDiagramLayerLocalPreset,
  saveDiagramLayerLocalPresets,
  type DiagramLayerNamedLocalPreset,
} from "@/lib/stage-diagram-layer-local-presets";
import { keyboardFocusIsTypingField } from "@/lib/keyboard-focus-is-typing-field";
import {
  STAGE_DIAGRAM_CABLE_RUN_LABELS,
  STAGE_DIAGRAM_CABLE_RUN_ORDER,
  sanitizeDiagramCableRunKind,
} from "@/lib/stage-design-cable-run";

const DIAGRAM_INSPECTOR_ID_PREVIEW_CAP = 8;

function appendPeerSnapGroupToExclude(
  placements: readonly StageDesignPlacement[],
  shapes: readonly StageDesignShape[],
  base: PeerSnapExclude | undefined,
  movingPlacementIds: readonly string[],
  movingShapeIds: readonly string[],
): PeerSnapExclude | undefined {
  const fl = peerSnapGroupFilterForManipulator({
    placements,
    shapes,
    movingPlacementIds,
    movingShapeIds,
  });
  if (!fl || !base) return base;
  return { ...base, peerSnapGroup: fl };
}

const SHAPE_TOOLS: StageDesignShapeKind[] = ["RECT", "LINE", "POLYLINE", "ELLIPSE", "TEXT"];

function colorInputCompatibleHex(fill: string | undefined, fallback6: `#${string}`): `#${string}` {
  const v = sanitizeStageSvgColor(fill);
  if (!v) return fallback6;
  const hex = v.slice(1);
  if (hex.length === 6) return v as `#${string}`;
  if (hex.length === 3)
    return (`#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`) as `#${string}`;
  if (hex.length === 8) return (`#${hex.slice(0, 6)}`) as `#${string}`;
  return fallback6;
}

function omitPlacementGlyphKey(
  ge: PlacementGlyphExtents | undefined,
  key: keyof PlacementGlyphExtents,
): PlacementGlyphExtents | undefined {
  if (!ge) return undefined;
  const next: PlacementGlyphExtents = { ...ge };
  delete next[key];
  return Object.values(next).some((x) => typeof x === "number" && Number.isFinite(x)) ? next : undefined;
}

/** Commit merged equipment blob; clears `equipment` when sanitize yields nothing (forward‑compatible strip). */
function applyPlacementEquipmentForCommit(
  row: StageDesignPlacement,
  merged: StagePlacementEquipment,
  footprint: StageDesignFootprint,
  margins: StageDesignPlotMargins,
  unit: StageDesignUnit,
  deckClamp: StageDeckPolygon[] | undefined,
): StageDesignPlacement {
  const s = sanitizeStagePlacementEquipment(merged, row.kind);
  if (!s) {
    const rest: StageDesignPlacement = { ...row };
    delete rest.equipment;
    return clampPlacement(rest, footprint, margins, unit, deckClamp);
  }
  return clampPlacement({ ...row, equipment: s }, footprint, margins, unit, deckClamp);
}

export type ProducerStageFloorPlacementsProps = {
  unit: StageDesignUnit;
  footprint: StageDesignFootprint;
  deckPolygons: StageDeckPolygon[];
  onDeckPolygonsChange: (next: StageDeckPolygon[]) => void;
  plotMargins: StageDesignPlotMargins;
  placements: StageDesignPlacement[];
  shapes: StageDesignShape[];
  onPlacementsChange: (next: StageDesignPlacement[]) => void;
  onShapesChange: (next: StageDesignShape[]) => void;
  /** Basename slug for diagram downloads (`{slug}.svg`, `{slug}.png`, `{slug}.pdf`, `{slug}-bom.csv`, `{slug}-truss-bom.csv`, `{slug}-fixtures-bom.csv`, `{slug}-plot.dxf`). */
  diagramExportFileSlug?: string;
  /** When set, persists cross-category SVG stacking (otherwise legacy deck→shapes→symbols). */
  diagramPaintOrder?: StageDiagramPaintRef[];
  onDiagramPaintOrderChange?: (next: StageDiagramPaintRef[] | undefined) => void;
  /** Bottom → top stack (`Main` is index 0); drives SVG paint grouping with per-entity optional `layerId`. */
  diagramLayers: StageDiagramLayer[];
  onDiagramLayersChange: (next: StageDiagramLayer[]) => void;
  /** When set, coalesces undo for drag/resize/rotate vs discrete commits (see `ProducerStageDesignForm`). */
  diagramHistoryCallbacks?: ProducerDiagramHistoryCallbacks | null;
};

type Workspace = "symbols" | "select" | "shapes" | "deck";

const STAGE_DESIGN_WORKSPACE_STORAGE_KEY = "uls_stage_design_workspace_v1";
const STAGE_DESIGN_SYMBOL_KIND_STORAGE_KEY = "uls_stage_design_symbol_kind_v1";
const STAGE_DESIGN_SHAPE_TOOL_STORAGE_KEY = "uls_stage_design_shape_tool_v1";
const STAGE_DESIGN_ACTIVE_LAYER_STORAGE_KEY = "uls_stage_design_active_layer_v1";

/** Segment control row; Digit1 … Digit4 switch workspace when focus is not in a typed field. */
const STAGE_DESIGN_WORKSPACE_ROWS: readonly (readonly [Workspace, string])[] = [
  ["symbols", "Symbols"],
  ["select", "Select"],
  ["deck", "Deck"],
  ["shapes", "Shapes"],
];

const STAGE_DESIGN_WORKSPACE_DIGIT_CODES = ["Digit1", "Digit2", "Digit3", "Digit4"] as const;

/** One-click palette rows beside **Add layer** (name + optional folder path). */
const DIAGRAM_LAYER_QUICK_PRESETS: readonly { readonly label: string; readonly name: string; readonly group?: string }[] =
  [
    { label: "LX", name: "LX", group: "Lighting" },
    { label: "Rig", name: "Rigging", group: "Rigging" },
    { label: "Notes", name: "Notes", group: "Documentation" },
  ];

function diagramFolderPathHighlightKey(segments: readonly string[]): string {
  return JSON.stringify([...segments]);
}

/** Digit5→Digit9 in Symbols → placement kinds toolbar; in Shapes → shape tools toolbar (left to right). */
const STAGE_DESIGN_SYMBOL_SHAPE_DIGIT_CODES = ["Digit5", "Digit6", "Digit7", "Digit8", "Digit9"] as const;

const STAGE_DESIGN_WORKSPACE_HOTKEY_CAPTION =
  " · Keys 1–4: Symbols · Select · Deck · Shapes (outside text fields)";

const STAGE_DESIGN_SYMBOLS_DIGIT_CAPTION =
  " · Keys 5–9 select symbol kinds left-to-right in the toolbar";

const STAGE_DESIGN_SHAPES_DIGIT_CAPTION =
  " · Keys 5–9 select shape tools left-to-right in the toolbar";

/** Short toolbar labels — full wording in hover (`title`). */
const SYMBOL_TOOLBAR_COMPACT_LABEL: Record<StageDesignPlacementKind, string> = {
  FIXTURE: "Fx",
  WASH_MOVING: "Wash",
  BEAM_MOVING: "Beam",
  PAR_STATIC: "PAR",
  UPLIGHT: "Up",
  STRIP_FIXED: "Strip",
  LED_WALL: "LED wall",
  POWER_DROP: "Drop",
  POWER: "Pwr hub",
  TRUSS: "Truss",
  DECOR: "Décor",
  PROJECTOR_SYM: "Projector",
};

/** Layer picker sentinel when the selection spans more than one diagram tier — not a persisted `diagramLayers[].id`. */
const DIAGRAM_SELECTION_LAYER_MIXED = "__uls_selection_mixed_layers__";

function cloneSetMinusId(ids: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(ids);
  next.delete(id);
  return next;
}

function countSelectableDeck(ids: ReadonlySet<string>): number {
  return [...ids].filter((id) => id !== SYNTHETIC_DECK_RECT_POLYGON_ID).length;
}

function parseStoredWorkspace(raw: string | null): Workspace | null {
  if (!raw) return null;
  if (raw === "symbols" || raw === "select" || raw === "deck" || raw === "shapes") return raw;
  return null;
}

function parseStoredSymbolKind(raw: string | null): StageDesignPlacementKind | null {
  if (!raw) return null;
  return STAGE_DESIGN_PLACEMENT_KIND_ORDER.some((k) => k === raw) ? (raw as StageDesignPlacementKind) : null;
}

function parseStoredShapeTool(raw: string | null): StageDesignShapeKind | null {
  if (!raw) return null;
  return SHAPE_TOOLS.some((k) => k === raw) ? (raw as StageDesignShapeKind) : null;
}

/** One axis value for producer plot hover readout (feet prime or meters). */
function formatStagePlotAxisCoord(v: number, unit: StageDesignUnit): string {
  const t = Math.abs(v) >= 99.5 ? v.toFixed(1) : v.toFixed(2);
  return unit === "METERS" ? `${t} m` : `${t}′`;
}

/** Tab-separated world X/Y (`wx`, `wy`) for spreadsheets — same payload as **Copy XY**. */
function copyDiagramWorldXYTabSeparated(pw: { wx: number; wy: number }): void {
  void navigator.clipboard.writeText(`${pw.wx}\t${pw.wy}`).catch(() => {});
}

export function ProducerStageFloorPlacements(props: ProducerStageFloorPlacementsProps) {
  const {
    unit,
    footprint,
    deckPolygons,
    onDeckPolygonsChange: setDeckDiagram,
    plotMargins,
    placements,
    shapes,
    onPlacementsChange: patchPlacementsUpstream,
    onShapesChange: patchShapesUpstream,
    diagramExportFileSlug,
    diagramPaintOrder,
    onDiagramPaintOrderChange,
    diagramLayers,
    onDiagramLayersChange,
    diagramHistoryCallbacks,
  } = props;
  const deckPolygonsForBomExport = useMemo(
    () => filterStageDesignDeckPolygonsForExport(deckPolygons),
    [deckPolygons],
  );
  const trussBomCsvPlacementCount = useMemo(() => placements.filter((p) => p.kind === "TRUSS").length, [placements]);
  const fixtureBomCsvPlacementCount = useMemo(
    () => placements.filter((p) => STAGE_DESIGN_FIXTURE_LIKE_KINDS.has(p.kind)).length,
    [placements],
  );
  const canExportDiagramBomCsv =
    placements.length > 0 || shapes.length > 0 || deckPolygonsForBomExport.length > 0;
  const deckClamp = deckPolygons.length > 0 ? deckPolygons : undefined;
  const [symbolKind, setSymbolKind] = useState<StageDesignPlacementKind>("FIXTURE");
  const [workspace, setWorkspace] = useState<Workspace>("symbols");
  const [shapeTool, setShapeTool] = useState<StageDesignShapeKind>("RECT");
  const [shapeDraft, setShapeDraft] = useState<{ x: number; y: number } | null>(null);
  const [polylineDraftPoints, setPolylineDraftPoints] = useState<StageDeckPoint[] | null>(null);
  const [deckRectDraft, setDeckRectDraft] = useState<{ x: number; y: number } | null>(null);
  const [selectedPlacementIds, setSelectedPlacementIds] = useState(() => new Set<string>());
  const [selectedShapeIds, setSelectedShapeIds] = useState(() => new Set<string>());
  const [selectedDeckPolygonIds, setSelectedDeckPolygonIds] = useState(() => new Set<string>());

  const selectedPlacementIdsRef = useRef<ReadonlySet<string>>(selectedPlacementIds);
  const selectedShapeIdsRef = useRef<ReadonlySet<string>>(selectedShapeIds);
  const selectedDeckPolygonIdsRef = useRef<ReadonlySet<string>>(selectedDeckPolygonIds);
  useLayoutEffect(() => {
    selectedPlacementIdsRef.current = selectedPlacementIds;
  }, [selectedPlacementIds]);
  useLayoutEffect(() => {
    selectedShapeIdsRef.current = selectedShapeIds;
  }, [selectedShapeIds]);
  useLayoutEffect(() => {
    selectedDeckPolygonIdsRef.current = selectedDeckPolygonIds;
  }, [selectedDeckPolygonIds]);

  const [activeDiagramLayerId, setActiveDiagramLayerId] = useState<string>(
    () =>
      diagramLayers.find((l) => l.visible !== false)?.id ??
      diagramLayers[0]?.id ??
      DIAGRAM_LAYER_DEFAULT_ID,
  );
  const [layerRemoveMigrateOpenId, setLayerRemoveMigrateOpenId] = useState<string | null>(null);
  const [layerRemoveMigrateTargetId, setLayerRemoveMigrateTargetId] = useState<string>(DIAGRAM_LAYER_DEFAULT_ID);
  const [diagramFolderDropHighlightKey, setDiagramFolderDropHighlightKey] = useState<string | null>(null);
  const diagramTemplateImportInputRef = useRef<HTMLInputElement>(null);
  const dxfImportInputRef = useRef<HTMLInputElement>(null);
  const [diagramTemplateImportMsg, setDiagramTemplateImportMsg] = useState<string | null>(null);
  const [dxfImportMsg, setDxfImportMsg] = useState<string | null>(null);
  const layerPresetStorageKey = useMemo(
    () => (diagramExportFileSlug?.trim() ? diagramExportFileSlug.trim().slice(0, 96) : "default"),
    [diagramExportFileSlug],
  );
  const [browserLayerPresetLabel, setBrowserLayerPresetLabel] = useState("");
  const [browserLayerPresets, setBrowserLayerPresets] = useState<DiagramLayerNamedLocalPreset[]>([]);
  const [diagramLayersDrawerOpen, setDiagramLayersDrawerOpen] = useState(false);

  const effectiveActiveDiagramLayerId = useMemo(() => {
    if (diagramLayers.some((l) => l.id === activeDiagramLayerId && l.visible !== false)) {
      return activeDiagramLayerId;
    }
    return diagramLayers.find((l) => l.visible !== false)?.id ?? DIAGRAM_LAYER_DEFAULT_ID;
  }, [diagramLayers, activeDiagramLayerId]);

  const resolvedLayerRemoveMigrateOpenId = useMemo(
    () =>
      layerRemoveMigrateOpenId && diagramLayers.some((l) => l.id === layerRemoveMigrateOpenId)
        ? layerRemoveMigrateOpenId
        : null,
    [diagramLayers, layerRemoveMigrateOpenId],
  );

  const [authoringSnapGuidesOverlay, setAuthoringSnapGuidesOverlay] = useState<{
    structural?: {
      verticalX?: number;
      horizontalY?: number;
      edge?: { x1: number; y1: number; x2: number; y2: number };
    };
    peer?: { verticalX?: number; horizontalY?: number };
  } | null>(null);
  const [plotPointerWorld, setPlotPointerWorld] = useState<{ wx: number; wy: number } | null>(null);
  const plotPointerWorldRef = useRef(plotPointerWorld);
  useLayoutEffect(() => {
    plotPointerWorldRef.current = plotPointerWorld;
  }, [plotPointerWorld]);

  useLayoutEffect(() => {
    let cancelled = false;
    const id = requestAnimationFrame(() => {
      if (cancelled) return;
      try {
        const restoredWs = parseStoredWorkspace(sessionStorage.getItem(STAGE_DESIGN_WORKSPACE_STORAGE_KEY));
        if (restoredWs) setWorkspace(restoredWs);
        const restoredSym = parseStoredSymbolKind(sessionStorage.getItem(STAGE_DESIGN_SYMBOL_KIND_STORAGE_KEY));
        if (restoredSym) setSymbolKind(restoredSym);
        const restoredShapeTool = parseStoredShapeTool(sessionStorage.getItem(STAGE_DESIGN_SHAPE_TOOL_STORAGE_KEY));
        if (restoredShapeTool) setShapeTool(restoredShapeTool);
        const restoredLayer = sessionStorage.getItem(STAGE_DESIGN_ACTIVE_LAYER_STORAGE_KEY);
        if (
          restoredLayer &&
          diagramLayers.some((l) => l.id === restoredLayer && l.visible !== false)
        ) {
          setActiveDiagramLayerId(restoredLayer);
        }
      } catch {
        /* private mode / storage blocked */
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot session restore from storage; tiers may load after paint.
  }, []);

  const [diagramSnapshotRasterBusy, setDiagramSnapshotRasterBusy] = useState(false);
  const [diagramSnapshotRasterMessage, setDiagramSnapshotRasterMessage] = useState<string | null>(null);
  const diagramSnapshotRasterNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    /* Client-only hydrate when slug-derived preset key changes; localStorage unavailable during SSR. */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-way sync from persisted presets
    setBrowserLayerPresets(loadDiagramLayerLocalPresets(layerPresetStorageKey));
  }, [layerPresetStorageKey]);

  useEffect(() => {
    if (!diagramLayersDrawerOpen) return;
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDiagramLayersDrawerOpen(false);
    };
    window.addEventListener("keydown", onDocKey);
    return () => window.removeEventListener("keydown", onDocKey);
  }, [diagramLayersDrawerOpen]);

  useEffect(() => {
    return () => {
      if (diagramSnapshotRasterNoticeTimeoutRef.current)
        clearTimeout(diagramSnapshotRasterNoticeTimeoutRef.current);
    };
  }, []);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const handleExportSvg = useCallback(() => {
    const el = svgRef.current;
    if (!el || typeof XMLSerializer === "undefined") return;
    try {
      const xml = svgDiagramSerializedForExport(el);
      const slug = sanitizeDiagramSvgFilenameSlug(diagramExportFileSlug ?? "stage-diagram");
      triggerSvgDiagramDownload(xml, `${slug}.svg`);
    } catch {
      /* clone/serialize can fail in restrictive environments */
    }
  }, [diagramExportFileSlug]);

  const handleExportPng = useCallback(async () => {
    const el = svgRef.current;
    if (!el || typeof XMLSerializer === "undefined") return;
    const failMsg =
      "Snapshot (PNG/PDF) couldn't render in this browser—use Export SVG, or relax privacy/blocking settings for downloads and canvas.";
    setDiagramSnapshotRasterBusy(true);
    setDiagramSnapshotRasterMessage(null);
    try {
      const xml = svgDiagramSerializedForExport(el);
      const slug = sanitizeDiagramSvgFilenameSlug(diagramExportFileSlug ?? "stage-diagram");
      const ok = await triggerPngDiagramDownload(xml, `${slug}.png`);
      if (!ok) {
        setDiagramSnapshotRasterMessage(failMsg);
        if (diagramSnapshotRasterNoticeTimeoutRef.current)
          clearTimeout(diagramSnapshotRasterNoticeTimeoutRef.current);
        diagramSnapshotRasterNoticeTimeoutRef.current = setTimeout(() => {
          diagramSnapshotRasterNoticeTimeoutRef.current = null;
          setDiagramSnapshotRasterMessage(null);
        }, 10000);
      }
    } catch {
      setDiagramSnapshotRasterMessage(failMsg);
      if (diagramSnapshotRasterNoticeTimeoutRef.current)
        clearTimeout(diagramSnapshotRasterNoticeTimeoutRef.current);
      diagramSnapshotRasterNoticeTimeoutRef.current = setTimeout(() => {
        diagramSnapshotRasterNoticeTimeoutRef.current = null;
        setDiagramSnapshotRasterMessage(null);
      }, 10000);
    } finally {
      setDiagramSnapshotRasterBusy(false);
    }
  }, [diagramExportFileSlug]);

  const handleExportPdf = useCallback(async () => {
    const el = svgRef.current;
    if (!el || typeof XMLSerializer === "undefined") return;
    const failMsg =
      "Snapshot (PNG/PDF) couldn't render in this browser—use Export SVG, or relax privacy/blocking settings for downloads and canvas.";
    setDiagramSnapshotRasterBusy(true);
    setDiagramSnapshotRasterMessage(null);
    try {
      const xml = svgDiagramSerializedForExport(el);
      const slug = sanitizeDiagramSvgFilenameSlug(diagramExportFileSlug ?? "stage-diagram");
      const ok = await triggerPdfDiagramDownload(xml, `${slug}.pdf`);
      if (!ok) {
        setDiagramSnapshotRasterMessage(failMsg);
        if (diagramSnapshotRasterNoticeTimeoutRef.current)
          clearTimeout(diagramSnapshotRasterNoticeTimeoutRef.current);
        diagramSnapshotRasterNoticeTimeoutRef.current = setTimeout(() => {
          diagramSnapshotRasterNoticeTimeoutRef.current = null;
          setDiagramSnapshotRasterMessage(null);
        }, 10000);
      }
    } catch {
      setDiagramSnapshotRasterMessage(failMsg);
      if (diagramSnapshotRasterNoticeTimeoutRef.current)
        clearTimeout(diagramSnapshotRasterNoticeTimeoutRef.current);
      diagramSnapshotRasterNoticeTimeoutRef.current = setTimeout(() => {
        diagramSnapshotRasterNoticeTimeoutRef.current = null;
        setDiagramSnapshotRasterMessage(null);
      }, 10000);
    } finally {
      setDiagramSnapshotRasterBusy(false);
    }
  }, [diagramExportFileSlug]);
  const handleExportDiagramBomCsv = useCallback(() => {
    if (!canExportDiagramBomCsv) return;
    const slug = sanitizeDiagramSvgFilenameSlug(diagramExportFileSlug ?? "stage-diagram");
    triggerUtf8CsvDownload(
      buildStageDesignDiagramBomCsv({ unit, placements, shapes, deckPolygons }),
      `${slug}-bom.csv`,
    );
  }, [canExportDiagramBomCsv, diagramExportFileSlug, deckPolygons, placements, shapes, unit]);

  const handleExportTrussBomCsv = useCallback(() => {
    if (trussBomCsvPlacementCount === 0) return;
    const slug = sanitizeDiagramSvgFilenameSlug(diagramExportFileSlug ?? "stage-diagram");
    triggerUtf8CsvDownload(
      buildStageDesignDiagramBomCsv({
        unit,
        placements,
        shapes,
        deckPolygons,
        placementKindsFilter: ["TRUSS"],
        focusedSlice: true,
      }),
      `${slug}-truss-bom.csv`,
    );
  }, [
    trussBomCsvPlacementCount,
    diagramExportFileSlug,
    deckPolygons,
    placements,
    shapes,
    unit,
  ]);

  const handleExportFixtureBomCsv = useCallback(() => {
    if (fixtureBomCsvPlacementCount === 0) return;
    const slug = sanitizeDiagramSvgFilenameSlug(diagramExportFileSlug ?? "stage-diagram");
    triggerUtf8CsvDownload(
      buildStageDesignDiagramBomCsv({
        unit,
        placements,
        shapes,
        deckPolygons,
        placementKindsFilter: Array.from(STAGE_DESIGN_FIXTURE_LIKE_KINDS),
        focusedSlice: true,
      }),
      `${slug}-fixtures-bom.csv`,
    );
  }, [
    fixtureBomCsvPlacementCount,
    diagramExportFileSlug,
    deckPolygons,
    placements,
    shapes,
    unit,
  ]);
  const dragRef = useRef<
    | { kind: "placement" | "shape" | "deck"; id: string }
    | {
        kind: "multi";
        placementIds: readonly string[];
        shapeIds: readonly string[];
        deckIds: readonly string[];
      }
    | null
  >(null);
  /** Producer diagram-tier drag source (`diagramLayers` index). Main stays index 0. */
  const diagramLayerReorderFromRef = useRef<number | null>(null);
  const resizeShapeRef = useRef<{
    id: string;
    encoded: ShapeResizeHandleEncoded;
    baseline: StageDesignShape;
  } | null>(null);
  const resizeDeckRef = useRef<{ id: string; corner: ResizeCornerId; baseline: StageDeckPolygon } | null>(null);
  const rotateShapeRef = useRef<{
    id: string;
    pivotWx: number;
    pivotWy: number;
    pointer0Deg: number;
    baselineRotDeg: number;
  } | null>(null);
  const rotatePlacementRef = useRef<{
    id: string;
    pivotWx: number;
    pivotWy: number;
    pointer0Deg: number;
    baselineRotDeg: number;
  } | null>(null);
  const lastWorldRef = useRef<{ wx: number; wy: number } | null>(null);
  const placementsRef = useRef(placements);
  const shapesRef = useRef(shapes);
  const deckPolygonsRef = useRef(deckPolygons);
  const footprintRef = useRef(footprint);
  const plotMarginsRef = useRef(plotMargins);

  useLayoutEffect(() => {
    placementsRef.current = placements;
    shapesRef.current = shapes;
    deckPolygonsRef.current = deckPolygons;
    footprintRef.current = footprint;
    plotMarginsRef.current = plotMargins;
  }, [placements, shapes, deckPolygons, footprint, plotMargins]);

  const commitDeck = useCallback(
    (next: StageDeckPolygon[]) => {
      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
      setDeckDiagram(next);
    },
    [diagramHistoryCallbacks, setDeckDiagram],
  );

  const commitPlacements = useCallback(
    (next: StageDesignPlacement[]) => {
      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
      patchPlacementsUpstream(next);
    },
    [diagramHistoryCallbacks, patchPlacementsUpstream],
  );

  const commitShapes = useCallback(
    (next: StageDesignShape[]) => {
      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
      patchShapesUpstream(next);
    },
    [diagramHistoryCallbacks, patchShapesUpstream],
  );

  const unitKey = unit === "METERS" ? "METERS" : "FEET";

  const previewCanvas = useMemo(
    (): StageDesignCanvas => ({
      version: STAGE_DESIGN_SCHEMA_VERSION,
      footprint,
      ...(deckPolygons.length > 0 ? { deckPolygons } : {}),
      plotMargins,
      placements,
      shapes,
      ...(diagramPaintOrder !== undefined ? { diagramPaintOrder } : {}),
      diagramLayers,
    }),
    [footprint, deckPolygons, plotMargins, placements, shapes, diagramPaintOrder, diagramLayers],
  );

  const selectionDiagramPrimitiveCount = useMemo(
    () =>
      selectedPlacementIds.size + selectedShapeIds.size + countSelectableDeck(selectedDeckPolygonIds),
    [selectedPlacementIds, selectedShapeIds, selectedDeckPolygonIds],
  );

  const selectionDiagramPrimitiveCountRef = useRef(0);
  useLayoutEffect(() => {
    selectionDiagramPrimitiveCountRef.current = selectionDiagramPrimitiveCount;
  }, [selectionDiagramPrimitiveCount]);

  const diagramSelectionConsensusLayerIds = useMemo(() => {
    const layers = new Set<string>();
    for (const id of selectedDeckPolygonIds) {
      if (id === SYNTHETIC_DECK_RECT_POLYGON_ID) continue;
      const poly = deckPolygons.find((p) => p.id === id);
      layers.add(effectiveDiagramLayerIdForEntity(poly?.layerId));
    }
    for (const id of selectedShapeIds) {
      const s = shapes.find((row) => row.id === id);
      layers.add(effectiveDiagramLayerIdForEntity(s?.layerId));
    }
    for (const id of selectedPlacementIds) {
      const p = placements.find((row) => row.id === id);
      layers.add(effectiveDiagramLayerIdForEntity(p?.layerId));
    }
    return layers;
  }, [selectedDeckPolygonIds, selectedShapeIds, selectedPlacementIds, deckPolygons, shapes, placements]);

  const diagramSelectionSpansMultipleDiagramLayers = diagramSelectionConsensusLayerIds.size > 1;
  const selectionEffectiveConsensusLayerId = useMemo((): string => {
    if (diagramSelectionConsensusLayerIds.size !== 1) return DIAGRAM_LAYER_DEFAULT_ID;
    return [...diagramSelectionConsensusLayerIds][0]!;
  }, [diagramSelectionConsensusLayerIds]);

  const selectionLayerPickerValue =
    diagramSelectionSpansMultipleDiagramLayers && selectionDiagramPrimitiveCount > 0
      ? DIAGRAM_SELECTION_LAYER_MIXED
      : selectionEffectiveConsensusLayerId;

  const selectionAlreadyMatchesStickyDiagramTier = useMemo(() => {
    if (selectionDiagramPrimitiveCount === 0) return false;
    const sticky = effectiveActiveDiagramLayerId;
    for (const id of selectedPlacementIds) {
      const row = placements.find((p) => p.id === id);
      if (effectiveDiagramLayerIdForEntity(row?.layerId) !== sticky) return false;
    }
    for (const id of selectedShapeIds) {
      const row = shapes.find((s) => s.id === id);
      if (effectiveDiagramLayerIdForEntity(row?.layerId) !== sticky) return false;
    }
    for (const id of selectedDeckPolygonIds) {
      if (id === SYNTHETIC_DECK_RECT_POLYGON_ID) continue;
      const poly = deckPolygons.find((d) => d.id === id);
      if (effectiveDiagramLayerIdForEntity(poly?.layerId) !== sticky) return false;
    }
    return true;
  }, [
    selectionDiagramPrimitiveCount,
    effectiveActiveDiagramLayerId,
    selectedPlacementIds,
    selectedShapeIds,
    selectedDeckPolygonIds,
    placements,
    shapes,
    deckPolygons,
  ]);

  const stickyDiagramTierLabel =
    diagramLayers.find((l) => l.id === effectiveActiveDiagramLayerId)?.name ?? "Main";

  const selectDiagramPaintLeadRef = useMemo(
    () =>
      diagramPaintLeadRefFromSelectionSets(previewCanvas, {
        deckIds: selectedDeckPolygonIds,
        shapeIds: selectedShapeIds,
        placementIds: selectedPlacementIds,
      }),
    [previewCanvas, selectedDeckPolygonIds, selectedShapeIds, selectedPlacementIds],
  );

  const handleExportDiagramDxf = useCallback(() => {
    if (!canExportDiagramBomCsv) return;
    const slug = sanitizeDiagramSvgFilenameSlug(diagramExportFileSlug ?? "stage-diagram");
    triggerAsciiDxfDownload(buildStageDesignDxf({ unit, canvas: previewCanvas }), `${slug}-plot.dxf`);
  }, [canExportDiagramBomCsv, diagramExportFileSlug, previewCanvas, unit]);

  const newEntityLayerPartial = useMemo((): { layerId?: string } => {
    if (effectiveActiveDiagramLayerId === DIAGRAM_LAYER_DEFAULT_ID) return {};
    const layer = diagramLayers.find((l) => l.id === effectiveActiveDiagramLayerId);
    if (!layer || layer.visible === false) return {};
    return { layerId: effectiveActiveDiagramLayerId };
  }, [diagramLayers, effectiveActiveDiagramLayerId]);

  const handleDxfImportSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const file = input.files?.[0];
      input.value = "";
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = importMinimalAsciiDxfEntities(text, { maxShapes: MAX_STAGE_SHAPES });
        if (!parsed.ok) {
          setDxfImportMsg(parsed.error);
          return;
        }
        const curShapes = shapesRef.current;
        const room = MAX_STAGE_SHAPES - curShapes.length;
        if (room <= 0) {
          setDxfImportMsg("Diagram shape cap reached — remove shapes before importing DXF.");
          return;
        }
        const slice = parsed.shapes.slice(0, room);
        const dc = deckPolygonsRef.current.length > 0 ? deckPolygonsRef.current : undefined;
        const layerPart = newEntityLayerPartial;
        diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
        const added: StageDesignShape[] = slice.map((raw) =>
          clampShape(
            { ...raw, id: crypto.randomUUID(), ...layerPart },
            footprintRef.current,
            plotMarginsRef.current,
            dc,
          ),
        );
        const mergedShapes = [...curShapes, ...added];
        patchShapesUpstream(mergedShapes);
        const canvasMerge: StageDesignCanvas = {
          version: STAGE_DESIGN_SCHEMA_VERSION,
          footprint: footprintRef.current,
          ...(deckPolygonsRef.current.length > 0 ? { deckPolygons: deckPolygonsRef.current } : {}),
          plotMargins: plotMarginsRef.current,
          placements: placementsRef.current,
          shapes: mergedShapes,
          ...(diagramPaintOrder !== undefined ? { diagramPaintOrder } : {}),
          diagramLayers,
        };
        onDiagramPaintOrderChange?.(repairDiagramPaintOrder(canvasMerge));
        const parts = [`Imported ${added.length} shape${added.length === 1 ? "" : "s"} from DXF.`];
        if (parsed.skippedDegenerate > 0) parts.push(`${parsed.skippedDegenerate} degenerate/skipped entities.`);
        if (parsed.skippedUnsupportedEntities > 0) {
          parts.push(`${parsed.skippedUnsupportedEntities} unsupported entities (outside LINE/CIRCLE/TEXT/MTEXT/polyline imports).`);
        }
        if (parsed.skippedAfterCap > 0) parts.push(`${parsed.skippedAfterCap} entities skipped (diagram shape cap).`);
        if (slice.length < parsed.shapes.length) {
          parts.push(`Import truncated — only ${room} shape slot${room === 1 ? "" : "s"} remaining.`);
        }
        setDxfImportMsg(parts.join(" "));
      } catch {
        setDxfImportMsg("Could not read DXF file.");
      }
    },
    [
      diagramHistoryCallbacks,
      diagramLayers,
      diagramPaintOrder,
      newEntityLayerPartial,
      onDiagramPaintOrderChange,
      patchShapesUpstream,
    ],
  );

  const pickActiveDiagramLayer = useCallback(
    (id: string) => {
      if (!diagramLayers.some((l) => l.id === id && l.visible !== false)) return;
      setActiveDiagramLayerId(id);
      try {
        sessionStorage.setItem(STAGE_DESIGN_ACTIVE_LAYER_STORAGE_KEY, id);
      } catch {
        /* private mode / storage blocked */
      }
    },
    [diagramLayers],
  );

  const duplicateActiveDiagramTier = useCallback(() => {
    if (diagramLayers.length >= MAX_DIAGRAM_LAYERS) return;
    const srcIdx = diagramLayers.findIndex((l) => l.id === effectiveActiveDiagramLayerId);
    if (srcIdx <= 0) return;
    const src = diagramLayers[srcIdx]!;
    diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
    const id = `uls_layer_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    let nameTry = `${src.name} copy`.trim().slice(0, 64);
    if (!nameTry) nameTry = "Layer";
    const dup: StageDiagramLayer = { id, name: nameTry };
    const groupSan = sanitizeDiagramLayerGroup(src.group);
    if (groupSan) dup.group = groupSan;
    if (src.visible === false) dup.visible = false;
    if (src.bracketReorderLocked === true) dup.bracketReorderLocked = true;
    const next = diagramLayers.slice();
    next.splice(srcIdx + 1, 0, dup);
    onDiagramLayersChange(next);
    setActiveDiagramLayerId(id);
    try {
      sessionStorage.setItem(STAGE_DESIGN_ACTIVE_LAYER_STORAGE_KEY, id);
    } catch {
      /* private mode */
    }
  }, [
    diagramHistoryCallbacks,
    diagramLayers,
    effectiveActiveDiagramLayerId,
    onDiagramLayersChange,
  ]);

  const exportDiagramLayerTemplatePack = useCallback(() => {
    const slug = sanitizeDiagramSvgFilenameSlug(diagramExportFileSlug ?? "stage-diagram");
    triggerUtf8JsonDownload(diagramLayersToTemplateJson(diagramLayers), `${slug}-diagram-layer-template.json`);
    setDiagramTemplateImportMsg(null);
  }, [diagramExportFileSlug, diagramLayers]);

  const onDiagramLayerTemplateImportChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const inputEl = e.currentTarget;
      const file = inputEl.files?.[0];
      inputEl.value = "";
      setDiagramTemplateImportMsg(null);
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = String(reader.result ?? "");
          const tiers = parseDiagramLayerTemplateEnvelope(JSON.parse(text) as unknown);
          if (!tiers?.length) {
            setDiagramTemplateImportMsg("Unrecognized template — need schemaVersion 1 and tiers array.");
            return;
          }
          const stacked = appendDiagramLayerTemplateTiers(diagramLayers, tiers);
          if (!stacked) {
            setDiagramTemplateImportMsg(
              diagramLayers.length >= MAX_DIAGRAM_LAYERS
                ? "Layer stack is full — remove tiers before merging a template."
                : "Nothing new to append from this template.",
            );
            return;
          }
          diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
          const addedCount = stacked.length - diagramLayers.length;
          onDiagramLayersChange(stacked);
          setDiagramTemplateImportMsg(
            addedCount > 0 ? `Merged ${addedCount} tier${addedCount === 1 ? "" : "s"} from template.` : "Merged template.",
          );
        } catch {
          setDiagramTemplateImportMsg("Could not parse JSON template.");
        }
      };
      reader.onerror = () => setDiagramTemplateImportMsg("Could not read file.");
      reader.readAsText(file, "UTF-8");
    },
    [diagramHistoryCallbacks, diagramLayers, onDiagramLayersChange],
  );

  const saveBrowserLayerPreset = useCallback(() => {
    const tiers = diagramCustomTiersToTemplateRows(diagramLayers);
    const r = addDiagramLayerLocalPreset(browserLayerPresets, browserLayerPresetLabel, tiers);
    if (!r.ok) {
      const msg =
        r.reason === "EMPTY_LABEL"
          ? "Enter a preset name before saving."
          : r.reason === "NO_CUSTOM_TIERS"
            ? "Add at least one custom tier (above Main) before saving a browser preset."
            : r.reason === "CAP"
              ? `Browser storage holds up to ${maxDiagramLayerLocalPresets()} presets per project — remove one first.`
              : "A preset with that name already exists for this project (names are case-insensitive).";
      setDiagramTemplateImportMsg(msg);
      return;
    }
    saveDiagramLayerLocalPresets(layerPresetStorageKey, r.presets);
    setBrowserLayerPresets(r.presets);
    const labelSaved = r.presets[r.presets.length - 1]?.label ?? "preset";
    setBrowserLayerPresetLabel("");
    setDiagramTemplateImportMsg(`Saved browser preset “${labelSaved}”.`);
  }, [browserLayerPresetLabel, browserLayerPresets, diagramLayers, layerPresetStorageKey]);

  const applyBrowserLayerPreset = useCallback(
    (preset: DiagramLayerNamedLocalPreset) => {
      const stacked = appendDiagramLayerTemplateTiers(diagramLayers, preset.tiers);
      if (!stacked) {
        setDiagramTemplateImportMsg(
          diagramLayers.length >= MAX_DIAGRAM_LAYERS
            ? "Layer stack is full — remove tiers before applying a preset."
            : "Nothing new to append from this preset.",
        );
        return;
      }
      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
      const added = stacked.length - diagramLayers.length;
      onDiagramLayersChange(stacked);
      setDiagramTemplateImportMsg(
        added > 0
          ? `Merged ${added} tier${added === 1 ? "" : "s"} from browser preset “${preset.label}”.`
          : `Applied preset “${preset.label}”.`,
      );
    },
    [diagramHistoryCallbacks, diagramLayers, onDiagramLayersChange],
  );

  const removeBrowserLayerPreset = useCallback(
    (presetId: string) => {
      const next = removeDiagramLayerLocalPreset(browserLayerPresets, presetId);
      saveDiagramLayerLocalPresets(layerPresetStorageKey, next);
      setBrowserLayerPresets(next);
      setDiagramTemplateImportMsg(null);
    },
    [browserLayerPresets, layerPresetStorageKey],
  );

  useEffect(() => {
    const onDupDiagramTierChord = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (keyboardFocusIsTypingField()) return;
      if (e.repeat) return;
      if (e.altKey) return;
      if (!(e.ctrlKey || e.metaKey) || !e.shiftKey) return;
      if (e.code !== "KeyL") return;
      e.preventDefault();
      duplicateActiveDiagramTier();
    };
    window.addEventListener("keydown", onDupDiagramTierChord, true);
    return () => window.removeEventListener("keydown", onDupDiagramTierChord, true);
  }, [duplicateActiveDiagramTier]);

  const assignSelectionLayer = useCallback(
    (targetLayerId: string) => {
      if (targetLayerId === DIAGRAM_SELECTION_LAYER_MIXED) return;
      if (!diagramLayers.some((l) => l.id === targetLayerId)) return;
      if (selectionDiagramPrimitiveCount === 0) return;

      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();

      const placementLayerPatch = (p: StageDesignPlacement): StageDesignPlacement => {
        if (targetLayerId === DIAGRAM_LAYER_DEFAULT_ID) {
          const next: StageDesignPlacement = { ...p };
          delete next.layerId;
          return clampPlacement(next, footprint, plotMargins, unit, deckClamp);
        }
        return clampPlacement({ ...p, layerId: targetLayerId }, footprint, plotMargins, unit, deckClamp);
      };
      const shapeLayerPatch = (s: StageDesignShape): StageDesignShape => {
        if (targetLayerId === DIAGRAM_LAYER_DEFAULT_ID) {
          const next: StageDesignShape = { ...s };
          delete next.layerId;
          return clampShape(next, footprint, plotMargins, deckClamp);
        }
        return clampShape({ ...s, layerId: targetLayerId }, footprint, plotMargins, deckClamp);
      };
      const deckLayerPatch = (poly: StageDeckPolygon): StageDeckPolygon => {
        if (targetLayerId === DIAGRAM_LAYER_DEFAULT_ID) {
          const next: StageDeckPolygon = { ...poly };
          delete next.layerId;
          return next;
        }
        return { ...poly, layerId: targetLayerId };
      };

      patchPlacementsUpstream(
        placements.map((row) => (selectedPlacementIds.has(row.id) ? placementLayerPatch(row) : row)),
      );
      patchShapesUpstream(shapes.map((row) => (selectedShapeIds.has(row.id) ? shapeLayerPatch(row) : row)));

      let deckNeedsWrite = false;
      const nextDeck = deckPolygons.map((poly) => {
        if (poly.id === SYNTHETIC_DECK_RECT_POLYGON_ID || !selectedDeckPolygonIds.has(poly.id)) return poly;
        deckNeedsWrite = true;
        return deckLayerPatch(poly);
      });
      if (deckNeedsWrite) setDeckDiagram(nextDeck);
    },
    [
      diagramLayers,
      selectionDiagramPrimitiveCount,
      selectedDeckPolygonIds,
      selectedPlacementIds,
      selectedShapeIds,
      diagramHistoryCallbacks,
      footprint,
      plotMargins,
      unit,
      deckClamp,
      deckPolygons,
      shapes,
      placements,
      setDeckDiagram,
      patchShapesUpstream,
      patchPlacementsUpstream,
    ],
  );

  const selectionPeerSnapBatchKey = useMemo(
    () => `${[...selectedPlacementIds].sort().join("\u0001")}|${[...selectedShapeIds].sort().join("\u0001")}`,
    [selectedPlacementIds, selectedShapeIds],
  );

  const selectionUnanimousPeerSnapTag = useMemo(() => {
    if (selectedPlacementIds.size + selectedShapeIds.size === 0) return undefined;
    return peerSnapGroupFilterForManipulator({
      placements,
      shapes,
      movingPlacementIds: [...selectedPlacementIds],
      movingShapeIds: [...selectedShapeIds],
    });
  }, [placements, shapes, selectedPlacementIds, selectedShapeIds]);

  const batchPeerSnapInputRef = useRef<HTMLInputElement | null>(null);

  const selectionFixtureEquipmentBatchKey = useMemo(
    () => [...selectedPlacementIds].sort().join("\u0001"),
    [selectedPlacementIds],
  );

  const selectionUnanimousFixtureId = useMemo(() => {
    if (selectedPlacementIds.size === 0) return undefined;
    let first: string | undefined;
    let saw = false;
    for (const id of selectedPlacementIds) {
      const row = placements.find((p) => p.id === id);
      const fid = row?.equipment?.fixtureId?.trim() ?? "";
      if (!saw) {
        first = fid;
        saw = true;
      } else if (fid !== first) return undefined;
    }
    return first ?? "";
  }, [selectedPlacementIds, placements]);

  const selectionHasDmxCapablePlacement = useMemo(() => {
    for (const id of selectedPlacementIds) {
      const row = placements.find((p) => p.id === id);
      if (row && placementKindAllowsDmxEquipment(row.kind)) return true;
    }
    return false;
  }, [selectedPlacementIds, placements]);

  const batchFixtureIdInputRef = useRef<HTMLInputElement | null>(null);
  const batchDmxUniverseInputRef = useRef<HTMLInputElement | null>(null);
  const batchDmxChannelInputRef = useRef<HTMLInputElement | null>(null);

  const mutateSelectionPeerSnapTags = useCallback(
    (g: string | undefined) => {
      if (selectedPlacementIds.size + selectedShapeIds.size === 0) return;
      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
      patchPlacementsUpstream(
        placements.map((row) => {
          if (!selectedPlacementIds.has(row.id)) return row;
          if (!g) {
            if (!row.peerSnapGroup) return row;
            const n: StageDesignPlacement = { ...row };
            delete n.peerSnapGroup;
            return clampPlacement(n, footprint, plotMargins, unit, deckClamp);
          }
          return clampPlacement({ ...row, peerSnapGroup: g }, footprint, plotMargins, unit, deckClamp);
        }),
      );
      patchShapesUpstream(
        shapes.map((row) => {
          if (!selectedShapeIds.has(row.id)) return row;
          if (!g) {
            if (!row.peerSnapGroup) return row;
            const next: StageDesignShape = { ...row };
            delete next.peerSnapGroup;
            return clampShape(next, footprint, plotMargins, deckClamp);
          }
          return clampShape({ ...row, peerSnapGroup: g }, footprint, plotMargins, deckClamp);
        }),
      );
    },
    [
      selectedPlacementIds,
      selectedShapeIds,
      placements,
      shapes,
      diagramHistoryCallbacks,
      footprint,
      plotMargins,
      unit,
      deckClamp,
      patchPlacementsUpstream,
      patchShapesUpstream,
    ],
  );

  const applySelectionPeerSnapFromDraft = useCallback(() => {
    const raw = batchPeerSnapInputRef.current?.value ?? "";
    mutateSelectionPeerSnapTags(sanitizePeerSnapGroup(raw));
  }, [mutateSelectionPeerSnapTags]);

  const clearSelectionPeerSnapTags = useCallback(() => {
    mutateSelectionPeerSnapTags(undefined);
  }, [mutateSelectionPeerSnapTags]);

  const applySelectionFixtureIdFromDraft = useCallback(() => {
    if (selectedPlacementIds.size === 0) return;
    const raw = batchFixtureIdInputRef.current?.value ?? "";
    const trimmed = raw.trim().slice(0, STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS);
    diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
    patchPlacementsUpstream(
      placements.map((row) => {
        if (!selectedPlacementIds.has(row.id)) return row;
        const merged: StagePlacementEquipment = { ...(row.equipment ?? {}) };
        if (trimmed.length === 0) delete merged.fixtureId;
        else merged.fixtureId = trimmed;
        return applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp);
      }),
    );
  }, [
    selectedPlacementIds,
    placements,
    diagramHistoryCallbacks,
    footprint,
    plotMargins,
    unit,
    deckClamp,
    patchPlacementsUpstream,
  ]);

  const clearSelectionFixtureIds = useCallback(() => {
    if (selectedPlacementIds.size === 0) return;
    diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
    patchPlacementsUpstream(
      placements.map((row) => {
        if (!selectedPlacementIds.has(row.id)) return row;
        const merged: StagePlacementEquipment = { ...(row.equipment ?? {}) };
        delete merged.fixtureId;
        return applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp);
      }),
    );
  }, [
    selectedPlacementIds,
    placements,
    diagramHistoryCallbacks,
    footprint,
    plotMargins,
    unit,
    deckClamp,
    patchPlacementsUpstream,
  ]);

  const applySelectionPairedDmxFromDraft = useCallback(() => {
    if (selectedPlacementIds.size === 0 || !selectionHasDmxCapablePlacement) return;
    const uStr = batchDmxUniverseInputRef.current?.value ?? "";
    const chStr = batchDmxChannelInputRef.current?.value ?? "";
    const u = Math.round(Number(uStr.trim()));
    const ch = Math.round(Number(chStr.trim()));
    if (!Number.isFinite(u) || !Number.isFinite(ch)) return;
    if (u < 1 || u > 256 || ch < 1 || ch > 512) return;
    diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
    patchPlacementsUpstream(
      placements.map((row) => {
        if (!selectedPlacementIds.has(row.id)) return row;
        if (!placementKindAllowsDmxEquipment(row.kind)) return row;
        const merged: StagePlacementEquipment = { ...(row.equipment ?? {}), dmxUniverse: u, dmxChannel: ch };
        return applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp);
      }),
    );
  }, [
    selectedPlacementIds,
    selectionHasDmxCapablePlacement,
    placements,
    diagramHistoryCallbacks,
    footprint,
    plotMargins,
    unit,
    deckClamp,
    patchPlacementsUpstream,
  ]);

  const clearSelectionDmxAddresses = useCallback(() => {
    if (selectedPlacementIds.size === 0) return;
    diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
    patchPlacementsUpstream(
      placements.map((row) => {
        if (!selectedPlacementIds.has(row.id)) return row;
        if (!placementKindAllowsDmxEquipment(row.kind)) return row;
        const merged: StagePlacementEquipment = { ...(row.equipment ?? {}) };
        delete merged.dmxUniverse;
        delete merged.dmxChannel;
        return applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp);
      }),
    );
  }, [
    selectedPlacementIds,
    placements,
    diagramHistoryCallbacks,
    footprint,
    plotMargins,
    unit,
    deckClamp,
    patchPlacementsUpstream,
  ]);

  const finalizeMigrateRemoveDiagramLayer = useCallback(
    (sourceLayerId: string, targetLayerId: string) => {
      if (sourceLayerId === DIAGRAM_LAYER_DEFAULT_ID) return;
      if (sourceLayerId === targetLayerId) return;
      if (!diagramLayers.some((l) => l.id === sourceLayerId)) return;
      if (!diagramLayers.some((l) => l.id === targetLayerId)) return;

      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
      const wantsMain = targetLayerId === DIAGRAM_LAYER_DEFAULT_ID;

      const placementLayerMigrate = (p: StageDesignPlacement): StageDesignPlacement => {
        if (effectiveDiagramLayerIdForEntity(p.layerId) !== sourceLayerId) return p;
        if (wantsMain) {
          const next: StageDesignPlacement = { ...p };
          delete next.layerId;
          return clampPlacement(next, footprint, plotMargins, unit, deckClamp);
        }
        return clampPlacement({ ...p, layerId: targetLayerId }, footprint, plotMargins, unit, deckClamp);
      };
      const shapeLayerMigrate = (s: StageDesignShape): StageDesignShape => {
        if (effectiveDiagramLayerIdForEntity(s.layerId) !== sourceLayerId) return s;
        if (wantsMain) {
          const next: StageDesignShape = { ...s };
          delete next.layerId;
          return clampShape(next, footprint, plotMargins, deckClamp);
        }
        return clampShape({ ...s, layerId: targetLayerId }, footprint, plotMargins, deckClamp);
      };
      const deckLayerMigrate = (poly: StageDeckPolygon): StageDeckPolygon => {
        if (effectiveDiagramLayerIdForEntity(poly.layerId) !== sourceLayerId) return poly;
        if (wantsMain) {
          const next: StageDeckPolygon = { ...poly };
          delete next.layerId;
          return next;
        }
        return { ...poly, layerId: targetLayerId };
      };

      const nextPlacements = placements.map(placementLayerMigrate);
      const nextShapes = shapes.map(shapeLayerMigrate);
      const nextDeck = deckPolygons.map(deckLayerMigrate);
      const nextDiagramLayers = diagramLayers.filter((l) => l.id !== sourceLayerId);

      patchPlacementsUpstream(nextPlacements);
      patchShapesUpstream(nextShapes);
      setDeckDiagram(nextDeck);
      onDiagramLayersChange(nextDiagramLayers);
      setLayerRemoveMigrateOpenId(null);

      if (onDiagramPaintOrderChange) {
        const nextCanvas: StageDesignCanvas = {
          version: STAGE_DESIGN_SCHEMA_VERSION,
          footprint,
          ...(nextDeck.length > 0 ? { deckPolygons: nextDeck } : {}),
          plotMargins,
          placements: nextPlacements,
          shapes: nextShapes,
          ...(diagramPaintOrder !== undefined ? { diagramPaintOrder } : {}),
          diagramLayers: nextDiagramLayers,
        };
        const presentation = diagramPaintRefsForPresentation(nextCanvas);
        const defaultOrd = defaultDiagramPaintOrder({
          footprint,
          ...(nextDeck.length > 0 ? { deckPolygons: nextDeck } : {}),
          placements: nextPlacements,
          shapes: nextShapes,
        });
        if (paintDiagramOrdersEqual(presentation, defaultOrd)) onDiagramPaintOrderChange(undefined);
        else onDiagramPaintOrderChange(presentation);
      }
    },
    [
      diagramHistoryCallbacks,
      diagramLayers,
      placements,
      shapes,
      deckPolygons,
      footprint,
      plotMargins,
      unit,
      deckClamp,
      diagramPaintOrder,
      patchPlacementsUpstream,
      patchShapesUpstream,
      setDeckDiagram,
      onDiagramLayersChange,
      onDiagramPaintOrderChange,
    ],
  );

  const toggleDiagramLayerFolderVisibility = useCallback(
    (indices: readonly number[]) => {
      if (indices.length === 0) return;
      const anyShown = indices.some((ix) => diagramLayers[ix]?.visible !== false);
      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
      onDiagramLayersChange(
        diagramLayers.map((row, j) => {
          if (!indices.includes(j)) return row;
          if (anyShown) return { ...row, visible: false };
          const next: StageDiagramLayer = { ...row };
          delete next.visible;
          return next;
        }),
      );
    },
    [diagramHistoryCallbacks, diagramLayers, onDiagramLayersChange],
  );

  function diagramLayerTierRow(idx: number, layer: StageDiagramLayer) {
    const isMain = idx === 0 && layer.id === DIAGRAM_LAYER_DEFAULT_ID;
    const primIds = listPrimitiveIdsOnDiagramLayer(previewCanvas, layer.id);
    const primCounts = {
      placements: primIds.placementIds.length,
      shapes: primIds.shapeIds.length,
      deckPolygons: primIds.deckPolygonIds.length,
    };
    const nPrim =
      primCounts.placements + primCounts.shapes + primCounts.deckPolygons;
    const canRemoveEmpty = !isMain && nPrim === 0;
    const canMigrateRemove = !isMain && nPrim > 0;
    const canTowardFront = idx >= 1 && idx < diagramLayers.length - 1;
    const canTowardBack = idx >= 2;
    const migrateEligibleTargets = !isMain ? diagramLayers.filter((l) => l.id !== layer.id) : [];
    const migrateTargetChosen =
      migrateEligibleTargets.length === 0
        ? DIAGRAM_LAYER_DEFAULT_ID
        : migrateEligibleTargets.some((t) => t.id === layerRemoveMigrateTargetId)
          ? layerRemoveMigrateTargetId
          : migrateEligibleTargets.find((t) => t.visible !== false)?.id ?? DIAGRAM_LAYER_DEFAULT_ID;

    const applyDiagramLayerReorder = (fromFlat: number) => {
      if (fromFlat === idx) return;
      const stacked = reorderDiagramLayerStackRow(diagramLayers, fromFlat, idx);
      if (!stacked) return;
      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
      onDiagramLayersChange(stacked);
    };

    return (
      <li
        key={`dl_${layer.id}_${idx}`}
        draggable={!isMain}
        onDragStart={(e) => {
          if (isMain) return;
          diagramLayerReorderFromRef.current = idx;
          e.dataTransfer.effectAllowed = "move";
          try {
            e.dataTransfer.setData("application/x-uls-diagram-layer-index", String(idx));
          } catch {
            /* ignore */
          }
        }}
        onDragEnd={() => {
          diagramLayerReorderFromRef.current = null;
          setDiagramFolderDropHighlightKey(null);
        }}
        onDragOver={(e) => {
          if (isMain) return;
          const fromFlat = diagramLayerReorderFromRef.current;
          if (fromFlat === null || fromFlat === idx) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDrop={(e) => {
          if (isMain) return;
          let fromFlat = diagramLayerReorderFromRef.current;
          if (fromFlat === null) {
            try {
              const raw = Number.parseInt(e.dataTransfer.getData("application/x-uls-diagram-layer-index"), 10);
              if (Number.isFinite(raw)) fromFlat = raw;
            } catch {
              /* ignore */
            }
          }
          diagramLayerReorderFromRef.current = null;
          if (fromFlat === null || fromFlat <= 0) return;
          e.preventDefault();
          applyDiagramLayerReorder(fromFlat);
        }}
        className={`rounded-lg border border-white/[0.08] bg-black/25 px-2 py-2 text-[11px] text-uls-text ${
          !isMain ? "cursor-grab touch-none active:cursor-grabbing" : ""
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {!isMain ? (
            <span
              aria-hidden
              className="w-5 shrink-0 select-none text-center text-sm leading-none text-uls-subtle"
              title="Drag tier — drop on another tier to reorder Main→front stack; drop on a folder heading to assign that path without moving the tier"
            >
              ≡
            </span>
          ) : (
            <span aria-hidden className="w-5 shrink-0" />
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            title={layer.visible === false ? "Show layer" : "Hide layer"}
            onClick={() => {
              diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
              const wasHidden = layer.visible === false;
              onDiagramLayersChange(
                diagramLayers.map((row, j) => {
                  if (j !== idx) return row;
                  if (wasHidden) {
                    const next: StageDiagramLayer = { ...row };
                    delete next.visible;
                    return next;
                  }
                  return { ...row, visible: false };
                }),
              );
            }}
          >
            {layer.visible === false ? "Show" : "Hide"}
          </Button>
          {!isMain ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Copy tier id (matches layerId in BOM / canvasJson)"
              className="tabular-nums font-mono text-[10px]"
              onClick={() => {
                void navigator.clipboard.writeText(layer.id).catch(() => {
                  /* private / blocked */
                });
              }}
            >
              Copy ID
            </Button>
          ) : null}
          {isMain ? (
            <span className="font-medium text-uls-text">{layer.name}</span>
          ) : (
            <input
              defaultValue={layer.name}
              key={layer.id}
              aria-label={`Layer ${idx + 1} name`}
              onBlur={(e) => {
                const v = e.target.value.trim().slice(0, 64);
                if (!v || v === layer.name) return;
                diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                onDiagramLayersChange(diagramLayers.map((row, j) => (j === idx ? { ...row, name: v } : row)));
              }}
              className="min-w-[6rem] flex-1 rounded border border-white/[0.1] bg-black/35 px-2 py-1 text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
            />
          )}
          {!isMain ? (
            <input
              defaultValue={layer.group ?? ""}
              maxLength={MAX_DIAGRAM_LAYER_GROUP_CHARS}
              key={`${layer.id}_folder`}
              placeholder="Rigging / LX"
              aria-label={`Folder path for ${layer.name}`}
              title="Use slashes to nest folders (example Rigging / LX). Adjacent custom tiers sharing the same path prefix collapse in this panel."
              onBlur={(e) => {
                const g = sanitizeDiagramLayerGroup(e.target.value);
                const cur = sanitizeDiagramLayerGroup(layer.group);
                const same = (!g && !cur) || g === cur;
                if (same) return;
                diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                onDiagramLayersChange(
                  diagramLayers.map((row, j) => {
                    if (j !== idx) return row;
                    if (!g) {
                      if (!row.group) return row;
                      const next: StageDiagramLayer = { ...row };
                      delete next.group;
                      return next;
                    }
                    return { ...row, group: g };
                  }),
                );
              }}
              className="min-w-[7.5rem] max-w-[12rem] shrink-0 flex-1 rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-[10px] text-uls-muted outline-none placeholder:text-uls-subtle/80 focus-visible:ring-2 focus-visible:ring-uls-accent/35"
            />
          ) : null}
          {!isMain ? (
            <label
              className="flex cursor-pointer items-center gap-1.5 text-[10px] text-uls-muted"
              title="When locked, bracket [ ] and Home/End only affect other tiers — use the tier list above to reorder the whole authoring layer."
            >
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-white/20 bg-black/40 accent-uls-accent"
                checked={layer.bracketReorderLocked === true}
                onChange={(ev) => {
                  diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                  onDiagramLayersChange(
                    diagramLayers.map((row, j) => {
                      if (j !== idx) return row;
                      if (ev.target.checked) return { ...row, bracketReorderLocked: true };
                      const nextRow: StageDiagramLayer = { ...row };
                      delete nextRow.bracketReorderLocked;
                      return nextRow;
                    }),
                  );
                }}
              />
              <span className="whitespace-nowrap">Lock `[` reorder</span>
            </label>
          ) : null}
          <span className="tabular-nums text-uls-subtle">
            · {nPrim} item{nPrim === 1 ? "" : "s"}
          </span>
          <div className="ml-auto flex flex-wrap gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canTowardBack}
              title={canTowardBack ? "Move toward back (toward Main)" : "Already just above Main"}
              onClick={() => {
                if (!canTowardBack) return;
                diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                const next = diagramLayers.slice();
                const tmp = next[idx - 1]!;
                next[idx - 1] = next[idx]!;
                next[idx] = tmp;
                onDiagramLayersChange(next);
              }}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!canTowardFront}
              title={
                canTowardFront ? "Move toward front (away from Main)" : "Already at the diagram front or locked"
              }
              onClick={() => {
                if (!canTowardFront) return;
                diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                const next = diagramLayers.slice();
                const tmp = next[idx + 1]!;
                next[idx + 1] = next[idx]!;
                next[idx] = tmp;
                onDiagramLayersChange(next);
              }}
            >
              Front
            </Button>
            {!isMain ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canRemoveEmpty && !canMigrateRemove}
                title={
                  canRemoveEmpty
                    ? "Remove empty layer"
                    : canMigrateRemove
                      ? "Move items to another layer, then remove this tier"
                      : "Cannot remove Main"
                }
                onClick={() => {
                  if (canRemoveEmpty) {
                    diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                    setLayerRemoveMigrateOpenId(null);
                    onDiagramLayersChange(diagramLayers.filter((_, j) => j !== idx));
                    return;
                  }
                  if (!canMigrateRemove) return;
                  if (resolvedLayerRemoveMigrateOpenId === layer.id) {
                    setLayerRemoveMigrateOpenId(null);
                  } else {
                    setLayerRemoveMigrateOpenId(layer.id);
                    const firstTarget =
                      diagramLayers.find((l) => l.id !== layer.id && l.visible !== false)?.id ??
                      DIAGRAM_LAYER_DEFAULT_ID;
                    setLayerRemoveMigrateTargetId(firstTarget);
                  }
                }}
              >
                {canMigrateRemove ? "Remove…" : "Remove"}
              </Button>
            ) : null}
          </div>
        </div>
        <details className="mt-1.5 border-t border-white/[0.06] pt-1.5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="cursor-pointer select-none text-[10px] text-uls-subtle hover:text-uls-muted">
            <span className="font-medium text-uls-text/[0.92]">Inspector</span>
            <span className="tabular-nums text-uls-muted">
              {' '}
              — symbols {primCounts.placements} · shapes {primCounts.shapes} · deck {primCounts.deckPolygons}
            </span>
          </summary>
          <dl className="mt-1.5 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-0.5 text-[10px] leading-snug text-uls-muted">
            <dt className="text-uls-subtle">Placement symbols</dt>
            <dd className="tabular-nums text-uls-text/90">{primCounts.placements}</dd>
            <dt className="text-uls-subtle">Drawn shapes</dt>
            <dd className="tabular-nums text-uls-text/90">{primCounts.shapes}</dd>
            <dt className="text-uls-subtle">Deck modules</dt>
            <dd className="tabular-nums text-uls-text/90">{primCounts.deckPolygons}</dd>
          </dl>
          {nPrim > 0 ? (
            <div className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2">
              <div className="text-[9px] text-uls-subtle">Primitive ids (paste into scripts / BOM joins)</div>
              <div className="flex flex-wrap gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={primIds.placementIds.length === 0}
                  title="Copy symbol placement ids — one id per line"
                  onClick={() => {
                    void navigator.clipboard.writeText(primIds.placementIds.join("\n")).catch(() => {
                      /* private / blocked */
                    });
                  }}
                >
                  Copy symbols
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={primIds.shapeIds.length === 0}
                  title="Copy shape ids — one id per line"
                  onClick={() => {
                    void navigator.clipboard.writeText(primIds.shapeIds.join("\n")).catch(() => {
                      /* private / blocked */
                    });
                  }}
                >
                  Copy shapes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={primIds.deckPolygonIds.length === 0}
                  title="Copy deck polygon ids — one id per line"
                  onClick={() => {
                    void navigator.clipboard.writeText(primIds.deckPolygonIds.join("\n")).catch(() => {
                      /* private / blocked */
                    });
                  }}
                >
                  Copy deck
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  title="Copy kind + id columns (TAB) — spreadsheet‑friendly order: symbols, then shapes, then deck"
                  onClick={() => {
                    void navigator.clipboard.writeText(diagramLayerPrimitiveIdsTsv(primIds)).catch(() => {
                      /* private / blocked */
                    });
                  }}
                >
                  Copy TSV
                </Button>
              </div>
              {primIds.placementIds.length > 0 ? (
                <div>
                  <div className="text-[9px] text-uls-subtle">Symbols preview</div>
                  <div className="break-all font-mono text-[9px] leading-snug text-uls-muted">
                    {primIds.placementIds.slice(0, DIAGRAM_INSPECTOR_ID_PREVIEW_CAP).join(", ")}
                  </div>
                  {primIds.placementIds.length > DIAGRAM_INSPECTOR_ID_PREVIEW_CAP ? (
                    <div className="text-[9px] text-uls-subtle">
                      +{primIds.placementIds.length - DIAGRAM_INSPECTOR_ID_PREVIEW_CAP} more (use Copy)
                    </div>
                  ) : null}
                </div>
              ) : null}
              {primIds.shapeIds.length > 0 ? (
                <div>
                  <div className="text-[9px] text-uls-subtle">Shapes preview</div>
                  <div className="break-all font-mono text-[9px] leading-snug text-uls-muted">
                    {primIds.shapeIds.slice(0, DIAGRAM_INSPECTOR_ID_PREVIEW_CAP).join(", ")}
                  </div>
                  {primIds.shapeIds.length > DIAGRAM_INSPECTOR_ID_PREVIEW_CAP ? (
                    <div className="text-[9px] text-uls-subtle">
                      +{primIds.shapeIds.length - DIAGRAM_INSPECTOR_ID_PREVIEW_CAP} more (use Copy)
                    </div>
                  ) : null}
                </div>
              ) : null}
              {primIds.deckPolygonIds.length > 0 ? (
                <div>
                  <div className="text-[9px] text-uls-subtle">Deck preview</div>
                  <div className="break-all font-mono text-[9px] leading-snug text-uls-muted">
                    {primIds.deckPolygonIds.slice(0, DIAGRAM_INSPECTOR_ID_PREVIEW_CAP).join(", ")}
                  </div>
                  {primIds.deckPolygonIds.length > DIAGRAM_INSPECTOR_ID_PREVIEW_CAP ? (
                    <div className="text-[9px] text-uls-subtle">
                      +{primIds.deckPolygonIds.length - DIAGRAM_INSPECTOR_ID_PREVIEW_CAP} more (use Copy)
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="mt-1.5 text-[9px] leading-relaxed text-uls-subtle">
            Matches BOM <span className="font-medium text-uls-muted">layerId</span> / canvas{' '}
            <span className="font-medium text-uls-muted">layerId</span> semantics for{' '}
            <span className="font-medium text-uls-text/90">{layer.name}</span>; bracket draw order splits within-tier stacking
            independently.
          </p>
        </details>
        {!isMain && resolvedLayerRemoveMigrateOpenId === layer.id ? (
          <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2 sm:flex-row sm:flex-wrap sm:items-end">
            <label className="flex flex-wrap items-center gap-2 text-[10px] text-uls-muted">
              <span>
                Move {nPrim} item{nPrim === 1 ? "" : "s"} to
              </span>
              <select
                className="rounded-md border border-white/[0.12] bg-black/45 px-2 py-1 text-xs text-uls-text"
                value={migrateTargetChosen}
                onChange={(e) => setLayerRemoveMigrateTargetId(e.target.value)}
              >
                {diagramLayers
                  .filter((l) => l.id !== layer.id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                      {l.visible === false ? " — hidden" : ""}
                    </option>
                  ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={migrateTargetChosen === layer.id}
                onClick={() => finalizeMigrateRemoveDiagramLayer(layer.id, migrateTargetChosen)}
              >
                Move & remove layer
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setLayerRemoveMigrateOpenId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </li>
    );
  }

  function tierPanelDragLikelyHasLayerIndex(ev: React.DragEvent): boolean {
    const fromIdx = diagramLayerReorderFromRef.current;
    if (fromIdx !== null && fromIdx > 0) return true;
    try {
      return [...ev.dataTransfer.types].includes("application/x-uls-diagram-layer-index");
    } catch {
      return false;
    }
  }

  function diagramLayerNestSubtree(
    roots: DiagramLayerNestNode[],
    depthPrefix: string,
    depthInset: boolean,
    ancestorPath: readonly string[],
  ) {
    return (
      <ul
        className={`space-y-2 list-none ${depthInset ? "mt-2 border-l border-white/[0.06] pl-3" : ""}`}
      >
        {roots.map((n, ni) => {
          if (n.kind === "tier") return diagramLayerTierRow(n.index, n.layer);
          const tiersUnderFolder = collectDiagramLayerNestTierIndices([n]);
          const anyShown = tiersUnderFolder.some((ix) => diagramLayers[ix]?.visible !== false);
          const folderSegments = [...ancestorPath, n.label];
          const folderKey = diagramFolderPathHighlightKey(folderSegments);
          const folderDropActive = diagramFolderDropHighlightKey === folderKey;
          return (
            <li key={`${depthPrefix}_fld_${ni}_${n.label}`} className="list-none rounded-md border border-white/[0.05] bg-black/[0.12] px-1 py-1">
              <details open className="rounded-md px-1">
                <summary
                  className={`flex cursor-pointer list-none flex-wrap items-center gap-x-2 gap-y-1 rounded-md py-1 pr-1 text-[11px] text-uls-text [&::-webkit-details-marker]:hidden ${folderDropActive ? "ring-2 ring-uls-accent/50 ring-offset-2 ring-offset-zinc-950" : ""}`}
                  title="Drag a tier’s ≡ grip here to assign its folder path (stack order unchanged)"
                  onDragOver={(e) => {
                    if (!tierPanelDragLikelyHasLayerIndex(e)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDiagramFolderDropHighlightKey(folderKey);
                  }}
                  onDragLeave={(e) => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                    if (diagramFolderDropHighlightKey === folderKey) setDiagramFolderDropHighlightKey(null);
                  }}
                  onDrop={(e) => {
                    let fromFlat = diagramLayerReorderFromRef.current;
                    if (fromFlat === null) {
                      try {
                        const raw = Number.parseInt(
                          e.dataTransfer.getData("application/x-uls-diagram-layer-index"),
                          10,
                        );
                        if (Number.isFinite(raw)) fromFlat = raw;
                      } catch {
                        /* ignore */
                      }
                    }
                    diagramLayerReorderFromRef.current = null;
                    setDiagramFolderDropHighlightKey(null);
                    if (fromFlat === null || fromFlat <= 0) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const stacked = assignDiagramTierUnderFolderPrefix(diagramLayers, fromFlat, folderSegments);
                    if (!stacked) return;
                    diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                    onDiagramLayersChange(stacked);
                  }}
                >
                  <span aria-hidden className="font-mono text-[10px] text-uls-subtle">
                    ▸
                  </span>
                  <span className="font-medium text-uls-text">{n.label}</span>
                  <span className="text-uls-subtle">
                    {tiersUnderFolder.length} tier{tiersUnderFolder.length === 1 ? "" : "s"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto"
                    title={anyShown ? "Hide every tier nested under this folder" : "Show every tier nested under this folder"}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleDiagramLayerFolderVisibility(tiersUnderFolder);
                    }}
                  >
                    {anyShown ? "Hide all" : "Show all"}
                  </Button>
                </summary>
                {diagramLayerNestSubtree(n.children, `${depthPrefix}_fld_${ni}_${n.label}`, true, folderSegments)}
              </details>
            </li>
          );
        })}
      </ul>
    );
  }

  /** Matches SVG paint sequence in {@link StageFootprintPreview}; HUD/brackets refer to the slice for the selection’s layer. */
  const presentationDiagramPaintOrder = useMemo(
    () => diagramPaintRefsForPresentation(previewCanvas),
    [previewCanvas],
  );

  const commitDiagramPaintOrderMutation = useCallback(
    (nextExplicit: StageDiagramPaintRef[] | undefined) => {
      diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
      onDiagramPaintOrderChange?.(nextExplicit);
    },
    [diagramHistoryCallbacks, onDiagramPaintOrderChange],
  );

  const persistRepairedDiagramPaintOrder = useCallback(
    (next: StageDiagramPaintRef[]) => {
      const defaultOrd = defaultDiagramPaintOrder({
        footprint,
        ...(deckPolygons.length > 0 ? { deckPolygons } : {}),
        placements,
        shapes,
      });
      if (paintDiagramOrdersEqual(next, defaultOrd)) commitDiagramPaintOrderMutation(undefined);
      else commitDiagramPaintOrderMutation(next);
    },
    [footprint, deckPolygons, placements, shapes, commitDiagramPaintOrderMutation],
  );

  /** `[`/`]` swaps only within the selected primitive’s authoring layer (exactly **one** item selected). Use the Layers panel / assignment control to reorder tiers or choose **Select all** subsets for bulk moves elsewhere. */
  const bumpDrawOrder = useCallback(
    (dirBr: -1 | 1): boolean => {
      if (selectionDiagramPrimitiveCount !== 1) return false;
      const sel = diagramPaintLeadRefFromSelectionSets(previewCanvas, {
        deckIds: selectedDeckPolygonIds,
        shapeIds: selectedShapeIds,
        placementIds: selectedPlacementIds,
      });
      if (!sel) return false;

      const next = bumpDiagramPaintOrderWithinDiagramLayer(previewCanvas, sel, dirBr);
      if (!next) return false;
      persistRepairedDiagramPaintOrder(next);
      return true;
    },
    [
      selectionDiagramPrimitiveCount,
      selectedDeckPolygonIds,
      selectedPlacementIds,
      selectedShapeIds,
      previewCanvas,
      persistRepairedDiagramPaintOrder,
    ],
  );

  /** Home/End jump to layer-local back/front (within the tier that contains the selection). Requires exactly **one** item selected — multi-select skips bracket extremes. */
  const bumpDrawOrderPaintExtreme = useCallback(
    (extreme: "back" | "front"): boolean => {
      if (selectionDiagramPrimitiveCount !== 1) return false;
      const sel = diagramPaintLeadRefFromSelectionSets(previewCanvas, {
        deckIds: selectedDeckPolygonIds,
        shapeIds: selectedShapeIds,
        placementIds: selectedPlacementIds,
      });
      if (!sel) return false;
      const next = moveDiagramPaintRefToDiagramLayerPaintExtreme(previewCanvas, sel, extreme);
      if (!next) return false;
      persistRepairedDiagramPaintOrder(next);
      return true;
    },
    [
      selectionDiagramPrimitiveCount,
      selectedDeckPolygonIds,
      selectedPlacementIds,
      selectedShapeIds,
      previewCanvas,
      persistRepairedDiagramPaintOrder,
    ],
  );

  const selectModeDrawOrderHud = useMemo(() => {
    if (workspace !== "select") return null;
    if (selectionDiagramPrimitiveCount !== 1) return null;
    const sel = selectDiagramPaintLeadRef;
    if (!sel) return null;
    const idx = presentationDiagramPaintOrder.findIndex((r) => r.kind === sel.kind && r.id === sel.id);
    if (idx < 0) return null;
    const wantLayer = effectiveDiagramLayerIdForPaintRef(previewCanvas, sel);
    const slots = presentationDiagramPaintOrder
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => effectiveDiagramLayerIdForPaintRef(previewCanvas, r) === wantLayer);
    const pos = slots.findIndex((s) => s.i === idx);
    if (pos < 0) return null;
    const layeredUi = diagramLayers.length > 1;
    const drawLocked = layeredUi && diagramTierBracketReorderLocked(previewCanvas, wantLayer);
    return {
      layerLabel: layeredUi ? "draw order · this layer only" : "diagram stack",
      canBack: !drawLocked && pos > 0,
      canFwd: !drawLocked && pos < slots.length - 1,
    };
  }, [
    workspace,
    selectionDiagramPrimitiveCount,
    selectDiagramPaintLeadRef,
    previewCanvas,
    presentationDiagramPaintOrder,
    diagramLayers.length,
  ]);

  const selectModeTargetRef = useMemo(() => {
    if (workspace !== "select") return null;
    if (selectionDiagramPrimitiveCount === 0) return null;
    return selectDiagramPaintLeadRef;
  }, [workspace, selectionDiagramPrimitiveCount, selectDiagramPaintLeadRef]);

  const snap = useCallback(
    (v: number) => snapStageCoordinate(v, unitKey),
    [unitKey],
  );

  const applyStructuralMagnets = useCallback(
    (gx: number, gy: number, snapEnabled: boolean) => {
      if (!snapEnabled) return { wx: gx, wy: gy };
      const canvasMini = {
        footprint: footprintRef.current,
        deckPolygons: deckPolygonsRef.current.length > 0 ? deckPolygonsRef.current : undefined,
      };
      const pb = getPlotBoundsFromCanvas(canvasMini, plotMarginsRef.current);
      const polys = normalizeDeckPolygons(canvasMini);
      return snapPlotWorldXYToStructuralGuidesWithMeta(gx, gy, pb, polys, unitKey);
    },
    [unitKey],
  );

  /** Structural + peer alignment (omit when Alt skips all magnets). Grid step already applied upstream when enabled. */
  const finalizeAuthoringSnap = useCallback(
    (
      skipAllMagnets: boolean,
      gx: number,
      gy: number,
      peerExclude?: PeerSnapExclude | null,
    ): PeerAlignSnapResult => {
      if (skipAllMagnets) return { wx: gx, wy: gy };
      const st = applyStructuralMagnets(gx, gy, true);
      const canvasMini = {
        footprint: footprintRef.current,
        deckPolygons: deckPolygonsRef.current.length > 0 ? deckPolygonsRef.current : undefined,
      };
      const { lay } = plotLayoutForCanvas(canvasMini, plotMarginsRef.current);
      const rotationLayout = peerSnapRotationLayoutFromPlotView(lay);
      const peer = snapPlotWorldXYToPeerAlignWithMeta(
        st.wx,
        st.wy,
        placementsRef.current,
        shapesRef.current,
        unitKey,
        peerExclude ?? null,
        unit,
        rotationLayout,
      );
      return {
        wx: peer.wx,
        wy: peer.wy,
        ...(peer.peerGuideVerticalWorldX !== undefined ? { peerGuideVerticalWorldX: peer.peerGuideVerticalWorldX } : {}),
        ...(peer.peerGuideHorizontalWorldY !== undefined ? { peerGuideHorizontalWorldY: peer.peerGuideHorizontalWorldY } : {}),
        ...(st.structuralGuideVerticalWorldX !== undefined
          ? { structuralGuideVerticalWorldX: st.structuralGuideVerticalWorldX }
          : {}),
        ...(st.structuralGuideHorizontalWorldY !== undefined
          ? { structuralGuideHorizontalWorldY: st.structuralGuideHorizontalWorldY }
          : {}),
        ...(st.structuralGuideEdgeWorld !== undefined ? { structuralGuideEdgeWorld: st.structuralGuideEdgeWorld } : {}),
      };
    },
    [applyStructuralMagnets, unit, unitKey],
  );

  const insertPolylineVertexAfterSegment = useCallback(
    (shapeId: string, afterVertexIndex: number, world: { x: number; y: number }) => {
      if (workspace !== "select") return;
      const s = shapesRef.current.find((r) => r.id === shapeId && r.kind === "POLYLINE");
      if (!s || s.kind !== "POLYLINE" || !s.vertices) return;
      if (afterVertexIndex < 0 || afterVertexIndex >= s.vertices.length - 1) return;
      if (s.vertices.length >= MAX_STAGE_SHAPE_POLYLINE_VERTICES) return;
      const gx = snap(world.x);
      const gy = snap(world.y);
      const m = finalizeAuthoringSnap(
        false,
        gx,
        gy,
        appendPeerSnapGroupToExclude(placementsRef.current, shapesRef.current, { shapeId }, [], [shapeId]),
      );
      const vertsNext = insertPolylineVertexOnSegment(s.vertices, afterVertexIndex, { x: m.wx, y: m.wy });
      if (!vertsNext) return;
      const next = clampShape(
        { ...s, vertices: vertsNext, x: vertsNext[0]!.x, y: vertsNext[0]!.y },
        footprintRef.current,
        plotMarginsRef.current,
        deckClamp,
      );
      commitShapes(shapesRef.current.map((row) => (row.id === shapeId ? next : row)));
    },
    [workspace, snap, finalizeAuthoringSnap, commitShapes, deckClamp],
  );

  const soleSelectedShapeForPolylineInsert = useMemo((): string | null => {
    if (selectedShapeIds.size !== 1) return null;
    return [...selectedShapeIds][0]!;
  }, [selectedShapeIds]);

  const polylineSegmentInsertConfig = useMemo(() => {
    if (workspace !== "select" || !soleSelectedShapeForPolylineInsert) return undefined;
    const row = shapes.find((r) => r.id === soleSelectedShapeForPolylineInsert);
    if (!row || row.kind !== "POLYLINE") return undefined;
    const poly = row as StageDesignShape & { kind: "POLYLINE" };
    return {
      shape: poly,
      onInsertAfterVertex: (afterVertexIndex: number, world: { x: number; y: number }) =>
        insertPolylineVertexAfterSegment(poly.id, afterVertexIndex, world),
    };
  }, [workspace, soleSelectedShapeForPolylineInsert, shapes, insertPolylineVertexAfterSegment]);

  const syncAuthoringSnapGuideOverlay = useCallback((skipMagnets: boolean, res: PeerAlignSnapResult) => {
    if (skipMagnets) {
      setAuthoringSnapGuidesOverlay(null);
      return;
    }
    const svx = res.structuralGuideVerticalWorldX;
    const shy = res.structuralGuideHorizontalWorldY;
    const pvx = res.peerGuideVerticalWorldX;
    const phy = res.peerGuideHorizontalWorldY;
    const se = res.structuralGuideEdgeWorld;
    const structural =
      svx !== undefined || shy !== undefined || se !== undefined
        ? {
            ...(svx !== undefined ? { verticalX: svx } : {}),
            ...(shy !== undefined ? { horizontalY: shy } : {}),
            ...(se !== undefined ? { edge: se } : {}),
          }
        : undefined;
    const peer =
      pvx !== undefined || phy !== undefined
        ? {
            ...(pvx !== undefined ? { verticalX: pvx } : {}),
            ...(phy !== undefined ? { horizontalY: phy } : {}),
          }
        : undefined;
    if (!structural && !peer) setAuthoringSnapGuidesOverlay(null);
    else
      setAuthoringSnapGuidesOverlay({
        ...(structural ? { structural } : {}),
        ...(peer ? { peer } : {}),
      });
  }, []);

  /** Canonical grid quantization + structural + peer snaps (producer select/drag tooling). */
  const gridStructuralPeers = useCallback(
    (wx: number, wy: number, guidesOn: boolean, peerExclude?: PeerSnapExclude | null): PeerAlignSnapResult => {
      if (!guidesOn) return { wx, wy };
      return finalizeAuthoringSnap(false, snap(wx), snap(wy), peerExclude);
    },
    [snap, finalizeAuthoringSnap],
  );

  const pickWorld = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return null;
      const { lay } = plotLayoutForCanvas({ footprint, deckPolygons: deckClamp }, plotMargins);
      return svgScreenPointToPlotWorld(svg, clientX, clientY, lay);
    },
    [footprint, plotMargins, deckClamp],
  );

  const endDrag = useCallback(() => {
    diagramHistoryCallbacks?.endContinuousDiagramGesture();
    dragRef.current = null;
    resizeShapeRef.current = null;
    resizeDeckRef.current = null;
    rotateShapeRef.current = null;
    rotatePlacementRef.current = null;
    lastWorldRef.current = null;
    setAuthoringSnapGuidesOverlay(null);
  }, [diagramHistoryCallbacks]);

  const activateWorkspaceMode = useCallback(
    (k: Workspace) => {
      try {
        sessionStorage.setItem(STAGE_DESIGN_WORKSPACE_STORAGE_KEY, k);
      } catch {
        /* ignore */
      }
      setWorkspace(k);
      setShapeDraft(null);
      setPolylineDraftPoints(null);
      setDeckRectDraft(null);
      if (k !== "select") {
        endDrag();
        setPlotPointerWorld(null);
      }
    },
    [endDrag],
  );

  const persistAndSetSymbolKind = useCallback((k: StageDesignPlacementKind) => {
    try {
      sessionStorage.setItem(STAGE_DESIGN_SYMBOL_KIND_STORAGE_KEY, k);
    } catch {
      /* ignore */
    }
    setSymbolKind(k);
  }, []);

  const persistAndSetShapeTool = useCallback((t: StageDesignShapeKind) => {
    try {
      sessionStorage.setItem(STAGE_DESIGN_SHAPE_TOOL_STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
    setShapeTool(t);
    setShapeDraft(null);
    setPolylineDraftPoints(null);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (keyboardFocusIsTypingField()) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;

      const di14 = STAGE_DESIGN_WORKSPACE_DIGIT_CODES.indexOf(e.code as (typeof STAGE_DESIGN_WORKSPACE_DIGIT_CODES)[number]);
      if (di14 >= 0) {
        const row = STAGE_DESIGN_WORKSPACE_ROWS[di14];
        if (!row) return;
        const next = row[0];
        if (workspace === next) return;
        e.preventDefault();
        activateWorkspaceMode(next);
        return;
      }

      const i59 = STAGE_DESIGN_SYMBOL_SHAPE_DIGIT_CODES.indexOf(
        e.code as (typeof STAGE_DESIGN_SYMBOL_SHAPE_DIGIT_CODES)[number],
      );
      if (i59 < 0) return;

      if (workspace === "symbols") {
        const k = STAGE_DESIGN_PLACEMENT_KIND_ORDER[i59];
        if (!k || symbolKind === k) return;
        e.preventDefault();
        persistAndSetSymbolKind(k);
        return;
      }

      if (workspace === "shapes") {
        const t = SHAPE_TOOLS[i59];
        if (!t || shapeTool === t) return;
        e.preventDefault();
        persistAndSetShapeTool(t);
        return;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [workspace, activateWorkspaceMode, symbolKind, shapeTool, persistAndSetSymbolKind, persistAndSetShapeTool]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const rd = resizeDeckRef.current;
      if (rd) {
        const hit = pickWorld(e.clientX, e.clientY);
        if (!hit) return;
        const skipSnap = Boolean(e.altKey);
        const gx = skipSnap ? hit.wx : snap(hit.wx);
        const gy = skipSnap ? hit.wy : snap(hit.wy);
        const sn = finalizeAuthoringSnap(skipSnap, gx, gy, undefined);
        setAuthoringSnapGuidesOverlay(null);
        const { wx: nx, wy: ny } = sn;
        const rawNext = applyDeckAxisAlignedRectangleCornerResize(rd.baseline, rd.corner, nx, ny);
        const mergedBeforeClamp = deckPolygonsRef.current.map((p) =>
          p.id === rd.id ? rawNext : p,
        );
        const pb = getPlotBoundsFromCanvas(
          { footprint: footprintRef.current, deckPolygons: mergedBeforeClamp },
          plotMarginsRef.current,
        );
        const merged = mergedBeforeClamp.map((p) =>
          p.id === rd.id ? clampDeckPolygonToPlotBounds(p, pb) : p,
        );
        deckPolygonsRef.current = merged;
        setDeckDiagram(merged);
        return;
      }

      const rotPl = rotatePlacementRef.current;
      if (rotPl) {
        setAuthoringSnapGuidesOverlay(null);
        const hitRaw = pickWorld(e.clientX, e.clientY);
        if (!hitRaw) return;
        const currPointerDeg = plotPointerAngleDegrees(rotPl.pivotWx, rotPl.pivotWy, hitRaw.wx, hitRaw.wy);
        const shiftHeld = typeof e.shiftKey === "boolean" ? e.shiftKey : false;
        const nextDeg = authoringRotationDegreesAtPointer(
          rotPl.baselineRotDeg,
          rotPl.pointer0Deg,
          currPointerDeg,
          shiftHeld,
        );
        patchPlacementsUpstream(
          placementsRef.current.map((p) =>
            p.id === rotPl.id ? clampPlacement({ ...p, rotationDeg: nextDeg }, footprint, plotMargins, unit, deckClamp) : p,
          ),
        );
        return;
      }

      const rotRef = rotateShapeRef.current;
      if (rotRef) {
        setAuthoringSnapGuidesOverlay(null);
        const hitRaw = pickWorld(e.clientX, e.clientY);
        if (!hitRaw) return;
        const currPointerDeg = plotPointerAngleDegrees(rotRef.pivotWx, rotRef.pivotWy, hitRaw.wx, hitRaw.wy);
        const shiftHeld = typeof e.shiftKey === "boolean" ? e.shiftKey : false;
        const nextDeg = authoringRotationDegreesAtPointer(
          rotRef.baselineRotDeg,
          rotRef.pointer0Deg,
          currPointerDeg,
          shiftHeld,
        );
        patchShapesUpstream(
          shapesRef.current.map((s) =>
            s.id === rotRef.id
              ? clampShape({ ...s, rotationDeg: nextDeg }, footprint, plotMargins, deckClamp)
              : s,
          ),
        );
        return;
      }

      const r = resizeShapeRef.current;
      if (r) {
        const hit = pickWorld(e.clientX, e.clientY);
        if (!hit) return;
        const skipSnap = Boolean(e.altKey);
        const gx = skipSnap ? hit.wx : snap(hit.wx);
        const gy = skipSnap ? hit.wy : snap(hit.wy);
        const sn = finalizeAuthoringSnap(
          skipSnap,
          gx,
          gy,
          appendPeerSnapGroupToExclude(placementsRef.current, shapesRef.current, { shapeId: r.id }, [], [r.id]),
        );
        syncAuthoringSnapGuideOverlay(skipSnap, sn);
        const { wx: nx, wy: ny } = sn;
        const next = clampShape(applyShapeResize(r.baseline, r.encoded, nx, ny), footprint, plotMargins, deckClamp);
        patchShapesUpstream(
          shapesRef.current.map((s) => (s.id === r.id ? next : s)),
        );
        return;
      }

      const d = dragRef.current;
      if (!d) return;
      const hit = pickWorld(e.clientX, e.clientY);
      if (!hit) return;
      const skipSnap = Boolean(e.altKey);
      const gx = skipSnap ? hit.wx : snap(hit.wx);
      const gy = skipSnap ? hit.wy : snap(hit.wy);
      let peerEx: PeerSnapExclude | undefined;
      if (d.kind === "placement") {
        peerEx = appendPeerSnapGroupToExclude(placementsRef.current, shapesRef.current, { placementId: d.id }, [d.id], []);
      } else if (d.kind === "shape") {
        peerEx = appendPeerSnapGroupToExclude(placementsRef.current, shapesRef.current, { shapeId: d.id }, [], [d.id]);
      } else if (d.kind === "deck") peerEx = undefined;
      else if (d.kind === "multi") {
        peerEx = appendPeerSnapGroupToExclude(
          placementsRef.current,
          shapesRef.current,
          {
            excludePlacementIds: new Set(d.placementIds),
            excludeShapeIds: new Set(d.shapeIds),
          },
          d.placementIds,
          d.shapeIds,
        );
      }
      const sn = finalizeAuthoringSnap(skipSnap, gx, gy, peerEx);
      syncAuthoringSnapGuideOverlay(skipSnap, sn);
      const { wx: nx, wy: ny } = sn;
      if (!lastWorldRef.current) {
        lastWorldRef.current = { wx: nx, wy: ny };
        return;
      }
      const dx = nx - lastWorldRef.current.wx;
      const dy = ny - lastWorldRef.current.wy;
      lastWorldRef.current = { wx: nx, wy: ny };
      if (dx === 0 && dy === 0) return;

      if (d.kind === "multi") {
        patchPlacementsUpstream(
          placementsRef.current.map((p) =>
            d.placementIds.includes(p.id)
              ? clampPlacement({ ...p, x: p.x + dx, y: p.y + dy }, footprint, plotMargins, unit, deckClamp)
              : p,
          ),
        );
        patchShapesUpstream(
          shapesRef.current.map((s) => {
            if (!d.shapeIds.includes(s.id)) return s;
            if (s.kind === "POLYLINE" && s.vertices) {
              return clampShape(
                {
                  ...s,
                  vertices: s.vertices.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
                },
                footprint,
                plotMargins,
                deckClamp,
              );
            }
            if (s.kind === "LINE") {
              return clampShape(
                {
                  ...s,
                  x: s.x + dx,
                  y: s.y + dy,
                  x2: (s.x2 ?? s.x) + dx,
                  y2: (s.y2 ?? s.y) + dy,
                },
                footprint,
                plotMargins,
                deckClamp,
              );
            }
            return clampShape({ ...s, x: s.x + dx, y: s.y + dy }, footprint, plotMargins, deckClamp);
          }),
        );
        const mergedDeck = deckPolygonsRef.current.map((p) =>
          d.deckIds.includes(p.id) ? translateDeckPolygon(p, dx, dy) : p,
        );
        const pb = getPlotBoundsFromCanvas(
          { footprint: footprintRef.current, deckPolygons: mergedDeck },
          plotMarginsRef.current,
        );
        const nextDeck = mergedDeck.map((p) =>
          d.deckIds.includes(p.id) ? clampDeckPolygonToPlotBounds(p, pb) : p,
        );
        deckPolygonsRef.current = nextDeck;
        setDeckDiagram(nextDeck);
        return;
      }

      if (d.kind === "placement") {
        patchPlacementsUpstream(
          placementsRef.current.map((p) =>
            p.id === d.id
              ? clampPlacement({ ...p, x: p.x + dx, y: p.y + dy }, footprint, plotMargins, unit, deckClamp)
              : p,
          ),
        );
      } else if (d.kind === "deck") {
        const merged = deckPolygonsRef.current.map((p) =>
          p.id === d.id ? translateDeckPolygon(p, dx, dy) : p,
        );
        const pb = getPlotBoundsFromCanvas(
          { footprint: footprintRef.current, deckPolygons: merged },
          plotMarginsRef.current,
        );
        const next = merged.map((p) =>
          p.id === d.id ? clampDeckPolygonToPlotBounds(p, pb) : p,
        );
        deckPolygonsRef.current = next;
        setDeckDiagram(next);
      } else {
        patchShapesUpstream(
            shapesRef.current.map((s) => {
            if (s.id !== d.id) return s;
            if (s.kind === "POLYLINE" && s.vertices) {
              return clampShape(
                {
                  ...s,
                  vertices: s.vertices.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
                },
                footprint,
                plotMargins,
                deckClamp,
              );
            }
            if (s.kind === "LINE") {
              return clampShape(
                {
                  ...s,
                  x: s.x + dx,
                  y: s.y + dy,
                  x2: (s.x2 ?? s.x) + dx,
                  y2: (s.y2 ?? s.y) + dy,
                },
                footprint,
                plotMargins,
                deckClamp,
              );
            }
            return clampShape({ ...s, x: s.x + dx, y: s.y + dy }, footprint, plotMargins, deckClamp);
          }),
        );
      }
    };

    const onUp = () => endDrag();

    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    return () => {
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
    };
  }, [
    finalizeAuthoringSnap,
    syncAuthoringSnapGuideOverlay,
    endDrag,
    footprint,
    deckClamp,
    setDeckDiagram,
    patchPlacementsUpstream,
    patchShapesUpstream,
    pickWorld,
    plotMargins,
    snap,
    unit,
  ]);

  useEffect(() => {
    if (workspace !== "select") return undefined;

    const unitGrid = unitKey === "FEET" ? ("FEET" as const) : ("METERS" as const);

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (workspace !== "select") return;
      if (keyboardFocusIsTypingField()) return;

      const selPl = selectedPlacementIdsRef.current;
      const selSh = selectedShapeIdsRef.current;
      const selDk = selectedDeckPolygonIdsRef.current;
      const nPrim = selectionDiagramPrimitiveCountRef.current;

      const mod = e.metaKey || e.ctrlKey;

      // Alt+Shift+C: hover readout → clipboard (same TSV as Copy XY); avoids hijacking ⌘/Ctrl+C.
      if (!mod && e.altKey && e.shiftKey && e.code === "KeyC") {
        if (e.repeat) return;
        const pw = plotPointerWorldRef.current;
        if (!pw) return;
        e.preventDefault();
        copyDiagramWorldXYTabSeparated(pw);
        return;
      }

      // Select all on the plotted stack (producer Select); keeps browser ⌘A out of editors via typing guard above.
      if (mod && !e.altKey && e.shiftKey === false && e.code === "KeyA") {
        if (e.repeat) return;
        e.preventDefault();
        setSelectedPlacementIds(new Set(placementsRef.current.map((p) => p.id)));
        setSelectedShapeIds(new Set(shapesRef.current.map((s) => s.id)));
        setSelectedDeckPolygonIds(
          new Set(
            deckPolygonsRef.current
              .filter((p) => p.id !== SYNTHETIC_DECK_RECT_POLYGON_ID)
              .map((p) => p.id),
          ),
        );
        return;
      }

      if (!mod && !e.altKey && e.code === "Escape") {
        e.preventDefault();
        endDrag();
        setSelectedPlacementIds(new Set());
        setSelectedShapeIds(new Set());
        setSelectedDeckPolygonIds(new Set());
        return;
      }

      if (!mod && !e.altKey && (e.code === "Delete" || e.code === "Backspace")) {
        if (nPrim === 0) return;
        e.preventDefault();
        endDrag();
        const dkDrop = new Set(selDk);
        dkDrop.delete(SYNTHETIC_DECK_RECT_POLYGON_ID);

        let nextDeck = deckPolygonsRef.current;
        if (dkDrop.size > 0) {
          nextDeck = nextDeck.filter((p) => !dkDrop.has(p.id));
          deckPolygonsRef.current = nextDeck;
          commitDeck(nextDeck);
        }

        if (selSh.size > 0) {
          const ns = shapesRef.current.filter((s) => !selSh.has(s.id));
          shapesRef.current = ns;
          commitShapes(ns);
        }
        if (selPl.size > 0) {
          const np = placementsRef.current.filter((p) => !selPl.has(p.id));
          placementsRef.current = np;
          commitPlacements(np);
        }
        setSelectedPlacementIds(new Set());
        setSelectedShapeIds(new Set());
        setSelectedDeckPolygonIds(new Set());
        return;
      }

      // [ ] / Shift+[ ]: one-step stack moves; extremes — only when exactly one primitive is selected.
      if (!mod && !e.altKey && (e.code === "BracketLeft" || e.code === "BracketRight")) {
        if (nPrim !== 1) return;
        if (e.shiftKey) {
          const extreme = e.code === "BracketLeft" ? "back" : "front";
          if (bumpDrawOrderPaintExtreme(extreme)) e.preventDefault();
        } else {
          const dirBr: -1 | 1 = e.code === "BracketLeft" ? -1 : 1;
          if (bumpDrawOrder(dirBr)) e.preventDefault();
        }
        return;
      }

      // Home/End: same paint extremes as Shift+[ / Shift+].
      if (!mod && !e.altKey && !e.shiftKey && (e.code === "Home" || e.code === "End")) {
        if (nPrim !== 1) return;
        const extreme = e.code === "Home" ? "back" : "front";
        if (bumpDrawOrderPaintExtreme(extreme)) e.preventDefault();
        return;
      }

      if (mod && (e.key === "d" || e.key === "D")) {
        if (nPrim === 0) return;
        const dupGrid = snapStageCoordinateStep(unitGrid);
        const dupFx = dupGrid;
        const dupFy = dupGrid;

        const nextPlSel = new Set<string>();
        const nextShSel = new Set<string>();
        const nextDkSel = new Set<string>();

        let placementsOut = placementsRef.current;
        let shapesOut = shapesRef.current;
        let deckOut = deckPolygonsRef.current;
        let anyDup = false;

        const deckIdsToDup = [...selDk].filter((id) => id !== SYNTHETIC_DECK_RECT_POLYGON_ID);
        if (deckIdsToDup.length > 0) {
          let trial = deckOut;
          for (const did of deckIdsToDup) {
            if (trial.length >= MAX_STAGE_DECK_MODULES) break;
            const poly = trial.find((p) => p.id === did);
            if (!poly) continue;
            const copy: StageDeckPolygon = {
              ...poly,
              id: crypto.randomUUID(),
              points: poly.points.map((pp) => ({ x: pp.x, y: pp.y })),
            };
            const shifted = translateDeckPolygon(copy, dupFx, dupFy);
            trial = [...trial, shifted];
            const pb = getPlotBoundsFromCanvas(
              { footprint: footprintRef.current, deckPolygons: trial },
              plotMarginsRef.current,
            );
            const clamped = clampDeckPolygonToPlotBounds(shifted, pb);
            trial = trial.slice(0, -1).concat(clamped);
            nextDkSel.add(clamped.id);
            anyDup = true;
          }
          deckOut = trial;
        }

        for (const sid of selSh) {
          if (shapesOut.length >= MAX_STAGE_SHAPES) break;
          const shape = shapesOut.find((s) => s.id === sid);
          if (!shape) continue;
          const p0 = gridStructuralPeers(shape.x + dupFx, shape.y + dupFy, true, null);
          let nextShape: StageDesignShape = { ...shape, id: crypto.randomUUID(), x: p0.wx, y: p0.wy };
          if (shape.kind === "POLYLINE" && shape.vertices?.length) {
            const shiftedVerts = shape.vertices.map((pt) => {
              const mv = gridStructuralPeers(pt.x + dupFx, pt.y + dupFy, true, null);
              return { x: mv.wx, y: mv.wy };
            });
            nextShape = {
              ...nextShape,
              vertices: shiftedVerts,
              x: shiftedVerts[0]!.x,
              y: shiftedVerts[0]!.y,
            };
          }
          if (shape.kind === "LINE") {
            const p1 = gridStructuralPeers((shape.x2 ?? shape.x) + dupFx, (shape.y2 ?? shape.y) + dupFy, true, null);
            nextShape = { ...nextShape, x2: p1.wx, y2: p1.wy };
          }
          const clamped = clampShape(nextShape, footprintRef.current, plotMarginsRef.current, deckClamp);
          shapesOut = [...shapesOut, clamped];
          nextShSel.add(clamped.id);
          anyDup = true;
        }

        for (const pid of selPl) {
          if (placementsOut.length >= MAX_STAGE_PLACEMENTS) break;
          const p = placementsOut.find((r) => r.id === pid);
          if (!p) continue;
          const np = gridStructuralPeers(p.x + dupFx, p.y + dupFy, true, null);
          const dup = clampPlacement(
            { ...p, id: crypto.randomUUID(), x: np.wx, y: np.wy },
            footprintRef.current,
            plotMarginsRef.current,
            unit,
            deckClamp,
          );
          placementsOut = [...placementsOut, dup];
          nextPlSel.add(dup.id);
          anyDup = true;
        }

        if (!anyDup) return;
        e.preventDefault();
        deckPolygonsRef.current = deckOut;
        shapesRef.current = shapesOut;
        placementsRef.current = placementsOut;
        setDeckDiagram(deckOut);
        patchShapesUpstream(shapesOut);
        patchPlacementsUpstream(placementsOut);
        setSelectedPlacementIds(nextPlSel);
        setSelectedShapeIds(nextShSel);
        setSelectedDeckPolygonIds(nextDkSel);
        return;
      }

      if (!mod && (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown")) {
        if (nPrim === 0) return;
        const stepPx = snapStageCoordinateStep(unitGrid) * (e.shiftKey ? 4 : 1);
        let dx = 0;
        let dy = 0;
        if (e.key === "ArrowLeft") dx = -stepPx;
        else if (e.key === "ArrowRight") dx = stepPx;
        else if (e.key === "ArrowUp") dy = stepPx;
        else dy = -stepPx;

        const dkReal = [...selDk].filter((id) => id !== SYNTHETIC_DECK_RECT_POLYGON_ID);
        const guidesOn = !e.altKey;

        const multiSnapFlt = peerSnapGroupFilterForManipulator({
          placements: placementsRef.current,
          shapes: shapesRef.current,
          movingPlacementIds: [...selPl],
          movingShapeIds: [...selSh],
        });

        e.preventDefault();
        if (dkReal.length > 0) {
          let merged = deckPolygonsRef.current;
          for (const deckId of dkReal) {
            merged = merged.map((p) => (p.id === deckId ? translateDeckPolygon(p, dx, dy) : p));
          }
          const pb = getPlotBoundsFromCanvas(
            { footprint: footprintRef.current, deckPolygons: merged },
            plotMarginsRef.current,
          );
          merged = merged.map((p) => (dkReal.includes(p.id) ? clampDeckPolygonToPlotBounds(p, pb) : p));
          deckPolygonsRef.current = merged;
          commitDeck(merged);
        }

        if (selSh.size > 0) {
          commitShapes(
            shapesRef.current.map((s) => {
              if (!selSh.has(s.id)) return s;
              const peerKb: PeerSnapExclude = {
                excludeShapeIds: cloneSetMinusId(selSh, s.id),
                excludePlacementIds: new Set(selPl),
                ...(multiSnapFlt ? { peerSnapGroup: multiSnapFlt } : {}),
              };
              if (s.kind === "POLYLINE" && s.vertices) {
                return clampShape(
                  {
                    ...s,
                    vertices: s.vertices.map((pt) => {
                      const mv = gridStructuralPeers(pt.x + dx, pt.y + dy, guidesOn, peerKb);
                      return { x: mv.wx, y: mv.wy };
                    }),
                  },
                  footprintRef.current,
                  plotMarginsRef.current,
                  deckClamp,
                );
              }
              if (s.kind === "LINE") {
                const ep0 = gridStructuralPeers(s.x + dx, s.y + dy, guidesOn, peerKb);
                const ep1 = gridStructuralPeers((s.x2 ?? s.x) + dx, (s.y2 ?? s.y) + dy, guidesOn, peerKb);
                return clampShape(
                  { ...s, x: ep0.wx, y: ep0.wy, x2: ep1.wx, y2: ep1.wy },
                  footprintRef.current,
                  plotMarginsRef.current,
                  deckClamp,
                );
              }
              const ep = gridStructuralPeers(s.x + dx, s.y + dy, guidesOn, peerKb);
              return clampShape({ ...s, x: ep.wx, y: ep.wy }, footprintRef.current, plotMarginsRef.current, deckClamp);
            }),
          );
        }

        if (selPl.size > 0) {
          commitPlacements(
            placementsRef.current.map((p) => {
              if (!selPl.has(p.id)) return p;
              const peerKb: PeerSnapExclude = {
                excludePlacementIds: cloneSetMinusId(selPl, p.id),
                excludeShapeIds: new Set(selSh),
                ...(multiSnapFlt ? { peerSnapGroup: multiSnapFlt } : {}),
              };
              const np = gridStructuralPeers(p.x + dx, p.y + dy, guidesOn, peerKb);
              return clampPlacement({ ...p, x: np.wx, y: np.wy }, footprintRef.current, plotMarginsRef.current, unit, deckClamp);
            }),
          );
        }
        return;
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [
    workspace,
    selectedPlacementIds,
    selectedShapeIds,
    selectedDeckPolygonIds,
    deckPolygons.length,
    unitKey,
    unit,
    endDrag,
    gridStructuralPeers,
    commitDeck,
    commitPlacements,
    commitShapes,
    deckClamp,
    bumpDrawOrder,
    bumpDrawOrderPaintExtreme,
    patchPlacementsUpstream,
    patchShapesUpstream,
    setDeckDiagram,
  ]);

  useEffect(() => {
    if (workspace !== "shapes") return undefined;

    const onPolyKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (shapeTool !== "POLYLINE") return;
      if (keyboardFocusIsTypingField()) return;

      if (!e.altKey && e.code === "Escape") {
        e.preventDefault();
        setPolylineDraftPoints(null);
        setShapeDraft(null);
        return;
      }

      if (
        !e.repeat &&
        !e.altKey &&
        !e.metaKey &&
        !e.ctrlKey &&
        (e.code === "Backspace" || e.code === "Delete")
      ) {
        const pts = polylineDraftPoints;
        if (!pts?.length) return;
        e.preventDefault();
        if (pts.length === 1) setPolylineDraftPoints(null);
        else setPolylineDraftPoints(pts.slice(0, -1));
        return;
      }

      if (
        !e.repeat &&
        !e.metaKey &&
        !e.ctrlKey &&
        (e.code === "Enter" || e.code === "NumpadEnter")
      ) {
        const pts = polylineDraftPoints;
        if (!pts || pts.length < 2 || shapesRef.current.length >= MAX_STAGE_SHAPES) return;
        e.preventDefault();
        commitShapes([
          ...shapesRef.current,
          clampShape(
            {
              id: crypto.randomUUID(),
              kind: "POLYLINE",
              x: pts[0]!.x,
              y: pts[0]!.y,
              vertices: pts,
              label: "Run",
              ...newEntityLayerPartial,
            },
            footprintRef.current,
            plotMarginsRef.current,
            deckClamp,
          ),
        ]);
        setPolylineDraftPoints(null);
      }
    };

    window.addEventListener("keydown", onPolyKey, true);
    return () => window.removeEventListener("keydown", onPolyKey, true);
  }, [workspace, shapeTool, polylineDraftPoints, commitShapes, deckClamp, newEntityLayerPartial]);

  const pushPlacement = (x: number, y: number) => {
    if (placements.length >= MAX_STAGE_PLACEMENTS) return;
    const row = clampPlacement(
      {
        id: crypto.randomUUID(),
        kind: symbolKind,
        x,
        y,
        ...newEntityLayerPartial,
      },
      footprint,
      plotMargins,
      unit,
      deckClamp,
    );
    commitPlacements([...placements, row]);
  };

  const handlePlotClick = (
    world: { x: number; y: number },
    opts?: { snapToStageGrid?: boolean },
  ) => {
    const snapGrid = opts?.snapToStageGrid !== false;
    let x = snapGrid ? snap(world.x) : world.x;
    let y = snapGrid ? snap(world.y) : world.y;
    if (snapGrid) {
      const m = finalizeAuthoringSnap(false, x, y, null);
      x = m.wx;
      y = m.wy;
    }

    if (workspace === "symbols") {
      pushPlacement(x, y);
      return;
    }

    if (workspace === "select") {
      setSelectedPlacementIds(new Set());
      setSelectedShapeIds(new Set());
      setSelectedDeckPolygonIds(new Set());
      return;
    }

    if (workspace === "deck") {
      if (deckPolygons.length >= MAX_STAGE_DECK_MODULES) return;
      if (!deckRectDraft) {
        setDeckRectDraft({ x, y });
        setShapeDraft(null);
        setPolylineDraftPoints(null);
        return;
      }
      const ax = deckRectDraft.x;
      const ay = deckRectDraft.y;
      setDeckRectDraft(null);
      const rw = Math.abs(x - ax);
      const rh = Math.abs(y - ay);
      if (rw < 0.5 || rh < 0.5) return;
      commitDeck([
        ...deckPolygons,
        {
          ...rectangleDeckPolygonFromCorners(crypto.randomUUID(), ax, ay, x, y),
          ...newEntityLayerPartial,
        },
      ]);
      return;
    }

    if (workspace === "shapes") {
      if (shapes.length >= MAX_STAGE_SHAPES) return;

      if (shapeTool === "POLYLINE") {
        setPolylineDraftPoints((prev) => {
          if (prev !== null && prev.length >= MAX_STAGE_SHAPE_POLYLINE_VERTICES) return prev;
          const nextPt: StageDeckPoint = { x, y };
          if (!prev?.length) return [nextPt];
          return [...prev, nextPt];
        });
        return;
      }

      if (shapeTool === "TEXT") {
        commitShapes([
          ...shapes,
          clampShape(
            {
              id: crypto.randomUUID(),
              kind: "TEXT",
              x,
              y,
              label: "Label",
              ...newEntityLayerPartial,
            },
            footprint,
            plotMargins,
            deckClamp,
          ),
        ]);
        setShapeDraft(null);
        setPolylineDraftPoints(null);
        return;
      }

      if (!shapeDraft) {
        setShapeDraft({ x, y });
        return;
      }

      const ax = shapeDraft.x;
      const ay = shapeDraft.y;
      setShapeDraft(null);

      if (shapeTool === "LINE") {
        commitShapes([
          ...shapes,
          clampShape(
            {
              id: crypto.randomUUID(),
              kind: "LINE",
              x: ax,
              y: ay,
              x2: x,
              y2: y,
              label: "Line",
              ...newEntityLayerPartial,
            },
            footprint,
            plotMargins,
            deckClamp,
          ),
        ]);
        return;
      }

      if (shapeTool === "RECT") {
        const rx = Math.min(ax, x);
        const ry = Math.min(ay, y);
        const rw = Math.abs(x - ax);
        const rh = Math.abs(y - ay);
        if (rw < 0.5 || rh < 0.5) return;
        commitShapes([
          ...shapes,
          clampShape(
            {
              id: crypto.randomUUID(),
              kind: "RECT",
              x: rx,
              y: ry,
              width: rw,
              height: rh,
              label: "Area",
              ...newEntityLayerPartial,
            },
            footprint,
            plotMargins,
            deckClamp,
          ),
        ]);
        return;
      }

      if (shapeTool === "ELLIPSE") {
        const rdx = Math.abs(x - ax);
        const rdy = Math.abs(y - ay);
        const rxw = Math.max(0.5, rdx);
        const ryw = Math.max(0.5, rdy);
        commitShapes([
          ...shapes,
          clampShape(
            {
              id: crypto.randomUUID(),
              kind: "ELLIPSE",
              x: ax,
              y: ay,
              width: rxw,
              height: ryw,
              label: "Ellipse",
              ...newEntityLayerPartial,
            },
            footprint,
            plotMargins,
            deckClamp,
          ),
        ]);
      }
    }
  };

  const startDragPlacement = (id: string, e: React.PointerEvent) => {
    if (workspace !== "select") return;
    e.preventDefault();
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelectedPlacementIds((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      return;
    }
    diagramHistoryCallbacks?.beginContinuousDiagramGesture();
    rotateShapeRef.current = null;
    rotatePlacementRef.current = null;
    resizeShapeRef.current = null;
    resizeDeckRef.current = null;
    const selPl = selectedPlacementIdsRef.current;
    const selSh = selectedShapeIdsRef.current;
    const selDk = selectedDeckPolygonIdsRef.current;
    const nPrim = selectionDiagramPrimitiveCountRef.current;
    const groupDrag = selPl.has(id) && nPrim > 1;
    if (groupDrag) {
      dragRef.current = {
        kind: "multi",
        placementIds: [...selPl],
        shapeIds: [...selSh],
        deckIds: [...selDk].filter((d) => d !== SYNTHETIC_DECK_RECT_POLYGON_ID),
      };
    } else {
      setSelectedPlacementIds(new Set([id]));
      setSelectedShapeIds(new Set());
      setSelectedDeckPolygonIds(new Set());
      dragRef.current = { kind: "placement", id };
    }
    lastWorldRef.current = null;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const startDragShape = (id: string, e: React.PointerEvent) => {
    if (workspace !== "select") return;
    e.preventDefault();
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelectedShapeIds((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
      return;
    }
    diagramHistoryCallbacks?.beginContinuousDiagramGesture();
    rotateShapeRef.current = null;
    rotatePlacementRef.current = null;
    resizeShapeRef.current = null;
    resizeDeckRef.current = null;
    const selPl = selectedPlacementIdsRef.current;
    const selSh = selectedShapeIdsRef.current;
    const selDk = selectedDeckPolygonIdsRef.current;
    const nPrim = selectionDiagramPrimitiveCountRef.current;
    const groupDrag = selSh.has(id) && nPrim > 1;
    if (groupDrag) {
      dragRef.current = {
        kind: "multi",
        placementIds: [...selPl],
        shapeIds: [...selSh],
        deckIds: [...selDk].filter((d) => d !== SYNTHETIC_DECK_RECT_POLYGON_ID),
      };
    } else {
      setSelectedShapeIds(new Set([id]));
      setSelectedPlacementIds(new Set());
      setSelectedDeckPolygonIds(new Set());
      dragRef.current = { kind: "shape", id };
    }
    lastWorldRef.current = null;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const startShapeResize = (shapeId: string, encoded: ShapeResizeHandleEncoded, e: React.PointerEvent) => {
    if (workspace !== "select") return;
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = null;
    resizeDeckRef.current = null;
    rotateShapeRef.current = null;
    rotatePlacementRef.current = null;
    lastWorldRef.current = null;
    setSelectedShapeIds(new Set([shapeId]));
    setSelectedPlacementIds(new Set());
    setSelectedDeckPolygonIds(new Set());
    const base = shapesRef.current.find((s) => s.id === shapeId);
    if (!base || base.kind === "TEXT") return;

    if (
      base.kind === "POLYLINE" &&
      e.altKey &&
      encoded.startsWith("POLYLINE:") &&
      base.vertices &&
      base.vertices.length > 2
    ) {
      const idx = Number.parseInt(encoded.slice("POLYLINE:".length), 10);
      if (!Number.isFinite(idx) || idx < 0 || idx >= base.vertices.length) return;
      const nextVerts = removePolylineVertexAtIndex(base.vertices, idx);
      if (!nextVerts) return;
      const nextShape = clampShape(
        {
          ...base,
          vertices: nextVerts,
          x: nextVerts[0]!.x,
          y: nextVerts[0]!.y,
        },
        footprintRef.current,
        plotMarginsRef.current,
        deckClamp,
      );
      commitShapes(shapesRef.current.map((row) => (row.id === shapeId ? nextShape : row)));
      return;
    }

    diagramHistoryCallbacks?.beginContinuousDiagramGesture();
    resizeShapeRef.current = { id: shapeId, encoded, baseline: { ...base } };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const startShapeRotate = (shapeId: string, e: React.PointerEvent) => {
    if (workspace !== "select") return;
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = null;
    resizeShapeRef.current = null;
    resizeDeckRef.current = null;
    rotatePlacementRef.current = null;
    lastWorldRef.current = null;
    const base = shapesRef.current.find((s) => s.id === shapeId);
    if (!base) return;
    const hit = pickWorld(e.clientX, e.clientY);
    if (!hit) return;
    const pivot = stageShapeRotationPivotWorld(base);
    diagramHistoryCallbacks?.beginContinuousDiagramGesture();
    const pointer0Deg = plotPointerAngleDegrees(pivot.wx, pivot.wy, hit.wx, hit.wy);
    rotateShapeRef.current = {
      id: shapeId,
      pivotWx: pivot.wx,
      pivotWy: pivot.wy,
      pointer0Deg,
      baselineRotDeg: base.rotationDeg ?? 0,
    };
    setSelectedShapeIds(new Set([shapeId]));
    setSelectedPlacementIds(new Set());
    setSelectedDeckPolygonIds(new Set());
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const startPlacementRotate = (placementId: string, e: React.PointerEvent) => {
    if (workspace !== "select") return;
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = null;
    resizeShapeRef.current = null;
    resizeDeckRef.current = null;
    rotateShapeRef.current = null;
    lastWorldRef.current = null;
    const pRow = placementsRef.current.find((p) => p.id === placementId);
    if (!pRow) return;
    const hit = pickWorld(e.clientX, e.clientY);
    if (!hit) return;
    const pivot = stagePlacementRotationPivotWorld(pRow);
    diagramHistoryCallbacks?.beginContinuousDiagramGesture();
    const pointer0Deg = plotPointerAngleDegrees(pivot.wx, pivot.wy, hit.wx, hit.wy);
    rotatePlacementRef.current = {
      id: placementId,
      pivotWx: pivot.wx,
      pivotWy: pivot.wy,
      pointer0Deg,
      baselineRotDeg: pRow.rotationDeg ?? 0,
    };
    setSelectedPlacementIds(new Set([placementId]));
    setSelectedShapeIds(new Set());
    setSelectedDeckPolygonIds(new Set());
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const startDeckDrag = (polyId: string, e: React.PointerEvent) => {
    if (workspace !== "select") return;
    if (polyId === SYNTHETIC_DECK_RECT_POLYGON_ID) return;
    e.preventDefault();
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      setSelectedDeckPolygonIds((prev) => {
        const n = new Set(prev);
        if (n.has(polyId)) n.delete(polyId);
        else n.add(polyId);
        return n;
      });
      return;
    }
    diagramHistoryCallbacks?.beginContinuousDiagramGesture();
    resizeShapeRef.current = null;
    resizeDeckRef.current = null;
    rotateShapeRef.current = null;
    rotatePlacementRef.current = null;
    const selPl = selectedPlacementIdsRef.current;
    const selSh = selectedShapeIdsRef.current;
    const selDk = selectedDeckPolygonIdsRef.current;
    const nPrim = selectionDiagramPrimitiveCountRef.current;
    const selectableDeckSel = [...selDk].filter((d) => d !== SYNTHETIC_DECK_RECT_POLYGON_ID);
    const groupDrag = selDk.has(polyId) && nPrim > 1;
    if (groupDrag) {
      dragRef.current = {
        kind: "multi",
        placementIds: [...selPl],
        shapeIds: [...selSh],
        deckIds: selectableDeckSel,
      };
    } else {
      setSelectedDeckPolygonIds(new Set([polyId]));
      setSelectedPlacementIds(new Set());
      setSelectedShapeIds(new Set());
      dragRef.current = { kind: "deck", id: polyId };
    }
    lastWorldRef.current = null;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const startDeckResize = (polyId: string, corner: ResizeCornerId, e: React.PointerEvent) => {
    if (workspace !== "select") return;
    if (e.button !== 0) return;
    if (polyId === SYNTHETIC_DECK_RECT_POLYGON_ID) return;
    e.preventDefault();
    dragRef.current = null;
    resizeShapeRef.current = null;
    rotateShapeRef.current = null;
    rotatePlacementRef.current = null;
    lastWorldRef.current = null;
    setSelectedDeckPolygonIds(new Set([polyId]));
    setSelectedPlacementIds(new Set());
    setSelectedShapeIds(new Set());
    const base = deckPolygonsRef.current.find((p) => p.id === polyId);
    if (!base) return;
    diagramHistoryCallbacks?.beginContinuousDiagramGesture();
    resizeDeckRef.current = { id: polyId, corner, baseline: { ...base, points: base.points.map((p) => ({ x: p.x, y: p.y })) } };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_min(17.5rem,28vw)] xl:items-start xl:gap-5">
      <div className="min-w-0 space-y-4">
      <div>
        <h3 className="text-xs font-semibold text-uls-text">Plot · Symbols · Deck · Shapes</h3>
        <p className="mt-1 text-[10px] leading-relaxed text-uls-muted">
          Extend the drawable area past the deck for FOH truss, lasers, wings, delay clusters, etc. Negative Y toward the audience
          stays inside the plotted margins — adjust margins if you hit the boundary. The gridded box is the plot at true scale; slim
          borders around it appear when the footprint plus margins is much wider than deep (or vice versa). Symbol size fields below
          resize marks on that grid. Use <span className="font-medium text-uls-text">Deck modules</span> for stacked rectangular
          platforms (multi-polygon CAD-style). Use Select to drag symbols, shapes, and deck modules; drag shape corners, line endpoints, or{' '}
          <span className="font-medium text-uls-text">polyline vertices</span> where shown, or
          deck corners (when the module is a rectangle) to resize; drag the amber knob on a selected symbol (or cyan for shapes —
          rects, ellipses, lines, polylines, text) to rotate on canvas (Shift snaps 15°).
          Polyline:&nbsp;<span className="font-medium text-uls-text">double‑click a segment</span> inserts a bend (cursor shows copy along the path);{' '}
          <span className="font-medium text-uls-text">Alt+click a vertex grip</span> deletes it while at least two points remain.
          When drafting a path in Shapes, <span className="font-medium text-uls-text">Backspace / Delete</span> peels the last plotted bend before you press Enter.&nbsp;
          In Select, <span className="font-mono text-[11px] font-medium text-uls-text">[</span>
          <span className="text-uls-muted"> / </span>
          <span className="font-mono text-[11px] font-medium text-uls-text">]</span> steps draw order one notch within whichever diagram layer owns the selection (use{' '}
          <span className="font-medium text-uls-text">Diagram layers</span> panel (<span className="font-medium text-uls-text">Layers</span> in the toolbar) to reorder whole tiers ahead of symbols, shapes, or deck modules);{' '}
          <span className="font-mono text-[11px] font-medium text-uls-text">Shift+[</span>
          <span className="text-uls-muted"> / </span>
          <span className="font-mono text-[11px] font-medium text-uls-text">Shift+]</span>{' '}
          or{' '}
          <span className="font-mono text-[11px] font-medium text-uls-text">Home</span>
          <span className="text-uls-muted"> / </span>
          <span className="font-mono text-[11px] font-medium text-uls-text">End</span> snap to layer-local back/front only (tier order follows the Layers list and matches director <span className="font-medium text-uls-text">Show</span> after Save).
          Keys <span className="font-mono text-[11px] font-medium text-uls-text">1</span>
          <span className="text-uls-muted">–</span>
          <span className="font-mono text-[11px] font-medium text-uls-text">4</span> switch workspaces when a text field isn’t focused; in{' '}
          <span className="font-medium text-uls-text">Symbols</span> or{' '}
          <span className="font-medium text-uls-text">Shapes</span>,{' '}
          <span className="font-mono text-[11px] font-medium text-uls-text">5</span>
          <span className="text-uls-muted">–</span>
          <span className="font-mono text-[11px] font-medium text-uls-text">9</span> selects the nth control in each symbol-type or shape-tool row (
          toolbar order).
          <span className="font-mono text-[11px] font-medium text-uls-text"> Alt+Shift+C</span> in Select copies hovered world X/Y (tab-separated), same as{' '}
          <span className="font-medium text-uls-text">Copy XY</span>;
          duplicate ⌘/Ctrl+D,
          Delete/Backspace to remove; Escape clears selection while editing.
          Rotate symbols in the lists too. Shapes use two taps (ellipse: center then edge).
        </p>
      </div>

      <div className="flex w-full max-w-3xl flex-wrap items-stretch gap-1 rounded-xl border border-white/[0.1] bg-zinc-950/90 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div
          className="inline-flex min-w-0 flex-1 flex-wrap rounded-lg bg-black/25 p-0.5"
          role="toolbar"
          aria-label="Stage plot workspace mode (keys 1 to 4 when not typing)"
        >
          {STAGE_DESIGN_WORKSPACE_ROWS.map(([k, lab], i) => {
            const active = workspace === k;
            return (
              <button
                key={k}
                type="button"
                title={`${lab} (${i + 1} when plot focus is outside text fields)`}
                onClick={() => activateWorkspaceMode(k)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-white/[0.11] text-uls-text shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                    : "text-uls-muted hover:bg-white/[0.05] hover:text-uls-text"
                }`}
              >
                {lab}
              </button>
            );
          })}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 rounded-lg border border-white/[0.08] px-3 text-xs font-medium"
          aria-expanded={diagramLayersDrawerOpen}
          title="Drafting tiers (bottom→top · export/import · browser presets)"
          onClick={() => setDiagramLayersDrawerOpen(true)}
        >
          Layers
        </Button>
      </div>

      {diagramLayersDrawerOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px]"
            aria-label="Close diagram layers"
            onClick={() => setDiagramLayersDrawerOpen(false)}
          />
          <aside
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-white/[0.1] bg-zinc-950/98 shadow-[0_0_40px_rgba(0,0,0,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-label="Diagram layers"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] px-3 py-2.5">
              <p className="text-xs font-semibold text-uls-text">Diagram layers</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDiagramLayersDrawerOpen(false)}>
                Close
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        <input
          ref={diagramTemplateImportInputRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          onChange={onDiagramLayerTemplateImportChange}
          aria-label="Import diagram layer template JSON"
        />
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="mt-0.5 text-[10px] text-uls-muted">
              Rows list bottom→top paint order across symbols, shapes, and deck modules. Optional folder paths use slashes to
              nest collapsible headings (example <span className="font-medium text-uls-subtle">Rigging / LX</span>); adjacent tiers
              that share the same nonempty path prefix collapse together — paint/stack order stays in this flat ordering; drag the
              <span className="mx-0.5 font-mono text-uls-text">≡</span> grip onto another tier to reorder relative to{' '}
              <span className="font-medium text-uls-subtle">Main</span>{' '}
              <span className="text-uls-subtle">(or Back / Front)</span>, or onto a nested folder heading to assign its path without typing.
              Preset chips add common tiers plus folder labels.{' '}
              <span className="font-medium text-uls-subtle">Export tiers JSON</span> /
              {' '}
              <span className="font-medium text-uls-subtle">Import tiers</span> snapshots custom tier stacks (fresh ids on merge —
              remap symbols after import if needed). <span className="font-medium text-uls-subtle">Browser presets</span> keep
              named stacks in local storage per project on this device. Within a tier, bracket draw order applies unless{' '}
              <span className="font-medium text-uls-subtle">Lock `[` reorder</span> is checked — then move primitives by changing tier or unlocking.
              Removing a nonempty custom layer prompts moving its items first.
              {' '}
              <span className="font-medium text-uls-subtle">Duplicate tier</span> /
              {' '}
              <span className="font-mono text-[10px] text-uls-text/95">⌘⇧L</span>
              <span className="text-uls-muted">/</span>
              <span className="font-mono text-[10px] text-uls-text/95">Ctrl+Shift+L</span>
              duplicates the picker selection (outside text fields), same as the button — not Main.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-end justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Download JSON of every custom tier (names, folders, visibility, bracket lock) — no ids; portable between plots"
              onClick={exportDiagramLayerTemplatePack}
            >
              Export tiers JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={diagramLayers.length >= MAX_DIAGRAM_LAYERS}
              title={
                diagramLayers.length >= MAX_DIAGRAM_LAYERS
                  ? "Tier cap reached — remove rows before merging a template"
                  : "Append tiers from a template JSON — new tier ids; primitives stay where they were unless migrated"
              }
              onClick={() => diagramTemplateImportInputRef.current?.click()}
            >
              Import tiers…
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={
                effectiveActiveDiagramLayerId === DIAGRAM_LAYER_DEFAULT_ID ||
                diagramLayers.length >= MAX_DIAGRAM_LAYERS
              }
              title={
                effectiveActiveDiagramLayerId === DIAGRAM_LAYER_DEFAULT_ID
                  ? "Pick a custom tier in Symbols / shapes / deck use below first"
                  : diagramLayers.length >= MAX_DIAGRAM_LAYERS
                    ? "Maximum layer count reached"
                    : "Duplicate the selected tier (empty copy; inherits folder) · ⌘/Ctrl+Shift+L outside text fields"
              }
              onClick={duplicateActiveDiagramTier}
            >
              Duplicate tier
            </Button>
            {DIAGRAM_LAYER_QUICK_PRESETS.map((preset) => (
              <Button
                key={preset.label}
                type="button"
                variant="ghost"
                size="sm"
                disabled={diagramLayers.length >= MAX_DIAGRAM_LAYERS}
                title={
                  diagramLayers.length >= MAX_DIAGRAM_LAYERS
                    ? "Maximum layer count reached"
                    : `Add ${preset.name}${preset.group ? ` under ${preset.group}` : ""}`
                }
                onClick={() => {
                  if (diagramLayers.length >= MAX_DIAGRAM_LAYERS) return;
                  diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                  const id = `uls_layer_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
                  const g = sanitizeDiagramLayerGroup(preset.group ?? "");
                  const row: StageDiagramLayer = { id, name: preset.name.slice(0, 64) };
                  if (g) row.group = g;
                  onDiagramLayersChange([...diagramLayers, row]);
                  setActiveDiagramLayerId(id);
                  try {
                    sessionStorage.setItem(STAGE_DESIGN_ACTIVE_LAYER_STORAGE_KEY, id);
                  } catch {
                    /* private mode */
                  }
                }}
              >
                + {preset.label}
              </Button>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={diagramLayers.length >= MAX_DIAGRAM_LAYERS}
              title={diagramLayers.length >= MAX_DIAGRAM_LAYERS ? "Maximum layer count reached" : "Add layer on top"}
              onClick={() => {
                if (diagramLayers.length >= MAX_DIAGRAM_LAYERS) return;
                diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                const id = `uls_layer_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
                onDiagramLayersChange([...diagramLayers, { id, name: "Layer" }]);
              }}
            >
              Add layer
            </Button>
          </div>
        </div>

        {diagramTemplateImportMsg ? (
          <p className="text-[10px] leading-snug text-uls-muted">{diagramTemplateImportMsg}</p>
        ) : null}

        <details className="mt-1 rounded-lg border border-white/[0.06] bg-black/[0.08] px-2 py-2 text-[10px] text-uls-muted">
          <summary className="cursor-pointer select-none font-medium text-uls-subtle">
            Browser presets (this device · this project)
          </summary>
          <div className="mt-2 space-y-2">
            <p className="text-[10px] leading-snug text-uls-subtle">
              Save the current custom tier rows (everything above <span className="font-medium text-uls-text">Main</span>) under
              a short name, then apply later — same merge rules as <span className="font-medium text-uls-text">Import tiers</span>{' '}
              (fresh ids; geometry stays on existing tiers until reassigned).
            </p>
            <div className="flex flex-wrap items-center gap-1">
              <input
                type="text"
                value={browserLayerPresetLabel}
                maxLength={48}
                placeholder="Preset name"
                aria-label="Name for browser tier preset"
                onChange={(e) => setBrowserLayerPresetLabel(e.target.value)}
                className="min-w-[10rem] flex-1 rounded-md border border-white/[0.1] bg-black/35 px-2 py-1 text-[11px] text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={saveBrowserLayerPreset}
                title="Stores custom tiers only (Main is never saved in a preset)"
              >
                Save current stack
              </Button>
            </div>
            {browserLayerPresets.length === 0 ? (
              <p className="text-[10px] text-uls-subtle">No presets saved in this browser for this project yet.</p>
            ) : (
              <ul className="list-none space-y-1.5">
                {browserLayerPresets.map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-white/[0.06] bg-black/25 px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 font-medium text-uls-text">{p.label}</span>
                    <span className="text-[9px] tabular-nums text-uls-subtle">
                      {p.tiers.length} tier{p.tiers.length === 1 ? "" : "s"}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={diagramLayers.length >= MAX_DIAGRAM_LAYERS}
                      title={
                        diagramLayers.length >= MAX_DIAGRAM_LAYERS
                          ? "Tier cap reached"
                          : `Append tiers from “${p.label}” to the stack`
                      }
                      onClick={() => applyBrowserLayerPreset(p)}
                    >
                      Apply
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title="Remove this preset from browser storage"
                      onClick={() => removeBrowserLayerPreset(p.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>

        <label className="flex flex-wrap items-center gap-2 text-[10px] text-uls-muted">
          <span className="font-medium text-uls-subtle">Symbols / shapes / deck use</span>
          <select
            className="rounded-md border border-white/[0.12] bg-black/40 px-2 py-1 text-xs text-uls-text"
            value={effectiveActiveDiagramLayerId}
            onChange={(e) => pickActiveDiagramLayer(e.target.value)}
          >
            {diagramLayers
              .filter((l) => l.visible !== false)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
          <span className="text-uls-subtle">(sticky in this browser session)</span>
        </label>

        <ul className="space-y-2 list-none">
          {diagramLayersListPaneItems(diagramLayers).map((item) =>
            item.kind === "row" ? (
              diagramLayerTierRow(item.index, item.layer)
            ) : (
              <li
                key={`dlg_nested_${item.tierIndices.join("_")}`}
                className="overflow-hidden rounded-lg border border-white/[0.09] bg-black/[0.06] px-2 py-1.5"
              >
                {diagramLayerNestSubtree(item.roots, `dlg_nested_${item.tierIndices.join("_")}`, false, [])}
              </li>
            ),
          )}
        </ul>
            </div>
          </aside>
        </>
      ) : null}

      {selectModeDrawOrderHud ? (
        <div
          className="flex max-w-3xl flex-col gap-3 rounded-xl border border-white/[0.1] bg-zinc-950/75 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          role="group"
          aria-label="Draw order within the selection layer ([ / ], Shift+[ / ], Home / End extremes)"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-uls-subtle">Draw order</span>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!selectModeDrawOrderHud.canBack}
                title="Send back one step ([)"
                onClick={() => bumpDrawOrder(-1)}
              >
                Send back
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!selectModeDrawOrderHud.canFwd}
                title="Bring forward one step (])"
                onClick={() => bumpDrawOrder(1)}
              >
                Bring forward
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!selectModeDrawOrderHud.canBack}
                title="Layer back — bottom of selection’s tier (Shift+[ or Home)"
                onClick={() => bumpDrawOrderPaintExtreme("back")}
              >
                Layer back
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!selectModeDrawOrderHud.canFwd}
                title="Layer front — top of selection’s tier (Shift+] or End)"
                onClick={() => bumpDrawOrderPaintExtreme("front")}
              >
                Layer front
              </Button>
            </div>
            <span className="text-[10px] leading-snug text-uls-muted">
              <span className="font-medium text-uls-text/[0.92]">{selectModeDrawOrderHud.layerLabel}</span>:{' '}
              <span className="font-mono text-[11px] text-uls-text/90">[</span>
              <span className="text-uls-muted"> / </span>
              <span className="font-mono text-[11px] text-uls-text/90">]</span> one step;{' '}
              <span className="font-mono text-[11px] text-uls-text/90">Shift+[</span>
              <span className="text-uls-muted"> / </span>
              <span className="font-mono text-[11px] text-uls-text/90">Shift+]</span> or{' '}
              <span className="font-mono text-[11px] text-uls-text/90">Home</span>
              <span className="text-uls-muted"> / </span>
              <span className="font-mono text-[11px] text-uls-text/90">End</span>
              {' '}layer-local bottom/top · change tiers via the <span className="font-medium text-uls-text">Layers</span> drawer or the Selection layer picker.
            </span>
          </div>
          {selectModeTargetRef ? (
            <label className="flex w-full min-w-0 max-w-md flex-col gap-1 text-[10px] text-uls-muted">
              <span className="font-semibold uppercase tracking-wide text-uls-subtle">Selection layer</span>
              <select
                className="rounded-md border border-white/[0.12] bg-black/45 px-2 py-1.5 text-xs text-uls-text"
                value={selectionLayerPickerValue}
                onChange={(e) => assignSelectionLayer(e.target.value)}
              >
                {diagramSelectionSpansMultipleDiagramLayers && selectionDiagramPrimitiveCount > 0 ? (
                  <option value={DIAGRAM_SELECTION_LAYER_MIXED} disabled>
                    Mixed layers…
                  </option>
                ) : null}
                {diagramLayers.map((l) => (
                  <option key={l.id} value={l.id} disabled={l.visible === false}>
                    {l.name}
                    {l.visible === false ? " — hidden" : ""}
                  </option>
                ))}
              </select>
              <span className="leading-snug text-uls-muted">
                Brackets reorder only peers on the assigned layer tier; extremes stay inside that tier too — open the{' '}
                <span className="font-medium text-uls-text">Layers</span> drawer to move a tier above another stack.
              </span>
            </label>
          ) : null}
        </div>
      ) : !selectModeDrawOrderHud && selectModeTargetRef ? (
        <div
          className="flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-white/[0.1] bg-zinc-950/75 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          role="group"
          aria-label="Assign layer for selected primitive"
        >
          <label className="flex w-full min-w-0 max-w-md flex-col gap-1 text-[10px] text-uls-muted">
            <span className="font-semibold uppercase tracking-wide text-uls-subtle">Selection layer</span>
            <select
              className="rounded-md border border-white/[0.12] bg-black/45 px-2 py-1.5 text-xs text-uls-text"
              value={selectionLayerPickerValue}
              onChange={(e) => assignSelectionLayer(e.target.value)}
            >
              {diagramSelectionSpansMultipleDiagramLayers && selectionDiagramPrimitiveCount > 0 ? (
                <option value={DIAGRAM_SELECTION_LAYER_MIXED} disabled>
                  Mixed layers…
                </option>
              ) : null}
              {diagramLayers.map((l) => (
                <option key={l.id} value={l.id} disabled={l.visible === false}>
                  {l.name}
                  {l.visible === false ? " — hidden" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {workspace === "select" && selectedPlacementIds.size + selectedShapeIds.size > 0 ? (
        <div
          className="flex max-w-3xl flex-col gap-2 rounded-xl border border-white/[0.1] bg-zinc-950/75 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          role="group"
          aria-label="Peer snap magnet tag for symbols and shapes in this selection"
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[11rem] flex-1 flex-col gap-1 text-[10px] text-uls-muted">
              <span className="font-semibold uppercase tracking-wide text-uls-subtle">Selection peer snap tag</span>
              <input
                key={`peerSnap:${selectionPeerSnapBatchKey}:${selectionUnanimousPeerSnapTag ?? ""}`}
                ref={batchPeerSnapInputRef}
                type="text"
                maxLength={PEER_SNAP_GROUP_MAX_CHARS}
                defaultValue={selectionUnanimousPeerSnapTag ?? ""}
                onChange={(e) => {
                  const el = e.currentTarget;
                  const next = el.value.slice(0, PEER_SNAP_GROUP_MAX_CHARS);
                  if (el.value !== next) el.value = next;
                }}
                placeholder="e.g. LX-rig-A — blank = clear on Apply"
                className="rounded-md border border-white/[0.12] bg-black/45 px-2 py-1.5 font-mono text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                title={`Same token as Symbols/Shapes inspector fields (≤${PEER_SNAP_GROUP_MAX_CHARS} chars, letters digits _ - ). When Apply resolves empty or invalid typing, tags are stripped from selected items.`}
              />
            </label>
            <Button type="button" variant="ghost" size="sm" title="Writes one tag to each selected symbol and shape row" onClick={applySelectionPeerSnapFromDraft}>
              Apply tag
            </Button>
            <Button type="button" variant="ghost" size="sm" title="Clears magnet tag field on selected symbols/shapes only" onClick={clearSelectionPeerSnapTags}>
              Clear tag
            </Button>
          </div>
          <p className="text-[10px] leading-snug text-uls-muted">
            Deck polygons have no magnet tag. When selection mixes primitives with different tags, the field blanks until Apply — export joins see{' '}
            <span className="font-mono text-uls-text/90">peer_snap_group</span> on{' '}
            <span className="font-medium text-uls-text/90">BOM CSV</span> symbol and shape tables.
          </p>
        </div>
      ) : null}

      {workspace === "select" && selectedPlacementIds.size > 0 ? (
        <div
          className="flex max-w-3xl flex-col gap-3 rounded-xl border border-white/[0.1] bg-zinc-950/75 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          role="group"
          aria-label="Batch symbol equipment for selected placements"
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex min-w-[11rem] flex-1 flex-col gap-1 text-[10px] text-uls-muted">
              <span className="font-semibold uppercase tracking-wide text-uls-subtle">Selection fixture id</span>
              <input
                key={`fixture:${selectionFixtureEquipmentBatchKey}:${selectionUnanimousFixtureId === undefined ? "__mixed__" : selectionUnanimousFixtureId}`}
                ref={batchFixtureIdInputRef}
                type="text"
                maxLength={STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS}
                defaultValue={selectionUnanimousFixtureId ?? ""}
                placeholder="e.g. LX-truss-block-A — blank clears on Apply"
                className="rounded-md border border-white/[0.12] bg-black/45 px-2 py-1.5 font-mono text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                title={`Writes fixture inventory id (≤${STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS} chars) to each selected symbol · Plot BOM fixture_id`}
              />
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Writes draft fixture id to every selected symbol row"
              onClick={applySelectionFixtureIdFromDraft}
            >
              Apply fixture id
            </Button>
            <Button type="button" variant="ghost" size="sm" title="Clears fixture id on selected symbols only" onClick={clearSelectionFixtureIds}>
              Clear id
            </Button>
          </div>
          <p className="text-[10px] leading-snug text-uls-muted">
            When fixture ids disagree inside the selection, the field blanks until Apply — same pattern as peer snap tags.
            Shapes and deck modules ignore this strip (symbols only).
          </p>
          {selectionHasDmxCapablePlacement ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-white/[0.06] pt-2">
              <label className="flex flex-col gap-1 text-[10px] text-uls-muted">
                <span className="font-semibold uppercase tracking-wide text-uls-subtle">Batch DMX universe</span>
                <input
                  ref={batchDmxUniverseInputRef}
                  type="number"
                  min={1}
                  max={256}
                  step={1}
                  placeholder="1–256"
                  className="w-[7rem] rounded-md border border-white/[0.12] bg-black/45 px-2 py-1.5 tabular-nums text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                />
              </label>
              <label className="flex flex-col gap-1 text-[10px] text-uls-muted">
                <span className="font-semibold uppercase tracking-wide text-uls-subtle">Batch DMX channel</span>
                <input
                  ref={batchDmxChannelInputRef}
                  type="number"
                  min={1}
                  max={512}
                  step={1}
                  placeholder="1–512"
                  className="w-[7rem] rounded-md border border-white/[0.12] bg-black/45 px-2 py-1.5 tabular-nums text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Writes paired universe + channel to each fixture-class symbol in the selection (LED surfaces & automated fixtures)"
                onClick={applySelectionPairedDmxFromDraft}
              >
                Apply paired DMX
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title="Clears DMX universe and channel on fixture-class symbols in the selection only"
                onClick={clearSelectionDmxAddresses}
              >
                Clear DMX
              </Button>
            </div>
          ) : (
            <p className="border-t border-white/[0.06] pt-2 text-[10px] leading-snug text-uls-muted">
              Add at least one fixture / strip / LED symbol to the selection for paired DMX batch edits (universe + channel apply
              together).
            </p>
          )}
        </div>
      ) : null}

      {workspace === "symbols" ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-uls-muted">Next symbol</legend>
          <div
            className="inline-flex max-w-full flex-wrap rounded-xl border border-white/[0.1] bg-zinc-950/90 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            role="toolbar"
            aria-label="Symbol type (keys 5 to 9 when this workspace is active, outside text fields)"
          >
            {STAGE_DESIGN_PLACEMENT_KIND_ORDER.map((k, idx) => (
              <label
                key={k}
                title={`${STAGE_DESIGN_KIND_LABELS[k]} — key ${Math.min(idx + 5, 9)} in Symbols mode when focus is outside text fields (symbols past slot 9 have no digit hotkey)`}
                className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium leading-tight transition-colors ${
                  symbolKind === k
                    ? "bg-white/[0.11] text-uls-text shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                    : "text-uls-muted hover:bg-white/[0.05] hover:text-uls-text"
                }`}
              >
                <input
                  type="radio"
                  name="placeKind"
                  checked={symbolKind === k}
                  onChange={() => persistAndSetSymbolKind(k)}
                  className="sr-only"
                />
                {SYMBOL_TOOLBAR_COMPACT_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {workspace === "deck" ? (
        <p className="text-[10px] leading-relaxed text-uls-accent">
          Two clicks place an axis-aligned deck block (thrust, wing, extension). Modules can overlap; nominal width/depth shrink-wrap
          the union. Max {MAX_STAGE_DECK_MODULES} modules.
          {deckRectDraft ? (
            <span className="block mt-1 font-medium">Second click finishes the rectangle…</span>
          ) : null}
        </p>
      ) : null}

      {workspace === "shapes" ? (
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-uls-muted">Shape tool</legend>
          <div
            className="inline-flex max-w-full flex-wrap rounded-xl border border-white/[0.1] bg-zinc-950/90 p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            role="toolbar"
            aria-label="Shape tool kind (keys 5 to 9 when this workspace is active, outside text fields)"
          >
            {SHAPE_TOOLS.map((k, idx) => (
              <label
                key={k}
                title={`${STAGE_SHAPE_KIND_LABELS[k]} — key ${idx + 5} in Shapes mode (outside text fields)`}
                className={`cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium leading-tight transition-colors ${
                  shapeTool === k
                    ? "bg-white/[0.11] text-uls-text shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                    : "text-uls-muted hover:bg-white/[0.05] hover:text-uls-text"
                }`}
              >
                <input
                  type="radio"
                  name="shapeTool"
                  checked={shapeTool === k}
                  onChange={() => persistAndSetShapeTool(k)}
                  className="sr-only"
                />
                {STAGE_SHAPE_KIND_LABELS[k]}
              </label>
            ))}
          </div>
          {polylineDraftPoints && polylineDraftPoints.length > 0 ? (
            <p className="text-[10px] text-uls-accent">
              {polylineDraftPoints.length}&nbsp;point{polylineDraftPoints.length === 1 ? "" : "s"} —
              tap the plot for each bend,&nbsp;
              <span className="font-mono">Backspace</span> /&nbsp;<span className="font-mono">Delete</span> peels last bend,
              then&nbsp;<span className="font-mono">Enter</span> to finish (max {MAX_STAGE_SHAPE_POLYLINE_VERTICES} bends).
            </p>
          ) : shapeDraft ? (
            <p className="text-[10px] text-uls-accent">
              Second click finishes the {STAGE_SHAPE_KIND_LABELS[shapeTool].toLowerCase()}…
            </p>
          ) : shapeTool === "POLYLINE" ? (
            <p className="text-[10px] text-uls-subtle">
              Tap the plot once per vertex along the rigging path;&nbsp;
              <span className="font-mono text-uls-text">Enter</span> commits,&nbsp;
              <span className="font-mono text-uls-text">Backspace</span>/<span className="font-mono text-uls-text">Delete</span>
              peels the last bend,&nbsp;
              <span className="font-mono text-uls-text">Esc</span> cancels drafting.
            </p>
          ) : shapeTool !== "TEXT" ? (
            <p className="text-[10px] text-uls-subtle">First click sets start / center; second click sets end / size.</p>
          ) : (
            <p className="text-[10px] text-uls-subtle">Single click drops a text label.</p>
          )}
        </fieldset>
      ) : null}

      {deckPolygons.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-white/[0.08] bg-black/15 px-3 py-2">
          <p className="text-xs font-medium text-uls-muted">
            Deck modules ({deckPolygons.length}/{MAX_STAGE_DECK_MODULES})
          </p>
          <ul className="max-h-36 space-y-1 overflow-y-auto pr-1">
            {deckPolygons.map((poly) => (
              <li
                key={poly.id}
                className={`flex items-center justify-between gap-2 rounded border px-2 py-1 text-[11px] ${
                  poly.id !== SYNTHETIC_DECK_RECT_POLYGON_ID && selectedDeckPolygonIds.has(poly.id)
                    ? "border-uls-accent/45 bg-black/35"
                    : "border-white/[0.06] bg-black/20"
                } cursor-pointer`}
                onClick={(e) => {
                  const additive = e.shiftKey || e.metaKey || e.ctrlKey;
                  if (poly.id === SYNTHETIC_DECK_RECT_POLYGON_ID) return;
                  if (additive) {
                    setSelectedDeckPolygonIds((prev) => {
                      const n = new Set(prev);
                      if (n.has(poly.id)) n.delete(poly.id);
                      else n.add(poly.id);
                      return n;
                    });
                    return;
                  }
                  setSelectedDeckPolygonIds(new Set([poly.id]));
                  setSelectedPlacementIds(new Set());
                  setSelectedShapeIds(new Set());
                }}
              >
                <span className="min-w-0 truncate text-uls-subtle">{poly.id}</span>
                <button
                  type="button"
                  className="shrink-0 text-uls-accent underline-offset-2 hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    commitDeck(deckPolygons.filter((p) => p.id !== poly.id));
                    setSelectedDeckPolygonIds((cur) => {
                      const n = new Set(cur);
                      n.delete(poly.id);
                      return n;
                    });
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              commitDeck([]);
              setSelectedDeckPolygonIds(new Set());
            }}
          >
            Clear all modules
          </Button>
        </div>
      ) : null}

      <details className="max-w-3xl rounded-lg border border-white/[0.08] bg-black/10 px-3 py-2 text-uls-subtle">
        <summary className="cursor-pointer select-none text-[11px] font-semibold text-uls-muted">
          Snap magnets & export format notes (optional reading)
        </summary>
        <p className="mt-2 text-[10px] leading-relaxed">
          Snap: {unitKey === "FEET" ? "½′" : "¼ m"} — magnets pin deck corners first, else snap along deck perimeter segments
          or plot rim within one grid step; then XY can align independently to nearby symbols/shape edges when in range (
          dashed amber crosshair = deck vertex, edge snap, or plot rim; amber along the deck perimeter = segment being magnetized; cyan = peers).
          Hold Alt while dragging, resizing, or clicking for free XY without grid + magnets.
          Origin: downstage‑left corner of the deck (0,0); −Y is toward the house. Export SVG / PNG omit authoring handles and snap overlays,
          drop the plot grid, and use the same deck fill/stroke treatment as Show workspace (exported shapes/symbols unchanged). PNG and PDF snapshots
          are made from that same rasterized view (**PDF** scales to Letter landscape · vector geometry stays in SVG or DXF). PNG target width is ~1080px;
          raster of the cleaned view matches SVG serialization. If PNG/PDF never start, use Export SVG or DXF interchange.
          {' '}
          <span className="font-medium text-uls-text">BOM CSV</span>
          {' '}
          downloads UTF‑8 stacked symbol + shape + deck tables (basename matches SVG/PNG, suffix{' '}
          <span className="font-mono text-[10px] text-uls-text/95">‑bom.csv</span>
          ): symbol positions, tiers, optional <span className="font-mono text-[10px] text-uls-text/95">peer_snap_group</span> magnet tags,
          cue/DMX/patch/gel; rectangles/lines/text/paths with anchors, cable_run on line/polyline rows, peer tags where set; modular deck polygons list vertex rings,
          tiers, bounding boxes, and condensed vertex weld.{' '}
          <span className="font-medium text-uls-text">Truss CSV</span>{' '}
          (<span className="font-mono text-[10px] text-uls-text/95">‑truss‑bom.csv</span>) captures truss segment symbols only.{' '}
          <span className="font-medium text-uls-text">Fixtures CSV</span>{' '}
          (<span className="font-mono text-[10px] text-uls-text/95">‑fixtures‑bom.csv</span>) is the lighting/video-surface fixture slice.{' '}
          <span className="font-medium text-uls-text">DXF</span>{' '}
          (<span className="font-mono text-[10px] text-uls-text/95">‑plot.dxf</span>) is an ASCII interchange slice (export: LINE/CIRCLE/TEXT/MTEXT + LWPOLYLINE rings/paths/chorded ellipses; import: LINE/CIRCLE/TEXT/MTEXT/LWPOLYLINE/classic POLYLINE — MTEXT paragraphs→newlines, \\t→TAB, fields summarized, px/pt/column directives stripped; DXF bulge 42 arcs tessellated into path vertices){' '}
          — pair it with <span className="font-medium text-uls-text">Import DXF…</span> on the exporter strip (sticky diagram tier applies). Export layers split outline vs deck vs annotations vs symbols in plot world coordinates (outline layer = working plot bounds; amber deck polygons on their own layers; annotations and symbols layered).
        </p>
      </details>

      <div className="mt-2 flex w-full flex-col items-end gap-1">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={handleExportSvg}>
            Export SVG
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={diagramSnapshotRasterBusy}
            aria-busy={diagramSnapshotRasterBusy}
            onClick={() => void handleExportPng()}
          >
            Export PNG
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={diagramSnapshotRasterBusy}
            aria-busy={diagramSnapshotRasterBusy}
            title="Letter landscape PDF — vector from presentation SVG when supported (svg2pdf); otherwise same raster embed as PNG"
            onClick={() => void handleExportPdf()}
          >
            Export PDF
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canExportDiagramBomCsv}
            title={
              !canExportDiagramBomCsv
                ? "Add at least one symbol, shape, or deck module to export the plot BOM spreadsheet"
                : "Export BOM (CSV): stacked tables (symbols · shapes · deck) separated by blank lines"
            }
            onClick={handleExportDiagramBomCsv}
          >
            BOM CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={trussBomCsvPlacementCount === 0}
            title={
              trussBomCsvPlacementCount === 0
                ? "Add at least one truss segment symbol for a truss-only symbol table"
                : "Export truss BOM (CSV): symbol table with truss placements only · no shapes/deck"
            }
            onClick={handleExportTrussBomCsv}
          >
            Truss CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={fixtureBomCsvPlacementCount === 0}
            title={
              fixtureBomCsvPlacementCount === 0
                ? "Add at least one fixture / LED / strip / projector symbol for a fixture-slice table"
                : "Export fixtures BOM (CSV): fixture-pack symbols only · no shapes/deck"
            }
            onClick={handleExportFixtureBomCsv}
          >
            Fixtures CSV
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!canExportDiagramBomCsv}
            title={
              !canExportDiagramBomCsv
                ? "Add geometry to export interchange"
                : "Export ASCII DXF (minimal entities, plot world XY · same basename as SVG/PNG)"
            }
            onClick={handleExportDiagramDxf}
          >
            Export DXF
          </Button>
          <input
            ref={dxfImportInputRef}
            type="file"
            accept=".dxf,application/dxf,drawing/x-dxf"
            className="sr-only"
            tabIndex={-1}
            aria-label="Import ASCII DXF geometry into shapes"
            onChange={(ev) => void handleDxfImportSelected(ev)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={shapes.length >= MAX_STAGE_SHAPES}
            title={
              shapes.length >= MAX_STAGE_SHAPES
                ? "Diagram shape cap reached"
                : "Append LINE/CIRCLE/TEXT/MTEXT/LWPOLYLINE/classic POLYLINE chains from ASCII DXF into drawn shapes (sticky diagram tier applies)"
            }
            onClick={() => dxfImportInputRef.current?.click()}
          >
            Import DXF…
          </Button>
        </div>
        {diagramSnapshotRasterMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="max-w-md text-pretty text-right text-[10px] text-amber-200/95"
          >
            {diagramSnapshotRasterMessage}
          </p>
        ) : null}
        {dxfImportMsg ? (
          <p role="status" aria-live="polite" className="max-w-lg text-pretty text-right text-[10px] text-sky-100/95">
            {dxfImportMsg}
          </p>
        ) : null}
      </div>

      {workspace === "select" ? (
        <div className="mb-1 flex min-h-7 items-center justify-end gap-2">
          <p
            className={`min-w-[12.5rem] text-right text-[10px] font-mono tabular-nums text-uls-muted ${
              plotPointerWorld ? "" : "invisible"
            }`}
            aria-hidden={!plotPointerWorld}
          >
            {plotPointerWorld ? (
              <>
                X {formatStagePlotAxisCoord(plotPointerWorld.wx, unit)} · Y{" "}
                {formatStagePlotAxisCoord(plotPointerWorld.wy, unit)}
              </>
            ) : (
              /* layout placeholder — same glyph pattern for stable width */
              <>X 000.00′ · Y 000.00′</>
            )}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!plotPointerWorld}
            className={`h-6 shrink-0 px-2 py-0 text-[10px] leading-none ${
              plotPointerWorld ? "" : "invisible pointer-events-none"
            }`}
            title="Copy tab-separated world X/Y (Alt+Shift+C when hovering the plot)"
            aria-label="Copy plot X and Y in world coordinates to the clipboard (tab-separated). Shortcut: Alt+Shift+C when the plot shows live X/Y."
            onClick={() => {
              if (!plotPointerWorld) return;
              copyDiagramWorldXYTabSeparated(plotPointerWorld);
            }}
          >
            Copy XY
          </Button>
        </div>
      ) : null}

      <div className="xl:hidden">
      <StageDiagramDimensionReadouts
        audience="producer"
        footprint={footprint}
        plotMargins={plotMargins}
        unit={unit}
        deckPolygonCount={deckPolygons.length}
        className="mt-2 max-w-3xl space-y-1 text-[10px] leading-snug text-uls-muted"
      />
      </div>

      <StageFootprintPreview
        ref={svgRef}
        authoringViewportNav
        canvas={previewCanvas}
        unit={unit}
        caption={
          workspace === "select"
            ? `Select mode — amber rotates symbols · cyan rotates shapes (Shift = 15° snap); resize handles (rect / ellipse corners, line ends, polyline vertices) when shown; Alt+click polyline vertex removes it (≥2 points remain); double‑click polyline segment adds a snapped vertex; multi-select Shift/⌘/Ctrl+click lists or plot glyphs (⌘/Ctrl+A selects everything on the diagram); arrows (↑↓←→ Shift×4 · Alt skips grid+magnets like pointer tooling); hover plot for world X/Y — Copy XY or Alt+Shift+C (tab-separated); wheel zoom / middle-drag pan plot · Tab plot then ⌘/Ctrl +/−/0; Fit view; [ ] bracket draw order inside the tier that owns the selection; Home/End jump to tier-local back/front (change tiers via Layers drawer or Selection layer picker; ⌘/Ctrl+Shift+L duplicates the picker tier—not Main—outside typed fields); plotted order matches director Show after Save · ⌘/Ctrl+D duplicate; Delete remove; Esc clears; ⌘/Ctrl+Z undo plot · ⌘/Ctrl+⇧+Z redo${STAGE_DESIGN_WORKSPACE_HOTKEY_CAPTION} · Symbols or Shapes: keys 5–9 match those toolbars (outside text fields)`
            : workspace === "deck"
              ? `Deck modules — two clicks per rectangle (Alt + click skips grid / magnets)${STAGE_DESIGN_WORKSPACE_HOTKEY_CAPTION}`
              : workspace === "shapes"
                ? `Shape mode — two-click rect/line/ellipse, one-click text, multi-tap polyline (Enter commits, Backspace/Delete peels last bend, Esc cancels draft) · Alt + click skips grid / magnets${STAGE_DESIGN_WORKSPACE_HOTKEY_CAPTION}${STAGE_DESIGN_SHAPES_DIGIT_CAPTION}`
                : `Symbol mode — Alt + click skips grid / magnets when you need sub-step drops${STAGE_DESIGN_WORKSPACE_HOTKEY_CAPTION}${STAGE_DESIGN_SYMBOLS_DIGIT_CAPTION}`
        }
        onPlotPlace={handlePlotClick}
        authoringSelectionChrome={workspace === "select"}
        selectedPlacementIds={selectedPlacementIds}
        selectedShapeIds={selectedShapeIds}
        onPlacementPointerDown={startDragPlacement}
        onShapePointerDown={startDragShape}
        showShapeResizeHandles={workspace === "select"}
        onShapeResizeHandlePointerDown={startShapeResize}
        showShapeRotateHandle={workspace === "select"}
        onShapeRotatePointerDown={startShapeRotate}
        showPlacementRotateHandle={workspace === "select"}
        onPlacementRotatePointerDown={startPlacementRotate}
        interactiveUserDeckModules={workspace === "select" && deckPolygons.length > 0}
        selectedDeckPolygonIds={selectedDeckPolygonIds}
        onDeckPolygonPointerDown={startDeckDrag}
        showDeckRectangleResizeHandles={workspace === "select" && deckPolygons.length > 0}
        onDeckResizeCornerPointerDown={startDeckResize}
        authoringSnapGuidesOverlay={workspace === "select" ? authoringSnapGuidesOverlay : null}
        onPlotPointerWorld={workspace === "select" ? setPlotPointerWorld : undefined}
        authoringPolylineDraftWorld={
          workspace === "shapes" && shapeTool === "POLYLINE" ? polylineDraftPoints ?? undefined : undefined
        }
        authoringPolylineSegmentInsert={polylineSegmentInsertConfig}
      />

      <div className="xl:hidden">
      <StageDiagramLegend canvas={previewCanvas} tierHighlightLayerId={effectiveActiveDiagramLayerId} />
      </div>

      <input type="hidden" name="placementsJson" value={JSON.stringify(placements)} readOnly />
      <input type="hidden" name="diagramLayersJson" value={JSON.stringify(diagramLayers)} readOnly />

      {placements.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-uls-muted">
            Symbols ({placements.length}/{MAX_STAGE_PLACEMENTS})
          </p>
          <p className="text-[10px] text-uls-subtle">
            Optional size fields resize the plotted mark while keeping snapped coordinates unchanged. Notes render as a small
            abbreviated caption inside the symbol on the plot — full text stays in the list and on hover. Use{' '}
            <span className="font-medium text-uls-text">Equipment</span> below for cue/circuit, optional{' '}
            <span className="font-medium text-uls-muted">patch</span>/<span className="font-medium text-uls-muted">gel</span>{' '}
            notes, optional <span className="font-medium text-uls-muted">fixture id</span> /{' '}
            <span className="font-medium text-uls-muted">beam · profile</span> strings on every symbol kind, and DMX pairing where
            applicable (SVG titles, exports, Plot BOM CSV symbol table).
            <span className="font-medium text-uls-muted">Peer snap group</span> (per row) limits magnet-to-peer behavior to the
            same tag when every selected symbol in a gesture shares that tag.
          </p>
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {placements.map((p) => {
              const eff = resolvePlacementGlyphWorld(p, unit);
              const gStep = unit === "METERS" ? "0.25" : "0.5";
              const uLab = unit === "METERS" ? "m" : "ft";
              return (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-2 text-xs"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-uls-text">{STAGE_DESIGN_KIND_LABELS[p.kind]}</span>
                  <span className="tabular-nums text-uls-subtle">
                    {" "}
                    @ {p.x.toFixed(2)}×{p.y.toFixed(2)} {uLab}
                  </span>
                </div>
                <label className="flex items-center gap-1 text-uls-subtle">
                  °
                  <input
                    type="number"
                    step={1}
                    min={0}
                    max={359}
                    value={Math.round(p.rotationDeg ?? 0)}
                    onChange={(e) => {
                      const r = Number(e.target.value);
                      commitPlacements(
                        placements.map((row) =>
                          row.id === p.id
                            ? clampPlacement({ ...row, rotationDeg: Number.isFinite(r) ? r : 0 }, footprint, plotMargins, unit, deckClamp)
                            : row,
                        ),
                      );
                    }}
                    className="w-14 rounded border border-white/[0.08] bg-black/30 px-1 py-0.5 text-uls-text"
                  />
                </label>
                <input
                  type="text"
                  aria-label={`Note for ${STAGE_DESIGN_KIND_LABELS[p.kind]}`}
                  placeholder="Optional label"
                  maxLength={220}
                  value={p.note ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    const note = v.trim().length > 0 ? v.slice(0, 220) : undefined;
                    commitPlacements(
                      placements.map((row) =>
                        row.id === p.id ? clampPlacement({ ...row, note }, footprint, plotMargins, unit, deckClamp) : row,
                      ),
                    );
                  }}
                  className="min-w-[8rem] flex-1 rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                />
                <button
                  type="button"
                  onClick={() => commitPlacements(placements.filter((row) => row.id !== p.id))}
                  className="shrink-0 rounded-md border border-white/[0.12] px-2 py-1 text-[11px] text-uls-muted hover:bg-white/[0.06]"
                >
                  Remove
                </button>
                </div>

                <div className="w-full space-y-2 border-t border-white/[0.06] pt-2">
                  <p className="text-[10px] text-uls-subtle">
                    <span className="font-medium text-uls-text">Equipment</span> — cue/circuit; optional{' '}
                    <span className="font-medium text-uls-muted">patch</span>/<span className="font-medium text-uls-muted">gel</span>;{' '}
                    optional <span className="font-medium text-uls-muted">fixture id</span> /{' '}
                    <span className="font-medium text-uls-muted">beam · profile</span> on every symbol kind; fixtures and LED
                    surfaces may add DMX pairing (SVG titles + Plot BOM CSV).
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[11px] text-uls-muted sm:col-span-2">
                      <span className="font-medium text-uls-subtle">Cue / role / circuit label</span>
                      <input
                        type="text"
                        placeholder="e.g. SR key, dimmer 3A"
                        maxLength={STAGE_PLACEMENT_EQUIPMENT_ROLE_MAX_CHARS}
                        value={p.equipment?.role ?? ""}
                        onChange={(e) => {
                          const t = e.target.value;
                          const merged: StagePlacementEquipment = { ...(p.equipment ?? {}) };
                          const trimmed = t.trim();
                          if (trimmed.length > 0) merged.role = trimmed.slice(0, STAGE_PLACEMENT_EQUIPMENT_ROLE_MAX_CHARS);
                          else delete merged.role;
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp)
                                : row,
                            ),
                          );
                        }}
                        className="w-full rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-uls-muted">
                      <span className="font-medium text-uls-subtle">Patch / distro slot</span>
                      <input
                        type="text"
                        placeholder="e.g. rack 4 · patch 12"
                        maxLength={STAGE_PLACEMENT_EQUIPMENT_PATCH_MAX_CHARS}
                        value={p.equipment?.patch ?? ""}
                        onChange={(e) => {
                          const t = e.target.value;
                          const merged: StagePlacementEquipment = { ...(p.equipment ?? {}) };
                          const trimmed = t.trim();
                          if (trimmed.length > 0)
                            merged.patch = trimmed.slice(0, STAGE_PLACEMENT_EQUIPMENT_PATCH_MAX_CHARS);
                          else delete merged.patch;
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp)
                                : row,
                            ),
                          );
                        }}
                        className="w-full rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-uls-muted">
                      <span className="font-medium text-uls-subtle">Gel / color note</span>
                      <input
                        type="text"
                        placeholder="e.g. R02 · frost"
                        maxLength={STAGE_PLACEMENT_EQUIPMENT_GEL_MAX_CHARS}
                        value={p.equipment?.gel ?? ""}
                        onChange={(e) => {
                          const t = e.target.value;
                          const merged: StagePlacementEquipment = { ...(p.equipment ?? {}) };
                          const trimmed = t.trim();
                          if (trimmed.length > 0)
                            merged.gel = trimmed.slice(0, STAGE_PLACEMENT_EQUIPMENT_GEL_MAX_CHARS);
                          else delete merged.gel;
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp)
                                : row,
                            ),
                          );
                        }}
                        className="w-full rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-uls-muted">
                      <span className="font-medium text-uls-subtle">Fixture id · inventory #</span>
                      <input
                        type="text"
                        placeholder="e.g. MX-LX-044 · blank clears"
                        maxLength={STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS}
                        value={p.equipment?.fixtureId ?? ""}
                        onChange={(e) => {
                          const t = e.target.value;
                          const merged: StagePlacementEquipment = { ...(p.equipment ?? {}) };
                          const trimmed = t.trim();
                          if (trimmed.length > 0)
                            merged.fixtureId = trimmed.slice(0, STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS);
                          else delete merged.fixtureId;
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp)
                                : row,
                            ),
                          );
                        }}
                        className="w-full rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs font-mono text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] text-uls-muted sm:col-span-2">
                      <span className="font-medium text-uls-subtle">Beam · personality · data note</span>
                      <input
                        type="text"
                        placeholder="e.g. 19° · Mode 12 · RGB + WW chip layout"
                        maxLength={STAGE_PLACEMENT_EQUIPMENT_FIXTURE_PROFILE_MAX_CHARS}
                        value={p.equipment?.fixtureProfile ?? ""}
                        onChange={(e) => {
                          const t = e.target.value;
                          const merged: StagePlacementEquipment = { ...(p.equipment ?? {}) };
                          const trimmed = t.trim();
                          if (trimmed.length > 0)
                            merged.fixtureProfile = trimmed.slice(0, STAGE_PLACEMENT_EQUIPMENT_FIXTURE_PROFILE_MAX_CHARS);
                          else delete merged.fixtureProfile;
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp)
                                : row,
                            ),
                          );
                        }}
                        className="w-full rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                      />
                    </label>
                    {placementKindAllowsDmxEquipment(p.kind) ? (
                      <>
                        <label className="flex flex-col gap-1 text-[11px] text-uls-muted">
                          <span className="font-medium text-uls-subtle">DMX universe (1–256)</span>
                          <input
                            type="number"
                            min={1}
                            max={256}
                            step={1}
                            value={p.equipment?.dmxUniverse ?? ""}
                            onChange={(e) => {
                              const uStr = e.target.value.trim();
                              const merged: StagePlacementEquipment = { ...(p.equipment ?? {}) };
                              if (uStr === "") delete merged.dmxUniverse;
                              else {
                                const u = Math.round(Number(uStr));
                                if (Number.isFinite(u)) merged.dmxUniverse = u;
                              }
                              commitPlacements(
                                placements.map((row) =>
                                  row.id === p.id
                                    ? applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp)
                                    : row,
                                ),
                              );
                            }}
                            className="w-full rounded border border-white/[0.08] bg-black/30 px-2 py-1 tabular-nums text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] text-uls-muted">
                          <span className="font-medium text-uls-subtle">DMX channel (1–512)</span>
                          <input
                            type="number"
                            min={1}
                            max={512}
                            step={1}
                            value={p.equipment?.dmxChannel ?? ""}
                            onChange={(e) => {
                              const chStr = e.target.value.trim();
                              const merged: StagePlacementEquipment = { ...(p.equipment ?? {}) };
                              if (chStr === "") delete merged.dmxChannel;
                              else {
                                const ch = Math.round(Number(chStr));
                                if (Number.isFinite(ch)) merged.dmxChannel = ch;
                              }
                              commitPlacements(
                                placements.map((row) =>
                                  row.id === p.id
                                    ? applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp)
                                    : row,
                                ),
                              );
                            }}
                            className="w-full rounded border border-white/[0.08] bg-black/30 px-2 py-1 tabular-nums text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                          />
                        </label>
                        <div className="sm:col-span-2">
                          <button
                            type="button"
                            className="text-[10px] text-uls-accent underline-offset-2 hover:underline"
                            onClick={() =>
                              commitPlacements(
                                placements.map((row) => {
                                  if (row.id !== p.id) return row;
                                  const merged: StagePlacementEquipment = { ...(row.equipment ?? {}) };
                                  delete merged.dmxUniverse;
                                  delete merged.dmxChannel;
                                  return applyPlacementEquipmentForCommit(row, merged, footprint, plotMargins, unit, deckClamp);
                                }),
                              )
                            }
                          >
                            Clear DMX pairing
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="w-full border-t border-white/[0.06] pt-2">
                  <label className="flex flex-col gap-1 text-[11px] text-uls-muted">
                    <span className="font-medium text-uls-subtle">Peer snap group</span>
                    <input
                      type="text"
                      key={`peerSnap_${p.id}`}
                      defaultValue={p.peerSnapGroup ?? ""}
                      placeholder="Optional — magnets only within same tag (see hint)"
                      maxLength={PEER_SNAP_GROUP_MAX_CHARS}
                      aria-label={`Peer snap group for ${STAGE_DESIGN_KIND_LABELS[p.kind]}`}
                      title="When every selected symbol in a move shares one tag, peer snapping sees only those peers (works across diagram tiers). Leave blank for normal full-plot snaps. Allowed: letters, digits, underscore, hyphen."
                      onBlur={(e) => {
                        const s = sanitizePeerSnapGroup(e.target.value);
                        const prev = sanitizePeerSnapGroup(p.peerSnapGroup);
                        if (s === prev) return;
                        commitPlacements(
                          placements.map((row) => {
                            if (row.id !== p.id) return row;
                            if (!s) {
                              if (!row.peerSnapGroup) return row;
                              const n: StageDesignPlacement = { ...row };
                              delete n.peerSnapGroup;
                              return clampPlacement(n, footprint, plotMargins, unit, deckClamp);
                            }
                            return clampPlacement({ ...row, peerSnapGroup: s }, footprint, plotMargins, unit, deckClamp);
                          }),
                        );
                      }}
                      className="w-full max-w-md rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs font-mono text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                    />
                  </label>
                </div>

                <div className="grid w-full gap-2 border-t border-white/[0.06] pt-2 sm:grid-cols-2">
                  {STAGE_DESIGN_KINDS_USING_FIXTURE_GLYPH_RADIUS.has(p.kind) ? (
                    <label className="flex flex-wrap items-center gap-2 text-[11px] text-uls-muted">
                      <span className="font-medium text-uls-subtle">Radius ({uLab})</span>
                      <input
                        type="number"
                        step={gStep}
                        value={eff.fixtureR}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? clampPlacement(
                                    { ...row, glyphExtents: { ...row.glyphExtents, fixtureRadius: v } },
                                    footprint,
                                    plotMargins,
                                    unit,
                                    deckClamp,
                                  )
                                : row,
                            ),
                          );
                        }}
                        className="w-24 rounded border border-white/[0.08] bg-black/30 px-2 py-1 tabular-nums text-uls-text"
                      />
                      <button
                        type="button"
                        className="text-[10px] text-uls-accent underline-offset-2 hover:underline"
                        onClick={() =>
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? clampPlacement(
                                    { ...row, glyphExtents: omitPlacementGlyphKey(row.glyphExtents, "fixtureRadius") },
                                    footprint,
                                    plotMargins,
                                    unit,
                                    deckClamp,
                                  )
                                : row,
                            ),
                          )
                        }
                      >
                        Reset
                      </button>
                    </label>
                  ) : null}
                  {p.kind === "POWER" || p.kind === "POWER_DROP" ? (
                    <label className="flex flex-wrap items-center gap-2 text-[11px] text-uls-muted">
                      <span className="font-medium text-uls-subtle">Triangle height ({uLab})</span>
                      <input
                        type="number"
                        step={gStep}
                        value={eff.powerTriH}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? clampPlacement(
                                    { ...row, glyphExtents: { ...row.glyphExtents, powerTriHeight: v } },
                                    footprint,
                                    plotMargins,
                                    unit,
                                    deckClamp,
                                  )
                                : row,
                            ),
                          );
                        }}
                        className="w-24 rounded border border-white/[0.08] bg-black/30 px-2 py-1 tabular-nums text-uls-text"
                      />
                      <button
                        type="button"
                        className="text-[10px] text-uls-accent underline-offset-2 hover:underline"
                        onClick={() =>
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? clampPlacement(
                                    { ...row, glyphExtents: omitPlacementGlyphKey(row.glyphExtents, "powerTriHeight") },
                                    footprint,
                                    plotMargins,
                                    unit,
                                    deckClamp,
                                  )
                                : row,
                            ),
                          )
                        }
                      >
                        Reset
                      </button>
                    </label>
                  ) : null}
                  {p.kind === "DECOR" ? (
                    <label className="flex flex-wrap items-center gap-2 text-[11px] text-uls-muted">
                      <span className="font-medium text-uls-subtle">Half-side ({uLab})</span>
                      <input
                        type="number"
                        step={gStep}
                        value={eff.decorHalf}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? clampPlacement(
                                    { ...row, glyphExtents: { ...row.glyphExtents, decorHalf: v } },
                                    footprint,
                                    plotMargins,
                                    unit,
                                    deckClamp,
                                  )
                                : row,
                            ),
                          );
                        }}
                        className="w-24 rounded border border-white/[0.08] bg-black/30 px-2 py-1 tabular-nums text-uls-text"
                      />
                      <button
                        type="button"
                        className="text-[10px] text-uls-accent underline-offset-2 hover:underline"
                        onClick={() =>
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? clampPlacement(
                                    { ...row, glyphExtents: omitPlacementGlyphKey(row.glyphExtents, "decorHalf") },
                                    footprint,
                                    plotMargins,
                                    unit,
                                    deckClamp,
                                  )
                                : row,
                            ),
                          )
                        }
                      >
                        Reset
                      </button>
                    </label>
                  ) : null}
                  {p.kind === "TRUSS" ? (
                    <label className="flex flex-wrap items-center gap-2 text-[11px] text-uls-muted">
                      <span className="font-medium text-uls-subtle">Half span ({uLab})</span>
                      <input
                        type="number"
                        step={gStep}
                        value={eff.trussHalfLen}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? clampPlacement(
                                    { ...row, glyphExtents: { ...row.glyphExtents, trussHalfLength: v } },
                                    footprint,
                                    plotMargins,
                                    unit,
                                    deckClamp,
                                  )
                                : row,
                            ),
                          );
                        }}
                        className="w-24 rounded border border-white/[0.08] bg-black/30 px-2 py-1 tabular-nums text-uls-text"
                      />
                      <button
                        type="button"
                        className="text-[10px] text-uls-accent underline-offset-2 hover:underline"
                        onClick={() =>
                          commitPlacements(
                            placements.map((row) =>
                              row.id === p.id
                                ? clampPlacement(
                                    { ...row, glyphExtents: omitPlacementGlyphKey(row.glyphExtents, "trussHalfLength") },
                                    footprint,
                                    plotMargins,
                                    unit,
                                    deckClamp,
                                  )
                                : row,
                            ),
                          )
                        }
                      >
                        Reset
                      </button>
                    </label>
                  ) : null}
                  {p.kind === "STRIP_FIXED" || p.kind === "LED_WALL" || p.kind === "PROJECTOR_SYM" ? (
                    <>
                      <label className="flex flex-wrap items-center gap-2 text-[11px] text-uls-muted">
                        <span className="font-medium text-uls-subtle">Half width ({uLab})</span>
                        <input
                          type="number"
                          step={gStep}
                          value={eff.ledHalfW}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            commitPlacements(
                              placements.map((row) =>
                                row.id === p.id
                                  ? clampPlacement(
                                      { ...row, glyphExtents: { ...row.glyphExtents, ledHalfWidth: v } },
                                      footprint,
                                      plotMargins,
                                      unit,
                                      deckClamp,
                                    )
                                  : row,
                              ),
                            );
                          }}
                          className="w-24 rounded border border-white/[0.08] bg-black/30 px-2 py-1 tabular-nums text-uls-text"
                        />
                      </label>
                      <label className="flex flex-wrap items-center gap-2 text-[11px] text-uls-muted">
                        <span className="font-medium text-uls-subtle">Half depth ({uLab})</span>
                        <input
                          type="number"
                          step={gStep}
                          value={eff.ledHalfH}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            commitPlacements(
                              placements.map((row) =>
                                row.id === p.id
                                  ? clampPlacement(
                                      { ...row, glyphExtents: { ...row.glyphExtents, ledHalfHeight: v } },
                                      footprint,
                                      plotMargins,
                                      unit,
                                      deckClamp,
                                    )
                                  : row,
                              ),
                            );
                          }}
                          className="w-24 rounded border border-white/[0.08] bg-black/30 px-2 py-1 tabular-nums text-uls-text"
                        />
                      </label>
                      <div className="flex flex-wrap gap-3 sm:col-span-2">
                        <button
                          type="button"
                          className="text-[10px] text-uls-accent underline-offset-2 hover:underline"
                          onClick={() =>
                            commitPlacements(
                              placements.map((row) => {
                                if (row.id !== p.id) return row;
                                let ge = omitPlacementGlyphKey(row.glyphExtents, "ledHalfWidth");
                                ge = omitPlacementGlyphKey(ge, "ledHalfHeight");
                                return clampPlacement({ ...row, glyphExtents: ge }, footprint, plotMargins, unit, deckClamp);
                              }),
                            )
                          }
                        >
                          Reset size
                        </button>
                      </div>
                    </>
                  ) : null}
                </div>
              </li>
              );
            })}
          </ul>
          <Button type="button" variant="ghost" size="sm" onClick={() => commitPlacements([])}>
            Clear all symbols
          </Button>
        </div>
      ) : null}

      {shapes.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-uls-muted">
            Shapes ({shapes.length}/{MAX_STAGE_SHAPES})
          </p>
          <p className="text-[10px] text-uls-subtle">
            Labels use the same abbreviated captions on the diagram (inside each shape where there is room); full wording stays in
            these fields and on hover.
            {' '}
            <span className="font-medium text-uls-muted">Peer snap group</span> (below) optionally limits peer magnets to shapes that
            share the same tag during drags and keyboard nudges.
          </p>
          <ul className="max-h-44 space-y-2 overflow-y-auto pr-1">
            {shapes.map((s) => (
              <li
                key={s.id}
                className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-black/20 p-2 text-xs sm:flex-row sm:flex-wrap sm:items-end"
              >
                <div className="min-w-0 flex-1 font-medium text-uls-text">{STAGE_SHAPE_KIND_LABELS[s.kind]}</div>
                <label className="flex items-center gap-1 text-uls-subtle">
                  °
                  <input
                    type="number"
                    step={1}
                    min={0}
                    max={359}
                    value={Math.round(s.rotationDeg ?? 0)}
                    onChange={(e) => {
                      const r = Number(e.target.value);
                      commitShapes(
                        shapes.map((row) =>
                          row.id === s.id
                            ? clampShape({ ...row, rotationDeg: Number.isFinite(r) ? r : 0 }, footprint, plotMargins, deckClamp)
                            : row,
                        ),
                      );
                    }}
                    className="w-14 rounded border border-white/[0.08] bg-black/30 px-1 py-0.5 text-uls-text"
                  />
                </label>
                <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto">
                  {s.kind !== "LINE" && s.kind !== "POLYLINE" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-uls-subtle">Fill</span>
                      <input
                        type="color"
                        aria-label="Shape fill"
                        title="Fill color"
                        className="h-7 w-[2.7rem] cursor-pointer rounded border border-white/[0.12] bg-transparent p-0"
                        value={colorInputCompatibleHex(
                          s.fill,
                          (s.kind === "ELLIPSE"
                            ? "#fb7185"
                            : s.kind === "TEXT"
                              ? "#f5f5f5"
                              : "#93c5fd") as `#${string}`,
                        )}
                        onChange={(e) =>
                          commitShapes(
                            shapes.map((row) =>
                              row.id === s.id
                                ? clampShape({ ...row, fill: e.target.value }, footprint, plotMargins, deckClamp)
                                : row,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="text-[10px] text-uls-accent underline-offset-2 hover:underline"
                        onClick={() =>
                          commitShapes(
                            shapes.map((row) =>
                              row.id === s.id
                                ? clampShape({ ...row, fill: undefined }, footprint, plotMargins, deckClamp)
                                : row,
                            ),
                          )
                        }
                      >
                        Default
                      </button>
                    </div>
                  ) : null}
                  {s.kind !== "TEXT" ? (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-uls-subtle">Outline</span>
                      <input
                        type="color"
                        aria-label="Shape outline"
                        title="Outline color"
                        className="h-7 w-[2.7rem] cursor-pointer rounded border border-white/[0.12] bg-transparent p-0"
                        value={colorInputCompatibleHex(s.stroke, "#cbd5e1")}
                        onChange={(e) =>
                          commitShapes(
                            shapes.map((row) =>
                              row.id === s.id
                                ? clampShape({ ...row, stroke: e.target.value }, footprint, plotMargins, deckClamp)
                                : row,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="text-[10px] text-uls-accent underline-offset-2 hover:underline"
                        onClick={() =>
                          commitShapes(
                            shapes.map((row) =>
                              row.id === s.id
                                ? clampShape({ ...row, stroke: undefined }, footprint, plotMargins, deckClamp)
                                : row,
                            ),
                          )
                        }
                      >
                        Default
                      </button>
                    </div>
                  ) : null}
                </div>
                {s.kind === "LINE" || s.kind === "POLYLINE" ? (
                  <label className="flex w-full min-w-[12rem] flex-col gap-1 text-[11px] text-uls-muted sm:max-w-md">
                    <span className="font-medium text-uls-subtle">Cable type (preset stroke + BOM cable_run)</span>
                    <select
                      className="rounded-md border border-white/[0.12] bg-black/45 px-2 py-1.5 text-xs text-uls-text"
                      value={s.cableRun ?? ""}
                      aria-label={`Cable preset for ${STAGE_SHAPE_KIND_LABELS[s.kind]}`}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        const nextRun = raw === "" ? undefined : sanitizeDiagramCableRunKind(raw);
                        diagramHistoryCallbacks?.beforeDiscreteDiagramMutation();
                        commitShapes(
                          shapes.map((row) => {
                            if (row.id !== s.id) return row;
                            if (!nextRun) {
                              const n: StageDesignShape = { ...row };
                              delete (n as { cableRun?: unknown }).cableRun;
                              return clampShape(n, footprint, plotMargins, deckClamp);
                            }
                            return clampShape({ ...row, cableRun: nextRun }, footprint, plotMargins, deckClamp);
                          }),
                        );
                      }}
                    >
                      <option value="">None (outline color only)</option>
                      {STAGE_DIAGRAM_CABLE_RUN_ORDER.map((ck) => (
                        <option key={ck} value={ck}>
                          {STAGE_DIAGRAM_CABLE_RUN_LABELS[ck]}
                        </option>
                      ))}
                    </select>
                    <span className="leading-snug text-[10px] text-uls-subtle">
                      Custom <span className="font-medium text-uls-muted">Outline</span> color hides the dashed/solid preset; the
                      token still exports when set.
                    </span>
                  </label>
                ) : null}
                <label className="flex w-full min-w-[12rem] flex-col gap-1 text-[11px] text-uls-muted sm:max-w-md">
                  <span className="font-medium text-uls-subtle">Peer snap group</span>
                  <input
                    type="text"
                    key={`shape_peer_${s.id}`}
                    defaultValue={s.peerSnapGroup ?? ""}
                    placeholder={`Optional (${PEER_SNAP_GROUP_MAX_CHARS} chars max)`}
                    maxLength={PEER_SNAP_GROUP_MAX_CHARS}
                    aria-label={`Peer snap group for ${STAGE_SHAPE_KIND_LABELS[s.kind]}`}
                    title="When every selected shape in a move shares one tag, peer snapping sees only those peers."
                    onBlur={(e) => {
                      const g = sanitizePeerSnapGroup(e.target.value);
                      const prev = sanitizePeerSnapGroup(s.peerSnapGroup);
                      if (g === prev) return;
                      commitShapes(
                        shapes.map((row) => {
                          if (row.id !== s.id) return row;
                          if (!g) {
                            if (!row.peerSnapGroup) return row;
                            const n: StageDesignShape = { ...row };
                            delete n.peerSnapGroup;
                            return clampShape(n, footprint, plotMargins, deckClamp);
                          }
                          return clampShape({ ...row, peerSnapGroup: g }, footprint, plotMargins, deckClamp);
                        }),
                      );
                    }}
                    className="w-full rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs font-mono text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                  />
                </label>
                <input
                  type="text"
                  aria-label="Shape label"
                  value={s.label ?? ""}
                  onChange={(e) => {
                    const lab = e.target.value.slice(0, 400);
                    commitShapes(
                      shapes.map((row) =>
                        row.id === s.id ? clampShape({ ...row, label: lab }, footprint, plotMargins, deckClamp) : row,
                      ),
                    );
                  }}
                  className="min-w-[8rem] flex-1 rounded border border-white/[0.08] bg-black/30 px-2 py-1 text-xs text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                />
                <button
                  type="button"
                  onClick={() => commitShapes(shapes.filter((row) => row.id !== s.id))}
                  className="shrink-0 rounded-md border border-white/[0.12] px-2 py-1 text-[11px] text-uls-muted hover:bg-white/[0.06]"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" size="sm" onClick={() => commitShapes([])}>
            Clear all shapes
          </Button>
        </div>
      ) : null}
      </div>

      <aside className="sticky top-20 z-10 mt-4 hidden max-h-[calc(100vh-6rem)] flex-col gap-3 overflow-y-auto rounded-xl border border-white/[0.08] bg-zinc-950/85 p-3 backdrop-blur-sm xl:mt-0 xl:flex xl:flex-col">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-uls-muted">Diagram inspector</p>
        {workspace === "select" && selectionDiagramPrimitiveCount > 0 ? (
          <div
            className="space-y-2 rounded-lg border border-white/[0.08] bg-black/25 p-2"
            role="group"
            aria-label="Diagram tier for current selection"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-uls-muted">Selection tiers</p>
            <p className="text-[10px] leading-snug text-uls-muted">
              {selectionDiagramPrimitiveCount} primitive{selectionDiagramPrimitiveCount === 1 ? "" : "s"}
              {diagramSelectionSpansMultipleDiagramLayers ? (
                <>
                  {" "}
                  · <span className="font-medium text-uls-text">Mixed tiers</span>
                </>
              ) : (
                <>
                  {" "}
                  ·{" "}
                  <span className="font-medium text-uls-text">
                    {diagramLayers.find((l) => l.id === selectionEffectiveConsensusLayerId)?.name ?? "Main"}
                  </span>
                </>
              )}
            </p>
            <label className="flex flex-col gap-1 text-[10px] text-uls-muted">
              <span className="font-semibold uppercase tracking-wide text-uls-subtle">Assign tier</span>
              <select
                className="rounded-md border border-white/[0.12] bg-black/45 px-2 py-1.5 text-xs text-uls-text"
                value={selectionLayerPickerValue}
                onChange={(e) => assignSelectionLayer(e.target.value)}
              >
                {diagramSelectionSpansMultipleDiagramLayers ? (
                  <option value={DIAGRAM_SELECTION_LAYER_MIXED} disabled>
                    Mixed tiers…
                  </option>
                ) : null}
                {diagramLayers.map((l) => (
                  <option key={l.id} value={l.id} disabled={l.visible === false}>
                    {l.name}
                    {l.visible === false ? " — hidden" : ""}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-auto w-full justify-center rounded-md border border-white/[0.1] px-2 py-1.5 text-[11px]"
              disabled={selectionAlreadyMatchesStickyDiagramTier}
              title={
                selectionAlreadyMatchesStickyDiagramTier
                  ? "Selection already matches the sticky Diagram layers tier"
                  : `Assign every selected primitive to “${stickyDiagramTierLabel}” (Symbols / Shapes / Deck sticky tier)`
              }
              onClick={() => assignSelectionLayer(effectiveActiveDiagramLayerId)}
            >
              Move to sticky tier ({stickyDiagramTierLabel})
            </Button>
            <p className="text-[9px] leading-relaxed text-uls-subtle">
              Same tier picker as the Select strip below — keeps tier edits visible beside lists on wide layouts.
            </p>
          </div>
        ) : null}
        <StageDiagramDimensionReadouts
          audience="producer"
          footprint={footprint}
          plotMargins={plotMargins}
          unit={unit}
          deckPolygonCount={deckPolygons.length}
          className="space-y-1 text-[10px] leading-snug text-uls-muted"
        />
        <StageDiagramLegend canvas={previewCanvas} tierHighlightLayerId={effectiveActiveDiagramLayerId} />
        <p className="text-[9px] leading-relaxed text-uls-subtle">
          Readouts, legend, and (in Select with a selection) tier assignment stay visible while scrolling symbol/shape lists on wide layouts.
        </p>
      </aside>
    </div>
  );
}
