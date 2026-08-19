import { StageDesignUnit } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { rectangleDeckPolygonFromCorners } from "./stage-design-canvas";
import { STAGE_DESIGN_SCHEMA_VERSION } from "./stage-design-canvas";
import type { StageDesignCanvas } from "./stage-design-canvas";
import {
  appendClosedPolylineLinesWorld,
  appendDxfArcWorld,
  appendDxfCircleWorld,
  appendDxfEllipseWorld,
  appendDxfLineWorld,
  appendLwPolylineWorld,
  buildStageDesignDxf,
} from "./stage-design-dxf-export";
import { importMinimalAsciiDxfEntities } from "./stage-design-dxf-import";
import { tessellateBulgeChordInclusive } from "./stage-design-dxf-bulge";

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

  it("appendClosedPolylineLinesWorld exports tessellated circles as CIRCLE", () => {
    const ring: { x: number; y: number }[] = [];
    for (let i = 0; i < 16; i++) {
      const ang = (2 * Math.PI * i) / 16;
      ring.push({ x: 3 + 4 * Math.cos(ang), y: 1 + 4 * Math.sin(ang) });
    }
    const o: string[] = [];
    appendClosedPolylineLinesWorld(o, "L", ring);
    const s = o.join("\n");
    expect(s).toContain("CIRCLE");
    expect(s).not.toContain("LWPOLYLINE");
  });

  it("appendClosedPolylineLinesWorld compresses closed arc rings with bulge 42", () => {
    const b = Math.tan(Math.PI / 8);
    const arcPts = tessellateBulgeChordInclusive(0, 0, 10, 10, b, 16);
    const o: string[] = [];
    appendClosedPolylineLinesWorld(o, "L", [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      ...arcPts.slice(1, -1),
    ]);
    const s = o.join("\n");
    expect(s).toContain("LWPOLYLINE");
    expect(s).toContain("\n42\n");
  });

  it("appendClosedPolylineLinesWorld forwards rectangles to LWPOLYLINE", () => {
    const o: string[] = [];
    appendClosedPolylineLinesWorld(o, "L", [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 2 },
      { x: 0, y: 2 },
    ]);
    expect(o.join("\n")).toContain("LWPOLYLINE");
  });

  it("emits ARC with degree endpoints", () => {
    const o: string[] = [];
    appendDxfArcWorld(o, "L", 0, 0, 10, 0, 90);
    const s = o.join("\n");
    expect(s).toContain("ARC");
    expect(s).toContain("\n50\n");
    expect(s).toContain("\n51\n");
  });

  it("emits ELLIPSE with AcDbEllipse markers and spline parameter span", () => {
    const o: string[] = [];
    appendDxfEllipseWorld(o, "L", 1, 2, 4, 3, 30);
    const s = o.join("\n");
    expect(s).toContain("ELLIPSE");
    expect(s).toContain("AcDbEllipse");
    expect(s).toContain("\n40\n");
    expect(s).toContain("\n41\n");
    expect(s).toContain("\n42\n");
  });
});

describe("buildStageDesignDxf", () => {
  it("exports tessellated arc POLYLINE as DXF ARC on re-export", () => {
    const imported = importMinimalAsciiDxfEntities(
      minimalDxfEntities(`
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
`),
      { maxShapes: 40 },
    );
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;

    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        shapes: imported.shapes.map((s, i) => ({ ...s, id: `arc_${i}` })),
      }),
    });
    expect(dxf).toContain("\r\n0\r\nARC\r\n");
  });

  it("exports circle ELLIPSE shapes as CIRCLE", () => {
    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        shapes: [{ id: "c", kind: "ELLIPSE", x: 2, y: 3, width: 4, height: 4, rotationDeg: 15 }],
      }),
    });
    expect(dxf).toContain("CIRCLE");
    const afterShapeLayer = dxf.split("ULSD_SHAPE")[1] ?? "";
    expect(afterShapeLayer).not.toContain("ELLIPSE");
  });

  it("exports mixed line+arc POLYLINE as compact LWPOLYLINE with bulge 42", () => {
    const b = Math.tan(Math.PI / 8);
    const arcPts = tessellateBulgeChordInclusive(20, 0, 20, 5, b, 12);
    const vertices = [{ x: 0, y: 0 }, { x: 20, y: 0 }, ...arcPts.slice(1)];

    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        shapes: [{ id: "mixed", kind: "POLYLINE", x: 0, y: 0, rotationDeg: 0, vertices }],
      }),
    });
    expect(dxf).toContain("\r\n42\r\n");
    expect(dxf).toMatch(/ULSD_SHAPE[\s\S]*LWPOLYLINE/);

    const r = importMinimalAsciiDxfEntities(dxf, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const imported = r.shapes.filter(
      (s) =>
        s.kind === "POLYLINE" &&
        (s.vertices?.length ?? 0) > 2 &&
        Math.abs((s.vertices!.at(-1)?.y ?? 0) - 5) < 0.5,
    );
    expect(imported.length).toBeGreaterThanOrEqual(1);
    const last = imported[0]!.vertices!.at(-1)!;
    expect(last.x).toBeCloseTo(20, 3);
    expect(last.y).toBeCloseTo(5, 3);
  });

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

  it("writes symbol BLOCK definitions and INSERT entities on the symbol layer", () => {
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
    expect(dxf).toContain("ULSD_SYM_FIXTURE");
    expect(dxf).toContain("ULSD_SYM_TRUSS");
    expect(dxf).toMatch(/\r\n0\r\nBLOCK\r\n[\s\S]*CIRCLE/);
    expect(dxf).toMatch(/\r\n0\r\nINSERT\r\n[\s\S]*ULSD_SYM_FIXTURE/);
    const entitiesSection = dxf.split("ENTITIES")[1] ?? "";
    expect(entitiesSection).toContain("INSERT");
    expect(entitiesSection).not.toMatch(/\r\n0\r\nCIRCLE\r\n/);
  });

  it("round-trips fixture placements exported as INSERT through the importer", () => {
    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        placements: [{ id: "fx", kind: "FIXTURE", x: 10, y: -5, rotationDeg: 30 }],
      }),
    });
    const r = importMinimalAsciiDxfEntities(dxf, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.insert).toBe(1);
    expect(r.importedCounts.circle).toBe(1);
    const circle = r.shapes.find((s) => s.kind === "ELLIPSE");
    expect(circle).toMatchObject({ kind: "ELLIPSE", x: 10, y: -5 });
  });

  it("exports ELLIPSE shapes as DXF ELLIPSE round-tripped by importer", () => {
    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        shapes: [
          {
            id: "ell",
            kind: "ELLIPSE",
            x: 5,
            y: -3,
            rotationDeg: 25,
            width: 6,
            height: 2,
          },
        ],
      }),
    });
    expect(dxf).toContain("ELLIPSE");

    const r = importMinimalAsciiDxfEntities(dxf, { maxShapes: 80 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ell = r.shapes.filter((s) => s.kind === "ELLIPSE").find((s) => Math.abs(s.x - 5) < 0.02 && Math.abs(s.y + 3) < 0.02);
    expect(ell).toBeDefined();
    expect(ell!.width).toBeCloseTo(6, 1);
    expect(ell!.height).toBeCloseTo(2, 1);
    expect(ell!.rotationDeg).toBeCloseTo(25, 1);
    expect(r.importedCounts.ellipse).toBeGreaterThanOrEqual(1);
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
    const paths = r.shapes.filter((s) => s.kind === "POLYLINE" && (s.vertices?.length ?? 0) >= 3);
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

  it("exports tessellated SPLINE POLYLINE shapes as SPLINE round-tripped by importer", () => {
    const imported = importMinimalAsciiDxfEntities(
      minimalDxfEntities(`
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
`),
      { maxShapes: 40 },
    );
    expect(imported.ok).toBe(true);
    if (!imported.ok) return;
    expect(imported.shapes[0]?.kind).toBe("POLYLINE");

    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        shapes: imported.shapes.map((s, i) => ({ ...s, id: `sp_${i}` })),
      }),
    });
    expect(dxf).toContain("\r\n0\r\nSPLINE\r\n");
    expect(dxf).toContain("\r\n91\r\n");

    const r = importMinimalAsciiDxfEntities(dxf, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.spline).toBeGreaterThanOrEqual(1);
    const path = r.shapes.find((s) => s.kind === "POLYLINE");
    expect((path?.vertices?.length ?? 0)).toBeGreaterThanOrEqual(5);
  });

  it("exports filled RECT shapes as HATCH plus outline round-tripped by importer", () => {
    const dxf = buildStageDesignDxf({
      unit: StageDesignUnit.FEET,
      canvas: minimalCanvas({
        shapes: [
          {
            id: "filled_rect",
            kind: "RECT",
            x: 4,
            y: 5,
            width: 8,
            height: 6,
            rotationDeg: 15,
            fill: "#33669988",
          },
        ],
      }),
    });
    expect(dxf).toContain("HATCH");
    expect(dxf).toContain("SOLID");
    expect(dxf).toMatch(/HATCH[\s\S]*LWPOLYLINE/);

    const r = importMinimalAsciiDxfEntities(dxf, { maxShapes: 40 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.importedCounts.hatch).toBeGreaterThanOrEqual(1);
    const filled = r.shapes.find(
      (s) => s.kind === "POLYLINE" && typeof (s as { fill?: string }).fill === "string",
    );
    expect(filled).toBeDefined();
    expect((filled as { fill?: string }).fill).toContain("rgba");
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
