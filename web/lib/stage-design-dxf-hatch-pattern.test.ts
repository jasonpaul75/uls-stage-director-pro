import { describe, expect, it } from "vitest";

import {
  generateDxfHatchPatternLineSegments,
  lookupBuiltinPatternLines,
  resolveImportedDxfHatchPattern,
} from "./stage-design-dxf-hatch-pattern";
import { parseDxfHatchBoundaryLoops } from "./stage-design-dxf-hatch";
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

describe("lookupBuiltinPatternLines", () => {
  it("resolves ANSI31 spacing", () => {
    const lines = lookupBuiltinPatternLines("ANSI31");
    expect(lines).not.toBeNull();
    expect(lines?.[0]?.angleDeg).toBe(45);
    expect(lines?.[0]?.offsetY).toBeCloseTo(0.125, 6);
  });
});

describe("generateDxfHatchPatternLineSegments", () => {
  const rect = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
    { x: 0, y: 5 },
  ];

  it("generates diagonal segments for ANSI31 inside a rectangle", () => {
    const pattern = resolveImportedDxfHatchPattern(null, "ANSI31", false);
    expect(pattern).not.toBeNull();
    const segs = generateDxfHatchPatternLineSegments(rect, pattern!);
    expect(segs.length).toBeGreaterThan(10);
    for (const seg of segs) {
      const dx = seg.x2 - seg.x1;
      const dy = seg.y2 - seg.y1;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      expect(Math.abs(Math.abs(angle) - 45)).toBeLessThan(1);
    }
  });

  it("returns no segments for solid fills", () => {
    const pattern = resolveImportedDxfHatchPattern(null, "ANSI31", true);
    expect(pattern).toBeNull();
  });
});

describe("parseDxfHatchBoundaryLoops pattern metadata", () => {
  it("parses explicit pattern line definitions from the entity tail", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfEntities(`
0
HATCH
100
AcDbHatch
2
USER1
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
52
0
41
2
78
1
53
45
43
0
44
0
45
0
46
0.125
79
0
`),
    );
    const start = pairs.findIndex((p) => p.code === 0 && p.value === "HATCH") + 1;
    const hat = parseDxfHatchBoundaryLoops(pairs, start);
    expect(hat.pattern).not.toBeNull();
    expect(hat.pattern?.lines).toHaveLength(1);
    expect(hat.pattern?.scale).toBeCloseTo(2, 6);
    const segs = generateDxfHatchPatternLineSegments(hat.loops[0]?.vertices ?? [], hat.pattern!);
    expect(segs.length).toBeGreaterThan(5);
  });
});

describe("importMinimalAsciiDxfEntities patterned HATCH", () => {
  it("imports ANSI31 HATCH with boundary fill tint and pattern LINE segments", () => {
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
    expect(r.importedCounts.hatchPatternLine).toBeGreaterThan(10);
    const poly = r.shapes.find((s) => s.kind === "POLYLINE");
    expect((poly as { fill?: string }).fill).toContain("rgba");
    const lines = r.shapes.filter((s) => s.kind === "LINE");
    expect(lines.length).toBe(r.importedCounts.hatchPatternLine);
    expect((lines[0] as { stroke?: string }).stroke).toContain("rgba");
  });

  it("does not emit pattern lines for solid HATCH", () => {
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
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.hatchPatternLine).toBe(0);
  });
});
