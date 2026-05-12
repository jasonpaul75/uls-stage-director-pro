import { describe, expect, it } from "vitest";

import {
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
  });

  it("fails without ENTITIES", () => {
    const r = importMinimalAsciiDxfEntities("0\nSECTION\n2\nHEADER\n0\nENDSEC\n", { maxShapes: 10 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.length).toBeGreaterThan(5);
  });
});
