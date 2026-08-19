import { describe, expect, it } from "vitest";

import {
  consumeDxfVertexChainEntityAt,
  dxfAnnotationLabelFromEntity,
  dxfConstructionLineSegmentFromFields,
  dxfWipeoutCornersFromEntity,
} from "./stage-design-dxf-vendor-leader";
import { importDxfEntities } from "./stage-design-dxf-import";
import { parseDxfAsciiPairs } from "./stage-design-dxf-import";

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

describe("consumeDxfVertexChainEntityAt", () => {
  it("collects 10/20 vertices and scalar fields", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfEntities(`
0
LEADER
10
0
20
0
10
5
20
5
1
North exit
`),
    );
    const start = pairs.findIndex((p) => p.code === 0 && p.value === "LEADER") + 1;
    const ent = consumeDxfVertexChainEntityAt(pairs, start);
    expect(ent.vertices).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ]);
    expect(dxfAnnotationLabelFromEntity(ent.fields, ent.mtext304)).toBe("North exit");
  });
});

describe("dxfConstructionLineSegmentFromFields", () => {
  it("clips RAY to a finite segment", () => {
    const fields = new Map<number, string>([
      [10, "0"],
      [20, "0"],
      [11, "1"],
      [21, "0"],
    ]);
    const seg = dxfConstructionLineSegmentFromFields(fields, false, 10);
    expect(seg).toEqual({ x1: 0, y1: 0, x2: 10, y2: 0 });
  });

  it("extends XLINE bidirectionally", () => {
    const fields = new Map<number, string>([
      [10, "0"],
      [20, "0"],
      [11, "0"],
      [21, "1"],
    ]);
    const seg = dxfConstructionLineSegmentFromFields(fields, true, 8);
    expect(seg).toEqual({ x1: 0, y1: -8, x2: 0, y2: 8 });
  });
});

describe("dxfWipeoutCornersFromEntity", () => {
  it("builds parallelogram from UV vectors", () => {
    const fields = new Map<number, string>([
      [10, "1"],
      [20, "2"],
      [11, "4"],
      [21, "0"],
      [12, "0"],
      [22, "3"],
    ]);
    expect(dxfWipeoutCornersFromEntity(fields, [])).toEqual([
      { x: 1, y: 2 },
      { x: 5, y: 2 },
      { x: 5, y: 5 },
      { x: 1, y: 5 },
    ]);
  });
});

describe("importDxfEntities vendor leaders", () => {
  it("imports LEADER path and annotation text", () => {
    const r = importDxfEntities(
      minimalDxfEntities(`
0
LEADER
10
0
20
0
10
4
20
6
11
8
21
9
1
Stage left
`),
      { maxShapes: 10 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.leader).toBe(1);
    expect(r.shapes.some((s) => s.kind === "POLYLINE")).toBe(true);
    expect(r.shapes.some((s) => s.kind === "TEXT" && s.label === "Stage left")).toBe(true);
  });

  it("imports MLEADER 304 mtext (flat fallback)", () => {
    const r = importDxfEntities(
      minimalDxfEntities(`
0
MLEADER
10
0
20
0
10
2
20
2
304
Dim note
11
5
21
5
`),
      { maxShapes: 10 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.leader).toBe(1);
    expect(r.shapes.some((s) => s.kind === "TEXT" && s.label === "Dim note")).toBe(true);
  });

  it("imports WIPEOUT clip boundary", () => {
    const r = importDxfEntities(
      minimalDxfEntities(`
0
WIPEOUT
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
10
0
20
10
`),
      { maxShapes: 5 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.wipeout).toBe(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
  });

  it("imports RAY and XLINE as clipped lines", () => {
    const r = importDxfEntities(
      minimalDxfEntities(`
0
RAY
10
0
20
0
11
1
21
0
0
XLINE
10
5
20
5
11
0
21
1
`),
      { maxShapes: 10 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.constructionLine).toBe(2);
    expect(r.shapes.filter((s) => s.kind === "LINE")).toHaveLength(2);
  });
});
