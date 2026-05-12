import { describe, expect, it } from "vitest";

import { rectangleDeckPolygonFromCorners, type StageDeckPolygon } from "@/lib/stage-design-canvas";
import {
  applyDeckAxisAlignedRectangleCornerResize,
  deckPolygonApproxAxisAlignedRectCorners,
  translateDeckPolygon,
} from "@/lib/stage-design-deck-resize";

describe("deckPolygonApproxAxisAlignedRectCorners", () => {
  it("returns corner map for axis-aligned rectangle polygon", () => {
    const poly = rectangleDeckPolygonFromCorners("id1", 1, 2, 5, 8);
    const info = deckPolygonApproxAxisAlignedRectCorners(poly);
    expect(info).not.toBeNull();
    expect(info!.xMin).toBeCloseTo(1);
    expect(info!.xMax).toBeCloseTo(5);
    expect(info!.yMin).toBeCloseTo(2);
    expect(info!.yMax).toBeCloseTo(8);
  });

  it("returns null for non-axis-aligned quad", () => {
    const poly: StageDeckPolygon = {
      id: "kite",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 1, y: 3 },
      ],
    };
    expect(deckPolygonApproxAxisAlignedRectCorners(poly)).toBeNull();
  });
});

describe("applyDeckAxisAlignedRectangleCornerResize", () => {
  it("shrinks/expands bbox from opposite anchor and cursor (dragging se)", () => {
    const base = rectangleDeckPolygonFromCorners("r", 0, 0, 4, 3);
    const next = applyDeckAxisAlignedRectangleCornerResize(base, "se", 6, -1);
    const info = deckPolygonApproxAxisAlignedRectCorners(next)!;
    expect(info.corners.nw.x).toBeCloseTo(0);
    expect(info.corners.nw.y).toBeCloseTo(-1);
    expect(info.corners.se.x).toBeCloseTo(6);
    expect(info.corners.se.y).toBeCloseTo(0);
    expect(info.corners.sw.x).toBeCloseTo(0);
    expect(info.corners.sw.y).toBeCloseTo(0);
  });
});

describe("translateDeckPolygon", () => {
  it("shifts all vertices", () => {
    const base = rectangleDeckPolygonFromCorners("r", 1, 1, 3, 5);
    const next = translateDeckPolygon(base, -0.5, 2);
    const info = deckPolygonApproxAxisAlignedRectCorners(next)!;
    expect(info.xMin).toBeCloseTo(0.5);
    expect(info.yMin).toBeCloseTo(3);
    expect(info.xMax).toBeCloseTo(2.5);
    expect(info.yMax).toBeCloseTo(7);
  });
});
