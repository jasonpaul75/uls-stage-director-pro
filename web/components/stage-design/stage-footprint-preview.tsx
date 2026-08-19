"use client";

import {
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEventHandler,
  type PointerEventHandler,
  type ReactElement,
} from "react";

import { Button } from "@/components/ui";

import type {
  StageDesignCanvas,
  StageDesignPlacement,
  StageDesignPlotMargins,
  StageDesignShape,
  StageDeckPolygon,
} from "@/lib/stage-design-canvas";
import {
  abbreviateStageDiagramLabel,
  normalizeDeckPolygons,
  placementEquipmentSvgTitleSuffix,
  resolvePlacementGlyphWorld,
  STAGE_DESIGN_KIND_LABELS,
  SYNTHETIC_DECK_RECT_POLYGON_ID,
} from "@/lib/stage-design-canvas";
import { diagramPaintRefsForPresentation } from "@/lib/stage-design-diagram-layers";
import { formatDiagramTextLabelForDisplay } from "@/lib/stage-design-dxf-mtext";
import { cableRunPresentationStroke, STAGE_DIAGRAM_CABLE_RUN_LABELS } from "@/lib/stage-design-cable-run";
import { STAGE_PLACEMENT_GLYPH_STYLE } from "@/lib/stage-design-placement-glyph-style";
import { deckPolygonApproxAxisAlignedRectCorners } from "@/lib/stage-design-deck-resize";
import type { StageDesignUnit } from "@prisma/client";
import {
  deckPolygonToSvgPoints,
  plotLayoutForCanvas,
  plotMinUniformScale,
  STAGE_PLOT_GRID_PATTERN_PERIOD,
  STAGE_SVG_VIEW_H,
  STAGE_SVG_VIEW_W,
  svgPlotPointToWorld,
  svgScreenPointToPlotWorld,
  worldPlotPointToSvg,
  type PlotViewLayout,
} from "@/lib/stage-design-svg-layout";
import {
  encodeEllipseResize,
  encodeLineResize,
  encodePolylineVertexResize,
  encodeRectResize,
  type ResizeCornerId,
  type ShapeResizeHandleEncoded,
} from "@/lib/stage-design-shape-resize";
import { stagePlacementRotationPivotWorld, stageShapeRotationPivotWorld } from "@/lib/stage-design-shape-rotate";
import {
  ULSD_AUTHORING_GRID_ATTR,
  ULSD_DIAGRAM_EXPORT_EXCLUDE_ATTR,
  ULSD_PRESENTATION_DECK_FILL_ATTR,
  ULSD_PRESENTATION_DECK_STROKE_ATTR,
} from "@/lib/stage-design-svg-export";

const ulsdExportExcludeSvg = { [ULSD_DIAGRAM_EXPORT_EXCLUDE_ATTR]: "" } as const;
const ulsdAuthoringGridSvg = { [ULSD_AUTHORING_GRID_ATTR]: "" } as const;

/** Readable `<title>` + clip `id`; strip characters invalid in SVG `id`. */
function safeSvgIdFragment(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60);
}

/** Small captions inside shape bounds (`ShapeDraw`). */
const DIAGRAM_INLINE_LABEL_FILL = "rgba(248,250,252,0.92)";

function SvgAbbrevCaption(props: {
  abbrev: string;
  cx: number;
  cy: number;
  minPx: number;
  /** When set, keeps strokes inside filled regions (circle / rect / polygon). */
  clipPathUrl?: string;
}) {
  const { abbrev, cx, cy, minPx, clipPathUrl } = props;
  if (!abbrev || minPx < 13) return null;
  const fs = Math.max(5.25, Math.min(9.25, minPx / 3.4));
  return (
    <text
      x={cx}
      y={cy}
      fill={DIAGRAM_INLINE_LABEL_FILL}
      fontSize={fs}
      fontWeight={650}
      textAnchor="middle"
      dominantBaseline="middle"
      pointerEvents="none"
      stroke="rgba(10,12,14,0.48)"
      strokeWidth={fs * 0.075}
      paintOrder="stroke fill"
      clipPath={clipPathUrl}
      style={{ userSelect: "none", fontFamily: "system-ui, Segoe UI, sans-serif" }}
    >
      {abbrev}
    </text>
  );
}

/** Optional context for {@link StageFootprintPreview} plot clicks (symbol / deck / shape placement). */
export type StagePlotPlaceOptions = {
  /** When `false`, producer UI may keep sub-grid world coordinates. Default: snap to stage grid. */
  snapToStageGrid?: boolean;
};

type Props = {
  canvas: StageDesignCanvas;
  unit: StageDesignUnit;
  caption?: string;
  showPlacements?: boolean;
  showShapes?: boolean;
  onPlotPlace?: (world: { x: number; y: number }, opts?: StagePlotPlaceOptions) => void;
  /** Select mode: highlights every listed placement glyph (preferred when non-empty); falls back to `selectedPlacementId`. */
  selectedPlacementIds?: ReadonlySet<string> | null;
  selectedPlacementId?: string | null;
  onPlacementPointerDown?: (id: string, e: React.PointerEvent) => void;
  /** Highlights every matching shape authoring stroke ring; falls back to `selectedShapeId`. */
  selectedShapeIds?: ReadonlySet<string> | null;
  selectedShapeId?: string | null;
  onShapePointerDown?: (id: string, e: React.PointerEvent) => void;
  /** When true with a RECT/LINE/ELLIPSE/POLYLINE selection, draw resize handles (polygon = per-vertex grips) above shapes. */
  showShapeResizeHandles?: boolean;
  onShapeResizeHandlePointerDown?: (shapeId: string, encoded: ShapeResizeHandleEncoded, e: React.PointerEvent) => void;
  /** When true and custom deck polygons exist, user modules receive pointer events below shapes/placements for select/drag. */
  interactiveUserDeckModules?: boolean;
  /** Selected user deck polygons (preferred when non-empty); falls back to `selectedDeckPolygonId`. Synthetic hull id is ignored. */
  selectedDeckPolygonIds?: ReadonlySet<string> | null;
  selectedDeckPolygonId?: string | null;
  onDeckPolygonPointerDown?: (polygonId: string, e: React.PointerEvent) => void;
  /** Corner handles for axis-aligned rectangular deck modules (select mode). */
  showDeckRectangleResizeHandles?: boolean;
  onDeckResizeCornerPointerDown?: (polygonId: string, corner: ResizeCornerId, e: React.PointerEvent) => void;
  /** Thumb outside selection for dragging rotation vs pivot ( RECT / ellipse / line / text ). */
  showShapeRotateHandle?: boolean;
  onShapeRotatePointerDown?: (shapeId: string, e: React.PointerEvent) => void;
  /** Amber thumb for symbol rotation in select-authoring — matches shape rotate behavior ( Shift = 15° snap upstream ). */
  showPlacementRotateHandle?: boolean;
  onPlacementRotatePointerDown?: (placementId: string, e: React.PointerEvent) => void;
  /**
   * When `false`, selection ids may still be set but glyphs omit the selection ring and
   * shapes omit thick authoring selection strokes (producer workspace other than Select). Default `true`.
   */
  authoringSelectionChrome?: boolean;
  /**
   * Director / share view: no authoring grid overlay, subdued plot frame (canonical coordinates unchanged).
   */
  presentationMode?: boolean;
  /** Producer: dashed cyan = peer XY alignment; dashed amber crosshair = deck vertex / edge foot / plot rim; amber along deck = snapped perimeter segment. Ignored when `presentationMode`. */
  authoringSnapGuidesOverlay?:
    | {
        structural?: {
          verticalX?: number;
          horizontalY?: number;
          edge?: { x1: number; y1: number; x2: number; y2: number };
        };
        peer?: { verticalX?: number; horizontalY?: number };
      }
    | null;
  /**
   * Live plot‑space pointer position (world X/Y in stage coordinates) while moving over the inner plot. `null` on leave.
   * Intended for producer authoring readouts; omit in presentation mode / director views.
   */
  onPlotPointerWorld?: (world: { wx: number; wy: number } | null) => void;
  /** Shapes workspace: tentative polyline vertices (world) rendered as a dashed authoring overlay. */
  authoringPolylineDraftWorld?: readonly { x: number; y: number }[] | null;
  /**
   * Select mode: thick hit-strokes along each segment of this polyline; double‑click inserts a vertex (producer snaps/clamps).
   * Ignored in `presentationMode`.
   */
  authoringPolylineSegmentInsert?: {
    shape: StageDesignShape & { kind: "POLYLINE" };
    onInsertAfterVertex: (afterVertexIndex: number, world: { x: number; y: number }) => void;
  } | null;
  /**
   * Producer: wheel zoom toward cursor + middle-button drag pan. Diagram export resets to the full stage frame (`svgDiagramSerializedForExport`).
   * Ignored when `presentationMode`.
   */
  authoringViewportNav?: boolean;
};

/** SVG user-space viewBox subset of the fixed 540×300 stage diagram frame. */
type StageSvgViewBox = { x: number; y: number; w: number; h: number };

const VIEWBOX_H_OVER_W = STAGE_SVG_VIEW_H / STAGE_SVG_VIEW_W;
const VIEWBOX_MIN_W = STAGE_SVG_VIEW_W / 8;
const VIEWPORT_NAV_ZOOM_STEP = 1.12;

function fullStageSvgViewBox(): StageSvgViewBox {
  return { x: 0, y: 0, w: STAGE_SVG_VIEW_W, h: STAGE_SVG_VIEW_H };
}

function clampStageViewBoxSize(vb: StageSvgViewBox): StageSvgViewBox {
  const w = Math.min(STAGE_SVG_VIEW_W, Math.max(VIEWBOX_MIN_W, vb.w));
  const h = w * VIEWBOX_H_OVER_W;
  return { ...vb, w, h };
}

function clampStageViewBoxPan(vb: StageSvgViewBox): StageSvgViewBox {
  const maxX = Math.max(0, STAGE_SVG_VIEW_W - vb.w);
  const maxY = Math.max(0, STAGE_SVG_VIEW_H - vb.h);
  return {
    ...vb,
    x: Math.min(Math.max(0, vb.x), maxX),
    y: Math.min(Math.max(0, vb.y), maxY),
  };
}

function normalizeStageViewBox(vb: StageSvgViewBox): StageSvgViewBox {
  return clampStageViewBoxPan(clampStageViewBoxSize(vb));
}

function zoomStageViewBoxAtScreenPoint(
  svg: SVGSVGElement,
  vb: StageSvgViewBox,
  clientX: number,
  clientY: number,
  zoomIn: boolean,
): StageSvgViewBox {
  const m = svg.getScreenCTM();
  if (!m) return vb;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(m.inverse());
  const factor = zoomIn ? 1 / VIEWPORT_NAV_ZOOM_STEP : VIEWPORT_NAV_ZOOM_STEP;
  let newW = vb.w * factor;
  newW = Math.min(STAGE_SVG_VIEW_W, Math.max(VIEWBOX_MIN_W, newW));
  const newH = newW * VIEWBOX_H_OVER_W;
  if (newW >= STAGE_SVG_VIEW_W - 0.5) {
    return fullStageSvgViewBox();
  }
  const relX = vb.w > 0 ? (p.x - vb.x) / vb.w : 0.5;
  const relY = vb.h > 0 ? (p.y - vb.y) / vb.h : 0.5;
  const nx = p.x - relX * newW;
  const ny = p.y - relY * newH;
  return normalizeStageViewBox({ x: nx, y: ny, w: newW, h: newH });
}

function clampSvgLen(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}

function axisPairGuideLines(
  bounds: PlotViewLayout["bounds"],
  lay: PlotViewLayout,
  guides: { verticalX?: number; horizontalY?: number },
  stroke: string,
  keyPrefix: string,
): ReactElement[] {
  const lines: ReactElement[] = [];
  const vx = guides.verticalX;
  const hy = guides.horizontalY;
  if (typeof vx === "number" && Number.isFinite(vx)) {
    const a = worldPlotPointToSvg(vx, bounds.maxY, bounds, lay);
    const b = worldPlotPointToSvg(vx, bounds.minY, bounds, lay);
    lines.push(
      <line
        key={`${keyPrefix}-v`}
        x1={a.sx}
        y1={a.sy}
        x2={b.sx}
        y2={b.sy}
        stroke={stroke}
        strokeWidth={1.25}
        strokeDasharray="4 4"
        pointerEvents="none"
      />,
    );
  }
  if (typeof hy === "number" && Number.isFinite(hy)) {
    const a = worldPlotPointToSvg(bounds.minX, hy, bounds, lay);
    const b = worldPlotPointToSvg(bounds.maxX, hy, bounds, lay);
    lines.push(
      <line
        key={`${keyPrefix}-h`}
        x1={a.sx}
        y1={a.sy}
        x2={b.sx}
        y2={b.sy}
        stroke={stroke}
        strokeWidth={1.25}
        strokeDasharray="4 4"
        pointerEvents="none"
      />,
    );
  }
  return lines;
}

function AuthoringSnapGuideLines(props: {
  bounds: PlotViewLayout["bounds"];
  lay: PlotViewLayout;
  overlay: NonNullable<Props["authoringSnapGuidesOverlay"]>;
}) {
  const { bounds, lay, overlay } = props;
  const parts: ReactElement[] = [];
  if (overlay.structural) {
    const edge = overlay.structural.edge;
    if (edge && Number.isFinite(edge.x1) && Number.isFinite(edge.y1) && Number.isFinite(edge.x2) && Number.isFinite(edge.y2)) {
      const pa = worldPlotPointToSvg(edge.x1, edge.y1, bounds, lay);
      const pb = worldPlotPointToSvg(edge.x2, edge.y2, bounds, lay);
      parts.push(
        <line
          key="uls-st-edge"
          x1={pa.sx}
          y1={pa.sy}
          x2={pb.sx}
          y2={pb.sy}
          stroke="rgba(251,191,36,0.65)"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          pointerEvents="none"
        />,
      );
    }
    parts.push(...axisPairGuideLines(bounds, lay, overlay.structural, "rgba(251,191,36,0.55)", "uls-st"));
  }
  if (overlay.peer) parts.push(...axisPairGuideLines(bounds, lay, overlay.peer, "rgba(96,165,250,0.5)", "uls-peer"));
  if (parts.length === 0) return null;
  return (
    <g pointerEvents="none" {...ulsdExportExcludeSvg}>
      {parts}
    </g>
  );
}

function PlacementGlyph(props: {
  sx: number;
  sy: number;
  placement: StageDesignPlacement;
  lay: PlotViewLayout;
  unit: StageDesignUnit;
  interactive: boolean;
  selected: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}) {
  const { sx, sy, placement, lay, unit, interactive, selected, onPointerDown } = props;
  const clipNonce = useId().replace(/:/g, "");
  const st = STAGE_PLACEMENT_GLYPH_STYLE[placement.kind];
  const id = placement.id.slice(0, 8);
  const pe = interactive ? "auto" : "none";
  const ring = selected ? "rgba(96,165,250,0.95)" : undefined;
  const rot = placement.rotationDeg ?? 0;
  const rotG = rot !== 0 ? `rotate(${rot}, ${sx}, ${sy})` : undefined;

  const noteAbbrev =
    typeof placement.note === "string" && placement.note.trim().length > 0
      ? abbreviateStageDiagramLabel(placement.note)
      : "";

  const svgTitleEquip = placementEquipmentSvgTitleSuffix(placement);

  const u = plotMinUniformScale(lay);
  const sxPer = lay.rectW / lay.worldW;
  const syPer = lay.rectH / lay.worldH;
  const ext = resolvePlacementGlyphWorld(placement, unit);

  const wrap = (node: React.ReactNode, ringR: number) => (
    <g
      pointerEvents={pe as "auto" | "none"}
      onPointerDown={onPointerDown}
      style={{ cursor: interactive ? "grab" : undefined }}
    >
      {ring ? (
        <circle
          cx={sx}
          cy={sy}
          r={ringR}
          fill="none"
          stroke={ring}
          strokeWidth={2}
          pointerEvents="none"
          transform={rotG}
          {...ulsdExportExcludeSvg}
        />
      ) : null}
      <g transform={rotG}>{node}</g>
    </g>
  );

  switch (placement.kind) {
    case "FIXTURE":
    case "WASH_MOVING":
    case "PAR_STATIC":
    case "UPLIGHT": {
      const r = clampSvgLen(ext.fixtureR * u, 2.25, 10);
      const ringR = interactive ? Math.max(r + 5, 12) : Math.max(r + 3.5, 9);
      const clipId = `uls-pf-${safeSvgIdFragment(placement.id)}-${clipNonce}`;
      const cap = noteAbbrev && r * 2 >= 13;
      return wrap(
        <>
          {cap ? (
            <defs>
              <clipPath id={clipId}>
                <circle cx={sx} cy={sy} r={r} />
              </clipPath>
            </defs>
          ) : null}
          <circle cx={sx} cy={sy} r={r} fill={st.fill} stroke={st.stroke} strokeWidth={1.25} pointerEvents="visiblePainted">
            <title>
              {`${STAGE_DESIGN_KIND_LABELS[placement.kind]} · ${placement.note ?? id}${svgTitleEquip}`}
            </title>
          </circle>
          {cap ? (
            <SvgAbbrevCaption
              abbrev={noteAbbrev}
              cx={sx}
              cy={sy}
              minPx={r * 2}
              clipPathUrl={`url(#${clipId})`}
            />
          ) : null}
        </>,
        ringR,
      );
    }
    case "BEAM_MOVING": {
      const rx = clampSvgLen(ext.fixtureR * u, 2.35, 10.5);
      const ry = clampSvgLen(ext.fixtureR * 0.52 * u, 1.35, 6.75);
      const ringR = interactive ? Math.max(rx + 4, ry + 4, 12) : Math.max(rx + 2.5, ry + 2.5, 9);
      const clipId = `uls-pbeam-${safeSvgIdFragment(placement.id)}-${clipNonce}`;
      const cap = noteAbbrev && Math.min(rx * 2, ry * 2) >= 13;
      return wrap(
        <>
          {cap ? (
            <defs>
              <clipPath id={clipId}>
                <ellipse cx={sx} cy={sy} rx={rx} ry={ry} />
              </clipPath>
            </defs>
          ) : null}
          <ellipse
            cx={sx}
            cy={sy}
            rx={rx}
            ry={ry}
            fill={st.fill}
            stroke={st.stroke}
            strokeWidth={1.35}
            pointerEvents="visiblePainted"
          >
            <title>
              {`${STAGE_DESIGN_KIND_LABELS[placement.kind]} · ${placement.note ?? id}${svgTitleEquip}`}
            </title>
          </ellipse>
          <line
            x1={sx}
            y1={sy - ry * 0.15}
            x2={sx}
            y2={sy + ry * 0.85}
            stroke={st.stroke}
            strokeWidth={Math.max(0.85, Math.min(rx, ry) * 0.09)}
            strokeLinecap="round"
            opacity={0.9}
            pointerEvents="none"
          />
          {cap ? (
            <SvgAbbrevCaption
              abbrev={noteAbbrev}
              cx={sx}
              cy={sy}
              minPx={Math.min(rx * 2, ry * 2)}
              clipPathUrl={`url(#${clipId})`}
            />
          ) : null}
        </>,
        ringR,
      );
    }
    case "POWER":
    case "POWER_DROP": {
      const triH = clampSvgLen(ext.powerTriH * u, 4, 16);
      const halfBase = triH * 0.58;
      const pts = `${sx},${sy - triH * 0.65} ${sx + halfBase},${sy + triH * 0.35} ${sx - halfBase},${sy + triH * 0.35}`;
      const clipId = `uls-pp-${safeSvgIdFragment(placement.id)}-${clipNonce}`;
      const triMinPx = Math.min(triH * 2, halfBase * 2 + 2);
      const cap = noteAbbrev && triMinPx >= 13;
      return wrap(
        <>
          {cap ? (
            <defs>
              <clipPath id={clipId}>
                <polygon points={pts} />
              </clipPath>
            </defs>
          ) : null}
          <polygon
            points={pts}
            fill={st.fill}
            stroke={st.stroke}
            strokeWidth={1}
            pointerEvents="visiblePainted"
          >
            <title>{`${STAGE_DESIGN_KIND_LABELS[placement.kind]} · ${placement.note ?? id}${svgTitleEquip}`}</title>
          </polygon>
          {cap ? (
            <SvgAbbrevCaption
              abbrev={noteAbbrev}
              cx={sx}
              cy={sy}
              minPx={triMinPx}
              clipPathUrl={`url(#${clipId})`}
            />
          ) : null}
        </>,
        interactive ? Math.max(triH, 14) : Math.max(triH * 0.85, 11),
      );
    }
    case "DECOR": {
      const h = clampSvgLen(ext.decorHalf * u, 3.5, 18);
      const clipId = `uls-pd-${safeSvgIdFragment(placement.id)}-${clipNonce}`;
      const inner = h * 2;
      const cap = noteAbbrev && inner >= 13;
      return wrap(
        <>
          {cap ? (
            <defs>
              <clipPath id={clipId}>
                <rect x={sx - h} y={sy - h} width={inner} height={inner} rx={1.75} />
              </clipPath>
            </defs>
          ) : null}
          <rect
            x={sx - h}
            y={sy - h}
            width={inner}
            height={inner}
            rx={1.75}
            fill={st.fill}
            stroke={st.stroke}
            strokeWidth={1.25}
            pointerEvents="visiblePainted"
          >
            <title>{`Décor block · ${placement.note ?? id}${svgTitleEquip}`}</title>
          </rect>
          {cap ? (
            <SvgAbbrevCaption
              abbrev={noteAbbrev}
              cx={sx}
              cy={sy}
              minPx={inner}
              clipPathUrl={`url(#${clipId})`}
            />
          ) : null}
        </>,
        interactive ? Math.max(h * 1.85, 14) : Math.max(h * 1.55, 11),
      );
    }
    case "TRUSS": {
      const halfLen = clampSvgLen(ext.trussHalfLen * u, 6, 56);
      const sw = clampSvgLen(0.22 * u, 1.5, 5);
      const segPx = halfLen * 2;
      const cap = noteAbbrev && segPx >= 14;
      return wrap(
        <>
          <line
            x1={sx - halfLen}
            y1={sy}
            x2={sx + halfLen}
            y2={sy}
            stroke={st.stroke}
            strokeWidth={sw}
            strokeLinecap="square"
            pointerEvents="visiblePainted"
          >
            <title>{`Truss · ${placement.note ?? id}${svgTitleEquip}`}</title>
          </line>
          {cap ? <SvgAbbrevCaption abbrev={noteAbbrev} cx={sx} cy={sy} minPx={segPx} /> : null}
        </>,
        interactive ? Math.max(halfLen * 1.08, 16) : Math.max(halfLen * 0.92, 12),
      );
    }
    case "STRIP_FIXED":
    case "LED_WALL":
    case "PROJECTOR_SYM": {
      const halfW = clampSvgLen(ext.ledHalfW * sxPer, 6, Math.min(lay.rectW * 0.42, 160));
      const halfHMin = placement.kind === "STRIP_FIXED" ? 1.1 : placement.kind === "PROJECTOR_SYM" ? 2.25 : 2.5;
      const halfH = clampSvgLen(ext.ledHalfH * syPer, halfHMin, placement.kind === "PROJECTOR_SYM" ? 24 : 22);
      const clipId = `uls-pl-${safeSvgIdFragment(placement.id)}-${clipNonce}`;
      const rw = halfW * 2;
      const rh = halfH * 2;
      const cap = noteAbbrev && Math.min(rw, rh) >= 13;
      return wrap(
        <>
          {cap ? (
            <defs>
              <clipPath id={clipId}>
                <rect x={sx - halfW} y={sy - halfH} width={rw} height={rh} rx={1.5} />
              </clipPath>
            </defs>
          ) : null}
          <rect
            x={sx - halfW}
            y={sy - halfH}
            width={rw}
            height={rh}
            rx={1.5}
            fill={st.fill}
            stroke={st.stroke}
            strokeWidth={st.strokeWidth ?? 2}
            pointerEvents="visiblePainted"
          >
            <title>{`${STAGE_DESIGN_KIND_LABELS[placement.kind]} · ${placement.note ?? id}${svgTitleEquip}`}</title>
          </rect>
          {placement.kind === "PROJECTOR_SYM" ? (
            <circle
              cx={sx}
              cy={sy + halfH * 0.08}
              r={clampSvgLen(Math.min(ext.ledHalfW, ext.ledHalfH) * 0.34 * syPer, 1.85, halfH * 0.92)}
              fill="rgba(8,14,22,0.55)"
              stroke={st.stroke}
              strokeWidth={1.35}
              pointerEvents="visiblePainted"
            />
          ) : null}
          {cap ? (
            <SvgAbbrevCaption
              abbrev={noteAbbrev}
              cx={sx}
              cy={sy}
              minPx={Math.min(rw, rh)}
              clipPathUrl={`url(#${clipId})`}
            />
          ) : null}
        </>,
        interactive ? Math.max(halfW, halfH) + 8 : Math.max(halfW, halfH) + 5,
      );
    }
    default:
      return null;
  }
}

function ShapeDraw(props: {
  shape: StageDesignShape;
  bounds: PlotViewLayout["bounds"];
  lay: PlotViewLayout;
  interactive: boolean;
  selected: boolean;
  onPointerDown?: (e: React.PointerEvent<SVGGElement>) => void;
}) {
  const { shape, bounds, lay, interactive, selected, onPointerDown } = props;
  const clipNonce = useId().replace(/:/g, "");
  const pe = interactive ? ("auto" as const) : ("none" as const);
  const strokeSel = selected ? "rgba(96,165,250,0.95)" : "rgba(244,244,245,0.45)";

  const gProps = {
    pointerEvents: pe,
    onPointerDown,
    style: { cursor: interactive ? ("grab" as const) : undefined },
  };

  switch (shape.kind) {
    case "LINE": {
      const a = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
      const b = worldPlotPointToSvg(shape.x2 ?? shape.x, shape.y2 ?? shape.y, bounds, lay);
      const rot = shape.rotationDeg ?? 0;
      const mx = (a.sx + b.sx) / 2;
      const my = (a.sy + b.sy) / 2;
      const lineG = rot !== 0 ? `rotate(${rot}, ${mx}, ${my})` : undefined;
      const preset = shape.cableRun ? cableRunPresentationStroke(shape.cableRun) : null;
      const lineOuterStroke = shape.stroke ?? preset?.stroke ?? strokeSel;
      const dashAttr = shape.stroke ? undefined : preset?.strokeDasharray;
      const strokeWide = selected ? 2.5 : shape.stroke ? 1.75 : preset?.strokeWidthPx ?? 1.75;
      const abbrev =
        typeof shape.label === "string" && shape.label.trim().length > 0
          ? abbreviateStageDiagramLabel(shape.label)
          : "";
      const segLen = Math.hypot(b.sx - a.sx, b.sy - a.sy);
      const lineCaptionFs =
        abbrev && segLen >= 13 ? Math.max(6, Math.min(9.5, segLen / 4.75)) : 0;
      return (
        <g {...gProps}>
          <g transform={lineG}>
            {selected ? (
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke="rgba(96,165,250,0.35)"
                strokeWidth={6}
                strokeLinecap="round"
                pointerEvents="none"
                {...ulsdExportExcludeSvg}
              />
            ) : null}
            <line
              x1={a.sx}
              y1={a.sy}
              x2={b.sx}
              y2={b.sy}
              stroke={selected ? strokeSel : lineOuterStroke}
              strokeWidth={strokeWide}
              strokeDasharray={dashAttr}
              strokeLinecap="round"
              pointerEvents="visibleStroke"
            />
            {abbrev && lineCaptionFs > 0 ? (
              <text
                x={mx}
                y={my}
                fill={DIAGRAM_INLINE_LABEL_FILL}
                fontSize={lineCaptionFs}
                fontWeight={650}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
                stroke="rgba(10,12,14,0.55)"
                strokeWidth={lineCaptionFs * 0.08}
                paintOrder="stroke fill"
                style={{ userSelect: "none", fontFamily: "system-ui, Segoe UI, sans-serif" }}
              >
                {abbrev}
              </text>
            ) : null}
            <title>
              {shape.label ?? "Line"}
              {shape.cableRun ? ` · ${STAGE_DIAGRAM_CABLE_RUN_LABELS[shape.cableRun]}` : ""}
            </title>
          </g>
        </g>
      );
    }
    case "POLYLINE": {
      const verts = shape.vertices;
      if (!verts?.length || verts.length < 2) return null;
      const ptsSvg = verts.map((pt) => worldPlotPointToSvg(pt.x, pt.y, bounds, lay));
      const pointsAttr = ptsSvg.map((p) => `${p.sx},${p.sy}`).join(" ");
      const pivW = stageShapeRotationPivotWorld(shape);
      const piv = worldPlotPointToSvg(pivW.wx, pivW.wy, bounds, lay);
      const rot = shape.rotationDeg ?? 0;
      const polyG = rot !== 0 ? `rotate(${rot}, ${piv.sx}, ${piv.sy})` : undefined;
      let geomLenPx = 0;
      for (let i = 1; i < ptsSvg.length; i++) {
        geomLenPx += Math.hypot(ptsSvg[i].sx - ptsSvg[i - 1].sx, ptsSvg[i].sy - ptsSvg[i - 1].sy);
      }
      const preset = shape.cableRun ? cableRunPresentationStroke(shape.cableRun) : null;
      const lineOuterStroke = shape.stroke ?? preset?.stroke ?? strokeSel;
      const dashAttr = shape.stroke ? undefined : preset?.strokeDasharray;
      const strokeWide = selected ? 2.5 : shape.stroke ? 1.75 : preset?.strokeWidthPx ?? 1.75;
      const abbrev =
        typeof shape.label === "string" && shape.label.trim().length > 0
          ? abbreviateStageDiagramLabel(shape.label)
          : "";
      const captionFs =
        abbrev && geomLenPx >= 13 ? Math.max(6, Math.min(9.5, geomLenPx / Math.max(4, verts.length + 2))) : 0;
      const midSeg = Math.floor((verts.length - 1) / 2);
      const i0 = midSeg;
      const i1 = Math.min(verts.length - 1, midSeg + 1);
      const wm = { wx: (verts[i0]!.x + verts[i1]!.x) / 2, wy: (verts[i0]!.y + verts[i1]!.y) / 2 };
      const lbl = worldPlotPointToSvg(wm.wx, wm.wy, bounds, lay);

      return (
        <g {...gProps}>
          <g transform={polyG}>
            {selected ? (
              <polyline
                points={pointsAttr}
                fill="none"
                stroke="rgba(96,165,250,0.35)"
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
                {...ulsdExportExcludeSvg}
              />
            ) : null}
            <polyline
              points={pointsAttr}
              fill="none"
              stroke={selected ? strokeSel : lineOuterStroke}
              strokeWidth={strokeWide}
              strokeDasharray={dashAttr}
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="visibleStroke"
            />
            {abbrev && captionFs > 0 ? (
              <text
                x={lbl.sx}
                y={lbl.sy}
                fill={DIAGRAM_INLINE_LABEL_FILL}
                fontSize={captionFs}
                fontWeight={650}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
                stroke="rgba(10,12,14,0.55)"
                strokeWidth={captionFs * 0.08}
                paintOrder="stroke fill"
                style={{ userSelect: "none", fontFamily: "system-ui, Segoe UI, sans-serif" }}
              >
                {abbrev}
              </text>
            ) : null}
            <title>
              {shape.label ?? "Polyline"}
              {shape.cableRun ? ` · ${STAGE_DIAGRAM_CABLE_RUN_LABELS[shape.cableRun]}` : ""}
            </title>
          </g>
        </g>
      );
    }
    case "RECT": {
      const w = shape.width ?? 6;
      const h = shape.height ?? 4;
      const p0 = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
      const p1 = worldPlotPointToSvg(shape.x + w, shape.y + h, bounds, lay);
      const rx = Math.min(p0.sx, p1.sx);
      const ry = Math.min(p0.sy, p1.sy);
      const rw = Math.abs(p1.sx - p0.sx);
      const rh = Math.abs(p1.sy - p0.sy);
      const cx = rx + rw / 2;
      const cy = ry + rh / 2;
      const rot = shape.rotationDeg ?? 0;
      const fillPaint = shape.fill ?? "rgba(147,197,253,0.08)";
      const strokePaint = selected ? strokeSel : shape.stroke ?? strokeSel;
      const abbrev =
        typeof shape.label === "string" && shape.label.trim().length > 0
          ? abbreviateStageDiagramLabel(shape.label)
          : "";
      const minDimPx = Math.min(rw, rh);
      const rectCaptionFs =
        abbrev && minDimPx >= 14 ? Math.max(6, Math.min(10, minDimPx / 3.6)) : 0;
      const rectClipId = `uls-rc-${safeSvgIdFragment(shape.id)}-${clipNonce}`;
      return (
        <g {...gProps}>
          <g transform={`rotate(${rot}, ${cx}, ${cy})`}>
            {abbrev && rectCaptionFs > 0 ? (
              <defs>
                <clipPath id={rectClipId}>
                  <rect x={rx} y={ry} width={rw} height={rh} rx={2} />
                </clipPath>
              </defs>
            ) : null}
            <rect
              x={rx}
              y={ry}
              width={rw}
              height={rh}
              rx={2}
              fill={fillPaint}
              stroke={strokePaint}
              strokeWidth={selected ? 2 : 1.25}
              pointerEvents="visiblePainted"
            />
            {abbrev && rectCaptionFs > 0 ? (
              <text
                x={cx}
                y={cy}
                clipPath={`url(#${rectClipId})`}
                fill={DIAGRAM_INLINE_LABEL_FILL}
                fontSize={rectCaptionFs}
                fontWeight={650}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
                stroke="rgba(10,12,14,0.45)"
                strokeWidth={rectCaptionFs * 0.07}
                paintOrder="stroke fill"
                style={{ userSelect: "none", fontFamily: "system-ui, Segoe UI, sans-serif" }}
              >
                {abbrev}
              </text>
            ) : null}
          </g>
          <title>{shape.label ?? "Rectangle"}</title>
        </g>
      );
    }
    case "ELLIPSE": {
      const rxWorld = shape.width ?? 4;
      const ryWorld = shape.height ?? 3;
      const c = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
      const pRx = Math.abs(worldPlotPointToSvg(shape.x + rxWorld, shape.y, bounds, lay).sx - c.sx);
      const pRy = Math.abs(worldPlotPointToSvg(shape.x, shape.y + ryWorld, bounds, lay).sy - c.sy);
      const rot = shape.rotationDeg ?? 0;
      const fillPaint = shape.fill ?? "rgba(251,113,133,0.1)";
      const strokePaint = selected ? strokeSel : shape.stroke ?? strokeSel;
      const abbrev =
        typeof shape.label === "string" && shape.label.trim().length > 0
          ? abbreviateStageDiagramLabel(shape.label)
          : "";
      const minEllipsePx = 2 * Math.min(Math.max(1, pRx), Math.max(1, pRy));
      const ellCaptionFs =
        abbrev && minEllipsePx >= 14 ? Math.max(6, Math.min(10, minEllipsePx / 3.6)) : 0;
      const ellClipId = `uls-el-${safeSvgIdFragment(shape.id)}-${clipNonce}`;
      return (
        <g {...gProps}>
          <g transform={`rotate(${rot}, ${c.sx}, ${c.sy})`}>
            {abbrev && ellCaptionFs > 0 ? (
              <defs>
                <clipPath id={ellClipId}>
                  <ellipse cx={c.sx} cy={c.sy} rx={Math.max(1, pRx)} ry={Math.max(1, pRy)} />
                </clipPath>
              </defs>
            ) : null}
            <ellipse
              cx={c.sx}
              cy={c.sy}
              rx={Math.max(1, pRx)}
              ry={Math.max(1, pRy)}
              fill={fillPaint}
              stroke={strokePaint}
              strokeWidth={selected ? 2 : 1.25}
              pointerEvents="visiblePainted"
            />
            {abbrev && ellCaptionFs > 0 ? (
              <text
                x={c.sx}
                y={c.sy}
                clipPath={`url(#${ellClipId})`}
                fill={DIAGRAM_INLINE_LABEL_FILL}
                fontSize={ellCaptionFs}
                fontWeight={650}
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
                stroke="rgba(10,12,14,0.45)"
                strokeWidth={ellCaptionFs * 0.07}
                paintOrder="stroke fill"
                style={{ userSelect: "none", fontFamily: "system-ui, Segoe UI, sans-serif" }}
              >
                {abbrev}
              </text>
            ) : null}
          </g>
          <title>{shape.label ?? "Ellipse"}</title>
        </g>
      );
    }
    case "TEXT": {
      const c = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
      const rot = shape.rotationDeg ?? 0;
      const rawFull = typeof shape.label === "string" && shape.label.trim() ? shape.label.trim() : "Label";
      const displayFull = formatDiagramTextLabelForDisplay(rawFull);
      const abbrev = abbreviateStageDiagramLabel(displayFull) || "LB";
      const u = plotMinUniformScale(lay);
      const textFs = Math.max(7, Math.min(10.5, 26 * u));
      const textFill = shape.fill ?? DIAGRAM_INLINE_LABEL_FILL;
      return (
        <g {...gProps}>
          <g transform={`rotate(${rot}, ${c.sx}, ${c.sy})`}>
            <text
              x={c.sx}
              y={c.sy}
              fill={textFill}
              fontSize={textFs}
              fontWeight={650}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="visiblePainted"
              stroke="rgba(10,12,14,0.5)"
              strokeWidth={textFs * 0.07}
              paintOrder="stroke fill"
              style={{ userSelect: "none", fontFamily: "system-ui, Segoe UI, sans-serif" }}
            >
              {abbrev}
            </text>
          </g>
          <title>{displayFull}</title>
        </g>
      );
    }
    default:
      return null;
  }
}

const RESIZE_CORNERS: ResizeCornerId[] = ["nw", "ne", "sw", "se"];
const HANDLE_R = 5;

function ResizeHandleSquare(props: {
  sx: number;
  sy: number;
  cursor: string;
  onDown: (e: React.PointerEvent<SVGRectElement>) => void;
  title?: string;
}) {
  return (
    <rect
      x={props.sx - HANDLE_R}
      y={props.sy - HANDLE_R}
      width={HANDLE_R * 2}
      height={HANDLE_R * 2}
      fill="rgba(253,251,246,0.98)"
      stroke="rgba(59,130,246,0.95)"
      strokeWidth={1.25}
      rx={1}
      pointerEvents="auto"
      style={{ cursor: props.cursor, touchAction: "none" }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        props.onDown(e);
      }}
    >
      {props.title ? <title>{props.title}</title> : null}
    </rect>
  );
}

/** Radial spacing for rotation thumb vs pivot — SVG px from centroid. */
function svgRotationLeadPx(shape: StageDesignShape, bounds: PlotViewLayout["bounds"], lay: PlotViewLayout): number {
  switch (shape.kind) {
    case "RECT": {
      const w = shape.width ?? 6;
      const h = shape.height ?? 4;
      const p0 = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
      const p1 = worldPlotPointToSvg(shape.x + w, shape.y + h, bounds, lay);
      const rw = Math.abs(p1.sx - p0.sx);
      const rh = Math.abs(p1.sy - p0.sy);
      return Math.max(30, Math.max(rw, rh) * 0.55 + 18);
    }
    case "ELLIPSE": {
      const rxWorld = shape.width ?? 4;
      const ryWorld = shape.height ?? 3;
      const c = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
      const pRx = Math.abs(worldPlotPointToSvg(shape.x + rxWorld, shape.y, bounds, lay).sx - c.sx);
      const pRy = Math.abs(worldPlotPointToSvg(shape.x, shape.y + ryWorld, bounds, lay).sy - c.sy);
      return Math.max(30, Math.max(pRx, pRy) * 1.08 + 20);
    }
    case "LINE": {
      const a = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
      const b = worldPlotPointToSvg(shape.x2 ?? shape.x, shape.y2 ?? shape.y, bounds, lay);
      const dx = b.sx - a.sx;
      const dy = b.sy - a.sy;
      return Math.max(28, Math.hypot(dx, dy) * 0.38 + 20);
    }
    case "POLYLINE": {
      const v = shape.vertices;
      if (!v?.length) return 34;
      let minSx = Infinity;
      let minSy = Infinity;
      let maxSx = -Infinity;
      let maxSy = -Infinity;
      for (const p of v) {
        const sp = worldPlotPointToSvg(p.x, p.y, bounds, lay);
        minSx = Math.min(minSx, sp.sx);
        minSy = Math.min(minSy, sp.sy);
        maxSx = Math.max(maxSx, sp.sx);
        maxSy = Math.max(maxSy, sp.sy);
      }
      const rw = Math.max(1e-6, maxSx - minSx);
      const rh = Math.max(1e-6, maxSy - minSy);
      return Math.max(28, Math.hypot(rw, rh) * 0.38 + 20);
    }
    case "TEXT":
    default:
      return 34;
  }
}

/** Radial spacing for symbol rotation thumb — aligned with {@link PlacementGlyph} extents. */
function svgPlacementRotationLeadPx(placement: StageDesignPlacement, unit: StageDesignUnit, lay: PlotViewLayout): number {
  const u = plotMinUniformScale(lay);
  const sxPer = lay.rectW / lay.worldW;
  const syPer = lay.rectH / lay.worldH;
  const ext = resolvePlacementGlyphWorld(placement, unit);

  switch (placement.kind) {
    case "FIXTURE":
    case "WASH_MOVING":
    case "PAR_STATIC":
    case "UPLIGHT": {
      const r = clampSvgLen(ext.fixtureR * u, 2.25, 10);
      const ringR = Math.max(r + 5, 12);
      return Math.max(26, ringR + 14);
    }
    case "BEAM_MOVING": {
      const rx = clampSvgLen(ext.fixtureR * u, 2.35, 10.5);
      const ry = clampSvgLen(ext.fixtureR * 0.52 * u, 1.35, 6.75);
      const ringR = Math.max(rx + 4, ry + 4, 14);
      return Math.max(28, ringR + 14);
    }
    case "POWER":
    case "POWER_DROP": {
      const triH = clampSvgLen(ext.powerTriH * u, 4, 16);
      const ringR = Math.max(triH, 14);
      return Math.max(26, ringR + 14);
    }
    case "DECOR": {
      const h = clampSvgLen(ext.decorHalf * u, 3.5, 18);
      const ringR = Math.max(h * 1.85, 14);
      return Math.max(28, ringR + 14);
    }
    case "TRUSS": {
      const halfLen = clampSvgLen(ext.trussHalfLen * u, 6, 56);
      const ringR = Math.max(halfLen * 1.08, 16);
      return Math.max(28, ringR + 14);
    }
    case "STRIP_FIXED":
    case "LED_WALL":
    case "PROJECTOR_SYM": {
      const halfW = clampSvgLen(ext.ledHalfW * sxPer, 6, Math.min(lay.rectW * 0.42, 160));
      const halfHMin = placement.kind === "STRIP_FIXED" ? 1.1 : placement.kind === "PROJECTOR_SYM" ? 2.25 : 2.5;
      const halfH = clampSvgLen(ext.ledHalfH * syPer, halfHMin, placement.kind === "PROJECTOR_SYM" ? 24 : 22);
      const ringR = Math.max(halfW, halfH) + (placement.kind === "PROJECTOR_SYM" ? 10 : 8);
      return Math.max(30, ringR + 14);
    }
    default:
      return 30;
  }
}

function PlacementRotationThumb(props: {
  placement: StageDesignPlacement;
  unit: StageDesignUnit;
  bounds: PlotViewLayout["bounds"];
  lay: PlotViewLayout;
  onPointerDown: (e: React.PointerEvent<SVGCircleElement>) => void;
}) {
  const { placement, bounds, lay, unit } = props;
  const pivotW = stagePlacementRotationPivotWorld(placement);
  const piv = worldPlotPointToSvg(pivotW.wx, pivotW.wy, bounds, lay);
  const R = svgPlacementRotationLeadPx(placement, unit, lay);
  const rotDeg = placement.rotationDeg ?? 0;
  const theta = (-rotDeg * Math.PI) / 180;
  const sx = piv.sx + R * Math.sin(theta);
  const sy = piv.sy - R * Math.cos(theta);

  const ROT_HANDLE_R_SVG = 6;
  return (
    <g {...ulsdExportExcludeSvg}>
      <circle
        cx={sx}
        cy={sy}
        r={ROT_HANDLE_R_SVG}
        fill="rgba(254,243,199,0.96)"
        stroke="rgba(245,158,11,0.95)"
        strokeWidth={1.35}
        pointerEvents="auto"
        style={{ cursor: "crosshair", touchAction: "none" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          props.onPointerDown(e);
        }}
      >
        <title>Rotate symbol</title>
      </circle>
    </g>
  );
}

function ShapeRotationThumb(props: {
  shape: StageDesignShape;
  bounds: PlotViewLayout["bounds"];
  lay: PlotViewLayout;
  onPointerDown: (e: React.PointerEvent<SVGCircleElement>) => void;
}) {
  const { shape, bounds, lay } = props;
  const pivotW = stageShapeRotationPivotWorld(shape);
  const piv = worldPlotPointToSvg(pivotW.wx, pivotW.wy, bounds, lay);
  const R = svgRotationLeadPx(shape, bounds, lay);
  const rotDeg = shape.rotationDeg ?? 0;
  const theta = (-rotDeg * Math.PI) / 180;
  const sx = piv.sx + R * Math.sin(theta);
  const sy = piv.sy - R * Math.cos(theta);

  const ROT_HANDLE_R_SVG = 6;
  return (
    <g {...ulsdExportExcludeSvg}>
      <circle
        cx={sx}
        cy={sy}
        r={ROT_HANDLE_R_SVG}
        fill="rgba(207,250,254,0.95)"
        stroke="rgba(6,182,212,0.95)"
        strokeWidth={1.35}
        pointerEvents="auto"
        style={{ cursor: "crosshair", touchAction: "none" }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.stopPropagation();
          e.preventDefault();
          props.onPointerDown(e);
        }}
      >
        <title>Rotate</title>
      </circle>
    </g>
  );
}

/** Select mode: invisible fat strokes receive double‑clicks between polyline bends (producer inserts + snaps vertex). */
function PolylineSegmentInsertHitLayer(props: {
  shape: StageDesignShape & { kind: "POLYLINE" };
  bounds: PlotViewLayout["bounds"];
  lay: PlotViewLayout;
  onInsertAfterVertex: (afterVertexIndex: number, world: { x: number; y: number }) => void;
}) {
  const { shape, bounds, lay, onInsertAfterVertex } = props;
  const verts = shape.vertices;
  if (!verts || verts.length < 2) return null;
  const pivW = stageShapeRotationPivotWorld(shape);
  const piv = worldPlotPointToSvg(pivW.wx, pivW.wy, bounds, lay);
  const rot = shape.rotationDeg ?? 0;
  const rotG = rot !== 0 ? `rotate(${rot}, ${piv.sx}, ${piv.sy})` : undefined;
  const segs: ReactElement[] = [];
  for (let i = 0; i + 1 < verts.length; i++) {
    const va = verts[i]!;
    const vb = verts[i + 1]!;
    const a = worldPlotPointToSvg(va.x, va.y, bounds, lay);
    const b = worldPlotPointToSvg(vb.x, vb.y, bounds, lay);
    segs.push(
      <line
        key={`${shape.id}-uls-poly-seg-hit-${i}`}
        x1={a.sx}
        y1={a.sy}
        x2={b.sx}
        y2={b.sy}
        stroke="transparent"
        strokeWidth={16}
        strokeLinecap="round"
        pointerEvents="stroke"
        style={{ cursor: "copy", touchAction: "manipulation" }}
        {...ulsdExportExcludeSvg}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const svg = e.currentTarget.ownerSVGElement;
          if (!svg) return;
          const w = svgScreenPointToPlotWorld(svg, e.clientX, e.clientY, lay);
          if (!w) return;
          onInsertAfterVertex(i, { x: w.wx, y: w.wy });
        }}
      >
        <title>Double‑click segment to add vertex</title>
      </line>,
    );
  }
  return (
    <g transform={rotG} pointerEvents="auto">
      {segs}
    </g>
  );
}

function ShapeResizeHandles(props: {
  shape: StageDesignShape;
  bounds: PlotViewLayout["bounds"];
  lay: PlotViewLayout;
  onHandlePointerDown: (encoded: ShapeResizeHandleEncoded, e: React.PointerEvent<SVGRectElement>) => void;
}) {
  const { shape, bounds, lay, onHandlePointerDown } = props;

  if (shape.kind === "POLYLINE") {
    const verts = shape.vertices;
    if (!verts?.length || verts.length < 2) return null;
    const pivW = stageShapeRotationPivotWorld(shape);
    const piv = worldPlotPointToSvg(pivW.wx, pivW.wy, bounds, lay);
    const rot = shape.rotationDeg ?? 0;
    const rotG = rot !== 0 ? `rotate(${rot}, ${piv.sx}, ${piv.sy})` : undefined;
    const ptsSvg = verts.map((pt) => worldPlotPointToSvg(pt.x, pt.y, bounds, lay));
    const pointsAttr = ptsSvg.map((p) => `${p.sx},${p.sy}`).join(" ");
    return (
      <g transform={rotG} pointerEvents="auto" {...ulsdExportExcludeSvg}>
        <polyline
          points={pointsAttr}
          fill="none"
          stroke="rgba(96,165,250,0.6)"
          strokeWidth={1}
          strokeDasharray="5 4"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
        {verts.map((pt, i) => {
          const sp = worldPlotPointToSvg(pt.x, pt.y, bounds, lay);
          return (
            <ResizeHandleSquare
              key={i}
              sx={sp.sx}
              sy={sp.sy}
              cursor="nwse-resize"
              title={verts.length > 2 ? "Alt+click to remove vertex (at least two points remain)" : undefined}
              onDown={(e) => onHandlePointerDown(encodePolylineVertexResize(i), e)}
            />
          );
        })}
      </g>
    );
  }

  if (shape.kind === "LINE") {
    const a = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
    const b = worldPlotPointToSvg(shape.x2 ?? shape.x, shape.y2 ?? shape.y, bounds, lay);
    return (
      <g pointerEvents="auto" {...ulsdExportExcludeSvg}>
        <line
          x1={a.sx}
          y1={a.sy}
          x2={b.sx}
          y2={b.sy}
          stroke="rgba(96,165,250,0.6)"
          strokeWidth={1}
          strokeDasharray="5 4"
          pointerEvents="none"
        />
        <ResizeHandleSquare
          sx={a.sx}
          sy={a.sy}
          cursor="nwse-resize"
          onDown={(e) => onHandlePointerDown(encodeLineResize("a"), e)}
        />
        <ResizeHandleSquare
          sx={b.sx}
          sy={b.sy}
          cursor="nwse-resize"
          onDown={(e) => onHandlePointerDown(encodeLineResize("b"), e)}
        />
      </g>
    );
  }

  if (shape.kind === "RECT") {
    const w = shape.width ?? 6;
    const h = shape.height ?? 4;
    const p0 = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
    const p1 = worldPlotPointToSvg(shape.x + w, shape.y + h, bounds, lay);
    const rx = Math.min(p0.sx, p1.sx);
    const ry = Math.min(p0.sy, p1.sy);
    const rw = Math.abs(p1.sx - p0.sx);
    const rh = Math.abs(p1.sy - p0.sy);
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    const rot = shape.rotationDeg ?? 0;
    const corners = {
      nw: { sx: rx, sy: ry },
      ne: { sx: rx + rw, sy: ry },
      sw: { sx: rx, sy: ry + rh },
      se: { sx: rx + rw, sy: ry + rh },
    } as const;
    const curs: Record<ResizeCornerId, string> = {
      nw: "nw-resize",
      ne: "ne-resize",
      sw: "sw-resize",
      se: "se-resize",
    };
    return (
      <g transform={`rotate(${rot}, ${cx}, ${cy})`} pointerEvents="auto" {...ulsdExportExcludeSvg}>
        <rect
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          fill="none"
          stroke="rgba(96,165,250,0.6)"
          strokeWidth={1}
          strokeDasharray="5 4"
          pointerEvents="none"
        />
        {RESIZE_CORNERS.map((k) => (
          <ResizeHandleSquare
            key={k}
            sx={corners[k].sx}
            sy={corners[k].sy}
            cursor={curs[k]}
            onDown={(e) => onHandlePointerDown(encodeRectResize(k), e)}
          />
        ))}
      </g>
    );
  }

  if (shape.kind === "ELLIPSE") {
    const rxWorld = shape.width ?? 4;
    const ryWorld = shape.height ?? 3;
    const c = worldPlotPointToSvg(shape.x, shape.y, bounds, lay);
    const pRx = Math.abs(worldPlotPointToSvg(shape.x + rxWorld, shape.y, bounds, lay).sx - c.sx);
    const pRy = Math.abs(worldPlotPointToSvg(shape.x, shape.y + ryWorld, bounds, lay).sy - c.sy);
    const rot = shape.rotationDeg ?? 0;
    const cx = c.sx;
    const cy = c.sy;
    const corners = {
      nw: { sx: cx - pRx, sy: cy - pRy },
      ne: { sx: cx + pRx, sy: cy - pRy },
      sw: { sx: cx - pRx, sy: cy + pRy },
      se: { sx: cx + pRx, sy: cy + pRy },
    } as const;
    const curs: Record<ResizeCornerId, string> = {
      nw: "nw-resize",
      ne: "ne-resize",
      sw: "sw-resize",
      se: "se-resize",
    };
    return (
      <g transform={`rotate(${rot}, ${cx}, ${cy})`} pointerEvents="auto" {...ulsdExportExcludeSvg}>
        <rect
          x={cx - pRx}
          y={cy - pRy}
          width={Math.max(1, pRx * 2)}
          height={Math.max(1, pRy * 2)}
          fill="none"
          stroke="rgba(96,165,250,0.6)"
          strokeWidth={1}
          strokeDasharray="5 4"
          pointerEvents="none"
        />
        {RESIZE_CORNERS.map((k) => (
          <ResizeHandleSquare
            key={k}
            sx={corners[k].sx}
            sy={corners[k].sy}
            cursor={curs[k]}
            onDown={(e) => onHandlePointerDown(encodeEllipseResize(k), e)}
          />
        ))}
      </g>
    );
  }

  return null;
}

function DeckRectangleResizeHandles(props: {
  poly: StageDeckPolygon;
  bounds: PlotViewLayout["bounds"];
  lay: PlotViewLayout;
  onCornerDown: (corner: ResizeCornerId, e: React.PointerEvent<SVGRectElement>) => void;
}) {
  const info = deckPolygonApproxAxisAlignedRectCorners(props.poly);
  if (!info) return null;
  const curs: Record<ResizeCornerId, string> = {
    nw: "nw-resize",
    ne: "ne-resize",
    sw: "sw-resize",
    se: "se-resize",
  };
  return (
    <g pointerEvents="auto" {...ulsdExportExcludeSvg}>
      {RESIZE_CORNERS.map((k) => {
        const w = info.corners[k];
        const { sx, sy } = worldPlotPointToSvg(w.x, w.y, props.bounds, props.lay);
        return (
          <ResizeHandleSquare
            key={k}
            sx={sx}
            sy={sy}
            cursor={curs[k]}
            onDown={(e) => props.onCornerDown(k, e)}
          />
        );
      })}
    </g>
  );
}

export const StageFootprintPreview = forwardRef<SVGSVGElement | null, Props>(
  function StageFootprintPreview(props, ref) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const patternId = `stage-plot-grid-${useId().replace(/:/g, "")}`;
  const canvas = props.canvas;
  const margins: StageDesignPlotMargins = canvas.plotMargins;
  const { width, depth } = canvas.footprint;
  const uSym = props.unit === "METERS" ? "m" : "ft";
  const { bounds, lay } = plotLayoutForCanvas(
    { footprint: canvas.footprint, deckPolygons: canvas.deckPolygons },
    margins,
  );

  const showPlacements = props.showPlacements ?? true;
  const showShapes = props.showShapes ?? true;
  /** Visual selection ring / thick strokes; false when producer leaves Select (ids may persist). */
  const selectionChrome = props.authoringSelectionChrome !== false;
  const showShapeResizeHandles = Boolean(props.showShapeResizeHandles && props.onShapeResizeHandlePointerDown);
  const deckPolysForDraw = normalizeDeckPolygons(canvas);
  const diagramPaintSequence = useMemo(() => diagramPaintRefsForPresentation(canvas), [canvas]);

  const pluralPlacements = props.selectedPlacementIds?.size ?? 0;
  const pluralShapes = props.selectedShapeIds?.size ?? 0;
  const pluralDeck = props.selectedDeckPolygonIds?.size ?? 0;

  const isPlacementSelectedUi = useCallback(
    (id: string): boolean =>
      pluralPlacements > 0 ? Boolean(props.selectedPlacementIds?.has(id)) : props.selectedPlacementId === id,
    [pluralPlacements, props.selectedPlacementId, props.selectedPlacementIds],
  );
  const isShapeSelectedUi = useCallback(
    (id: string): boolean =>
      pluralShapes > 0 ? Boolean(props.selectedShapeIds?.has(id)) : props.selectedShapeId === id,
    [pluralShapes, props.selectedShapeId, props.selectedShapeIds],
  );
  const isDeckPolygonSelectedUi = useCallback(
    (id: string): boolean =>
      pluralDeck > 0 ? Boolean(props.selectedDeckPolygonIds?.has(id)) : props.selectedDeckPolygonId === id,
    [pluralDeck, props.selectedDeckPolygonId, props.selectedDeckPolygonIds],
  );

  const soleSelectedPlacementId = useMemo((): string | null => {
    if (props.selectedPlacementIds && props.selectedPlacementIds.size === 1) return [...props.selectedPlacementIds][0]!;
    if ((props.selectedPlacementIds?.size ?? 0) > 0) return null;
    return props.selectedPlacementId ?? null;
  }, [props.selectedPlacementIds, props.selectedPlacementId]);

  const soleSelectedShapeId = useMemo((): string | null => {
    if (props.selectedShapeIds && props.selectedShapeIds.size === 1) return [...props.selectedShapeIds][0]!;
    if ((props.selectedShapeIds?.size ?? 0) > 0) return null;
    return props.selectedShapeId ?? null;
  }, [props.selectedShapeIds, props.selectedShapeId]);

  const soleSelectedDeckPolygonId = useMemo((): string | null => {
    if (props.selectedDeckPolygonIds && props.selectedDeckPolygonIds.size >= 1) {
      const real = [...props.selectedDeckPolygonIds].filter((d) => d !== SYNTHETIC_DECK_RECT_POLYGON_ID);
      if (real.length === 1) return real[0]!;
      return null;
    }
    const one = props.selectedDeckPolygonId;
    return one && one !== SYNTHETIC_DECK_RECT_POLYGON_ID ? one : null;
  }, [props.selectedDeckPolygonIds, props.selectedDeckPolygonId]);

  const shapeById = useMemo(() => new Map(canvas.shapes.map((s) => [s.id, s])), [canvas.shapes]);
  const placementById = useMemo(() => new Map(canvas.placements.map((p) => [p.id, p])), [canvas.placements]);
  const deckById = useMemo(() => new Map(deckPolysForDraw.map((p) => [p.id, p])), [deckPolysForDraw]);
  const customDeck =
    canvas.deckPolygons !== undefined && Array.isArray(canvas.deckPolygons) && canvas.deckPolygons.length > 0;
  const resizeShape =
    showShapeResizeHandles && soleSelectedShapeId ? canvas.shapes.find((s) => s.id === soleSelectedShapeId) ?? null : null;
  const rotatePlacement =
    showPlacements &&
    Boolean(props.showPlacementRotateHandle && props.onPlacementRotatePointerDown) &&
    soleSelectedPlacementId
      ? canvas.placements.find((p) => p.id === soleSelectedPlacementId) ?? null
      : null;

  const interactiveUserDeckModules = props.interactiveUserDeckModules === true && customDeck;
  const selectedDeckPoly =
    customDeck && soleSelectedDeckPolygonId
      ? (canvas.deckPolygons?.find((p) => p.id === soleSelectedDeckPolygonId) ?? null)
      : null;
  const showDeckCorners =
    Boolean(props.showDeckRectangleResizeHandles && props.onDeckResizeCornerPointerDown) &&
    selectedDeckPoly !== null &&
    deckPolygonApproxAxisAlignedRectCorners(selectedDeckPoly) !== null;

  const presentationMode = props.presentationMode === true;

  const authoringViewportNav = props.authoringViewportNav === true && !presentationMode;

  const viewportNavWrapRef = useRef<HTMLDivElement | null>(null);
  const [authoringViewBox, setAuthoringViewBox] = useState(() => fullStageSvgViewBox());
  const authoringViewBoxRef = useRef(authoringViewBox);
  useLayoutEffect(() => {
    authoringViewBoxRef.current = authoringViewBox;
  }, [authoringViewBox]);

  useEffect(() => {
    if (!authoringViewportNav) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset view when disabling viewport navigation
      setAuthoringViewBox(fullStageSvgViewBox());
    }
  }, [authoringViewportNav]);

  useEffect(() => {
    if (!authoringViewportNav) return;
    const wrap = viewportNavWrapRef.current;
    if (!wrap) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const zoomIn = e.deltaY < 0;
      setAuthoringViewBox((vb) =>
        zoomStageViewBoxAtScreenPoint(svg, vb, e.clientX, e.clientY, zoomIn),
      );
    };
    wrap.addEventListener("wheel", onWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", onWheel);
  }, [authoringViewportNav]);

  useEffect(() => {
    if (!authoringViewportNav) return;
    const svg = svgRef.current;
    if (!svg) return;
    let panPid: number | null = null;
    let lx = 0;
    let ly = 0;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 1) return;
      e.preventDefault();
      panPid = e.pointerId;
      lx = e.clientX;
      ly = e.clientY;
      try {
        svg.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (panPid === null || e.pointerId !== panPid) return;
      const dx = e.clientX - lx;
      const dy = e.clientY - ly;
      lx = e.clientX;
      ly = e.clientY;
      const vb = authoringViewBoxRef.current;
      const rect = svg.getBoundingClientRect();
      const scaleX = vb.w / Math.max(1, rect.width);
      const scaleY = vb.h / Math.max(1, rect.height);
      setAuthoringViewBox(
        clampStageViewBoxPan({
          ...vb,
          x: vb.x - dx * scaleX,
          y: vb.y - dy * scaleY,
        }),
      );
    };
    const onEnd = (e: PointerEvent) => {
      if (panPid === null || e.pointerId !== panPid) return;
      try {
        svg.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      panPid = null;
    };
    svg.addEventListener("pointerdown", onDown);
    svg.addEventListener("pointermove", onMove);
    svg.addEventListener("pointerup", onEnd);
    svg.addEventListener("pointercancel", onEnd);
    return () => {
      svg.removeEventListener("pointerdown", onDown);
      svg.removeEventListener("pointermove", onMove);
      svg.removeEventListener("pointerup", onEnd);
      svg.removeEventListener("pointercancel", onEnd);
    };
  }, [authoringViewportNav]);

  const diagramViewBoxStr = authoringViewportNav
    ? `${authoringViewBox.x} ${authoringViewBox.y} ${authoringViewBox.w} ${authoringViewBox.h}`
    : `0 0 ${STAGE_SVG_VIEW_W} ${STAGE_SVG_VIEW_H}`;

  const handleDiagramViewportNavKeyDown: KeyboardEventHandler<HTMLDivElement> = useCallback(
    (e) => {
      if (!authoringViewportNav) return;
      if (!e.ctrlKey && !e.metaKey) return;
      const svg = svgRef.current;
      if (!svg) return;

      const { code, key } = e;
      const fit =
        code === "Digit0" ||
        code === "Numpad0" ||
        key === "0";
      const zoomIn =
        code === "Equal" ||
        code === "NumpadAdd" ||
        key === "+";
      const zoomOut =
        code === "Minus" ||
        code === "NumpadSubtract" ||
        key === "-";

      if (fit) {
        e.preventDefault();
        setAuthoringViewBox(fullStageSvgViewBox());
        return;
      }
      if (zoomIn || zoomOut) {
        e.preventDefault();
        const r = svg.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        const towardIn = zoomIn && !zoomOut;
        setAuthoringViewBox((vb) =>
          zoomStageViewBoxAtScreenPoint(svg, vb, cx, cy, towardIn),
        );
      }
    },
    [authoringViewportNav],
  );

  const placing = Boolean(props.onPlotPlace);
  const handlePlotPointerDown: PointerEventHandler<SVGRectElement> | undefined =
    placing && props.onPlotPlace
      ? (ev) => {
          const placeAt = props.onPlotPlace!;
          if (ev.button !== 0) return;
          const svg = svgRef.current;
          if (!svg) return;
          const pt = svg.createSVGPoint();
          pt.x = ev.clientX;
          pt.y = ev.clientY;
          const m = svg.getScreenCTM();
          if (!m) return;
          const cursor = pt.matrixTransform(m.inverse());
          const hit = svgPlotPointToWorld(cursor.x, cursor.y, lay);
          if (!hit) return;
          placeAt({ x: hit.wx, y: hit.wy }, { snapToStageGrid: !ev.altKey });
        }
      : undefined;

  const pointerWorldCb = props.onPlotPointerWorld;
  /** Plot rect only receives events on the gridded deck; symbols/shapes sit above it. Track at `<svg>` so hover over items still reports world XY and avoids layout jump in the producer HUD. */
  const handleSvgPointerMoveForWorldHud: PointerEventHandler<SVGSVGElement> | undefined = pointerWorldCb
    ? (e) => {
        const svg = svgRef.current;
        if (!svg) return;
        const w = svgScreenPointToPlotWorld(svg, e.clientX, e.clientY, lay);
        pointerWorldCb(w ? { wx: w.wx, wy: w.wy } : null);
      }
    : undefined;
  const handleSvgPointerLeaveClearWorldHud: PointerEventHandler<SVGSVGElement> | undefined = pointerWorldCb
    ? () => pointerWorldCb(null)
    : undefined;

  return (
    <div className="mt-4 w-full">
      {props.caption ? (
        <p className="mb-2 text-[10px] uppercase tracking-wide text-uls-subtle">{props.caption}</p>
      ) : null}
      {authoringViewportNav ? (
        <div className="mb-1 flex flex-wrap items-center justify-end gap-3">
          <span className="hidden text-[10px] leading-snug text-uls-muted sm:inline">
            Wheel zoom · Middle-drag pan · Tab plot · ⌘/Ctrl+/−/0
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => setAuthoringViewBox(fullStageSvgViewBox())}
          >
            Fit view
          </Button>
        </div>
      ) : null}
      <div
        className={`w-full overflow-hidden rounded-xl shadow-inner ${
          presentationMode ? "border border-white/[0.06] bg-zinc-950/70" : "border border-white/[0.12] bg-zinc-950/80"
        }`}
        style={{
          aspectRatio: `${STAGE_SVG_VIEW_W} / ${STAGE_SVG_VIEW_H}`,
          minHeight: "max(380px, min(56vh, 720px))",
        }}
      >
        <div
          ref={authoringViewportNav ? viewportNavWrapRef : undefined}
          tabIndex={authoringViewportNav ? 0 : undefined}
          aria-label={
            authoringViewportNav
              ? "Stage diagram plot — Tab to focus, then Ctrl or Command with plus, minus, or zero to zoom and fit."
              : undefined
          }
          onKeyDown={authoringViewportNav ? handleDiagramViewportNavKeyDown : undefined}
          className={
            authoringViewportNav
              ? "h-full w-full rounded-[inherit] outline-none focus-visible:ring-2 focus-visible:ring-sky-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black/40"
              : "h-full w-full"
          }
        >
        <svg
          ref={(el) => {
            svgRef.current = el;
            if (typeof ref === "function") ref(el);
            else if (ref && "current" in ref) {
              (ref as React.MutableRefObject<SVGSVGElement | null>).current = el;
            }
          }}
          viewBox={diagramViewBoxStr}
          preserveAspectRatio="xMidYMid meet"
          className="block h-full w-full"
          role="img"
          onPointerMove={handleSvgPointerMoveForWorldHud}
          onPointerLeave={handleSvgPointerLeaveClearWorldHud}
          onAuxClick={
            authoringViewportNav
              ? (e) => {
                  if (e.button === 1) e.preventDefault();
                }
              : undefined
          }
          aria-label={
            customDeck
              ? `Stage plot with ${(canvas.deckPolygons ?? []).length} deck modules, span ${width} by ${depth} ${uSym}`
              : `Stage plot with deck ${width} by ${depth} ${uSym}`
          }
        >
        {presentationMode ? null : (
          <defs {...ulsdAuthoringGridSvg}>
            <pattern
              id={patternId}
              width={STAGE_PLOT_GRID_PATTERN_PERIOD}
              height={STAGE_PLOT_GRID_PATTERN_PERIOD}
              patternUnits="userSpaceOnUse"
            >
              <path
                d={`M ${STAGE_PLOT_GRID_PATTERN_PERIOD} 0 L 0 0 0 ${STAGE_PLOT_GRID_PATTERN_PERIOD}`}
                fill="none"
                stroke="rgba(255,255,255,0.042)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
        )}
        <rect width={STAGE_SVG_VIEW_W} height={STAGE_SVG_VIEW_H} fill="rgba(10,12,14,1)" />

        <rect
          x={lay.rx}
          y={lay.ry}
          width={lay.rectW}
          height={lay.rectH}
          fill={presentationMode ? "rgba(255,255,255,0.018)" : `url(#${patternId})`}
          stroke={presentationMode ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.1)"}
          strokeWidth={1}
          rx={3}
          className={placing ? "cursor-crosshair touch-manipulation" : undefined}
          onPointerDown={handlePlotPointerDown}
          {...(!presentationMode ? ulsdAuthoringGridSvg : {})}
        />

        {diagramPaintSequence.map((ref, paintIdx) => {
          const key = `${ref.kind}-${ref.id}`;
          if (ref.kind === "deck") {
            const poly = deckById.get(ref.id);
            if (!poly) return null;
            const idx = paintIdx;
            const isSynthetic = poly.id === SYNTHETIC_DECK_RECT_POLYGON_ID;
            const interactiveThis = interactiveUserDeckModules && !isSynthetic;
            const deckSelected = !isSynthetic && isDeckPolygonSelectedUi(poly.id);
            const fillAlpha = presentationMode
              ? 0.055 + (idx % 3) * 0.012
              : 0.09 + (idx % 5) * 0.017;
            const presentationDeckFill = `rgba(251,191,36,${0.055 + (idx % 3) * 0.012})`;
            const presentationDeckStroke = "rgba(251,191,36,0.4)";
            const exportDeckSnap =
              presentationMode
                ? null
                : {
                    [ULSD_PRESENTATION_DECK_FILL_ATTR]: presentationDeckFill,
                    [ULSD_PRESENTATION_DECK_STROKE_ATTR]: presentationDeckStroke,
                  };
            return (
              <polygon
                key={key}
                points={deckPolygonToSvgPoints(poly, bounds, lay)}
                fill={`rgba(251,191,36,${fillAlpha})`}
                stroke={
                  deckSelected && interactiveUserDeckModules
                    ? "rgba(96,165,250,0.92)"
                    : presentationMode
                      ? "rgba(251,191,36,0.4)"
                      : "rgba(251,191,36,0.55)"
                }
                strokeWidth={deckSelected && interactiveUserDeckModules ? 3 : 2}
                strokeLinejoin="round"
                {...(exportDeckSnap ?? {})}
                pointerEvents={interactiveThis ? ("visiblePainted" as const) : ("none" as const)}
                style={{
                  cursor: interactiveThis ? "grab" : undefined,
                  touchAction: interactiveThis ? "none" : undefined,
                }}
                onPointerDown={
                  interactiveThis && props.onDeckPolygonPointerDown
                    ? (e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        props.onDeckPolygonPointerDown!(poly.id, e);
                      }
                    : undefined
                }
              />
            );
          }
          if (ref.kind === "shape") {
            if (!showShapes) return null;
            const s = shapeById.get(ref.id);
            if (!s) return null;
            const segmentHits =
              !presentationMode &&
              props.authoringPolylineSegmentInsert &&
              props.authoringPolylineSegmentInsert.shape.id === s.id ? (
                <PolylineSegmentInsertHitLayer
                  shape={props.authoringPolylineSegmentInsert.shape}
                  bounds={bounds}
                  lay={lay}
                  onInsertAfterVertex={props.authoringPolylineSegmentInsert.onInsertAfterVertex}
                />
              ) : null;
            return (
              <Fragment key={key}>
                <ShapeDraw
                  shape={s}
                  bounds={bounds}
                  lay={lay}
                  interactive={Boolean(props.onShapePointerDown)}
                  selected={selectionChrome && isShapeSelectedUi(s.id)}
                  onPointerDown={
                    props.onShapePointerDown
                      ? (e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          props.onShapePointerDown!(s.id, e);
                        }
                      : undefined
                  }
                />
                {segmentHits}
              </Fragment>
            );
          }
          if (ref.kind === "placement") {
            if (!showPlacements) return null;
            const p = placementById.get(ref.id);
            if (!p) return null;
            const { sx, sy } = worldPlotPointToSvg(p.x, p.y, bounds, lay);
            return (
              <PlacementGlyph
                key={key}
                sx={sx}
                sy={sy}
                placement={p}
                lay={lay}
                unit={props.unit}
                interactive={Boolean(props.onPlacementPointerDown)}
                selected={selectionChrome && isPlacementSelectedUi(p.id)}
                onPointerDown={
                  props.onPlacementPointerDown
                    ? (e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        props.onPlacementPointerDown!(p.id, e);
                      }
                    : undefined
                }
              />
            );
          }
          return null;
        })}

        {!presentationMode &&
        props.authoringPolylineDraftWorld &&
        props.authoringPolylineDraftWorld.length >= 2 ? (
          <polyline
            fill="none"
            stroke="rgba(6,182,212,0.52)"
            strokeDasharray="5 4"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            pointerEvents="none"
            {...ulsdExportExcludeSvg}
            points={props.authoringPolylineDraftWorld
              .map((pt) => {
                const sp = worldPlotPointToSvg(pt.x, pt.y, bounds, lay);
                return `${sp.sx},${sp.sy}`;
              })
              .join(" ")}
          />
        ) : null}

        {!presentationMode && props.authoringSnapGuidesOverlay ? (
          <AuthoringSnapGuideLines bounds={bounds} lay={lay} overlay={props.authoringSnapGuidesOverlay} />
        ) : null}

        {showShapeResizeHandles && resizeShape && resizeShape.kind !== "TEXT" ? (
          <ShapeResizeHandles
            shape={resizeShape}
            bounds={bounds}
            lay={lay}
            onHandlePointerDown={(encoded, e) => {
              props.onShapeResizeHandlePointerDown?.(resizeShape.id, encoded, e);
            }}
          />
        ) : null}

        {resizeShape && props.showShapeRotateHandle && props.onShapeRotatePointerDown ? (
          <ShapeRotationThumb
            shape={resizeShape}
            bounds={bounds}
            lay={lay}
            onPointerDown={(e) => props.onShapeRotatePointerDown!(resizeShape.id, e)}
          />
        ) : null}

        {rotatePlacement && props.showPlacementRotateHandle && props.onPlacementRotatePointerDown ? (
          <PlacementRotationThumb
            placement={rotatePlacement}
            unit={props.unit}
            bounds={bounds}
            lay={lay}
            onPointerDown={(e) => props.onPlacementRotatePointerDown!(rotatePlacement.id, e)}
          />
        ) : null}

        {showDeckCorners && selectedDeckPoly ? (
          <DeckRectangleResizeHandles
            poly={selectedDeckPoly}
            bounds={bounds}
            lay={lay}
            onCornerDown={(corner, e) => props.onDeckResizeCornerPointerDown?.(selectedDeckPoly.id, corner, e)}
          />
        ) : null}
        </svg>
        </div>
      </div>
    </div>
  );
},
);

StageFootprintPreview.displayName = "StageFootprintPreview";
