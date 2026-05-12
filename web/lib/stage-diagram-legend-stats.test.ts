import { describe, expect, it } from "vitest";

import {
  parseStageDesignCanvas,
  STAGE_DESIGN_SCHEMA_VERSION,
} from "./stage-design-canvas";
import type { StageDesignCanvas } from "./stage-design-canvas";
import {
  histogramPlacementKinds,
  histogramShapeKinds,
  summarizeDiagramTiersForLegend,
  summarizeEquipmentMetadataForLegend,
} from "./stage-diagram-legend-stats";

const emptyCanvasBase = (): StageDesignCanvas => ({
  version: STAGE_DESIGN_SCHEMA_VERSION,
  footprint: { width: 20, depth: 16 },
  plotMargins: { downstage: 4, upstage: 6, stageLeft: 10, stageRight: 10 },
  placements: [],
  shapes: [],
});

describe("histogramPlacementKinds", () => {
  it("counts each symbol kind independently", () => {
    const m = histogramPlacementKinds([
      { id: "a", kind: "FIXTURE", x: 0, y: 0 },
      { id: "b", kind: "FIXTURE", x: 1, y: 1 },
      { id: "c", kind: "TRUSS", x: 2, y: -1 },
    ]);
    expect(m.get("FIXTURE")).toBe(2);
    expect(m.get("TRUSS")).toBe(1);
    expect(m.get("POWER")).toBe(0);
  });
});

describe("histogramShapeKinds", () => {
  it("counts shape kinds independently", () => {
    const m = histogramShapeKinds([
      { id: "x", kind: "RECT", x: 0, y: 0, width: 1, height: 1 },
      { id: "y", kind: "RECT", x: 0, y: 0, width: 1, height: 1 },
      { id: "z", kind: "LINE", x: 0, y: 0, x2: 1, y2: 1 },
    ]);
    expect(m.get("RECT")).toBe(2);
    expect(m.get("LINE")).toBe(1);
    expect(m.get("TEXT")).toBe(0);
  });
});

describe("summarizeDiagramTiersForLegend", () => {
  it("does not advertise tiers for implicit Main-only canvas", () => {
    const canvas = emptyCanvasBase();
    const sum = summarizeDiagramTiersForLegend(canvas);
    expect(sum.show).toBe(false);
    expect(sum.visibleLabelsBottomToTop).toEqual(["Main"]);
    expect(sum.visibleTierRowsBottomToTop.map((t) => t.name)).toEqual(["Main"]);
    expect(sum.visibleTierRowsBottomToTop.every((t) => t.id.length > 0)).toBe(true);
    expect(sum.hiddenTierLabels).toEqual([]);
  });

  it("shows when more than Main exists or any tier hidden", () => {
    const canvasVisible: StageDesignCanvas = {
      ...emptyCanvasBase(),
      diagramLayers: [
        { id: "rig", name: "Rig", visible: true },
        { id: "notes", name: "Notes", visible: true },
      ],
    };
    const v = summarizeDiagramTiersForLegend(canvasVisible);
    expect(v.show).toBe(true);
    expect(v.visibleLabelsBottomToTop).toContain("Main");
    expect(v.visibleLabelsBottomToTop).toContain("Rig");
    expect(v.visibleTierRowsBottomToTop.find((t) => t.name === "Rig")?.id).toBe("rig");

    const canvasHidden: StageDesignCanvas = {
      ...emptyCanvasBase(),
      diagramLayers: [{ id: "old", name: "Archive", visible: false }],
    };
    expect(summarizeDiagramTiersForLegend(canvasHidden).show).toBe(true);
    expect(summarizeDiagramTiersForLegend(canvasHidden).hiddenTierLabels).toContain("Archive");
  });

  it("surfaces folder path hint and bracket lock cues for Show legend parity", () => {
    const canvas: StageDesignCanvas = {
      ...emptyCanvasBase(),
      diagramLayers: [{ id: "lx", name: "Wash", group: "Lighting / LX", bracketReorderLocked: true }],
    };
    const s = summarizeDiagramTiersForLegend(canvas);
    const wash = s.visibleTierRowsBottomToTop.find((t) => t.name === "Wash");
    expect(wash?.folderPathHint).toBe("Lighting / LX");
    expect(wash?.drawOrderLocked).toBe(true);
  });
});

describe("summarizeEquipmentMetadataForLegend", () => {
  it("ignores empty equipment blobs or whitespace-only cue roles", () => {
    expect(
      summarizeEquipmentMetadataForLegend([
        { id: "a", kind: "FIXTURE", x: 0, y: 0, equipment: {} },
        { id: "b", kind: "POWER", x: 0, y: 0, equipment: { role: "   " } },
      ]),
    ).toEqual({
      annotatedCount: 0,
      symbolsWithCueRole: 0,
      symbolsWithDmxPair: 0,
      symbolsWithPartialDmx: 0,
      symbolsWithDmxUniverseOnly: 0,
      symbolsWithDmxChannelOnly: 0,
    });
  });

  it("counts cue and paired DMX together on one symbol", () => {
    expect(
      summarizeEquipmentMetadataForLegend([
        {
          id: "m",
          kind: "FIXTURE",
          x: 0,
          y: 0,
          equipment: { role: "SL", dmxUniverse: 3, dmxChannel: 10 },
        },
      ]),
    ).toEqual({
      annotatedCount: 1,
      symbolsWithCueRole: 1,
      symbolsWithDmxPair: 1,
      symbolsWithPartialDmx: 0,
      symbolsWithDmxUniverseOnly: 0,
      symbolsWithDmxChannelOnly: 0,
    });
  });

  it("counts universe-only fixture patch like a BOM row waiting on channel", () => {
    expect(
      summarizeEquipmentMetadataForLegend([
        {
          id: "u",
          kind: "FIXTURE",
          x: 2,
          y: -4,
          equipment: { role: "FOH PAR", dmxUniverse: 6 },
        },
      ]),
    ).toEqual({
      annotatedCount: 1,
      symbolsWithCueRole: 1,
      symbolsWithDmxPair: 0,
      symbolsWithPartialDmx: 1,
      symbolsWithDmxUniverseOnly: 1,
      symbolsWithDmxChannelOnly: 0,
    });
  });

  it("counts channel-only fixture patch (address drafted before universe)", () => {
    expect(
      summarizeEquipmentMetadataForLegend([
        {
          id: "c",
          kind: "FIXTURE",
          x: 11,
          y: -3,
          equipment: { dmxChannel: 418 },
        },
      ]),
    ).toEqual({
      annotatedCount: 1,
      symbolsWithCueRole: 0,
      symbolsWithDmxPair: 0,
      symbolsWithPartialDmx: 1,
      symbolsWithDmxUniverseOnly: 0,
      symbolsWithDmxChannelOnly: 1,
    });
  });

  it("parses BOM-style snake_case keys into the same universe-only / channel-only split", () => {
    const out = parseStageDesignCanvas({
      version: STAGE_DESIGN_SCHEMA_VERSION,
      footprint: { width: 40, depth: 24 },
      placements: [
        {
          id: "lx-a",
          kind: "FIXTURE",
          x: 4,
          y: -6,
          equipment: { dmx_universe: 6 },
        },
        {
          id: "lx-b",
          kind: "FIXTURE",
          x: 5,
          y: -6,
          equipment: { dmx_channel: 418 },
        },
      ],
    } as unknown);
    expect(summarizeEquipmentMetadataForLegend(out.placements)).toEqual({
      annotatedCount: 2,
      symbolsWithCueRole: 0,
      symbolsWithDmxPair: 0,
      symbolsWithPartialDmx: 2,
      symbolsWithDmxUniverseOnly: 1,
      symbolsWithDmxChannelOnly: 1,
    });
  });
});
