import type {
  StageDeckPolygon,
  StageDesignPlotMargins,
  StageDesignPlacement,
  StageDesignShape,
  StageDiagramPaintRef,
} from "./stage-design-canvas";
import type { StageDiagramLayer } from "./stage-design-diagram-layers";

/** Callbacks from `ProducerStageDesignForm` so plot gestures coalesce undo (one step per drag) vs discrete edits. */
export type ProducerDiagramHistoryCallbacks = {
  beginContinuousDiagramGesture(): void;
  endContinuousDiagramGesture(): void;
  beforeDiscreteDiagramMutation(): void;
};

/** Full producer diagram form slices that undo/redo hydrate together (footprint derives from fw/fd/deck coupling in the form). */
export type StageDiagramHistorySnapshot = Readonly<{
  fw: number;
  fd: number;
  plotMargins: StageDesignPlotMargins;
  placements: StageDesignPlacement[];
  shapes: StageDesignShape[];
  deckPolygons: StageDeckPolygon[];
  diagramPaintOrder?: StageDiagramPaintRef[];
  diagramLayers?: StageDiagramLayer[];
}>;

/** Default cap (~2–8 MB typed JSON worst-case stays bounded vs unbounded snapshots). */
export const STAGE_DIAGRAM_MAX_UNDO = 52;

/** Deep clone for hydrate / stack storage (diagram client surfaces only — modern browsers support `structuredClone`). */
export function cloneStageDiagramSnapshot(s: StageDiagramHistorySnapshot): StageDiagramHistorySnapshot {
  return structuredClone(s) as StageDiagramHistorySnapshot;
}

export function snapshotsEqualDiagramHistory(a: StageDiagramHistorySnapshot, b: StageDiagramHistorySnapshot): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}
