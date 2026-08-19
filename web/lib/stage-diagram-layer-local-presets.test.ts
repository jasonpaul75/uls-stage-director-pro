import { describe, expect, it, vi } from "vitest";

import { DIAGRAM_LAYER_DEFAULT_ID } from "./stage-design-diagram-layers";
import { diagramCustomTiersToTemplateRows } from "./stage-diagram-layer-template";
import {
  addDiagramLayerLocalPreset,
  mergeDiagramLayerImportPresets,
  parseDiagramLayerLocalPresets,
  removeDiagramLayerLocalPreset,
} from "./stage-diagram-layer-local-presets";

describe("diagram layer local presets", () => {
  it("parses stored JSON envelope", () => {
    const parsed = parseDiagramLayerLocalPresets({
      version: 1,
      presets: [
        {
          id: "ulp_abcdef123456",
          label: "Tour LX",
          savedAt: "2026-01-01T00:00:00.000Z",
          tiers: [{ name: "LX", group: "Lighting / Wash", bracketReorderLocked: true }],
        },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.label).toBe("Tour LX");
    expect(parsed[0]!.tiers[0]!.group).toBe("Lighting / Wash");
  });

  it("add enforces cap, label, and duplicate names", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee");

    const empty = addDiagramLayerLocalPreset([], "", [{ name: "A" }]);
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.reason).toBe("EMPTY_LABEL");

    const dupe = addDiagramLayerLocalPreset(
      [
        {
          id: "ulp_x",
          label: "Same",
          savedAt: "",
          tiers: [{ name: "A" }],
        },
      ],
      "same",
      [{ name: "B" }],
    );
    expect(dupe.ok).toBe(false);
    if (!dupe.ok) expect(dupe.reason).toBe("DUPE_LABEL");

    const ok = addDiagramLayerLocalPreset([], "Nice", [{ name: "B" }]);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.presets[0]?.label).toBe("Nice");
  });

  it("remove filters by id", () => {
    const next = removeDiagramLayerLocalPreset(
      [
        { id: "ulp_a", label: "a", savedAt: "", tiers: [{ name: "A" }] },
        { id: "ulp_b", label: "b", savedAt: "", tiers: [{ name: "B" }] },
      ],
      "ulp_a",
    );
    expect(next).toHaveLength(1);
    expect(next[0]!.id).toBe("ulp_b");
  });

  it("merge skips duplicate labels and respects cap", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("bbbbbbbb-bbbb-4ccc-dddd-eeeeeeeeeeee");

    const existing = [{ id: "ulp_x", label: "Tour", savedAt: "", tiers: [{ name: "LX" }] }];
    const merged = mergeDiagramLayerImportPresets(existing, [
      { label: "Tour", tiers: [{ name: "Dup" }] },
      { label: "Corporate", tiers: [{ name: "Rig" }] },
    ]);
    expect(merged.added).toBe(1);
    expect(merged.skipped).toBe(1);
    expect(merged.presets).toHaveLength(2);
    expect(merged.presets[1]!.label).toBe("Corporate");
  });
});

describe("diagramCustomTiersToTemplateRows", () => {
  it("strips Main from template tier list", () => {
    const rows = diagramCustomTiersToTemplateRows([
      { id: DIAGRAM_LAYER_DEFAULT_ID, name: "Main" },
      { id: "x", name: "Top", group: "Rig", visible: false, bracketReorderLocked: true },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Top",
      group: "Rig",
      visible: false,
      bracketReorderLocked: true,
    });
  });
});
