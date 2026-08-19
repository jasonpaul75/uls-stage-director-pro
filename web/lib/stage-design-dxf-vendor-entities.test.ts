import { describe, expect, it } from "vitest";

import {
  dxfDimensionTextFromFields,
  dxfFaceCornersFromFields,
} from "./stage-design-dxf-vendor-entities";
import { importDxfEntities } from "./stage-design-dxf-import";

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

describe("dxfFaceCornersFromFields", () => {
  it("reads triangle SOLID corners", () => {
    const fields = new Map<number, string>([
      [10, "0"],
      [20, "0"],
      [11, "10"],
      [21, "0"],
      [12, "5"],
      [22, "8"],
    ]);
    expect(dxfFaceCornersFromFields(fields)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 8 },
    ]);
  });
});

describe("dxfDimensionTextFromFields", () => {
  it("extracts override text at midpoint", () => {
    const fields = new Map<number, string>([
      [1, "12'-6\""],
      [11, "4"],
      [21, "5"],
      [50, "0"],
    ]);
    expect(dxfDimensionTextFromFields(fields)).toMatchObject({
      label: "12'-6\"",
      x: 4,
      y: 5,
      rotationDeg: 0,
    });
  });
});

describe("importDxfEntities vendor faces", () => {
  it("imports SOLID as closed POLYLINE with fill", () => {
    const src = minimalDxfEntities(`
0
SOLID
10
0
20
0
11
10
21
0
12
10
22
6
13
0
23
6
`);
    const r = importDxfEntities(src, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.face).toBe(1);
    expect(r.shapes[0]?.kind).toBe("POLYLINE");
    expect((r.shapes[0] as { fill?: string }).fill).toContain("rgba");
  });

  it("imports DIMENSION override text as TEXT", () => {
    const src = minimalDxfEntities(`
0
DIMENSION
1
24.0
11
8
21
9
50
0
`);
    const r = importDxfEntities(src, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.dimension).toBe(1);
    expect(r.shapes[0]).toMatchObject({ kind: "TEXT", x: 8, y: 9, label: "24.0" });
  });
});
