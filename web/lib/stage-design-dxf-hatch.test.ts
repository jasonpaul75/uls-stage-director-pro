import { describe, expect, it } from "vitest";

import { appendDxfSolidHatchPolylineBoundary, parseDxfHatchBoundaryLoops } from "./stage-design-dxf-hatch";
import { parseDxfAsciiPairs, importMinimalAsciiDxfEntities } from "./stage-design-dxf-import";

function minimalDxfEntities(body: string): string {
  return [
    "0",
    "SECTION",
    "2",
    "HEADER",
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    body.trim(),
    "0",
    "ENDSEC",
    "0",
    "EOF",
    "",
  ].join("\r\n");
}

describe("parseDxfHatchBoundaryLoops", () => {
  it("parses a polyline hatch boundary rectangle", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfEntities(`
0
HATCH
100
AcDbHatch
10
0
20
0
70
1
91
1
92
6
72
1
73
1
93
4
10
0
20
0
42
0
10
10
20
0
42
0
10
10
20
5
42
0
10
0
20
5
42
0
`),
    );
    const start = pairs.findIndex((p) => p.code === 0 && p.value === "HATCH") + 1;
    const hat = parseDxfHatchBoundaryLoops(pairs, start);
    expect(hat.solidFill).toBe(true);
    expect(hat.loops).toHaveLength(1);
    expect(hat.loops[0]?.vertices.length).toBeGreaterThanOrEqual(4);
    expect(hat.loops[0]?.vertices[0]).toEqual({ x: 0, y: 0 });
  });

  it("parses line-edge hatch boundaries into a closed loop", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfEntities(`
0
HATCH
100
AcDbHatch
70
1
91
1
92
2
93
4
72
1
10
2
20
3
11
12
21
3
72
1
10
12
20
3
11
12
21
8
72
1
10
12
20
8
11
2
21
8
72
1
10
2
20
8
11
2
21
3
`),
    );
    const start = pairs.findIndex((p) => p.code === 0 && p.value === "HATCH") + 1;
    const hat = parseDxfHatchBoundaryLoops(pairs, start);
    expect(hat.loops).toHaveLength(1);
    const verts = hat.loops[0]?.vertices ?? [];
    expect(verts.length).toBeGreaterThanOrEqual(4);
    expect(verts[0]?.x).toBeCloseTo(2, 4);
    expect(verts[0]?.y).toBeCloseTo(3, 4);
    expect(verts.some((v) => Math.abs(v.x - 12) < 0.01 && Math.abs(v.y - 8) < 0.01)).toBe(true);
  });

  it("parses arc-edge hatch boundaries with tessellated arc segments", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfEntities(`
0
HATCH
100
AcDbHatch
70
1
91
1
92
2
93
2
72
1
10
0
20
0
11
10
21
0
72
2
10
5
20
0
40
5
50
180
51
0
73
1
`),
    );
    const start = pairs.findIndex((p) => p.code === 0 && p.value === "HATCH") + 1;
    const hat = parseDxfHatchBoundaryLoops(pairs, start);
    expect(hat.loops).toHaveLength(1);
    const verts = hat.loops[0]?.vertices ?? [];
    expect(verts.length).toBeGreaterThan(4);
    expect(verts[0]?.x).toBeCloseTo(0, 3);
    expect(verts[0]?.y).toBeCloseTo(0, 3);
    expect(verts.at(-1)?.x).toBeCloseTo(10, 3);
    expect(verts.at(-1)?.y).toBeCloseTo(0, 3);
  });

  it("parses elliptic-arc hatch edges", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfEntities(`
0
HATCH
100
AcDbHatch
70
1
91
1
92
2
93
2
72
1
10
0
20
0
11
10
21
0
72
3
10
5
20
0
11
5
21
0
40
0.5
50
0
51
180
73
1
`),
    );
    const start = pairs.findIndex((p) => p.code === 0 && p.value === "HATCH") + 1;
    const hat = parseDxfHatchBoundaryLoops(pairs, start);
    expect(hat.loops).toHaveLength(1);
    const verts = hat.loops[0]?.vertices ?? [];
    expect(verts.length).toBeGreaterThan(4);
    expect(verts[0]?.x).toBeCloseTo(0, 3);
    expect(verts.some((v) => v.y > 0.5)).toBe(true);
    expect(verts.some((v) => Math.abs(v.x - 10) < 0.01)).toBe(true);
  });

  it("parses spline-edge hatch boundaries via fit points", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfEntities(`
0
HATCH
100
AcDbHatch
70
1
91
1
92
2
93
1
72
4
94
3
73
0
75
0
97
3
11
0
21
0
11
10
21
0
11
10
21
8
`),
    );
    const start = pairs.findIndex((p) => p.code === 0 && p.value === "HATCH") + 1;
    const hat = parseDxfHatchBoundaryLoops(pairs, start);
    expect(hat.loops).toHaveLength(1);
    const verts = hat.loops[0]?.vertices ?? [];
    expect(verts.length).toBeGreaterThanOrEqual(3);
    expect(verts[0]).toEqual({ x: 0, y: 0 });
    expect(verts.at(-1)?.y).toBeCloseTo(8, 3);
  });

  it("captures patterned hatch names from group code 2", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfEntities(`
0
HATCH
100
AcDbHatch
2
ANSI31
70
0
91
1
92
6
72
1
73
1
93
4
10
0
20
0
42
0
10
10
20
0
42
0
10
10
20
5
42
0
10
0
20
5
42
0
`),
    );
    const start = pairs.findIndex((p) => p.code === 0 && p.value === "HATCH") + 1;
    const hat = parseDxfHatchBoundaryLoops(pairs, start);
    expect(hat.patternName).toBe("ANSI31");
    expect(hat.solidFill).toBe(false);
  });
});

describe("appendDxfSolidHatchPolylineBoundary", () => {
  it("emits solid HATCH with polyline boundary flags", () => {
    const o: string[] = [];
    appendDxfSolidHatchPolylineBoundary(
      o,
      "L",
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 5 },
        { x: 0, y: 5 },
      ],
    );
    const s = o.join("\n");
    expect(s).toContain("HATCH");
    expect(s).toContain("SOLID");
    expect(s).toContain("\n70\n1\n");
    expect(s).toContain("\n92\n6\n");
  });

  it("round-trips through importMinimalAsciiDxfEntities", () => {
    const o: string[] = [];
    appendDxfSolidHatchPolylineBoundary(
      o,
      "ULSD_SHAPE",
      [
        { x: 2, y: 3 },
        { x: 12, y: 3 },
        { x: 12, y: 8 },
        { x: 2, y: 8 },
      ],
    );
    const src = minimalDxfEntities(o.join("\r\n"));
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.hatch).toBe(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
    expect((r.shapes[0] as { fill?: string }).fill).toContain("rgba");
  });
});

describe("importMinimalAsciiDxfEntities HATCH", () => {
  it("imports solid HATCH as closed POLYLINE with default fill", () => {
    const src = minimalDxfEntities(`
0
HATCH
100
AcDbHatch
10
0
20
0
70
1
91
1
92
6
72
1
73
1
93
4
10
2
20
3
42
0
10
12
20
3
42
0
10
12
20
8
42
0
10
2
20
8
42
0
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.hatch).toBe(1);
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
    expect((r.shapes[0] as { fill?: string }).fill).toContain("rgba");
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts[0]?.x).toBeCloseTo(2, 4);
    expect(verts[0]?.y).toBeCloseTo(3, 4);
  });

  it("imports line-edge HATCH boundaries as closed POLYLINE with fill", () => {
    const src = minimalDxfEntities(`
0
HATCH
100
AcDbHatch
70
1
91
1
92
2
93
4
72
1
10
2
20
3
11
12
21
3
72
1
10
12
20
3
11
12
21
8
72
1
10
12
20
8
11
2
21
8
72
1
10
2
20
8
11
2
21
3
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.hatch).toBe(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
    expect((r.shapes[0] as { fill?: string }).fill).toContain("rgba");
  });

  it("imports patterned HATCH boundaries with light fill and pattern lines", () => {
    const src = minimalDxfEntities(`
0
HATCH
100
AcDbHatch
2
ANSI31
70
0
91
1
92
6
72
1
73
1
93
4
10
0
20
0
42
0
10
10
20
0
42
0
10
10
20
5
42
0
10
0
20
5
42
0
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 200 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.hatch).toBe(1);
    expect(r.importedCounts.hatchPatternLine).toBeGreaterThan(0);
    expect((r.shapes[0] as { fill?: string }).fill).toContain("rgba");
  });

  it("imports elliptic-edge HATCH boundaries as closed POLYLINE", () => {
    const src = minimalDxfEntities(`
0
HATCH
100
AcDbHatch
70
1
91
1
92
2
93
2
72
1
10
0
20
0
11
10
21
0
72
3
10
5
20
0
11
5
21
0
40
0.5
50
0
51
180
73
1
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.hatch).toBe(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
    expect((r.shapes[0] as { fill?: string }).fill).toContain("rgba");
  });
});
