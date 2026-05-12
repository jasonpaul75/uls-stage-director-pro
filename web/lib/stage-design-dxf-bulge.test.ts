import { describe, expect, it } from "vitest";

import { expandVerticesWithBulges, tessellateBulgeChordInclusive } from "./stage-design-dxf-bulge";

describe("tessellateBulgeChordInclusive", () => {
  it("returns a two-point chord when bulge is zero", () => {
    const pts = tessellateBulgeChordInclusive(0, 0, 10, 0, 0);
    expect(pts).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("approximates a 90° arc with bulge tan(π/8) from (1,0) to (0,1)", () => {
    const b = Math.tan(Math.PI / 8);
    const pts = tessellateBulgeChordInclusive(1, 0, 0, 1, b, 32);
    expect(pts.length).toBeGreaterThan(4);
    const mid = pts[Math.floor(pts.length / 2)]!;
    expect(mid.x).toBeGreaterThan(0.45);
    expect(mid.x).toBeLessThan(0.85);
    expect(mid.y).toBeGreaterThan(0.45);
    expect(mid.y).toBeLessThan(0.85);
    expect(Math.hypot(mid.x, mid.y)).toBeGreaterThan(0.95);
    expect(Math.hypot(mid.x, mid.y)).toBeLessThan(1.05);
    const last = pts[pts.length - 1]!;
    expect(last.x).toBeCloseTo(0, 5);
    expect(last.y).toBeCloseTo(1, 5);
  });

  it("handles a vertical semicircle chord (bulge = 1)", () => {
    const pts = tessellateBulgeChordInclusive(0, 1, 0, -1, 1, 32);
    expect(pts.length).toBeGreaterThan(8);
    const apex = pts.reduce(
      (best, p) => (Math.abs(p.x) > Math.abs(best.x) ? p : best),
      pts[0]!,
    );
    expect(Math.abs(apex.x)).toBeGreaterThan(0.9);
    expect(apex.y).toBeCloseTo(0, 1);
  });
});

describe("expandVerticesWithBulges", () => {
  it("chains two bulge arcs on an open polyline", () => {
    const b = Math.tan(Math.PI / 8);
    const expanded = expandVerticesWithBulges(
      [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
      ],
      [b, b],
      false,
    );
    expect(expanded.length).toBeGreaterThan(6);
    expect(expanded[0]).toEqual({ x: 1, y: 0 });
    expect(expanded[expanded.length - 1]).toEqual({ x: -1, y: 0 });
  });
});
