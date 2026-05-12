import { StageDesignUnit } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  abbreviateStageDiagramLabel,
  clampFootprint,
  DEFAULT_PLOT_MARGINS,
  defaultStageDesignCanvas,
  insertPolylineVertexOnSegment,
  MAX_STAGE_SHAPE_POLYLINE_VERTICES,
  parsePlacementsFromJsonString,
  parseShapesFromJsonString,
  parseStageDesignCanvas,
  peerSnapGroupFilterForManipulator,
  peerSnapRotationLayoutFromPlotView,
  placementEquipmentSvgTitleSuffix,
  paintDiagramOrdersEqual,
  removePolylineVertexAtIndex,
  moveDiagramPaintRefToPaintExtreme,
  repairDiagramPaintOrder,
  sanitizeStagePlacementEquipment,
  sanitizeStageSvgColor,
  sanitizePeerSnapGroup,
  rectangleDeckPolygonFromCorners,
  snapPlotWorldXYToPeerAlignWithMeta,
  snapPlotWorldXYToPeerAlign,
  snapPlotWorldXYToStructuralGuidesWithMeta,
  snapPlotWorldXYToStructuralGuides,
  snapStageCoordinate,
  snapStageCoordinateStep,
  snapStageMagnetToleranceWorld,
  STAGE_DESIGN_SCHEMA_VERSION,
  SYNTHETIC_DECK_RECT_POLYGON_ID,
  type StageDeckPolygon,
  type StageDesignPlacement,
  type StageDesignShape,
} from "./stage-design-canvas";
import { DIAGRAM_LAYER_DEFAULT_ID } from "./stage-design-diagram-layers";
import { plotLayoutForCanvas } from "./stage-design-svg-layout";

describe("abbreviateStageDiagramLabel", () => {
  it("uses initials across words then caps length", () => {
    expect(abbreviateStageDiagramLabel("  Front truss line  ")).toBe("FTL");
    expect(abbreviateStageDiagramLabel("Down Stage Edge")).toBe("DSE");
  });

  it("uppercases single token prefix", () => {
    expect(abbreviateStageDiagramLabel("LX1")).toBe("LX1");
    expect(abbreviateStageDiagramLabel("PRIMARY")).toBe("PRIMAR");
    expect(abbreviateStageDiagramLabel("longcaption")).toBe("LONGCA");
    expect(abbreviateStageDiagramLabel("toolongforfield")).toBe("TOOLON");
  });

  it("returns empty for blanks or glyph-less strings", () => {
    expect(abbreviateStageDiagramLabel("")).toBe("");
    expect(abbreviateStageDiagramLabel("   ")).toBe("");
    expect(abbreviateStageDiagramLabel("!!!")).toBe("");
    expect(abbreviateStageDiagramLabel(undefined)).toBe("");
  });

  it("handles digits in words", () => {
    expect(abbreviateStageDiagramLabel("Track A1")).toBe("TA");
    expect(abbreviateStageDiagramLabel("MC2 Main")).toBe("MM");
  });
});

describe("placement equipment captions", () => {
  it("formats SVG title suffix with role and paired DMX", () => {
    const p: StageDesignPlacement = {
      id: "a",
      kind: "FIXTURE",
      x: 0,
      y: 0,
      equipment: { role: "Backlight", dmxUniverse: 1, dmxChannel: 301 },
    };
    expect(placementEquipmentSvgTitleSuffix(p)).toBe(" · Backlight · U1.301");
  });

  it("sanitize preserves universe-only patch for fixtures", () => {
    expect(sanitizeStagePlacementEquipment({ dmxUniverse: 12 }, "FIXTURE")).toEqual({ dmxUniverse: 12 });
  });

  it("sanitize preserves channel-only patch for fixtures", () => {
    expect(sanitizeStagePlacementEquipment({ dmxChannel: 418 }, "FIXTURE")).toEqual({ dmxChannel: 418 });
  });

  it("SVG title suffix omits U·ch when only universe or only channel is set on a fixture", () => {
    const uOnly: StageDesignPlacement = {
      id: "u",
      kind: "FIXTURE",
      x: 0,
      y: 0,
      equipment: { role: "FOH RGB", dmxUniverse: 6 },
    };
    expect(placementEquipmentSvgTitleSuffix(uOnly)).toBe(" · FOH RGB");
    const chOnly: StageDesignPlacement = {
      id: "c",
      kind: "FIXTURE",
      x: 0,
      y: 0,
      equipment: { dmxChannel: 418 },
    };
    expect(placementEquipmentSvgTitleSuffix(chOnly)).toBe("");
  });

  it("sanitize drops invalid DMX range", () => {
    expect(sanitizeStagePlacementEquipment({ role: "x", dmxUniverse: 999 }, "FIXTURE")).toEqual({ role: "x" });
  });
});

describe("sanitizeStageSvgColor", () => {
  it("normalizes #RGB/#RRGGBB/#RRGGBBAA and rejects non-hex", () => {
    expect(sanitizeStageSvgColor("#AbC")).toBe("#abc");
    expect(sanitizeStageSvgColor("#112233")).toBe("#112233");
    expect(sanitizeStageSvgColor("#112233AA")).toBe("#112233aa");
    expect(sanitizeStageSvgColor("red")).toBeUndefined();
    expect(sanitizeStageSvgColor("#")).toBeUndefined();
  });
});

describe("parseStageDesignCanvas", () => {
  it("defaults empty input", () => {
    expect(parseStageDesignCanvas(null)).toEqual(defaultStageDesignCanvas());
  });

  it("reads footprint with clamping", () => {
    expect(
      parseStageDesignCanvas({
        version: 1,
        footprint: { width: 9999, depth: -2 },
      }).footprint,
    ).toEqual(clampFootprint(9999, -2));
  });

  it("fills missing footprint axes from defaults", () => {
    expect(
      parseStageDesignCanvas({
        version: 1,
        footprint: { width: 12 },
      }).footprint,
    ).toEqual({ width: 12, depth: 24 });
  });

  it("reads placements and pins schema version when non-empty", () => {
    const out = parseStageDesignCanvas({
      version: 1,
      footprint: { width: 40, depth: 24 },
      placements: [{ id: "x1", kind: "POWER", x: 2, y: 4 }],
    });
    expect(out.version).toBe(STAGE_DESIGN_SCHEMA_VERSION);
    expect(out.placements).toHaveLength(1);
    expect(out.placements[0]?.id).toBe("x1");
  });

  it("keeps marker v1 when canvas has no placements, shapes, or stored plotMargins", () => {
    expect(
      parseStageDesignCanvas({ version: 1, footprint: { width: 20, depth: 12 } }).version,
    ).toBe(1);
  });

  it("uses schema v3 when plotMargins appear in persisted JSON even if placements are empty", () => {
    const out = parseStageDesignCanvas({
      version: 1,
      footprint: { width: 20, depth: 12 },
      plotMargins: { downstage: 80, upstage: 0, stageLeft: 0, stageRight: 0 },
      placements: [],
    });
    expect(out.version).toBe(STAGE_DESIGN_SCHEMA_VERSION);
    expect(out.plotMargins.downstage).toBe(80);
  });

  it("uses schema v3 when only shapes appear", () => {
    const out = parseStageDesignCanvas({
      version: 1,
      footprint: { width: 20, depth: 12 },
      shapes: [
        {
          id: "sq",
          kind: "RECT",
          x: 0,
          y: 0,
          width: 4,
          height: 4,
          label: "Box",
        },
      ],
    });
    expect(out.version).toBe(STAGE_DESIGN_SCHEMA_VERSION);
    expect(out.shapes).toHaveLength(1);
    expect(out.shapes[0]?.id).toBe("sq");
  });

  it("re-clamps legacy v1 placements to default plot margins", () => {
    const margins = DEFAULT_PLOT_MARGINS;
    const out = parseStageDesignCanvas({
      version: 1,
      footprint: { width: 10, depth: 10 },
      placements: [{ id: "foh", kind: "FIXTURE", x: 5, y: -99 }],
    });
    expect(out.placements[0]?.y).toBe(-margins.downstage);
  });

  it("does not treat array plotMargins as stored margins (version stays v1, defaults restored)", () => {
    const out = parseStageDesignCanvas({
      version: 1,
      footprint: { width: 10, depth: 10 },
      plotMargins: [] as unknown,
    } as unknown);
    expect(out.version).toBe(1);
    expect(out.plotMargins).toEqual(DEFAULT_PLOT_MARGINS);
  });

  it("parses and clamps glyphExtents for symbols (feet)", () => {
    const out = parseStageDesignCanvas(
      {
        version: 3,
        footprint: { width: 20, depth: 12 },
        placements: [
          { id: "f1", kind: "FIXTURE", x: 1, y: 1, glyphExtents: { fixtureRadius: 999 } },
          { id: "f2", kind: "FIXTURE", x: 2, y: 2, glyphExtents: { fixtureRadius: 0.08 } },
          { id: "p1", kind: "POWER", x: 3, y: 3, glyphExtents: { fixtureRadius: 5 } },
        ],
      },
      StageDesignUnit.FEET,
    );
    expect(out.placements[0]?.glyphExtents?.fixtureRadius).toBe(72);
    expect(out.placements[1]?.glyphExtents?.fixtureRadius).toBe(0.25);
    expect(out.placements[2]?.glyphExtents).toBeUndefined();
  });

  it("clamps glyphExtents using meter limits when design unit is meters", () => {
    const out = parseStageDesignCanvas(
      {
        version: 3,
        footprint: { width: 20, depth: 12 },
        placements: [{ id: "f1", kind: "FIXTURE", x: 1, y: 1, glyphExtents: { fixtureRadius: 50 } }],
      },
      StageDesignUnit.METERS,
    );
    expect(out.placements[0]?.glyphExtents?.fixtureRadius).toBe(22);
  });

  it("parses placement equipment (cue trim; DMX fixtures; ignores DMX on power)", () => {
    const out = parseStageDesignCanvas(
      {
        version: 4,
        footprint: { width: 20, depth: 12 },
        placements: [
          {
            id: "lx1",
            kind: "FIXTURE",
            x: 1,
            y: 1,
            equipment: {
              role: "  FOH key  ",
              dmxUniverse: 2,
              dmxChannel: 14,
              fixture_id: " LX-asset-44 ",
              fixtureProfile: "19° beam",
            },
          },
          {
            id: "pwr",
            kind: "POWER",
            x: 3,
            y: 3,
            equipment: { role: "Cam A", dmxUniverse: 1, dmxChannel: 1 },
          },
        ],
      },
      StageDesignUnit.FEET,
    );
    expect(out.placements[0]?.equipment).toEqual({
      role: "FOH key",
      fixtureId: "LX-asset-44",
      fixtureProfile: "19° beam",
      dmxUniverse: 2,
      dmxChannel: 14,
    });
    expect(out.placements[1]?.equipment).toEqual({ role: "Cam A" });
  });

  it("parses persisted deck polygons and pins schema version", () => {
    const out = parseStageDesignCanvas({
      version: 1,
      footprint: { width: 40, depth: 24 },
      deckPolygons: [
        {
          id: "mod_a",
          points: [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
            { x: 10, y: 6 },
            { x: 0, y: 6 },
          ],
        },
      ],
    });
    expect(out.version).toBe(STAGE_DESIGN_SCHEMA_VERSION);
    expect(out.deckPolygons?.[0]?.id).toBe("mod_a");
  });

  it("drops diagramPaintOrder when it matches default legacy stacking", () => {
    const out = parseStageDesignCanvas({
      version: 4,
      footprint: { width: 20, depth: 12 },
      shapes: [{ id: "s1", kind: "RECT", x: 1, y: 1, width: 2, height: 2 }],
      diagramPaintOrder: [
        { kind: "deck", id: SYNTHETIC_DECK_RECT_POLYGON_ID },
        { kind: "shape", id: "s1" },
      ],
    });
    expect(out.diagramPaintOrder).toBeUndefined();
  });

  it("preserves diagramPaintOrder when stacking differs from legacy deck→shapes→placements", () => {
    const out = parseStageDesignCanvas({
      version: 4,
      footprint: { width: 20, depth: 12 },
      placements: [{ id: "p1", kind: "POWER", x: 2, y: 2 }],
      shapes: [{ id: "s1", kind: "RECT", x: 1, y: 1, width: 2, height: 2 }],
      diagramPaintOrder: [
        { kind: "placement", id: "p1" },
        { kind: "deck", id: SYNTHETIC_DECK_RECT_POLYGON_ID },
        { kind: "shape", id: "s1" },
      ],
    });
    expect(out.diagramPaintOrder?.map((x) => x.kind)).toEqual(["placement", "deck", "shape"]);
  });

  it("reconciles diagramLayers seeding Main and preserving authoring rows", () => {
    const lid = "uls_parse_layer_chk";
    const out = parseStageDesignCanvas({
      version: 4,
      footprint: { width: 20, depth: 12 },
      placements: [{ id: "p1", kind: "POWER", x: 2, y: 2, layerId: lid }],
      shapes: [],
      diagramLayers: [{ id: lid, name: "Truss", group: "Rig prep" }],
    });
    expect(out.diagramLayers?.[0]?.id).toBe(DIAGRAM_LAYER_DEFAULT_ID);
    expect(out.diagramLayers?.some((r) => r.id === lid && r.name === "Truss" && r.group === "Rig prep")).toBe(true);
  });

  it("omits diagramLayers when trivial single-layer diagram", () => {
    const out = parseStageDesignCanvas({
      version: 4,
      footprint: { width: 20, depth: 12 },
      placements: [{ id: "p1", kind: "POWER", x: 2, y: 2 }],
      shapes: [],
    });
    expect(out.diagramLayers).toBeUndefined();
  });
});

describe("diagramPaintOrder helpers", () => {
  it("repairDiagramPaintOrder appends missing ids after persisted partial order", () => {
    const canvas = {
      version: STAGE_DESIGN_SCHEMA_VERSION,
      footprint: { width: 20, depth: 12 },
      plotMargins: DEFAULT_PLOT_MARGINS,
      placements: [{ id: "p1", kind: "POWER" as const, x: 2, y: 2 }],
      shapes: [],
      diagramPaintOrder: [{ kind: "placement" as const, id: "p1" }],
    };
    const r = repairDiagramPaintOrder(canvas);
    expect(r[0]?.kind).toBe("placement");
    expect(r.some((x) => x.kind === "deck")).toBe(true);
  });

  it("paintDiagramOrdersEqual compares kind and id sequences", () => {
    expect(
      paintDiagramOrdersEqual(
        [
          { kind: "shape", id: "a" },
          { kind: "deck", id: "d" },
        ],
        [
          { kind: "shape", id: "a" },
          { kind: "deck", id: "d" },
        ],
      ),
    ).toBe(true);
    expect(
      paintDiagramOrdersEqual(
        [{ kind: "shape", id: "a" }],
        [{ kind: "placement", id: "a" }],
      ),
    ).toBe(false);
  });

  it("moveDiagramPaintRefToPaintExtreme moves to stack back or front", () => {
    const order = [
      { kind: "deck" as const, id: "d1" },
      { kind: "shape" as const, id: "s1" },
      { kind: "placement" as const, id: "p1" },
    ];
    expect(moveDiagramPaintRefToPaintExtreme(order, { kind: "placement", id: "p1" }, "back")).toEqual([
      { kind: "placement", id: "p1" },
      { kind: "deck", id: "d1" },
      { kind: "shape", id: "s1" },
    ]);
    expect(moveDiagramPaintRefToPaintExtreme(order, { kind: "deck", id: "d1" }, "front")).toEqual([
      { kind: "shape", id: "s1" },
      { kind: "placement", id: "p1" },
      { kind: "deck", id: "d1" },
    ]);
  });

  it("moveDiagramPaintRefToPaintExtreme returns null when missing or already at extreme", () => {
    const order = [
      { kind: "shape" as const, id: "s1" },
      { kind: "deck" as const, id: "d1" },
    ];
    expect(moveDiagramPaintRefToPaintExtreme(order, { kind: "shape", id: "ghost" }, "back")).toBeNull();
    expect(moveDiagramPaintRefToPaintExtreme(order, { kind: "shape", id: "s1" }, "back")).toBeNull();
    expect(moveDiagramPaintRefToPaintExtreme(order, { kind: "deck", id: "d1" }, "front")).toBeNull();
  });
});

describe("snapStageCoordinate", () => {
  it("snaps feet to halves", () => {
    expect(snapStageCoordinate(10.28, "FEET")).toBe(10.5);
    expect(snapStageCoordinate(3.01, "FEET")).toBe(3);
  });

  it("snaps meters to quarters", () => {
    expect(snapStageCoordinate(8.51, "METERS")).toBe(8.5);
  });
});

describe("parsePlacementsFromJsonString", () => {
  it("parses POST JSON with clamping to deck when plot has zero margins", () => {
    const fp = { width: 10, depth: 10 };
    const zm = { downstage: 0, upstage: 0, stageLeft: 0, stageRight: 0 };
    const raw =
      '[{"id":"a","kind":"FIXTURE","x":99,"y":-5},{"id":"bad","kind":"NOT_A_KIND","x":1,"y":1}]';
    const out = parsePlacementsFromJsonString(raw, fp, zm);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(
      expect.objectContaining({
        id: "a",
        kind: "FIXTURE",
        x: 10,
        y: 0,
      }),
    );
  });

  it("allows FOH negatives when downstage margin is set", () => {
    const fp = { width: 10, depth: 10 };
    const margins = { downstage: 20, upstage: 0, stageLeft: 0, stageRight: 0 };
    const raw = '[{"id":"b","kind":"FIXTURE","x":5,"y":-12}]';
    const out = parsePlacementsFromJsonString(raw, fp, margins);
    expect(out[0]).toEqual(expect.objectContaining({ id: "b", y: -12 }));
  });
});

describe("parseShapesFromJsonString", () => {
  const fp = { width: 20, depth: 12 };
  const margins = { downstage: 48, upstage: 12, stageLeft: 16, stageRight: 16 };

  it("parses RECT with clamping inside plot bounds", () => {
    const raw = JSON.stringify([
      { id: "r1", kind: "RECT", x: 5, y: -30, width: 100, height: 5, label: "Truss" },
      { id: "skip", kind: "NOT_SHAPE", x: 0, y: 0 },
    ]);
    const out = parseShapesFromJsonString(raw, fp, margins);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual(
      expect.objectContaining({ id: "r1", kind: "RECT", label: "Truss", y: -30, width: 31, height: 5 }),
    );
  });

  it("parses LINE with both endpoints clamped", () => {
    const raw = JSON.stringify([
      {
        id: "ln",
        kind: "LINE",
        x: -50,
        y: -60,
        x2: 999,
        y2: 999,
      },
    ]);
    const out = parseShapesFromJsonString(raw, fp, margins);
    expect(out[0]).toEqual(
      expect.objectContaining({
        id: "ln",
        kind: "LINE",
        x: -margins.stageLeft,
        y: -margins.downstage,
      }),
    );
  });

  it("parses POLYLINE and preserves ordered vertices", () => {
    const raw = JSON.stringify([
      {
        id: "pl1",
        kind: "POLYLINE",
        x: 2,
        y: 2,
        vertices: [
          { x: 2, y: 2 },
          { x: 6, y: 2 },
          { x: 6, y: 6 },
        ],
      },
    ]);
    const out = parseShapesFromJsonString(raw, fp, margins);
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe("POLYLINE");
    expect((out[0] as { vertices?: { x: number; y: number }[] }).vertices).toEqual([
      { x: 2, y: 2 },
      { x: 6, y: 2 },
      { x: 6, y: 6 },
    ]);
  });

  it("parses RECT fill and drops malformed stroke", () => {
    const fp = { width: 20, depth: 12 };
    const margins = { downstage: 48, upstage: 12, stageLeft: 16, stageRight: 16 };
    const raw = JSON.stringify([
      { id: "r", kind: "RECT", x: 2, y: 2, width: 6, height: 4, fill: "#00FF00aa", stroke: "bogus" },
    ]);
    const out = parseShapesFromJsonString(raw, fp, margins);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      id: "r",
      kind: "RECT",
      fill: "#00ff00aa",
    });
    expect("stroke" in (out[0] as object)).toBe(false);
  });

  it("parses TEXT and drops malformed rows", () => {
    const raw = JSON.stringify([{ id: "t", kind: "TEXT", x: 1, y: 2 }, { kind: "TEXT", x: 0, y: 0 }]);
    const out = parseShapesFromJsonString(raw, fp, margins);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe("t");
  });
});

describe("polyline vertex edit helpers", () => {
  it("insertPolylineVertexOnSegment splices after the segment start index", () => {
    const v = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    const out = insertPolylineVertexOnSegment(v, 0, { x: 5, y: 1 });
    expect(out).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 1 },
      { x: 10, y: 0 },
    ]);
  });

  it("insertPolylineVertexOnSegment returns null on invalid segment or at cap", () => {
    const two = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    expect(insertPolylineVertexOnSegment(two, -1, { x: 0, y: 0 })).toBeNull();
    expect(insertPolylineVertexOnSegment(two, 1, { x: 0, y: 0 })).toBeNull();
    const capped = Array.from({ length: MAX_STAGE_SHAPE_POLYLINE_VERTICES }, (_, i) => ({ x: i, y: 0 }));
    expect(insertPolylineVertexOnSegment(capped, 0, { x: 0.5, y: 0 })).toBeNull();
  });

  it("removePolylineVertexAtIndex keeps at least two vertices", () => {
    const three = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(removePolylineVertexAtIndex(three, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
    expect(removePolylineVertexAtIndex(three, -1)).toBeNull();
    expect(removePolylineVertexAtIndex(three, 99)).toBeNull();
    const two = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];
    expect(removePolylineVertexAtIndex(two, 0)).toBeNull();
    expect(removePolylineVertexAtIndex(two, 1)).toBeNull();
  });
});

describe("snapStageCoordinateStep", () => {
  it("matches grid spacing used by snapStageCoordinate", () => {
    expect(snapStageCoordinateStep("FEET")).toBe(0.5);
    expect(snapStageCoordinateStep("METERS")).toBe(0.25);
  });
});

describe("snapStageMagnetToleranceWorld", () => {
  it("tracks grid step sizing", () => {
    expect(snapStageMagnetToleranceWorld("FEET")).toBeCloseTo(snapStageCoordinateStep("FEET"), 12);
    expect(snapStageMagnetToleranceWorld("METERS")).toBeCloseTo(snapStageCoordinateStep("METERS"), 12);
  });
});

describe("snapPlotWorldXYToStructuralGuides", () => {
  it("pulls XY to nearest deck vertex within magnet radius (feet)", () => {
    const pb = { minX: -5, maxX: 50, minY: -8, maxY: 32 };
    const poly = rectangleDeckPolygonFromCorners("r1", 0, 0, 20, 24);
    const out = snapPlotWorldXYToStructuralGuides(19.72, 24.08, pb, [poly], "FEET");
    expect(out.wx).toBe(20);
    expect(out.wy).toBe(24);
  });

  it("projects to the nearest point on a deck perimeter segment (feet)", () => {
    const pb = { minX: -5, maxX: 50, minY: -8, maxY: 32 };
    const poly = rectangleDeckPolygonFromCorners("r1", 0, 0, 20, 24);
    const out = snapPlotWorldXYToStructuralGuides(10.08, -0.18, pb, [poly], "FEET");
    expect(out.wy).toBeCloseTo(0, 12);
    expect(out.wx).toBeCloseTo(10.08, 12);
  });

  it("snaps perpendicular to sloped deck perimeter segments, not only cardinals (feet)", () => {
    const pb = { minX: -4, maxX: 50, minY: -4, maxY: 50 };
    const tri: StageDeckPolygon = {
      id: "tri",
      points: [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
      ],
    };
    const out = snapPlotWorldXYToStructuralGuides(21.06, 20.93, pb, [tri], "FEET");
    expect(Math.abs(out.wx - out.wy)).toBeLessThan(1e-5);
    expect(out.wx).toBeGreaterThan(19.5);
    expect(out.wx).toBeLessThan(21.55);
  });

  it("snaps orthogonal axes toward plot rim when close (feet)", () => {
    const pb = { minX: 0, maxX: 40, minY: 0, maxY: 24 };
    const poly = rectangleDeckPolygonFromCorners("r1", 5, 5, 35, 20);
    const out = snapPlotWorldXYToStructuralGuides(-0.42, 12, pb, [poly], "FEET");
    expect(out.wx).toBe(0);
    expect(out.wy).toBeCloseTo(12, 12);
    const tol = snapStageMagnetToleranceWorld("FEET");
    const towardMaxY = snapPlotWorldXYToStructuralGuides(16, pb.maxY - tol * 0.6, pb, [poly], "FEET");
    expect(towardMaxY.wy).toBe(pb.maxY);
  });

  it("WithMeta reports guide axes for vertex snap (feet)", () => {
    const pb = { minX: -5, maxX: 50, minY: -8, maxY: 32 };
    const poly = rectangleDeckPolygonFromCorners("r1", 0, 0, 20, 24);
    const m = snapPlotWorldXYToStructuralGuidesWithMeta(19.72, 24.08, pb, [poly], "FEET");
    expect(m.structuralGuideVerticalWorldX).toBe(20);
    expect(m.structuralGuideHorizontalWorldY).toBe(24);
    expect(m.structuralGuideEdgeWorld).toBeUndefined();
  });

  it("WithMeta reports vertical guide when only plot minX rim snaps (feet)", () => {
    const pb = { minX: 0, maxX: 40, minY: 0, maxY: 24 };
    const poly = rectangleDeckPolygonFromCorners("r1", 5, 5, 35, 20);
    const m = snapPlotWorldXYToStructuralGuidesWithMeta(-0.42, 12, pb, [poly], "FEET");
    expect(m.structuralGuideVerticalWorldX).toBe(0);
    expect(m.structuralGuideHorizontalWorldY).toBeUndefined();
  });

  it("WithMeta reports crosshair at deck edge foot when close to perimeter (feet)", () => {
    const pb = { minX: -5, maxX: 50, minY: -8, maxY: 32 };
    const poly = rectangleDeckPolygonFromCorners("r1", 0, 0, 20, 24);
    const m = snapPlotWorldXYToStructuralGuidesWithMeta(10.08, -0.18, pb, [poly], "FEET");
    expect(m.wy).toBeCloseTo(0, 12);
    expect(m.structuralGuideHorizontalWorldY).toBeCloseTo(0, 12);
    expect(m.structuralGuideVerticalWorldX).toBeCloseTo(10.08, 12);
  });

  it("WithMeta includes structuralGuideEdgeWorld along the snapped perimeter segment (feet)", () => {
    const pb = { minX: -5, maxX: 50, minY: -8, maxY: 32 };
    const poly = rectangleDeckPolygonFromCorners("r1", 0, 0, 20, 24);
    const m = snapPlotWorldXYToStructuralGuidesWithMeta(10.08, -0.18, pb, [poly], "FEET");
    expect(m.structuralGuideEdgeWorld).toBeDefined();
    const e = m.structuralGuideEdgeWorld!;
    const minX = Math.min(e.x1, e.x2);
    const maxX = Math.max(e.x1, e.x2);
    expect(Math.abs(e.y1)).toBeLessThan(1e-9);
    expect(Math.abs(e.y2)).toBeLessThan(1e-9);
    expect(minX).toBeLessThanOrEqual(0 + 1e-9);
    expect(maxX).toBeGreaterThanOrEqual(20 - 1e-9);
  });
});

describe("peerSnapGroup — magnet isolation + filter helper", () => {
  it("sanitizePeerSnapGroup trims and rejects unsafe characters", () => {
    expect(sanitizePeerSnapGroup("  lx-rig-A1\t")).toBe("lx-rig-A1");
    expect(sanitizePeerSnapGroup("a/b")).toBeUndefined();
    expect(sanitizePeerSnapGroup("")).toBeUndefined();
  });

  it("peerSnapGroupFilterForManipulator returns one tag only when unanimous and tagged", () => {
    const placements: StageDesignPlacement[] = [
      { id: "a", kind: "FIXTURE", x: 0, y: 0, peerSnapGroup: "LX" },
      { id: "b", kind: "POWER", x: 1, y: 1, peerSnapGroup: "LX" },
    ];
    expect(
      peerSnapGroupFilterForManipulator({
        placements,
        shapes: [],
        movingPlacementIds: ["a", "b"],
        movingShapeIds: [],
      }),
    ).toBe("LX");
    expect(
      peerSnapGroupFilterForManipulator({
        placements,
        shapes: [],
        movingPlacementIds: ["a"],
        movingShapeIds: [],
      }),
    ).toBe("LX");
    expect(
      peerSnapGroupFilterForManipulator({
        placements,
        shapes: [{ id: "s1", kind: "RECT", x: 0, y: 0, width: 1, height: 1 }],
        movingPlacementIds: ["a"],
        movingShapeIds: ["s1"],
      }),
    ).toBeUndefined();
  });

  it("isolates peers when exclude.peerSnapGroup is set so ungrouped neighbors do not win", () => {
    const placements: StageDesignPlacement[] = [
      { id: "lx_base", kind: "FIXTURE", x: 10, y: 20, peerSnapGroup: "LX" },
      { id: "rig_n", kind: "FIXTURE", x: 15.06, y: 20 },
      { id: "lx_mov", kind: "FIXTURE", x: 16, y: 20, peerSnapGroup: "LX" },
    ];
    const withFilter = snapPlotWorldXYToPeerAlignWithMeta(
      15.44,
      20.06,
      placements,
      [],
      "FEET",
      { placementId: "lx_mov", peerSnapGroup: "LX" },
      StageDesignUnit.FEET,
    );
    const bare = snapPlotWorldXYToPeerAlignWithMeta(15.44, 20.06, placements, [], "FEET", { placementId: "lx_mov" }, StageDesignUnit.FEET);
    expect(withFilter.wx).toBeCloseTo(15.44, 12);
    expect(bare.wx).toBeCloseTo(15.06, 12);
    expect(withFilter.peerGuideVerticalWorldX).toBeUndefined();
    expect(bare.peerGuideVerticalWorldX).toBeCloseTo(15.06, 12);
  });
});

describe("snapPlotWorldXYToPeerAlign", () => {
  it("snaps each axis to nearest other placement anchor (feet)", () => {
    const placements: StageDesignPlacement[] = [
      { id: "a", kind: "FIXTURE", x: 10, y: 5 },
      { id: "b", kind: "FIXTURE", x: 10.55, y: 8 },
    ];
    const out = snapPlotWorldXYToPeerAlign(10.48, 8, placements, [], "FEET", { placementId: "b" }, StageDesignUnit.FEET);
    expect(out.wx).toBe(10);
    expect(out.wy).toBe(8);
  });

  it("uses rectangle bbox edges/centers as alignment targets and skips excluded shape id", () => {
    const placements: StageDesignPlacement[] = [{ id: "fixture_a", kind: "FIXTURE", x: -100, y: -100 }];
    const shapes: StageDesignShape[] = [
      { id: "r1", kind: "RECT", x: 20, y: 20, width: 4, height: 2 },
      { id: "r2", kind: "RECT", x: 24.42, y: 19.86, width: 3, height: 2 },
    ];
    const out = snapPlotWorldXYToPeerAlign(24.44, 20.1, placements, shapes, "FEET", { shapeId: "r2" }, StageDesignUnit.FEET);
    expect(out.wx).toBeCloseTo(24, 12);
    expect(out.wy).toBeCloseTo(20, 12);
  });

  it("includes ellipse horizontal/vertical extents in peer snaps (feet)", () => {
    const shapes: StageDesignShape[] = [
      { id: "e1", kind: "ELLIPSE", x: 10, y: 14, width: 4, height: 2 },
      { id: "e2", kind: "ELLIPSE", x: 13.92, y: 13.9, width: 2, height: 2 },
    ];
    const out = snapPlotWorldXYToPeerAlign(13.92, 13.9, [], shapes, "FEET", { shapeId: "e2" }, StageDesignUnit.FEET);
    expect(out.wx).toBeCloseTo(14, 12);
    expect(out.wy).toBeCloseTo(14, 12);
  });

  it("aligns symbols to truss endpoints in world XY (feet)", () => {
    const placements: StageDesignPlacement[] = [
      { id: "t1", kind: "TRUSS", x: 20, y: 24 },
      { id: "f1", kind: "FIXTURE", x: 23.92, y: 24 },
    ];
    const out = snapPlotWorldXYToPeerAlign(23.92, 24, placements, [], "FEET", { placementId: "f1" }, StageDesignUnit.FEET);
    expect(out.wx).toBeCloseTo(24.25, 10);
    expect(out.wy).toBeCloseTo(24, 12);
  });

  it("uses SVG-consistent rotation for truss peer targets when plot layout is passed (feet)", () => {
    const canvas = defaultStageDesignCanvas();
    const { lay } = plotLayoutForCanvas(canvas, canvas.plotMargins);
    const rotLay = peerSnapRotationLayoutFromPlotView(lay);
    const placements: StageDesignPlacement[] = [
      { id: "t90", kind: "TRUSS", x: 20, y: 24, rotationDeg: 90 },
      { id: "fmov", kind: "FIXTURE", x: 20.08, y: 28.18 },
    ];
    const out = snapPlotWorldXYToPeerAlign(20.08, 28.18, placements, [], "FEET", { placementId: "fmov" }, StageDesignUnit.FEET, rotLay);
    expect(out.wx).toBeCloseTo(20, 10);
    expect(out.wy).toBeCloseTo(28.25, 10);
    const meta = snapPlotWorldXYToPeerAlignWithMeta(20.08, 28.18, placements, [], "FEET", { placementId: "fmov" }, StageDesignUnit.FEET, rotLay);
    expect(meta.peerGuideVerticalWorldX).toBeCloseTo(20, 10);
    expect(meta.peerGuideHorizontalWorldY).toBeCloseTo(28.25, 10);
  });

  it("uses estimated TEXT label bbox edges as peer magnets when plot layout is passed", () => {
    const canvas = defaultStageDesignCanvas();
    const { lay } = plotLayoutForCanvas(canvas, canvas.plotMargins);
    const rotLay = peerSnapRotationLayoutFromPlotView(lay);
    const shapes: StageDesignShape[] = [{ id: "t1", kind: "TEXT", x: 10, y: 14, label: "Hello" }];
    /** Near right edge of abbreviated TEXT bbox (HELLO peer model). */
    const probe = 11.48;
    const without = snapPlotWorldXYToPeerAlign(probe, 14, [], shapes, "FEET", { shapeId: "x" }, StageDesignUnit.FEET, null);
    const withLay = snapPlotWorldXYToPeerAlign(probe, 14, [], shapes, "FEET", { shapeId: "x" }, StageDesignUnit.FEET, rotLay);
    expect(without.wx).toBe(probe);
    expect(withLay.wx).not.toBe(probe);
    expect(Math.abs(withLay.wx - 10)).toBeGreaterThan(0.51);
    const meta = snapPlotWorldXYToPeerAlignWithMeta(probe, 14, [], shapes, "FEET", { shapeId: "x" }, StageDesignUnit.FEET, rotLay);
    expect(meta.peerGuideVerticalWorldX).toBeDefined();
    expect(meta.wx).toBeCloseTo(meta.peerGuideVerticalWorldX as number, 12);
    expect(withLay.wy).toBe(14);
  });

  it("snapPlotWorldXYToPeerAlignWithMeta reports axes that latched to a peer guide", () => {
    const placements: StageDesignPlacement[] = [
      { id: "a", kind: "FIXTURE", x: 10, y: 5 },
      { id: "b", kind: "FIXTURE", x: 22, y: 8 },
    ];
    /** Exclude id absent from placements so both fixtures contribute peers (dragging phantom item). */
    const r = snapPlotWorldXYToPeerAlignWithMeta(
      10.48,
      8.06,
      placements,
      [],
      "FEET",
      { placementId: "__cursor__" },
      StageDesignUnit.FEET,
    );
    expect(r.wx).toBe(10);
    expect(r.wy).toBe(8);
    expect(r.peerGuideVerticalWorldX).toBe(10);
    expect(r.peerGuideHorizontalWorldY).toBe(8);
  });

  it("omits peer guide fields when no peer lies within magnet tolerance", () => {
    const placements: StageDesignPlacement[] = [{ id: "a", kind: "FIXTURE", x: 0, y: 0 }];
    const r = snapPlotWorldXYToPeerAlignWithMeta(
      100,
      100,
      placements,
      [],
      "FEET",
      { placementId: "b" },
      StageDesignUnit.FEET,
    );
    expect(r.peerGuideVerticalWorldX).toBeUndefined();
    expect(r.peerGuideHorizontalWorldY).toBeUndefined();
  });
});
