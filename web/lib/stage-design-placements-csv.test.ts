import { StageDesignUnit } from "@prisma/client";
import { describe, expect, it } from "vitest";

import type { StageDeckPolygon, StageDesignPlacement, StageDesignShape } from "./stage-design-canvas";
import {
  rectangleDeckPolygonFromCorners,
  SYNTHETIC_DECK_RECT_POLYGON_ID,
} from "./stage-design-canvas";
import {
  buildStageDesignDeckCsv,
  buildStageDesignDiagramBomCsv,
  buildStageDesignPlacementsCsv,
  buildStageDesignShapesCsv,
  csvEscapeDiagramField,
  filterStageDesignDeckPolygonsForExport,
} from "./stage-design-placements-csv";

describe("csvEscapeDiagramField", () => {
  it("wraps commas and quotes per RFC-ish rules", () => {
    expect(csvEscapeDiagramField(`a,b`)).toBe('"a,b"');
    expect(csvEscapeDiagramField(`say "hi"`)).toBe('"say ""hi"""');
    expect(csvEscapeDiagramField("plain")).toBe("plain");
  });

  it("normalizes CRLF inside fields", () => {
    expect(csvEscapeDiagramField("a\r\nb")).toBe('"a\nb"');
  });
});

describe("buildStageDesignShapesCsv", () => {
  it("encodes RECT / LINE / POLYLINE semantics in columns", () => {
    const shapes: StageDesignShape[] = [
      {
        id: "sq",
        kind: "RECT",
        x: 0,
        y: 0,
        width: 4,
        height: 6,
      },
      {
        id: "ln",
        kind: "LINE",
        x: 1,
        y: 2,
        x2: 9,
        y2: -1,
      },
      {
        id: "zig",
        kind: "POLYLINE",
        x: 0,
        y: 0,
        vertices: [
          { x: 0, y: 0 },
          { x: 3, y: 0 },
          { x: 3, y: 2 },
          { x: 1, y: 2 },
        ],
      },
    ];
    const csv = buildStageDesignShapesCsv({ unit: StageDesignUnit.FEET, shapes });
    expect(csv).toContain(
      "id,shape_kind,label,anchor_x (ft),anchor_y (ft),rotation_deg,diagram_layer_id,peer_snap_group,cable_run,width_span",
    );
    expect(csv).toContain("ln,Line,,1,2,0,,,,,,9,-1,,");
    expect(csv).toContain("sq,Rectangle,,0,0,0,,,,4,6,,,,");
    expect(csv).toContain("zig,Polyline,,0,0,0,,,,,,,,4,0|0 3|0 3|2 1|2");
  });

  it("emits peer_snap_group when shapes carry the authoring tag", () => {
    const csv = buildStageDesignShapesCsv({
      unit: StageDesignUnit.FEET,
      shapes: [{ id: "r", kind: "RECT", x: 0, y: 0, width: 1, height: 1, peerSnapGroup: "scenic-A" }],
    });
    expect(csv).toContain("peer_snap_group");
    expect(csv).toContain("r,Rectangle,,0,0,0,,scenic-A,,1,1,,,,");
  });
});

describe("filterStageDesignDeckPolygonsForExport", () => {
  it("drops synthetic nominal deck polygon id", () => {
    const rect = rectangleDeckPolygonFromCorners("real", 0, 0, 4, 3);
    const filtered = filterStageDesignDeckPolygonsForExport([
      rect,
      {
        id: SYNTHETIC_DECK_RECT_POLYGON_ID,
        points: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 1 },
          { x: 0, y: 1 },
        ],
      },
    ]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("real");
  });
});

describe("buildStageDesignDeckCsv", () => {
  it("lists vertices, bbox, and geom-summary ring", () => {
    const tri: StageDeckPolygon = {
      id: "deck_tri",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: -4 },
      ],
    };
    const csv = buildStageDesignDeckCsv({ unit: StageDesignUnit.FEET, deckPolygons: [tri] });
    expect(csv).toContain("id,vertex_count,diagram_layer_id,bbox_min_x (ft)");
    expect(csv).toContain("deck_tri,3,,0,10,-4,0,0|0 10|0 5|-4");
  });
});

describe("buildStageDesignDiagramBomCsv", () => {
  it("combines symbols and shapes with a blank separator", () => {
    const placements: StageDesignPlacement[] = [
      { id: "p", kind: "POWER", x: 1, y: 2 },
    ];
    const shapes: StageDesignShape[] = [{ id: "sq", kind: "RECT", x: 3, y: 3, width: 1, height: 2 }];
    const bom = buildStageDesignDiagramBomCsv({ unit: StageDesignUnit.METERS, placements, shapes });
    expect(bom).toContain("id,kind,note,position_x (m)");
    expect(bom).toContain("id,shape_kind,label,anchor_x (m)");
    expect(bom).toContain("\r\n\r\nid,shape_kind,");
  });

  it("places deck block after symbols and shapes when modules exist", () => {
    const deck = rectangleDeckPolygonFromCorners("d1", 0, 0, 2, 2);
    const bom = buildStageDesignDiagramBomCsv({
      unit: StageDesignUnit.FEET,
      placements: [{ id: "p", kind: "POWER", x: 1, y: 1 }],
      shapes: [{ id: "sq", kind: "RECT", x: 0, y: 0, width: 1, height: 1 }],
      deckPolygons: [deck],
    });
    expect(bom.indexOf("id,kind,")).toBeLessThan(bom.indexOf("id,shape_kind,"));
    expect(bom.indexOf("id,shape_kind,")).toBeLessThan(bom.indexOf("id,vertex_count,"));
    expect(bom).toContain("d1,4,,0,2,0,2,");
    expect(bom.split("\r\n\r\n")[0]!).toMatch(/peer_snap_group/);
  });

  it("returns deck-only when symbols and shapes are empty but deck modules exist", () => {
    const bom = buildStageDesignDiagramBomCsv({
      unit: StageDesignUnit.FEET,
      placements: [],
      shapes: [],
      deckPolygons: [rectangleDeckPolygonFromCorners("only", 1, -1, 4, 2)],
    });
    expect(bom.startsWith("id,vertex_count,diagram_layer_id,bbox_min_x (ft)")).toBe(true);
  });

  it("returns symbols header only when placements, shapes, and deck export are empty", () => {
    expect(
      buildStageDesignDiagramBomCsv({
        unit: StageDesignUnit.FEET,
        placements: [],
        shapes: [],
      }).startsWith("id,kind,note"),
    ).toBe(true);
  });

  it("filters symbol rows without dropping shapes/deck unless focusedSlice", () => {
    const bom = buildStageDesignDiagramBomCsv({
      unit: StageDesignUnit.FEET,
      placements: [
        { id: "t", kind: "TRUSS", x: 0, y: 0 },
        { id: "f", kind: "FIXTURE", x: 1, y: 1 },
      ],
      shapes: [{ id: "sq", kind: "RECT", x: 0, y: 0, width: 1, height: 1 }],
      placementKindsFilter: ["TRUSS"],
      focusedSlice: false,
    });
    expect(bom).toContain("t,Truss segment");
    expect(bom).not.toContain("f,Lighting fixture");
    expect(bom).toContain("id,shape_kind,label");
  });

  it("focusedSlice with placementKindsFilter omits shapes and deck blocks", () => {
    const bom = buildStageDesignDiagramBomCsv({
      unit: StageDesignUnit.FEET,
      placements: [
        { id: "t", kind: "TRUSS", x: 0, y: 0 },
        { id: "f", kind: "FIXTURE", x: 1, y: 1 },
      ],
      shapes: [{ id: "sq", kind: "RECT", x: 0, y: 0, width: 1, height: 1 }],
      deckPolygons: [rectangleDeckPolygonFromCorners("d", 0, 0, 2, 2)],
      placementKindsFilter: ["TRUSS"],
      focusedSlice: true,
    });
    expect(bom.startsWith("id,kind,note")).toBe(true);
    expect(bom).toContain("t,Truss segment");
    expect(bom).not.toContain("f,Lighting fixture");
    expect(bom).not.toContain("id,shape_kind,");
    expect(bom).not.toContain("id,vertex_count,");
  });

  it("focusedSlice with FIXTURE filter omits shapes and deck blocks", () => {
    const bom = buildStageDesignDiagramBomCsv({
      unit: StageDesignUnit.FEET,
      placements: [
        { id: "fx", kind: "FIXTURE", x: 0, y: 0 },
        { id: "t", kind: "TRUSS", x: 1, y: 1 },
      ],
      shapes: [{ id: "sq", kind: "RECT", x: 0, y: 0, width: 1, height: 1 }],
      deckPolygons: [rectangleDeckPolygonFromCorners("d", 0, 0, 2, 2)],
      placementKindsFilter: ["FIXTURE"],
      focusedSlice: true,
    });
    expect(bom.startsWith("id,kind,note")).toBe(true);
    expect(bom).toContain("fx,Lighting fixture");
    expect(bom).not.toContain("t,Truss segment");
    expect(bom).not.toContain("id,shape_kind,");
    expect(bom).not.toContain("id,vertex_count,");
  });

  it("returns shapes-only when no symbols exist", () => {
    expect(
      buildStageDesignDiagramBomCsv({
        unit: StageDesignUnit.FEET,
        placements: [],
        shapes: [{ id: "sq", kind: "RECT", x: 0, y: 0, width: 1, height: 1 }],
      }).startsWith("id,shape_kind,label"),
    ).toBe(true);
  });
});

describe("buildStageDesignPlacementsCsv", () => {
  it("lists sorted symbols with tier and equipment columns", () => {
    const layerId = "uls_layer_mid";
    const placements: StageDesignPlacement[] = [
      {
        id: "z",
        kind: "POWER",
        x: 1,
        y: 2,
        equipment: { role: "rack A", dmxUniverse: 99 },
      },
      {
        id: "a",
        kind: "FIXTURE",
        x: 10,
        y: -8,
        rotationDeg: 90,
        note: `note, "lite"`,
        layerId,
        equipment: { role: "SL", dmxUniverse: 2, dmxChannel: 5 },
      },
    ];
    const csv = buildStageDesignPlacementsCsv({ unit: StageDesignUnit.FEET, placements });
    expect(
      csv.startsWith(
        `id,kind,note,position_x (ft),position_y (ft),rotation_deg,diagram_layer_id,peer_snap_group,cue_role,patch_note,gel_note,fixture_id,fixture_profile,dmx_universe,dmx_channel\r\n`,
      ),
    ).toBe(true);
    expect(csv).toContain(`a,Lighting fixture (generic),"note, ""lite""",10,-8,90,${layerId},,SL,,,,,2,5`);
    expect(csv).toContain(`z,Power / distro hub,,1,2,0,,,rack A,,,,,99,`);
  });

  it("emits blank diagram_layer_id for Main (default tier)", () => {
    const csv = buildStageDesignPlacementsCsv({
      unit: StageDesignUnit.METERS,
      placements: [{ id: "fx", kind: "FIXTURE", x: 0, y: 0 }],
    });
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(`fx,Lighting fixture (generic),,0,0,0,,,,,,,,,`);
  });

  it("emits sanitized peer_snap_group for symbols table rows", () => {
    const csv = buildStageDesignPlacementsCsv({
      unit: StageDesignUnit.FEET,
      placements: [{ id: "tagged", kind: "FIXTURE", x: 0, y: 0, peerSnapGroup: "LX-rig-Z" }],
    });
    expect(csv).toContain("peer_snap_group");
    expect(csv).toContain(",LX-rig-Z,,,,,");
  });
});
