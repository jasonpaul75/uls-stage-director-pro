import { describe, expect, it } from "vitest";

import {
  DIAGRAM_LAYER_DEFAULT_ID,
  assignDiagramTierUnderFolderPrefix,
  bumpDiagramPaintOrderWithinDiagramLayer,
  deriveDiagramFolderLeafSegment,
  diagramLayerFolderPathSegments,
  diagramLayerPrimitiveIdsTsv,
  diagramLayersListPaneItems,
  longestCommonDiagramFolderPathPrefix,
  reorderDiagramLayerStackRow,
  collectDiagramLayerNestTierIndices,
  countPrimitivesOnDiagramLayer,
  diagramPaintRefsForPresentation,
  listPrimitiveIdsOnDiagramLayer,
  moveDiagramPaintRefToDiagramLayerPaintExtreme,
  reconcileDiagramLayersOnCanvas,
  sanitizeDiagramLayerGroup,
  summarizePrimitivesOnDiagramLayer,
} from "./stage-design-diagram-layers";
import {
  defaultDiagramPaintOrder,
  paintDiagramOrdersEqual,
  repairDiagramPaintOrder,
  STAGE_DESIGN_SCHEMA_VERSION,
  SYNTHETIC_DECK_RECT_POLYGON_ID,
  type StageDesignCanvas,
} from "./stage-design-canvas";

function canvasStub(
  parts: Partial<StageDesignCanvas> &
    Pick<StageDesignCanvas, "placements" | "shapes">,
): StageDesignCanvas {
  const c: StageDesignCanvas = {
    version: STAGE_DESIGN_SCHEMA_VERSION,
    footprint: { width: 40, depth: 24 },
    plotMargins: { downstage: 2, upstage: 2, stageLeft: 2, stageRight: 2 },
    placements: parts.placements,
    shapes: parts.shapes,
    ...(parts.deckPolygons ? { deckPolygons: parts.deckPolygons } : {}),
    ...(parts.diagramPaintOrder ? { diagramPaintOrder: parts.diagramPaintOrder } : {}),
    ...(parts.diagramLayers ? { diagramLayers: parts.diagramLayers } : {}),
  };
  return reconcileDiagramLayersOnCanvas(c);
}

describe("diagramPaintRefsForPresentation", () => {
  it("puts a custom layer bucket after Main (placement layerId)", () => {
    const topId = "uls_layer_top_test";
    const canvas = canvasStub({
      placements: [
        { id: "p_main", kind: "FIXTURE", x: 4, y: 6 },
        { id: "p_top", kind: "FIXTURE", x: 8, y: 6, layerId: topId },
      ],
      shapes: [],
      diagramLayers: [{ id: topId, name: "Scrim" }],
    });
    expect(canvas.diagramLayers?.some((row) => row.id === DIAGRAM_LAYER_DEFAULT_ID)).toBe(true);
    const pres = diagramPaintRefsForPresentation(canvas);
    const idxMain = pres.findIndex((r) => r.kind === "placement" && r.id === "p_main");
    const idxTop = pres.findIndex((r) => r.kind === "placement" && r.id === "p_top");
    expect(idxMain).toBeGreaterThanOrEqual(0);
    expect(idxTop).toBeGreaterThanOrEqual(0);
    expect(idxMain).toBeLessThan(idxTop);

    const base = repairDiagramPaintOrder(canvas);
    expect(
      base.findIndex((r) => r.kind === "placement" && r.id === "p_main"),
    ).toBeLessThan(base.findIndex((r) => r.kind === "placement" && r.id === "p_top"));
  });

  it("drops refs whose layer definition is invisible", () => {
    const hiddenId = "uls_layer_hide_test";
    const canvas = canvasStub({
      placements: [{ id: "ghost", kind: "DECOR", x: 3, y: 3, layerId: hiddenId }],
      shapes: [],
      diagramLayers: [
        { id: hiddenId, name: "Cue", visible: false },
      ],
    });
    const presIds = diagramPaintRefsForPresentation(canvas).flatMap((r) =>
      r.kind === "placement" ? [r.id] : [],
    );
    expect(presIds).not.toContain("ghost");
  });
});

describe("assignDiagramTierUnderFolderPrefix", () => {
  it("writes group prefix + leaf from tier name when no prior path", () => {
    const main = { id: DIAGRAM_LAYER_DEFAULT_ID, name: "Main" };
    const lx = { id: "tier_lx", name: "Spots" };
    const out = assignDiagramTierUnderFolderPrefix([main, lx], 1, ["Lighting", "LX"]);
    expect(out).not.toBeNull();
    expect(out![1]!.group).toBe("Lighting / LX / Spots");
  });

  it("uses last slash segment from existing group as leaf when present", () => {
    const main = { id: DIAGRAM_LAYER_DEFAULT_ID, name: "Main" };
    const t = {
      id: "a",
      name: "Ignored",
      group: sanitizeDiagramLayerGroup("Rigging / Pods / wash") ?? "Rigging / Pods / wash",
    };
    const out = assignDiagramTierUnderFolderPrefix([main, t], 1, ["Documentation"]);
    expect(out).not.toBeNull();
    expect(out![1]!.group).toBe("Documentation / wash");
  });
});

describe("deriveDiagramFolderLeafSegment", () => {
  it("prefers trimmed last path segment over name", () => {
    expect(
      deriveDiagramFolderLeafSegment({
        id: "x",
        name: "Name",
        group: "A / B trail",
      }),
    ).toBe("B trail");
  });
});

describe("summarizePrimitivesOnDiagramLayer", () => {
  it("counts placements, shapes, and deck polygons per authoring tier", () => {
    const lid = "uls_layer_split";
    const canvas = canvasStub({
      placements: [{ id: "p1", kind: "FIXTURE", x: 0, y: 0, layerId: lid }],
      shapes: [
        { id: "s1", kind: "RECT", x: 0, y: 0, width: 1, height: 1, layerId: lid },
        { id: "s2", kind: "LINE", x: 0, y: 0, x2: 1, y2: 1, layerId: lid },
      ],
      deckPolygons: [
        {
          id: "deck_a",
          layerId: lid,
          points: [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 2 },
            { x: 0, y: 2 },
          ],
        },
      ],
      diagramLayers: [{ id: lid, name: "Hybrid" }],
    });
    expect(summarizePrimitivesOnDiagramLayer(canvas, lid)).toEqual({
      placements: 1,
      shapes: 2,
      deckPolygons: 1,
    });
    expect(countPrimitivesOnDiagramLayer(canvas, lid)).toBe(4);
  });

  it("resolves implicit Main placements and shapes together", () => {
    const canvas = canvasStub({
      placements: [{ id: "main_p", kind: "DECOR", x: 0, y: 0 }],
      shapes: [{ id: "main_s", kind: "RECT", x: 0, y: 0, width: 1, height: 1 }],
    });
    expect(summarizePrimitivesOnDiagramLayer(canvas, DIAGRAM_LAYER_DEFAULT_ID)).toEqual({
      placements: 1,
      shapes: 1,
      deckPolygons: 0,
    });
  });
});

describe("listPrimitiveIdsOnDiagramLayer + diagramLayerPrimitiveIdsTsv", () => {
  it("lists placement, shape, and deck ids per tier with stable traversal order", () => {
    const lid = "uls_layer_ids_order";
    const canvas = canvasStub({
      placements: [
        { id: "pz", kind: "FIXTURE", x: 0, y: 0, layerId: lid },
        { id: "pa", kind: "POWER", x: 1, y: 1, layerId: lid },
      ],
      shapes: [
        { id: "s_line", kind: "LINE", x: 0, y: 0, x2: 1, y2: 1, layerId: lid },
      ],
      deckPolygons: [
        {
          id: "deck_x",
          layerId: lid,
          points: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 2, y: 2 },
            { x: 0, y: 2 },
          ],
        },
      ],
      diagramLayers: [{ id: lid, name: "T" }],
    });
    expect(listPrimitiveIdsOnDiagramLayer(canvas, lid)).toEqual({
      placementIds: ["pz", "pa"],
      shapeIds: ["s_line"],
      deckPolygonIds: ["deck_x"],
    });
    expect(diagramLayerPrimitiveIdsTsv(listPrimitiveIdsOnDiagramLayer(canvas, lid))).toBe(
      "placement\tpz\nplacement\tpa\nshape\ts_line\ndeck\tdeck_x",
    );
  });

  it("matches summarize counts", () => {
    const lid = "uls_layer_id_match_sum";
    const canvas = canvasStub({
      placements: [{ id: "p1", kind: "FIXTURE", x: 0, y: 0, layerId: lid }],
      shapes: [{ id: "sh1", kind: "RECT", x: 0, y: 0, width: 1, height: 2, layerId: lid }],
      deckPolygons: [],
      diagramLayers: [{ id: lid, name: "M" }],
    });
    const ids = listPrimitiveIdsOnDiagramLayer(canvas, lid);
    const sum = summarizePrimitivesOnDiagramLayer(canvas, lid);
    expect(ids.placementIds.length).toBe(sum.placements);
    expect(ids.shapeIds.length).toBe(sum.shapes);
    expect(ids.deckPolygonIds.length).toBe(sum.deckPolygons);
  });

  it("returns empty buckets for sanitized-away custom tier id", () => {
    const canvas = canvasStub({
      placements: [],
      shapes: [],
      diagramLayers: [{ id: "ok_layer", name: "X" }],
    });
    const bad =
      '{"oops":true}............................................................................';
    const ids = listPrimitiveIdsOnDiagramLayer(canvas, bad);
    expect(ids).toEqual({ placementIds: [], shapeIds: [], deckPolygonIds: [] });
    expect(diagramLayerPrimitiveIdsTsv(ids)).toBe("");
  });
});

describe("bumpDiagramPaintOrderWithinDiagramLayer", () => {
  it("does not bracket-swap upward into a higher diagram layer tier", () => {
    const overlay = "uls_bracket_wall";
    const canvas = canvasStub({
      placements: [
        { id: "main_a", kind: "FIXTURE", x: 1, y: 1 },
        { id: "main_b", kind: "FIXTURE", x: 2, y: 2 },
        { id: "ov", kind: "POWER", x: 9, y: 9, layerId: overlay },
      ],
      shapes: [],
      diagramLayers: [{ id: overlay, name: "LX" }],
      diagramPaintOrder: [
        { kind: "deck", id: SYNTHETIC_DECK_RECT_POLYGON_ID },
        { kind: "placement", id: "main_a" },
        { kind: "placement", id: "main_b" },
        { kind: "placement", id: "ov" },
      ],
    });
    expect(bumpDiagramPaintOrderWithinDiagramLayer(canvas, { kind: "placement", id: "main_b" }, 1)).toBeNull();
  });

  it("swaps placements that share Main", () => {
    const canvas = canvasStub({
      placements: [
        { id: "main_a", kind: "FIXTURE", x: 1, y: 1 },
        { id: "main_b", kind: "FIXTURE", x: 2, y: 2 },
      ],
      shapes: [],
      diagramPaintOrder: [
        { kind: "deck", id: SYNTHETIC_DECK_RECT_POLYGON_ID },
        { kind: "placement", id: "main_a" },
        { kind: "placement", id: "main_b" },
      ],
    });
    const next = bumpDiagramPaintOrderWithinDiagramLayer(canvas, { kind: "placement", id: "main_a" }, 1);
    expect(next).not.toBeNull();
    const ia = next!.findIndex((r) => r.kind === "placement" && r.id === "main_a");
    const ib = next!.findIndex((r) => r.kind === "placement" && r.id === "main_b");
    expect(ib).toBeLessThan(ia);
  });

  it("does not reorder inside a tier marked bracketReorderLocked", () => {
    const overlay = "uls_lock_bracket";
    const canvas = canvasStub({
      placements: [
        { id: "a", kind: "FIXTURE", x: 1, y: 1 },
        { id: "b", kind: "FIXTURE", x: 2, y: 2, layerId: overlay },
      ],
      shapes: [],
      diagramLayers: [{ id: overlay, name: "Locked", bracketReorderLocked: true }],
      diagramPaintOrder: [
        { kind: "deck", id: SYNTHETIC_DECK_RECT_POLYGON_ID },
        { kind: "placement", id: "a" },
        { kind: "placement", id: "b" },
      ],
    });
    expect(bumpDiagramPaintOrderWithinDiagramLayer(canvas, { kind: "placement", id: "b" }, 1)).toBeNull();
  });
});

describe("moveDiagramPaintRefToDiagramLayerPaintExtreme", () => {
  it("is a no-op move when tier bracketReorderLocked", () => {
    const overlay = "uls_lock_move";
    const canvas = canvasStub({
      placements: [
        { id: "deep", kind: "FIXTURE", x: 1, y: 1, layerId: overlay },
        { id: "high", kind: "FIXTURE", x: 2, y: 2, layerId: overlay },
      ],
      shapes: [],
      diagramLayers: [{ id: overlay, name: "L", bracketReorderLocked: true }],
      diagramPaintOrder: [
        { kind: "deck", id: SYNTHETIC_DECK_RECT_POLYGON_ID },
        { kind: "placement", id: "deep" },
        { kind: "placement", id: "high" },
      ],
    });
    expect(moveDiagramPaintRefToDiagramLayerPaintExtreme(canvas, { kind: "placement", id: "deep" }, "front")).toBeNull();
  });

  it("moves a Main placement toward its tier paint front without reordering overlays", () => {
    const overlay = "uls_ext_wall";
    const canvas = canvasStub({
      placements: [
        { id: "deep", kind: "FIXTURE", x: 1, y: 1 },
        { id: "high", kind: "FIXTURE", x: 2, y: 2 },
        { id: "ov", kind: "POWER", x: 9, y: 9, layerId: overlay },
      ],
      shapes: [],
      diagramLayers: [{ id: overlay, name: "LX" }],
      diagramPaintOrder: [
        { kind: "deck", id: SYNTHETIC_DECK_RECT_POLYGON_ID },
        { kind: "placement", id: "deep" },
        { kind: "placement", id: "high" },
        { kind: "placement", id: "ov" },
      ],
    });
    const next = moveDiagramPaintRefToDiagramLayerPaintExtreme(canvas, { kind: "placement", id: "deep" }, "front");
    expect(next).not.toBeNull();

    const presentationAfter = diagramPaintRefsForPresentation({ ...canvas, diagramPaintOrder: next! });
    const idxOv = presentationAfter.findIndex((r) => r.kind === "placement" && r.id === "ov");
    const idxHigh = presentationAfter.findIndex((r) => r.kind === "placement" && r.id === "high");
    const idxDeep = presentationAfter.findIndex((r) => r.kind === "placement" && r.id === "deep");
    expect(idxOv).toBeGreaterThan(Math.max(idxHigh, idxDeep));
    expect(idxDeep).toBeGreaterThan(idxHigh);
  });
});

/** Mirrors producer migrate-remove cleanup: primitives lose `layerId`, tier row removed, then paint repair from {@link diagramPaintRefsForPresentation}. */
function stripTopPlacementLayerId(
  pl: StageDesignCanvas["placements"],
  topId: string,
): StageDesignCanvas["placements"] {
  return pl.map((p) => {
    if (p.layerId !== topId) return p;
    const next = { ...p };
    delete next.layerId;
    return next;
  });
}

describe("migrate-remove diagram layer (paint repair contract)", () => {
  it("after moving overlay placements to Main, presentation keeps Main→overlay visual order and repair is idempotent", () => {
    const topId = "uls_migrate_paint";
    const before = canvasStub({
      placements: [
        { id: "p_main", kind: "FIXTURE", x: 1, y: 1 },
        { id: "p_top", kind: "DECOR", x: 2, y: 2, layerId: topId },
      ],
      shapes: [],
      diagramLayers: [{ id: topId, name: "Upstage" }],
      diagramPaintOrder: [
        { kind: "deck", id: SYNTHETIC_DECK_RECT_POLYGON_ID },
        { kind: "placement", id: "p_main" },
        { kind: "placement", id: "p_top" },
      ],
    });

    const migrated = reconcileDiagramLayersOnCanvas({
      version: STAGE_DESIGN_SCHEMA_VERSION,
      footprint: before.footprint,
      plotMargins: before.plotMargins,
      placements: stripTopPlacementLayerId(before.placements, topId),
      shapes: before.shapes,
      diagramPaintOrder: before.diagramPaintOrder,
    });

    expect(migrated.diagramLayers).toBeUndefined();

    const presentation = diagramPaintRefsForPresentation(migrated);
    const idxMain = presentation.findIndex((r) => r.kind === "placement" && r.id === "p_main");
    const idxTop = presentation.findIndex((r) => r.kind === "placement" && r.id === "p_top");
    expect(idxMain).toBeGreaterThanOrEqual(0);
    expect(idxTop).toBeGreaterThanOrEqual(0);
    expect(idxMain).toBeLessThan(idxTop);

    const canonical = defaultDiagramPaintOrder(migrated);
    const nextExplicit = paintDiagramOrdersEqual(presentation, canonical) ? undefined : presentation;

    const healed = reconcileDiagramLayersOnCanvas({
      ...migrated,
      ...(nextExplicit ? { diagramPaintOrder: nextExplicit } : { diagramPaintOrder: undefined }),
    });
    expect(
      paintDiagramOrdersEqual(diagramPaintRefsForPresentation(healed), diagramPaintRefsForPresentation(migrated)),
    ).toBe(true);
  });

  it("when no explicit diagramPaintOrder existed, migration collapses to default diagram stacking", () => {
    const topId = "uls_migrate_implicit";
    const before = canvasStub({
      placements: [
        { id: "pm", kind: "FIXTURE", x: 1, y: 1 },
        { id: "pt", kind: "POWER", x: 3, y: 3, layerId: topId },
      ],
      shapes: [],
      diagramLayers: [{ id: topId, name: "Truss" }],
    });
    expect(before.diagramPaintOrder).toBeUndefined();

    const migrated = reconcileDiagramLayersOnCanvas({
      version: STAGE_DESIGN_SCHEMA_VERSION,
      footprint: before.footprint,
      plotMargins: before.plotMargins,
      placements: stripTopPlacementLayerId(before.placements, topId),
      shapes: before.shapes,
    });

    const presentation = diagramPaintRefsForPresentation(migrated);
    expect(paintDiagramOrdersEqual(presentation, defaultDiagramPaintOrder(migrated))).toBe(true);
  });
});

describe("sanitizeDiagramLayerGroup", () => {
  it("trims length and rejects control characters", () => {
    expect(sanitizeDiagramLayerGroup(`  LX / rig  `)).toBe("LX / rig");
    expect(sanitizeDiagramLayerGroup("a\tb")).toBeUndefined();
    expect(sanitizeDiagramLayerGroup("")).toBeUndefined();
  });
});

describe("diagramLayersListPaneItems", () => {
  const main = { id: DIAGRAM_LAYER_DEFAULT_ID, name: "Main" } as const;
  const trussA = { id: "uls_la", name: "Truss-A", group: "Rig" };
  const powerB = { id: "lbs_lb", name: "Power-B", group: "Rig" };
  const scenic = { id: "uls_lc", name: "Notes" };

  it("clusters contiguous tiers whose folder paths share a prefix — flat label Rig", () => {
    const pane = diagramLayersListPaneItems([main, trussA, powerB, scenic]);
    expect(pane.map((p) => p.kind)).toEqual(["row", "nested", "row"]);
    const nest = pane[1] as Extract<(typeof pane)[number], { kind: "nested" }>;
    expect(nest.tierIndices).toEqual([1, 2]);
    expect(nest.roots).toHaveLength(1);
    expect(nest.roots[0]).toMatchObject({ kind: "folder", label: "Rig" });
    const rg = nest.roots[0] as Extract<(typeof nest.roots)[number], { kind: "folder" }>;
    expect(rg.children.every((c) => c.kind === "tier")).toBe(true);
  });

  it("starts separate folder blocks once the path-linked run breaks — even when a flat label repeats later", () => {
    const repeatRig = { id: "x1", name: "Cable", group: "Rig" };
    const pane = diagramLayersListPaneItems([main, trussA, { id: "y1", name: "Solo" }, repeatRig]);
    expect(pane.filter((p) => p.kind === "nested")).toHaveLength(2);
  });

  it("splits slashes into nested folder nodes", () => {
    const lx = { id: "a1", name: "LX-bus", group: "Audio / LX" };
    const vid = { id: "b1", name: "Video-bus", group: "Video / Replay" };
    const pane = diagramLayersListPaneItems([main, lx, vid]);
    expect(pane.map((p) => p.kind)).toEqual(["row", "nested", "nested"]);
    const n0 = pane[1] as Extract<(typeof pane)[number], { kind: "nested" }>;
    expect(n0.tierIndices).toEqual([1]);
    expect(n0.roots[0]).toMatchObject({
      kind: "folder",
      label: "Audio",
      children: expect.any(Array),
    });
    expect((n0.roots[0] as { kind: "folder"; children: unknown[] }).children[0]).toMatchObject({
      kind: "folder",
      label: "LX",
    });
    const n1 = pane[2] as Extract<(typeof pane)[number], { kind: "nested" }>;
    expect(n1.tierIndices).toEqual([2]);
    expect((n1.roots[0] as { kind: "folder"; label: string; children: unknown[] }).label).toBe("Video");
  });
});

describe("diagramLayerFolderPathSegments · longestCommonDiagramFolderPathPrefix", () => {
  it("splits sanitized groups on slashes", () => {
    expect(diagramLayerFolderPathSegments("  Rigging / LX  ")).toEqual(["Rigging", "LX"]);
  });

  it("computes longest shared prefix arrays", () => {
    expect(
      longestCommonDiagramFolderPathPrefix([
        ["A", "X"],
        ["A", "Y"],
      ]),
    ).toEqual(["A"]);
    expect(longestCommonDiagramFolderPathPrefix([["B"]])).toEqual(["B"]);
  });
});

describe("reorderDiagramLayerStackRow", () => {
  const main = { id: DIAGRAM_LAYER_DEFAULT_ID, name: "Main" } as const;

  it("moves custom tiers relative to flat indices (Main anchored at index 0)", () => {
    const a = { id: "a", name: "A" };
    const b = { id: "b", name: "B" };
    const c = { id: "c", name: "C" };
    const rows = [main, a, b, c];
    const next = reorderDiagramLayerStackRow(rows, 3, 1);
    expect(next?.map((r) => r.id)).toEqual([main.id, "c", "a", "b"]);
  });

  it("returns null when moving Main or inserting at Main's slot", () => {
    const a = { id: "a", name: "A" };
    const rows = [main, a];
    expect(reorderDiagramLayerStackRow(rows, 0, 1)).toBeNull();
    expect(reorderDiagramLayerStackRow(rows, 1, 0)).toBeNull();
  });
});

describe("collectDiagramLayerNestTierIndices", () => {
  it("flatten tier indices DFS", () => {
    const n: Parameters<typeof collectDiagramLayerNestTierIndices>[0] = [
      {
        kind: "folder",
        label: "R",
        children: [
          { kind: "tier", index: 2, layer: { id: "x", name: "X" } },
          {
            kind: "folder",
            label: "S",
            children: [{ kind: "tier", index: 7, layer: { id: "y", name: "Y" } }],
          },
        ],
      },
    ];
    expect(collectDiagramLayerNestTierIndices(n).sort()).toEqual([2, 7]);
  });
});
