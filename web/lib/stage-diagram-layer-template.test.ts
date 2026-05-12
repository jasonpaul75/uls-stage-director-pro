import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DIAGRAM_LAYER_DEFAULT_ID } from "./stage-design-diagram-layers";
import {
  appendDiagramLayerTemplateTiers,
  diagramLayersToTemplateJson,
  parseDiagramLayerTemplateEnvelope,
} from "./stage-diagram-layer-template";

describe("diagram layer template envelope", () => {
  let stubSeq = 0;

  beforeEach(() => {
    stubSeq = 0;
    vi.spyOn(globalThis.crypto, "randomUUID").mockImplementation(() => {
      stubSeq += 1;
      const a = stubSeq.toString(16).padStart(8, "0");
      return `${a}-0001-4222-a333-044444444444`;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serialize excludes Main but keeps customs", () => {
    const layers = [
      { id: DIAGRAM_LAYER_DEFAULT_ID, name: "Main" },
      { id: "uls_layer_one", name: "LX", group: "Lighting / Wash", bracketReorderLocked: true },
      { id: "uls_layer_two", name: "Notes", visible: false as const },
    ];
    const parsed = JSON.parse(diagramLayersToTemplateJson(layers)) as unknown;
    const tiers = parseDiagramLayerTemplateEnvelope(parsed);
    expect(tiers).toEqual([
      { name: "LX", group: "Lighting / Wash", bracketReorderLocked: true },
      { name: "Notes", visible: false },
    ]);
  });

  it("append respects MAX cap and allocates fresh ids", () => {
    const next = appendDiagramLayerTemplateTiers(
      [
        { id: DIAGRAM_LAYER_DEFAULT_ID, name: "Main" },
        { id: "old", name: "Old" },
      ],
      [
        { name: "A", group: "Foo" },
        { name: "B" },
      ],
    );
    expect(next).not.toBeNull();
    expect(next!).toHaveLength(4);
    expect(next![0]!.id).toBe(DIAGRAM_LAYER_DEFAULT_ID);
    expect(next![1]!.id).toBe("old");
    expect(next![2]!.id).not.toEqual(next![3]!.id);
    expect(next![2]!.name).toBe("A");
    expect(next![2]!.group).toBe("Foo");
    expect(next![3]!.name).toBe("B");
    expect(next![3]!.group).toBeUndefined();
  });

  it("rejects wrong schemaVersion", () => {
    expect(parseDiagramLayerTemplateEnvelope({ schemaVersion: 99, tiers: [{ name: "X" }] })).toBeUndefined();
  });
});
