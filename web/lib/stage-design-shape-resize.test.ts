import { describe, expect, it } from "vitest";

import { applyShapeResize, encodePolylineVertexResize } from "@/lib/stage-design-shape-resize";

describe("polyline vertex resize", () => {
  const baseline = {
    id: "pl",
    kind: "POLYLINE" as const,
    x: 0,
    y: 0,
    vertices: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
    ],
    label: "Cable",
  };

  it("encodePolylineVertexResize floors index", () => {
    expect(encodePolylineVertexResize(2)).toBe("POLYLINE:2");
    expect(encodePolylineVertexResize(2.9)).toBe("POLYLINE:2");
  });

  it("applyShapeResize moves only the dragged vertex", () => {
    const enc = encodePolylineVertexResize(1);
    const next = applyShapeResize(baseline, enc, 10, 4);
    expect(next.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 4 },
      { x: 10, y: 8 },
    ]);
    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
  });

  it("applyShapeResize updates anchor x,y when first vertex moves", () => {
    const next = applyShapeResize(baseline, encodePolylineVertexResize(0), -2, -1);
    expect(next.vertices?.[0]).toEqual({ x: -2, y: -1 });
    expect(next.x).toBe(-2);
    expect(next.y).toBe(-1);
  });
});
