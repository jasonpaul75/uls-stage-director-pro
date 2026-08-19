import { describe, expect, it } from "vitest";

import {
  computeDiagramSelectionCentroid,
  diagramSelectionDeltaToTarget,
  formatDiagramWorldXYTabSeparated,
  parseDiagramWorldXYClipboardText,
} from "./stage-design-plot-clipboard";

describe("formatDiagramWorldXYTabSeparated", () => {
  it("uses tab between axes", () => {
    expect(formatDiagramWorldXYTabSeparated(12.5, -3.25)).toBe("12.5\t-3.25");
  });
});

describe("parseDiagramWorldXYClipboardText", () => {
  it("parses tab-separated values", () => {
    expect(parseDiagramWorldXYClipboardText("12.5\t8")).toEqual({ x: 12.5, y: 8 });
  });

  it("parses comma-separated values", () => {
    expect(parseDiagramWorldXYClipboardText("4, 6.5")).toEqual({ x: 4, y: 6.5 });
  });

  it("strips feet and meter suffixes", () => {
    expect(parseDiagramWorldXYClipboardText("10′\t2.5 m")).toEqual({ x: 10, y: 2.5 });
  });

  it("rejects single-column paste", () => {
    expect(parseDiagramWorldXYClipboardText("12.5")).toBeNull();
  });
});

describe("computeDiagramSelectionCentroid", () => {
  it("averages selected placement anchors", () => {
    const c = computeDiagramSelectionCentroid({
      selectedPlacementIds: new Set(["a", "b"]),
      selectedShapeIds: new Set(),
      selectedDeckPolygonIds: new Set(),
      placements: [
        { id: "a", kind: "FIXTURE", x: 0, y: 0, rotationDeg: 0 },
        { id: "b", kind: "FIXTURE", x: 10, y: 20, rotationDeg: 0 },
      ],
      shapes: [],
      deckPolygons: [],
      syntheticDeckRectId: "syn",
    });
    expect(c).toEqual({ x: 5, y: 10 });
  });
});

describe("diagramSelectionDeltaToTarget", () => {
  it("returns translation from centroid to target", () => {
    expect(diagramSelectionDeltaToTarget({ x: 5, y: 10 }, { x: 8, y: 6 })).toEqual({ dx: 3, dy: -4 });
  });
});
