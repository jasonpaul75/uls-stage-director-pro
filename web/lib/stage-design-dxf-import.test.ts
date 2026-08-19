import { describe, expect, it } from "vitest";

import {
  formatDxfImportEntitySummary,
  importMinimalAsciiDxfEntities,
  parseDxfAsciiPairs,
} from "./stage-design-dxf-import";

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

function minimalDxfWithBlocks(blocksBody: string, entitiesBody: string): string {
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
    "BLOCKS",
    blocksBody.trim(),
    "0",
    "ENDSEC",
    "0",
    "SECTION",
    "2",
    "ENTITIES",
    entitiesBody.trim(),
    "0",
    "ENDSEC",
    "0",
    "EOF",
    "",
  ].join("\r\n");
}

describe("parseDxfAsciiPairs", () => {
  it("pairs CRLF lines", () => {
    const pairs = parseDxfAsciiPairs("10\r\n5\r\n20\r\n7\r\n");
    expect(pairs).toEqual([
      { code: 10, value: "5" },
      { code: 20, value: "7" },
    ]);
  });
});

describe("importMinimalAsciiDxfEntities", () => {
  it("imports LINE CIRCLE TEXT", () => {
    const src = minimalDxfEntities(`
0
LINE
10
1
20
2
30
0
11
11
21
22
31
0
0
CIRCLE
10
5
20
6
40
3
0
TEXT
10
9
20
8
40
0.5
50
1.0471975511965976
1
Hello
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(3);
    expect(r.shapes[0]).toMatchObject({
      kind: "LINE",
      x: 1,
      y: 2,
      x2: 11,
      y2: 22,
    });
    expect(r.shapes[1]).toMatchObject({
      kind: "ELLIPSE",
      x: 5,
      y: 6,
      width: 3,
      height: 3,
    });
    expect(r.shapes[2]).toMatchObject({
      kind: "TEXT",
      x: 9,
      y: 8,
      label: "Hello",
      rotationDeg: 60,
    });
    expect(r.importedCounts).toEqual({
      line: 1,
      circle: 1,
      arc: 0,
      ellipse: 0,
      ellipseArc: 0,
      text: 1,
      mtext: 0,
      lwPolyline: 0,
      polyline: 0,
      spline: 0,
      insert: 0,
      hatch: 0,
      hatchPatternLine: 0,
      face: 0,
      dimension: 0,
      leader: 0,
      wipeout: 0,
      constructionLine: 0,
      attrib: 0,
      polyface: 0,
    });
  });

  it("imports ARC as tessellated open POLYLINE (degrees on 50/51)", () => {
    const src = minimalDxfEntities(`
0
ARC
10
0
20
0
40
10
50
0
51
90
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
    expect(r.importedCounts.arc).toBe(1);
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts.length).toBeGreaterThan(3);
    expect(verts[0]?.x).toBeCloseTo(10, 5);
    expect(verts[0]?.y).toBeCloseTo(0, 5);
    expect(verts[verts.length - 1]?.x).toBeCloseTo(0, 5);
    expect(verts[verts.length - 1]?.y).toBeCloseTo(10, 5);
  });

  it("imports full DXF ELLIPSE as diagram ELLIPSE shape", () => {
    const src = minimalDxfEntities(`
0
ELLIPSE
100
AcDbEntity
8
0
100
AcDbEllipse
10
5
20
-3
30
0
11
6
21
0
31
0
40
0.333333
41
0
42
6.283185307179586
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]).toMatchObject({
      kind: "ELLIPSE",
      x: 5,
      y: -3,
      width: 6,
      rotationDeg: 0,
    });
    expect((r.shapes[0] as { height?: number }).height).toBeCloseTo(2, 5);
    expect(r.importedCounts.ellipse).toBe(1);
  });

  it("imports partial DXF ELLIPSE arc as open POLYLINE", () => {
    const src = minimalDxfEntities(`
0
ELLIPSE
100
AcDbEntity
8
0
100
AcDbEllipse
10
0
20
0
30
0
11
10
21
0
31
0
40
0.5
41
0
42
1.5707963267948966
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
    expect(r.importedCounts.ellipseArc).toBe(1);
    expect(r.importedCounts.ellipse).toBe(0);
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts.length).toBeGreaterThan(2);
    expect(verts[0]?.x).toBeCloseTo(10, 4);
    expect(verts[0]?.y).toBeCloseTo(0, 4);
    expect(verts[verts.length - 1]?.x).toBeCloseTo(0, 4);
    expect(verts[verts.length - 1]?.y).toBeCloseTo(5, 4);
  });

  it("imports MTEXT as TEXT with ordered chunks and stripped markup", () => {
    const src = minimalDxfEntities(`
0
MTEXT
10
9
20
8
40
0.5
50
1.0471975511965976
1
{\\fArial|b0|i0;
3
Hello\\PWorld}
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]).toMatchObject({
      kind: "TEXT",
      x: 9,
      y: 8,
      label: "Hello\nWorld",
      rotationDeg: 60,
    });
    expect(r.importedCounts.mtext).toBe(1);
  });

  it("imports MTEXT preserving tab columns between paragraphs", () => {
    const src = minimalDxfEntities(`
0
MTEXT
10
1
20
2
40
1
50
0
1
Room\\t101\\PNorth wing
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.shapes[0] as { label?: string }).label).toBe("Room\t101\nNorth wing");
  });

  it("imports open LWPOLYLINE as POLYLINE", () => {
    const src = minimalDxfEntities(`
0
LWPOLYLINE
90
3
70
0
10
1
20
1
10
5
20
3
10
9
20
7
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]).toMatchObject({
      kind: "POLYLINE",
      x: 1,
      y: 1,
      rotationDeg: 0,
    });
    expect((r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices).toEqual([
      { x: 1, y: 1 },
      { x: 5, y: 3 },
      { x: 9, y: 7 },
    ]);
  });

  it("imports closed LWPOLYLINE by repeating first vertex", () => {
    const src = minimalDxfEntities(`
0
LWPOLYLINE
90
3
70
1
10
0
20
0
10
10
20
0
10
10
20
10
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts).toHaveLength(4);
    expect(verts[0]).toEqual({ x: 0, y: 0 });
    expect(verts[verts.length - 1]).toEqual({ x: 0, y: 0 });
  });

  it("imports classic POLYLINE + VERTEX + SEQEND as POLYLINE", () => {
    const src = minimalDxfEntities(`
0
POLYLINE
8
0
70
0
0
VERTEX
10
1
20
1
30
0
0
VERTEX
10
5
20
3
30
0
0
VERTEX
10
9
20
7
30
0
0
SEQEND
8
0
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]).toMatchObject({
      kind: "POLYLINE",
      x: 1,
      y: 1,
      rotationDeg: 0,
    });
    expect((r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices).toEqual([
      { x: 1, y: 1 },
      { x: 5, y: 3 },
      { x: 9, y: 7 },
    ]);
  });

  it("imports closed POLYLINE chain via flag 70 bit 1", () => {
    const src = minimalDxfEntities(`
0
POLYLINE
70
1
0
VERTEX
10
0
20
0
0
VERTEX
10
10
20
0
0
VERTEX
10
10
20
10
0
SEQEND
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts).toHaveLength(4);
    expect(verts[0]).toEqual({ x: 0, y: 0 });
    expect(verts[verts.length - 1]).toEqual({ x: 0, y: 0 });
  });

  it("imports polyface mesh POLYLINE as one closed POLYLINE per face", () => {
    const src = minimalDxfEntities(`
0
POLYLINE
70
192
0
VERTEX
10
0
20
0
0
VERTEX
10
10
20
0
0
VERTEX
10
10
20
5
0
VERTEX
10
0
20
5
0
VERTEX
70
128
71
1
72
2
73
3
74
4
0
SEQEND
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.polyface).toBe(1);
    expect(r.importedCounts.polyline).toBe(1);
    expect(r.shapes).toHaveLength(1);
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts).toHaveLength(5);
    expect(verts[0]).toEqual({ x: 0, y: 0 });
    expect(verts[2]).toEqual({ x: 10, y: 5 });
  });

  it("imports polygon mesh POLYLINE as quad face loops", () => {
    const src = minimalDxfEntities(`
0
POLYLINE
70
64
71
2
72
2
0
VERTEX
10
0
20
0
0
VERTEX
10
10
20
0
0
VERTEX
10
0
20
5
0
VERTEX
10
10
20
5
0
SEQEND
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.polyface).toBe(1);
    expect(r.importedCounts.polyline).toBe(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
  });

  it("tessellates LWPOLYLINE bulge (42) into arc vertices", () => {
    const b = Math.tan(Math.PI / 8);
    const src = minimalDxfEntities(`
0
LWPOLYLINE
90
2
70
0
10
1
20
0
42
${b}
10
0
20
1
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts.length).toBeGreaterThan(4);
    expect(verts[0]).toEqual({ x: 1, y: 0 });
    expect(verts[verts.length - 1]).toEqual({ x: 0, y: 1 });
  });

  it("tessellates VERTEX bulge on classic POLYLINE chain", () => {
    const b = Math.tan(Math.PI / 8);
    const src = minimalDxfEntities(`
0
POLYLINE
70
0
0
VERTEX
10
1
20
0
42
${b}
0
VERTEX
10
0
20
1
0
SEQEND
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts.length).toBeGreaterThan(4);
    expect(verts[0]).toEqual({ x: 1, y: 0 });
    expect(verts[verts.length - 1]).toEqual({ x: 0, y: 1 });
  });

  it("respects maxShapes", () => {
    const lines = Array.from({ length: 25 }, (_, k) =>
      `
0
LINE
10
${k}
20
0
11
${k + 1}
21
1
31
0`.trim(),
    ).join("\r\n");
    const src = minimalDxfEntities(lines);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes.length).toBe(3);
    expect(r.skippedAfterCap > 0).toBe(true);
    expect(r.importedCounts.line).toBe(3);
  });

  it("fails without ENTITIES", () => {
    const r = importMinimalAsciiDxfEntities("0\nSECTION\n2\nHEADER\n0\nENDSEC\n", { maxShapes: 10 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(5);
  });

  it("imports SPLINE fit points as POLYLINE", () => {
    const src = minimalDxfEntities(`
0
SPLINE
70
8
74
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
10
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
    expect(r.importedCounts.spline).toBe(1);
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts[0]).toEqual({ x: 0, y: 0 });
    expect(verts[verts.length - 1]).toEqual({ x: 10, y: 10 });
  });

  it("imports SPLINE control points via B-spline tessellation", () => {
    const src = minimalDxfEntities(`
0
SPLINE
70
8
71
3
73
4
10
0
20
0
10
4
20
8
10
8
20
8
10
12
20
0
40
0
40
0
40
0
40
1
40
1
40
1
40
1
`);
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.importedCounts.spline).toBe(1);
    const verts = (r.shapes[0] as { vertices?: { x: number; y: number }[] }).vertices ?? [];
    expect(verts.length).toBeGreaterThan(4);
    expect(verts[0]?.x).toBeCloseTo(0, 3);
    expect(verts[verts.length - 1]?.x).toBeCloseTo(12, 3);
  });

  it("explodes INSERT using BLOCKS definitions with translation", () => {
    const src = minimalDxfWithBlocks(
      `
0
BLOCK
2
BAR
10
0
20
0
0
LINE
10
0
20
0
11
10
21
0
0
ENDBLK
`,
      `
0
INSERT
2
BAR
10
5
20
5
41
1
42
1
50
0
`,
    );
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]).toMatchObject({ kind: "LINE", x: 5, y: 5, x2: 15, y2: 5 });
    expect(r.importedCounts.insert).toBe(1);
    expect(r.importedCounts.line).toBe(1);
  });

  it("explodes INSERT column/row arrays into multiple block instances", () => {
    const src = minimalDxfWithBlocks(
      `
0
BLOCK
2
BAR
10
0
20
0
0
LINE
10
0
20
0
11
4
21
0
0
ENDBLK
`,
      `
0
INSERT
2
BAR
10
0
20
0
41
1
42
1
50
0
70
3
71
1
10
5
20
0
11
0
21
0
`,
    );
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.insert).toBe(1);
    expect(r.importedCounts.line).toBe(3);
    const lines = r.shapes.filter((s) => s.kind === "LINE");
    expect(lines.some((s) => Math.abs(s.x - 0) < 0.01)).toBe(true);
    expect(lines.some((s) => Math.abs(s.x - 5) < 0.01)).toBe(true);
    expect(lines.some((s) => Math.abs(s.x - 10) < 0.01)).toBe(true);
  });

  it("imports visible ATTRIB followers on INSERT as TEXT", () => {
    const src = minimalDxfWithBlocks(
      `
0
BLOCK
2
BAR
10
0
20
0
0
LINE
10
0
20
0
11
2
21
0
0
ENDBLK
`,
      `
0
INSERT
2
BAR
10
5
20
5
0
ATTRIB
1
Fixt-12
10
6
20
7
50
30
0
SEQEND
`,
    );
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(2);
    expect(r.importedCounts.insert).toBe(1);
    expect(r.importedCounts.attrib).toBe(1);
    expect(r.importedCounts.line).toBe(1);
    const label = r.shapes.find((s) => s.kind === "TEXT");
    expect(label).toMatchObject({ kind: "TEXT", x: 6, y: 7, label: "Fixt-12", rotationDeg: 30 });
    expect(r.skippedUnsupportedEntities).toBe(0);
  });

  it("skips invisible ATTRIB followers on INSERT", () => {
    const src = minimalDxfWithBlocks(
      `
0
BLOCK
2
BAR
10
0
20
0
0
LINE
10
0
20
0
11
2
21
0
0
ENDBLK
`,
      `
0
INSERT
2
BAR
10
0
20
0
0
ATTRIB
1
Hidden
10
1
20
2
60
1
0
SEQEND
`,
    );
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.importedCounts.attrib).toBe(0);
  });

  it("ignores ATTDEF entities inside BLOCK definitions", () => {
    const src = minimalDxfWithBlocks(
      `
0
BLOCK
2
BAR
10
0
20
0
0
ATTDEF
2
TAG
10
0
20
0
0
LINE
10
0
20
0
11
3
21
0
0
ENDBLK
`,
      `
0
INSERT
2
BAR
10
1
20
1
`,
    );
    const r = importMinimalAsciiDxfEntities(src, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.shapes).toHaveLength(1);
    expect(r.shapes[0]).toMatchObject({ kind: "LINE", x: 1, y: 1, x2: 4, y2: 1 });
    expect(r.skippedUnsupportedEntities).toBe(0);
  });
});

describe("formatDxfImportEntitySummary", () => {
  it("includes spline counts in the summary string", () => {
    expect(
      formatDxfImportEntitySummary({
        line: 0,
        circle: 0,
        arc: 0,
        ellipse: 0,
        ellipseArc: 0,
        text: 0,
        mtext: 0,
        lwPolyline: 0,
        polyline: 0,
        spline: 2,
        insert: 0,
        hatch: 0,
        attrib: 0,
        polyface: 0,
      }),
    ).toBe("2 spline→polyline");
  });

  it("includes polyface mesh counts", () => {
    expect(
      formatDxfImportEntitySummary({
        line: 0,
        circle: 0,
        arc: 0,
        ellipse: 0,
        ellipseArc: 0,
        text: 0,
        mtext: 0,
        lwPolyline: 0,
        polyline: 2,
        spline: 0,
        insert: 0,
        hatch: 0,
        attrib: 0,
        polyface: 1,
      }),
    ).toBe("1 polyface mesh · 2 POLYLINE");
  });

  it("includes ATTRIB import counts", () => {
    expect(
      formatDxfImportEntitySummary({
        line: 0,
        circle: 0,
        arc: 0,
        ellipse: 0,
        ellipseArc: 0,
        text: 0,
        mtext: 0,
        lwPolyline: 0,
        polyline: 0,
        spline: 0,
        insert: 1,
        hatch: 0,
        attrib: 2,
      }),
    ).toBe("1 INSERT→explode · 2 ATTRIB→TEXT");
  });

  it("includes INSERT explode counts", () => {
    expect(
      formatDxfImportEntitySummary({
        line: 1,
        circle: 0,
        arc: 0,
        ellipse: 0,
        ellipseArc: 0,
        text: 0,
        mtext: 0,
        lwPolyline: 0,
        polyline: 0,
        spline: 0,
        insert: 1,
        hatch: 0,
        attrib: 0,
        polyface: 0,
      }),
    ).toBe("1 line · 1 INSERT→explode");
  });
});
