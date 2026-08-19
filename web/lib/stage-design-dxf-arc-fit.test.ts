import { describe, expect, it } from "vitest";

import { tessellateBulgeChordInclusive } from "./stage-design-dxf-bulge";
import {
  compressClosedPolylineForDxfExport,
  compressOpenPolylineForDxfExport,
  fitClosedCircularLoopFromVertices,
  fitOpenCircularArcFromVertices,
} from "./stage-design-dxf-arc-fit";

describe("fitOpenCircularArcFromVertices", () => {
  it("recovers quarter-circle ARC parameters from tessellated vertices", () => {
    const verts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 12; i++) {
      const ang = (Math.PI / 2) * (i / 12);
      verts.push({ x: 10 * Math.cos(ang), y: 10 * Math.sin(ang) });
    }
    const fit = fitOpenCircularArcFromVertices(verts);
    expect(fit).not.toBeNull();
    expect(fit!.cx).toBeCloseTo(0, 4);
    expect(fit!.cy).toBeCloseTo(0, 4);
    expect(fit!.r).toBeCloseTo(10, 4);
    expect(fit!.startDeg).toBeCloseTo(0, 3);
    expect(fit!.endDeg).toBeCloseTo(90, 3);
  });

  it("returns null for straight segments", () => {
    expect(
      fitOpenCircularArcFromVertices([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toBeNull();
  });
});

describe("compressOpenPolylineForDxfExport", () => {
  it("collapses a tessellated quarter arc to one chord + bulge", () => {
    const b = Math.tan(Math.PI / 8);
    const arcPts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 16; i++) {
      const ang = (Math.PI / 2) * (i / 16);
      arcPts.push({ x: 10 * Math.cos(ang), y: 10 * Math.sin(ang) });
    }
    const compressed = compressOpenPolylineForDxfExport(arcPts);
    expect(compressed.vertices).toHaveLength(2);
    expect(compressed.vertices[0]?.x).toBeCloseTo(10, 4);
    expect(compressed.vertices[0]?.y).toBeCloseTo(0, 4);
    expect(compressed.vertices[1]?.x).toBeCloseTo(0, 4);
    expect(compressed.vertices[1]?.y).toBeCloseTo(10, 4);
    expect(compressed.bulgesOut[0]).toBeCloseTo(b, 5);
  });

  it("keeps straight runs as zero bulge", () => {
    const compressed = compressOpenPolylineForDxfExport([
      { x: 0, y: 0 },
      { x: 4, y: 0 },
      { x: 9, y: 0 },
    ]);
    expect(compressed.vertices).toHaveLength(2);
    expect(compressed.bulgesOut[0]).toBe(0);
  });

  it("compresses line + arc mixed paths", () => {
    const b = Math.tan(Math.PI / 8);
    const arcPts = tessellateBulgeChordInclusive(20, 0, 20, 5, b, 12);
    const mixed = [{ x: 0, y: 0 }, { x: 20, y: 0 }, ...arcPts.slice(1)];
    const compressed = compressOpenPolylineForDxfExport(mixed);
    expect(compressed.vertices).toHaveLength(3);
    expect(compressed.vertices[0]).toEqual({ x: 0, y: 0 });
    expect(compressed.vertices[1]).toEqual({ x: 20, y: 0 });
    expect(compressed.vertices[2]?.x).toBeCloseTo(20, 4);
    expect(compressed.vertices[2]?.y).toBeCloseTo(5, 4);
    expect(compressed.bulgesOut[0]).toBe(0);
    expect(compressed.bulgesOut[1]).toBeCloseTo(b, 5);
  });
});

describe("fitClosedCircularLoopFromVertices", () => {
  it("detects tessellated full circles", () => {
    const ring: { x: number; y: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const ang = (2 * Math.PI * i) / 16;
      ring.push({ x: 5 + 8 * Math.cos(ang), y: -2 + 8 * Math.sin(ang) });
    }
    const fit = fitClosedCircularLoopFromVertices(ring);
    expect(fit).not.toBeNull();
    expect(fit!.cx).toBeCloseTo(5, 4);
    expect(fit!.cy).toBeCloseTo(-2, 4);
    expect(fit!.r).toBeCloseTo(8, 4);
  });

  it("returns null for semicircular arcs", () => {
    const ring: { x: number; y: number }[] = [];
    for (let i = 0; i <= 12; i++) {
      const ang = Math.PI * (i / 12);
      ring.push({ x: 10 * Math.cos(ang), y: 10 * Math.sin(ang) });
    }
    expect(fitClosedCircularLoopFromVertices(ring)).toBeNull();
  });
});

describe("compressClosedPolylineForDxfExport", () => {
  it("collapses a tessellated quarter ring to one vertex + bulge per corner", () => {
    const b = Math.tan(Math.PI / 8);
    const arcPts: { x: number; y: number }[] = [];
    for (let i = 0; i <= 16; i++) {
      const ang = (Math.PI / 2) * (i / 16);
      arcPts.push({ x: 10 * Math.cos(ang), y: 10 * Math.sin(ang) });
    }
    const closed = [...arcPts, arcPts[0]!];
    const compressed = compressClosedPolylineForDxfExport(closed);
    expect(compressed.vertices.length).toBeGreaterThanOrEqual(2);
    expect(compressed.bulgesOut.length).toBe(compressed.vertices.length);
    expect(compressed.bulgesOut.some((bulge) => Math.abs(bulge - b) < 1e-4)).toBe(true);
  });

  it("keeps axis-aligned rectangles as four straight edges", () => {
    const compressed = compressClosedPolylineForDxfExport([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ]);
    expect(compressed.vertices).toHaveLength(4);
    expect(compressed.bulgesOut.every((b) => b === 0)).toBe(true);
  });
});
