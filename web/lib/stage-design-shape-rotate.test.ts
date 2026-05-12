import { describe, expect, it } from "vitest";

import {
  authoringRotationDegreesAtPointer,
  shortestAngleDegreesDelta,
  stagePlacementRotationPivotWorld,
  stageShapeRotationPivotWorld,
} from "@/lib/stage-design-shape-rotate";

describe("shortestAngleDegreesDelta", () => {
  it("unwraps clockwise wrap", () => {
    expect(shortestAngleDegreesDelta(350, 10)).toBeCloseTo(20, 5);
    expect(shortestAngleDegreesDelta(10, 350)).toBeCloseTo(-20, 5);
  });
});

describe("authoringRotationDegreesAtPointer", () => {
  it("tracks pointer delta against baseline", () => {
    expect(authoringRotationDegreesAtPointer(0, 0, 90, false)).toBe(90);
    expect(authoringRotationDegreesAtPointer(340, -10, 20, false)).toBe(10);
  });

  it("coarse-snaps every 15° when coarseSnap is true", () => {
    expect(authoringRotationDegreesAtPointer(7, 0, 92, true)).toBe(105);
    expect(authoringRotationDegreesAtPointer(354, 0, 92, true)).toBe(90);
  });
});

describe("stagePlacementRotationPivotWorld", () => {
  it("anchors at placement x,y like PlacementGlyph pivot", () => {
    expect(
      stagePlacementRotationPivotWorld({ id: "p", kind: "FIXTURE", x: 3.25, y: -1.75 }),
    ).toEqual({ wx: 3.25, wy: -1.75 });
    expect(stagePlacementRotationPivotWorld({ id: "q", kind: "TRUSS", x: -2, y: 5 })).toEqual({ wx: -2, wy: 5 });
  });
});

describe("stageShapeRotationPivotWorld", () => {
  it("centers rects and midpoints lines", () => {
    expect(
      stageShapeRotationPivotWorld({ id: "r", kind: "RECT", x: 10, y: 4, width: 8, height: 6, label: "R" }),
    ).toEqual({ wx: 14, wy: 7 });
    expect(
      stageShapeRotationPivotWorld({ id: "l", kind: "LINE", x: 1, y: 1, x2: 5, y2: -3 }),
    ).toEqual({ wx: 3, wy: -1 });
    expect(
      stageShapeRotationPivotWorld({
        id: "pl",
        kind: "POLYLINE",
        x: 0,
        y: 0,
        vertices: [
          { x: 0, y: 0 },
          { x: 6, y: 0 },
          { x: 6, y: 6 },
        ],
      }),
    ).toEqual({ wx: 4, wy: 2 });
    expect(stageShapeRotationPivotWorld({ id: "t", kind: "TEXT", x: 9, y: -2 })).toEqual({ wx: 9, wy: -2 });
  });
});
