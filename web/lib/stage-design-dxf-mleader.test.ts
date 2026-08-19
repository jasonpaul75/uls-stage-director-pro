import { describe, expect, it } from "vitest";

import {
  consumeDxfMleaderEntityAt,
  dxfMleaderLabelFromParse,
} from "./stage-design-dxf-mleader";
import { importDxfEntities, parseDxfAsciiPairs } from "./stage-design-dxf-import";

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

describe("consumeDxfMleaderEntityAt", () => {
  it("collects nested LEADER_LINE vertices and text labels", () => {
    const pairs = parseDxfAsciiPairs(
      minimalDxfEntities(`
0
MLEADER
300
CONTEXT_DATA{
302
LEADER{
304
LEADER_LINE{
10
0
20
0
10
4
20
6
305
}
303
}
301
}
304
Downstage note
11
8
21
9
`),
    );
    const start = pairs.findIndex((p) => p.code === 0 && p.value === "MLEADER") + 1;
    const ml = consumeDxfMleaderEntityAt(pairs, start);
    expect(ml.leaderLines).toEqual([[{ x: 0, y: 0 }, { x: 4, y: 6 }]]);
    expect(dxfMleaderLabelFromParse(ml.labels, ml.fields)).toBe("Downstage note");
  });

  it("imports multiple LEADER_LINE branches as separate polylines", () => {
    const r = importDxfEntities(
      minimalDxfEntities(`
0
MLEADER
300
CONTEXT_DATA{
302
LEADER{
304
LEADER_LINE{
10
0
20
0
10
2
20
2
305
}
304
LEADER_LINE{
10
5
20
5
10
7
20
8
305
}
303
}
301
}
304
Branch label
11
10
21
10
`),
      { maxShapes: 20 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.leader).toBe(1);
    expect(r.shapes.filter((s) => s.kind === "POLYLINE")).toHaveLength(2);
    expect(r.shapes.some((s) => s.kind === "TEXT" && s.label === "Branch label")).toBe(true);
  });
});
