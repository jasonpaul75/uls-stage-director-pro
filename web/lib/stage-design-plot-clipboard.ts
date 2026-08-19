import type { StageDeckPolygon, StageDesignPlacement, StageDesignShape } from "./stage-design-canvas";

/** Tab-separated world X/Y for Excel / Sheets paste round-trip. */
export function formatDiagramWorldXYTabSeparated(wx: number, wy: number): string {
  return `${wx}\t${wy}`;
}

function parseDiagramAxisNumber(raw: string): number | null {
  const s = raw
    .trim()
    .replace(/[′'"]/g, "")
    .replace(/\s*m$/i, "")
    .trim();
  if (s.length === 0) return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

/**
 * Parse clipboard text copied from spreadsheets (tab, comma, semicolon, or whitespace columns).
 * Accepts optional unit suffixes on each axis (`′`, `m`).
 */
export function parseDiagramWorldXYClipboardText(raw: string): { x: number; y: number } | null {
  const t = raw.trim();
  if (t.length === 0) return null;
  const parts = t.split(/[\t,;]+|\s+/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length < 2) return null;
  const x = parseDiagramAxisNumber(parts[0]!);
  const y = parseDiagramAxisNumber(parts[1]!);
  if (x === null || y === null) return null;
  return { x, y };
}

export type DiagramSelectionCentroidInput = {
  selectedPlacementIds: ReadonlySet<string>;
  selectedShapeIds: ReadonlySet<string>;
  selectedDeckPolygonIds: ReadonlySet<string>;
  placements: readonly StageDesignPlacement[];
  shapes: readonly StageDesignShape[];
  deckPolygons: readonly StageDeckPolygon[];
  /** Synthetic deck rect is not user-selectable for paste moves. */
  syntheticDeckRectId: string;
};

/** Average anchor / vertex positions for the current diagram selection (paste pivot). */
export function computeDiagramSelectionCentroid(input: DiagramSelectionCentroidInput): { x: number; y: number } | null {
  const pts: { x: number; y: number }[] = [];
  for (const p of input.placements) {
    if (input.selectedPlacementIds.has(p.id)) pts.push({ x: p.x, y: p.y });
  }
  for (const s of input.shapes) {
    if (input.selectedShapeIds.has(s.id)) pts.push({ x: s.x, y: s.y });
  }
  for (const d of input.deckPolygons) {
    if (d.id === input.syntheticDeckRectId) continue;
    if (!input.selectedDeckPolygonIds.has(d.id)) continue;
    for (const v of d.points) pts.push({ x: v.x, y: v.y });
  }
  if (pts.length === 0) return null;
  const n = pts.length;
  return {
    x: pts.reduce((sum, p) => sum + p.x, 0) / n,
    y: pts.reduce((sum, p) => sum + p.y, 0) / n,
  };
}

export function diagramSelectionDeltaToTarget(
  centroid: { x: number; y: number },
  target: { x: number; y: number },
): { dx: number; dy: number } {
  return { dx: target.x - centroid.x, dy: target.y - centroid.y };
}
