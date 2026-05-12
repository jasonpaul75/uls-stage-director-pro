import { StageDesignUnit } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { rectangleDeckPolygonFromCorners } from "./stage-design-canvas";
import { STAGE_DESIGN_SCHEMA_VERSION } from "./stage-design-canvas";
import type { StageDesignCanvas } from "./stage-design-canvas";
import {
  appendClosedPolylineLinesWorld,
  appendDxfCircleWorld,
  appendDxfLineWorld,
  appendLwPolylineWorld,
  buildStageDesignDxf,
} from "./stage-design-dxf-export";
import { importMinimalAsciiDxfEntities } from "./stage-design-dxf-import";

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

  it("emits closed LWPOLYLINE with closure flag", () => {
    const o: string[] = [];
    appendLwPolylineWorld(o, "L", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: -5 },
    ], true);
    const s = o.join("\n");
    expect(s).toContain("LWPOLYLINE");
    expect(s).toContain("\n90\n3\n");
    expect(s).toContain("\n70\n1\n");
    expect(s.split("\n").filter((l) => l === "LINE").length).toBe(0);
  });

  it("appendClosedPolylineLinesWorld forwards to LWPOLYLINE", () => {
    const o: string[] = [];
    appendClosedPolylineLinesWorld(o, "L", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(o.join("\n")).toContain("LWPOLYLINE");
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
  it("declares AC1015 and terminates EOF marker", () => {
    const dxf = buildStageDesignDxf({ unit: StageDesignUnit.FEET, canvas: minimalCanvas() });
    expect(dxf.endsWith("\r\n")).toBe(true);
    expect(dxf.includes("\r\n0\r\nEOF")).toBe(true);
    expect(dxf).toContain("AC1015");
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

  it("exports open POLYLINE shapes as LWPOLYLINE round-tripped by importer", () => {
    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        shapes: [
          {
            id: "open_path",
            kind: "POLYLINE",
            x: 2,
            y: 3,
            rotationDeg: 0,
            vertices: [
              { x: 2, y: 3 },
              { x: 10, y: 11 },
              { x: 12, y: 5 },
            ],
          },
        ],
      }),
    });
    expect(dxf).toContain("LWPOLYLINE");
    const r = importMinimalAsciiDxfEntities(dxf, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const paths = r.shapes.filter((s) => s.kind === "POLYLINE" && (s.vertices?.length ?? 0) === 3);
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(paths.some((s) => Math.abs((s as { x: number }).x - 2) < 1e-5)).toBe(true);
  });

  it("exports multiline/tabbed TEXT shapes as MTEXT round-tripped by importer", () => {
    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        shapes: [
          {
            id: "rich_text",
            kind: "TEXT",
            x: 4,
            y: 5,
            rotationDeg: 45,
            label: "Room\t101\nNorth wing",
          },
        ],
      }),
    });
    expect(dxf).toContain("MTEXT");
    expect(dxf).toContain("\\t");
    expect(dxf).toContain("\\P");
    const r = importMinimalAsciiDxfEntities(dxf, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const imported = r.shapes.find((s) => s.kind === "TEXT" && s.label === "Room\t101\nNorth wing");
    expect(imported).toMatchObject({
      kind: "TEXT",
      x: 4,
      y: 5,
      rotationDeg: 45,
    });
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
