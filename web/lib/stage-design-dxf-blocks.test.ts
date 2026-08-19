import { describe, expect, it } from "vitest";

import {
  buildDxfInsertInstanceTransforms,
  consumeDxfInsertAttribFollowersAt,
  parseDxfAttribEntityAt,
  parseDxfBlockCatalog,
  parseDxfInsertEntityAt,
  transformBlockLocalXY,
  transformImportedShapeForBlockInsert,
} from "./stage-design-dxf-blocks";
import { parseDxfAsciiPairs } from "./stage-design-dxf-import";

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

describe("parseDxfBlockCatalog", () => {
  it("indexes BLOCK entities up to ENDBLK", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfWithBlocks(
        `
0
BLOCK
2
TRUSS_SEG
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
        "",
      ),
    );
    const catalog = parseDxfBlockCatalog(pairs);
    const block = catalog.get("TRUSS_SEG");
    expect(block).toBeDefined();
    expect(block!.baseX).toBe(0);
    expect(block!.entityEnd).toBeGreaterThan(block!.entityStart);
  });
});

describe("transformBlockLocalXY", () => {
  it("translates block-local geometry to INSERT point", () => {
    expect(
      transformBlockLocalXY(10, 0, 0, 0, { ix: 5, iy: 5, sx: 1, sy: 1, rotDeg: 0 }),
    ).toEqual({ x: 15, y: 5 });
  });

  it("applies rotation about the insertion point", () => {
    const p = transformBlockLocalXY(10, 0, 0, 0, { ix: 0, iy: 0, sx: 1, sy: 1, rotDeg: 90 });
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(10, 5);
  });
});

describe("transformImportedShapeForBlockInsert", () => {
  it("maps LINE endpoints through INSERT transform", () => {
    const out = transformImportedShapeForBlockInsert(
      { kind: "LINE", x: 0, y: 0, x2: 10, y2: 0, rotationDeg: 0 },
      0,
      0,
      { ix: 5, iy: 5, sx: 1, sy: 1, rotDeg: 0 },
    );
    expect(out).toMatchObject({ kind: "LINE", x: 5, y: 5, x2: 15, y2: 5 });
  });
});

describe("buildDxfInsertInstanceTransforms", () => {
  it("expands column/row array spacing from the base INSERT", () => {
    const base = { ix: 0, iy: 0, sx: 1, sy: 1, rotDeg: 0 };
    const instances = buildDxfInsertInstanceTransforms(base, 2, 2, 10, 0, 0, 5);
    expect(instances).toHaveLength(4);
    expect(instances[0]).toMatchObject({ ix: 0, iy: 0 });
    expect(instances[1]).toMatchObject({ ix: 10, iy: 0 });
    expect(instances[2]).toMatchObject({ ix: 0, iy: 5 });
    expect(instances[3]).toMatchObject({ ix: 10, iy: 5 });
  });
});

describe("parseDxfInsertEntityAt", () => {
  it("reads array counts and duplicate 10/20 spacing fields in order", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfWithBlocks(
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
2
41
1
42
1
50
0
70
2
71
2
10
10
20
0
11
0
21
5
`,
      ),
    );
    const entitiesStart = pairs.findIndex((p) => p.code === 2 && p.value === "ENTITIES");
    const insertIdx = pairs.findIndex(
      (p, idx) => idx > entitiesStart && p.code === 0 && p.value === "INSERT",
    );
    expect(insertIdx).toBeGreaterThan(0);
    const parsed = parseDxfInsertEntityAt(pairs, insertIdx + 1);
    expect(parsed?.blockName).toBe("BAR");
    expect(parsed?.instances).toHaveLength(4);
    expect(parsed?.instances[3]?.ix).toBeCloseTo(11, 5);
    expect(parsed?.instances[3]?.iy).toBeCloseTo(7, 5);
  });
});

describe("parseDxfAttribEntityAt", () => {
  it("parses visible attribute text and skips invisible flags", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfWithBlocks(
        `
0
BLOCK
2
TAGS
10
0
20
0
0
ENDBLK
`,
        `
0
ATTRIB
1
Cue A
10
3
20
4
50
15
60
0
0
ATTRIB
1
Hidden
10
0
20
0
60
1
`,
      ),
    );
    const entitiesStart = pairs.findIndex((p) => p.code === 2 && p.value === "ENTITIES");
    const first = pairs.findIndex((p, idx) => idx > entitiesStart && p.code === 0 && p.value === "ATTRIB");
    expect(first).toBeGreaterThan(0);
    const visible = parseDxfAttribEntityAt(pairs, first + 1);
    expect(visible.attrib).toMatchObject({
      label: "Cue A",
      x: 3,
      y: 4,
      rotationDeg: 15,
      visible: true,
    });

    const second = pairs.findIndex(
      (p, idx) => idx > first && p.code === 0 && p.value === "ATTRIB",
    );
    expect(second).toBeGreaterThan(first);
    const hidden = parseDxfAttribEntityAt(pairs, second + 1);
    expect(hidden.attrib).toMatchObject({ label: "Hidden", visible: false });
  });
});

describe("consumeDxfInsertAttribFollowersAt", () => {
  it("collects only visible ATTRIB entities until SEQEND", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfWithBlocks(
        `
0
BLOCK
2
X
10
0
20
0
0
ENDBLK
`,
        `
0
INSERT
2
X
10
0
20
0
41
1
42
1
0
ATTRIB
1
One
10
1
20
1
0
ATTRIB
1
Two
10
2
20
2
60
1
0
SEQEND
0
LINE
10
0
20
0
11
1
21
1
`,
      ),
    );
    const entitiesStart = pairs.findIndex((p) => p.code === 2 && p.value === "ENTITIES");
    const insertIdx = pairs.findIndex(
      (p, idx) => idx > entitiesStart && p.code === 0 && p.value === "INSERT",
    );
    expect(insertIdx).toBeGreaterThan(0);
    const insertEnd = parseDxfInsertEntityAt(pairs, insertIdx + 1)?.next ?? insertIdx + 1;
    const got = consumeDxfInsertAttribFollowersAt(pairs, insertEnd);
    expect(got.attribs).toHaveLength(1);
    expect(got.attribs[0]?.label).toBe("One");
  });
});
