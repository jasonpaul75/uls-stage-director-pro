import { StageDesignUnit } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { rectangleDeckPolygonFromCorners } from "./stage-design-canvas";
import { STAGE_DESIGN_SCHEMA_VERSION } from "./stage-design-canvas";
import type { StageDesignCanvas } from "./stage-design-canvas";
import { appendClosedPolylineLinesWorld, appendDxfCircleWorld, appendDxfLineWorld, buildStageDesignDxf } from "./stage-design-dxf-export";

describe("DXF primitives", () => {
  it("emits LINE and CIRCLE with expected group codes", () => {
    const o: string[] = [];
    appendDxfLineWorld(o, "L", 0, 0, 1, 2);
    appendDxfCircleWorld(o, "L", 5, -3, 1.25);
    const s = o.join("\n");
    expect(s).toContain("LINE");
    expect(s).toContain("CIRCLE");
    expect(s).toContain("\n40\n");
  });

  it("closes a polyline as LINE segments including closing edge", () => {
    const o: string[] = [];
    appendClosedPolylineLinesWorld(o, "L", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: -5 },
    ]);
    expect(o.join("\n").split("\n").filter((l) => l === "LINE").length).toBe(3);
  });
});

function minimalCanvas(patch: Partial<StageDesignCanvas> = {}): StageDesignCanvas {
  return {
    version: STAGE_DESIGN_SCHEMA_VERSION,
    footprint: { width: 24, depth: 20 },
    plotMargins: { downstage: 4, upstage: 8, stageLeft: 12, stageRight: 14 },
    placements: [],
    shapes: [],
    ...patch,
  };
}

describe("buildStageDesignDxf", () => {
  it("produces terminating EOF marker", () => {
    const dxf = buildStageDesignDxf({ unit: StageDesignUnit.FEET, canvas: minimalCanvas() });
    expect(dxf.endsWith("\r\n")).toBe(true);
    expect(dxf.includes("\r\n0\r\nEOF")).toBe(true);
  });

  it("includes ENTITIES SECTION and nominal deck rectangle when deck modules omit", () => {
    const dxf = buildStageDesignDxf({ unit: StageDesignUnit.FEET, canvas: minimalCanvas() });
    expect(dxf).toContain("ENTITIES");
    expect(dxf).toContain("ULSD_DECK");
  });

  it("writes fixture circles and truss lines into symbol layer", () => {
    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.METERS,
      canvas: minimalCanvas({
        placements: [
          { id: "fx", kind: "FIXTURE", x: 1, y: -1 },
          {
            id: "tr",
            kind: "TRUSS",
            x: 10,
            y: -5,
            rotationDeg: 90,
          },
        ],
      }),
    });
    expect(dxf).toContain("ULSD_SYMBOL");
    expect(dxf).toContain("CIRCLE");
    expect(dxf).toContain("LINE");
  });

  it("respects modular deck polygons for deck layer", () => {
    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        deckPolygons: [rectangleDeckPolygonFromCorners("d1", 2, 2, 8, 9)],
      }),
    });
    expect(dxf).toContain("ULSD_DECK");
    expect(dxf).not.toContain("__deck_rect__");
  });
});
