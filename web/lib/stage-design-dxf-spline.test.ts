import { describe, expect, it } from "vitest";

import {
  appendDxfSplineFitPointsWorld,
  buildClampedUniformKnots,
  shouldExportPolylineAsSpline,
  tessellateDxfSplineToVertices,
} from "./stage-design-dxf-spline";

describe("buildClampedUniformKnots", () => {
  it("builds a clamped open knot vector", () => {
    expect(buildClampedUniformKnots(4, 3)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });
});

describe("tessellateDxfSplineToVertices", () => {
  it("uses fit points when provided", () => {
    const pts = tessellateDxfSplineToVertices({
      controlPoints: [],
      fitPoints: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
      ],
      knots: [],
      weights: [],
      degree: 3,
      closed: false,
      rational: false,
    });
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[2]).toEqual({ x: 10, y: 5 });
  });

  it("closes fit-point loops when flagged closed", () => {
    const pts = tessellateDxfSplineToVertices({
      controlPoints: [],
      fitPoints: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 3 },
      ],
      knots: [],
      weights: [],
      degree: 3,
      closed: true,
      rational: false,
    });
    expect(pts[pts.length - 1]).toEqual({ x: 0, y: 0 });
  });

  it("samples a cubic control-point spline with multiple segments", () => {
    const pts = tessellateDxfSplineToVertices({
      controlPoints: [
        { x: 0, y: 0 },
        { x: 4, y: 8 },
        { x: 8, y: 8 },
        { x: 12, y: 0 },
      ],
      fitPoints: [],
      knots: buildClampedUniformKnots(4, 3),
      weights: [],
      degree: 3,
      closed: false,
      rational: false,
      maxSegments: 16,
    });
    expect(pts.length).toBeGreaterThan(4);
    expect(pts[0]?.x).toBeCloseTo(0, 4);
    expect(pts[0]?.y).toBeCloseTo(0, 4);
    expect(pts[pts.length - 1]?.x).toBeCloseTo(12, 4);
    expect(pts[pts.length - 1]?.y).toBeCloseTo(0, 4);
  });
});

describe("appendDxfSplineFitPointsWorld", () => {
  it("emits fit-point SPLINE with planar flags and degree", () => {
    const o: string[] = [];
    appendDxfSplineFitPointsWorld(
      o,
      "L",
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      false,
    );
    const s = o.join("\n");
    expect(s).toContain("SPLINE");
    expect(s).toContain("AcDbSpline");
    expect(s).toContain("\n70\n8\n");
    expect(s).toContain("\n74\n");
    expect(s).toContain("\n91\n3\n");
    expect(s).toContain("\n11\n");
    expect(s).toContain("\n21\n");
  });
});

describe("shouldExportPolylineAsSpline", () => {
  it("prefers spline for dense vertex paths without bulge compression", () => {
    const ring: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const ang = (2 * Math.PI * i) / 8;
      ring.push({ x: 3 + 2 * Math.cos(ang), y: 1 + 2 * Math.sin(ang) });
    }
    expect(
      shouldExportPolylineAsSpline(ring, { vertices: ring, bulgesOut: ring.map(() => 0) }),
    ).toBe(true);
  });

  it("keeps compact bulge polylines on LWPOLYLINE", () => {
    const verts = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
    ];
    expect(
      shouldExportPolylineAsSpline(verts, {
        vertices: verts.slice(0, 2),
        bulgesOut: [Math.tan(Math.PI / 8)],
      }),
    ).toBe(false);
  });
});
