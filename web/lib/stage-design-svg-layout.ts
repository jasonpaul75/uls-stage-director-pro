import {
  getPlotBounds,
  getPlotBoundsFromCanvas,
  type PlotWorldBounds,
  type StageDeckPolygon,
  type StageDesignCanvas,
  type StageDesignFootprint,
  type StageDesignPlotMargins,
} from "@/lib/stage-design-canvas";

/** Stage plot SVG coordinate system (passed to `<svg viewBox>`). */
/** Wider view box so the inscribed plot fills more horizontal space in the rounded tile on typical stage aspect ratios. */
export const STAGE_SVG_VIEW_W = 540;
/** Taller canvas so wide FOH/wing plots retain readable deck height after aspect fit. */
export const STAGE_SVG_VIEW_H = 300;

/** Grid pattern period in SVG user units (producer authoring). Director presentation skips the overlay grid. */
export const STAGE_PLOT_GRID_PATTERN_PERIOD = 10;

/** Minimal inset; the gridded plot is as large as possible while staying inside the view box. */
export const STAGE_DRAW_INNER_PAD = 5;
/** Max inscribed box for the plotted world (preserves world aspect → may letterbox inside this box). */
export const STAGE_DRAW_INNER_MAX_W = STAGE_SVG_VIEW_W - STAGE_DRAW_INNER_PAD * 2;
export const STAGE_DRAW_INNER_MAX_H = STAGE_SVG_VIEW_H - STAGE_DRAW_INNER_PAD * 2;

/** Legacy: fitted stage-only rect (plot = deck). */
export type FootprintViewLayout = {
  rx: number;
  ry: number;
  rectW: number;
  rectH: number;
};

/** Full plot bounds in SVG user space (inside {@link STAGE_SVG_VIEW_W}×{@link STAGE_SVG_VIEW_H} view box). */
export type PlotViewLayout = FootprintViewLayout & {
  bounds: PlotWorldBounds;
  worldW: number;
  worldH: number;
};

export function plotViewLayout(bounds: PlotWorldBounds): PlotViewLayout {
  const worldW = Math.max(1e-6, bounds.maxX - bounds.minX);
  const worldH = Math.max(1e-6, bounds.maxY - bounds.minY);
  const aspect = worldW / worldH;
  const maxW = STAGE_DRAW_INNER_MAX_W;
  const maxH = STAGE_DRAW_INNER_MAX_H;
  let rectW: number;
  let rectH: number;
  if (aspect > maxW / maxH) {
    rectW = maxW;
    rectH = maxW / aspect;
  } else {
    rectH = maxH;
    rectW = maxH * aspect;
  }
  /** Center the aspect-fitted plot inside the drawable area (bands appear when world aspect ≠ box aspect). */
  const rx = STAGE_DRAW_INNER_PAD + (maxW - rectW) / 2;
  const ry = STAGE_DRAW_INNER_PAD + (maxH - rectH) / 2;
  return { rx, ry, rectW, rectH, bounds, worldW, worldH };
}

/** Plot layout from deck polygons (or legacy rectangular deck) plus margins. */
export function plotLayoutForCanvas(
  canvas: Pick<StageDesignCanvas, "footprint" | "deckPolygons">,
  margins: StageDesignPlotMargins,
): { bounds: PlotWorldBounds; lay: PlotViewLayout } {
  const bounds = getPlotBoundsFromCanvas(canvas, margins);
  return { bounds, lay: plotViewLayout(bounds) };
}

/** Deck-only layout (margins zero width): same numeric box as legacy footprint helper. */
export function footprintViewLayoutForMargins(
  footprint: StageDesignFootprint,
  margins: StageDesignPlotMargins,
): PlotViewLayout {
  return plotLayoutForCanvas({ footprint, deckPolygons: undefined }, margins).lay;
}

/** @deprecated Use {@link footprintViewLayoutForMargins} with zero margins for tests. */
export function footprintViewLayout(footprint: StageDesignFootprint): FootprintViewLayout {
  const z: StageDesignPlotMargins = { downstage: 0, upstage: 0, stageLeft: 0, stageRight: 0 };
  const p = plotViewLayout(getPlotBounds(footprint, z));
  return { rx: p.rx, ry: p.ry, rectW: p.rectW, rectH: p.rectH };
}

export function worldPlotPointToSvg(
  wx: number,
  wy: number,
  bounds: PlotWorldBounds,
  lay: PlotViewLayout,
): { sx: number; sy: number } {
  const tX = (wx - bounds.minX) / lay.worldW;
  const tY = (wy - bounds.minY) / lay.worldH;
  const sx = lay.rx + tX * lay.rectW;
  /** minY (downstage front / FOH) maps to bottom of plot rect in SVG. */
  const sy = lay.ry + lay.rectH - tY * lay.rectH;
  return { sx, sy };
}

export function svgPlotPointToWorld(sx: number, sy: number, lay: PlotViewLayout): { wx: number; wy: number } | null {
  const relX = sx - lay.rx;
  const relY = sy - lay.ry;
  const eps = Math.max(1e-9, Math.max(lay.rectW, lay.rectH) * 1e-14);
  if (relX < -eps || relY < -eps || relX > lay.rectW + eps || relY > lay.rectH + eps) return null;
  const qx = Math.min(lay.rectW, Math.max(0, relX));
  const qy = Math.min(lay.rectH, Math.max(0, relY));
  const { bounds } = lay;
  const wx = bounds.minX + (qx / lay.rectW) * lay.worldW;
  const wy = bounds.minY + ((lay.rectH - qy) / lay.rectH) * lay.worldH;
  return { wx, wy };
}

/** Stage deck corners in SVG (for drawing the amber deck inside the plot). */
export function stageDeckSvgRect(
  footprint: StageDesignFootprint,
  bounds: PlotWorldBounds,
  lay: PlotViewLayout,
): { x: number; y: number; w: number; h: number } {
  const p00 = worldPlotPointToSvg(0, 0, bounds, lay);
  const p11 = worldPlotPointToSvg(footprint.width, footprint.depth, bounds, lay);
  const x = Math.min(p00.sx, p11.sx);
  const y = Math.min(p00.sy, p11.sy);
  const w = Math.abs(p11.sx - p00.sx);
  const h = Math.abs(p11.sy - p00.sy);
  return { x, y, w, h };
}

/** @deprecated Legacy deck-only mapping. Layout arg is ignored — kept for call-site compatibility. */
export function worldFootprintPointToSvg(
  wx: number,
  wy: number,
  footprint: StageDesignFootprint,
  lay: FootprintViewLayout,
): { sx: number; sy: number } {
  void lay;
  const z: StageDesignPlotMargins = { downstage: 0, upstage: 0, stageLeft: 0, stageRight: 0 };
  const b = getPlotBounds(footprint, z);
  const pl = plotViewLayout(b);
  return worldPlotPointToSvg(wx, wy, b, pl);
}

export function svgScreenPointToPlotWorld(
  svg: SVGSVGElement,
  screenX: number,
  screenY: number,
  lay: PlotViewLayout,
): { wx: number; wy: number } | null {
  const pt = svg.createSVGPoint();
  pt.x = screenX;
  pt.y = screenY;
  const m = svg.getScreenCTM();
  if (!m) return null;
  const c = pt.matrixTransform(m.inverse());
  return svgPlotPointToWorld(c.x, c.y, lay);
}

/**
 * Uniform-ish scale: SVG units per one world unit (ft or m) using the tighter plot axis so
 * round markers stay circular when the plot is anisotropic.
 */
export function plotMinUniformScale(lay: PlotViewLayout): number {
  return Math.min(lay.rectW / lay.worldW, lay.rectH / lay.worldH);
}

export function plotLayoutForFootprint(
  footprint: StageDesignFootprint,
  margins: StageDesignPlotMargins,
): { bounds: PlotWorldBounds; lay: PlotViewLayout } {
  return plotLayoutForCanvas({ footprint, deckPolygons: undefined }, margins);
}

/** SVG `points="…"` attribute for one deck polygon (plot → SVG userspace). */
export function deckPolygonToSvgPoints(
  polygon: StageDeckPolygon,
  bounds: PlotWorldBounds,
  lay: PlotViewLayout,
): string {
  return polygon.points
    .map((pt) => {
      const { sx, sy } = worldPlotPointToSvg(pt.x, pt.y, bounds, lay);
      return `${sx},${sy}`;
    })
    .join(" ");
}

/** @deprecated Legacy deck-only inverse. Layout arg is ignored — kept for call-site compatibility. */
export function svgFootprintPointToWorld(
  sx: number,
  sy: number,
  footprint: StageDesignFootprint,
  lay: FootprintViewLayout,
): { wx: number; wy: number } | null {
  void lay;
  const z: StageDesignPlotMargins = { downstage: 0, upstage: 0, stageLeft: 0, stageRight: 0 };
  const b = getPlotBounds(footprint, z);
  const pl = plotViewLayout(b);
  return svgPlotPointToWorld(sx, sy, pl);
}
