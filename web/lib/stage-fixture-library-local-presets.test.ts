import { describe, expect, it } from "vitest";

import {
  addFixtureLibraryLocalPreset,
  fixtureLibraryEntriesToPortableJson,
  fixtureLibraryEntriesToCsv,
  fixtureLibraryTemplateFromDraftStrings,
  mergeFixtureLibraryImportRows,
  mergeFixtureLibraryTemplateOntoEquipment,
  parseFixtureLibraryImportCsv,
  parseFixtureLibraryImportRows,
  parseFixtureLibraryLocalPresets,
  sanitizeFixtureLibraryPresetLabel,
  splitCsvRecords,
} from "./stage-fixture-library-local-presets";

describe("sanitizeFixtureLibraryPresetLabel", () => {
  it("trims and rejects blanks / control chars", () => {
    expect(sanitizeFixtureLibraryPresetLabel("  VL3500 wash  ")).toBe("VL3500 wash");
    expect(sanitizeFixtureLibraryPresetLabel("   ")).toBeUndefined();
    expect(sanitizeFixtureLibraryPresetLabel("bad\u0001")).toBeUndefined();
  });
});

describe("fixtureLibraryTemplateFromDraftStrings", () => {
  it("returns undefined when no fields survive sanitization", () => {
    expect(fixtureLibraryTemplateFromDraftStrings({})).toBeUndefined();
    expect(fixtureLibraryTemplateFromDraftStrings({ role: "   " })).toBeUndefined();
  });

  it("keeps trimmed string slices within caps", () => {
    const t = fixtureLibraryTemplateFromDraftStrings({
      role: "LX wash",
      fixtureId: " INV-001 ",
      fixtureProfile: "Beam 12deg",
    });
    expect(t).toEqual({
      role: "LX wash",
      fixtureId: "INV-001",
      fixtureProfile: "Beam 12deg",
    });
  });
});

describe("mergeFixtureLibraryTemplateOntoEquipment", () => {
  it("overwrites overlapping keys only", () => {
    const base = { role: "Old", patch: "A", dmxUniverse: 1, dmxChannel: 10 };
    const template = { role: "New", gel: "R79" };
    expect(mergeFixtureLibraryTemplateOntoEquipment(base, template)).toEqual({
      role: "New",
      patch: "A",
      dmxUniverse: 1,
      dmxChannel: 10,
      gel: "R79",
    });
  });
});

describe("parseFixtureLibraryLocalPresets", () => {
  it("parses v1 envelope and drops invalid rows", () => {
    const parsed = parseFixtureLibraryLocalPresets({
      version: 1,
      presets: [
        {
          id: "ufl_bad id",
          label: "Bad id",
          savedAt: "x",
          equipment: { fixtureId: "a" },
        },
        {
          id: "ufl_abc123def456",
          label: "Good",
          savedAt: "2026-01-01",
          equipment: { fixtureId: "LX-1", gel: "" },
        },
      ],
    });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.label).toBe("Good");
    expect(parsed[0]?.equipment.fixtureId).toBe("LX-1");
    expect(parsed[0]?.equipment.gel).toBeUndefined();
  });
});

describe("fixture library portable JSON", () => {
  it("roundtrips export → parse", () => {
    const rows = addFixtureLibraryLocalPreset([], "A", { fixtureId: "x", role: "cue" });
    expect(rows.ok).toBe(true);
    if (!rows.ok) return;
    const json = fixtureLibraryEntriesToPortableJson(rows.presets);
    const parsed = parseFixtureLibraryImportRows(JSON.parse(json) as unknown);
    expect(parsed).toEqual([{ label: "A", equipment: { fixtureId: "x", role: "cue" } }]);
  });

  it("merge skips duplicate labels vs existing", () => {
    const existing = [
      {
        id: "ufl_one",
        label: "Dup",
        savedAt: "",
        equipment: { fixtureId: "a" },
      },
    ];
    const r = mergeFixtureLibraryImportRows(existing, [
      { label: "Dup", equipment: { fixtureId: "b" } },
      { label: "New", equipment: { gel: "R26" } },
    ]);
    expect(r.added).toBe(1);
    expect(r.skipped).toBe(1);
    expect(r.presets.map((p) => p.label)).toEqual(["Dup", "New"]);
  });

  it("accepts versioned localStorage-shaped backup", () => {
    const rows = parseFixtureLibraryImportRows({
      version: 1,
      presets: [{ id: "ufl_x", label: "From backup", savedAt: "", equipment: { patch: "Dim 1" } }],
    });
    expect(rows).toEqual([{ label: "From backup", equipment: { patch: "Dim 1" } }]);
  });
});

describe("fixture library CSV", () => {
  it("splitCsvRecords handles quoted commas", () => {
    expect(splitCsvRecords('a,"b,c",d\r\n', ",")).toEqual([["a", "b,c", "d"]]);
  });

  it("splitCsvRecords supports semicolon delimiter", () => {
    expect(splitCsvRecords("a;b;c", ";")).toEqual([["a", "b", "c"]]);
  });

  it("roundtrips CSV export → parseFixtureLibraryImportCsv", () => {
    const added = addFixtureLibraryLocalPreset([], "Spot", { fixtureId: "F1", role: "LX" });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const csv = fixtureLibraryEntriesToCsv(added.presets);
    expect(csv.toLowerCase()).toContain("library_label");
    expect(parseFixtureLibraryImportCsv(csv)).toEqual([{ label: "Spot", equipment: { fixtureId: "F1", role: "LX" } }]);
  });

  it("accepts label synonym header", () => {
    expect(parseFixtureLibraryImportCsv("label,gel_note\nWash,R79\n")).toEqual([{ label: "Wash", equipment: { gel: "R79" } }]);
  });

  it("parses semicolon-separated rows when commas do not yield library_label", () => {
    const csv = "library_label;cue_role;fixture_id\r\nWash;LX-A;F-01\r\n";
    expect(parseFixtureLibraryImportCsv(csv)).toEqual([
      { label: "Wash", equipment: { role: "LX-A", fixtureId: "F-01" } },
    ]);
  });
});

describe("addFixtureLibraryLocalPreset", () => {
  it("rejects duplicate labels case-insensitively", () => {
    const existing = [
      {
        id: "ufl_existing123",
        label: "VL3500",
        savedAt: "x",
        equipment: { fixtureId: "a" },
      },
    ];
    const dup = addFixtureLibraryLocalPreset(existing, "vl3500", { fixtureId: "b" });
    expect(dup.ok).toBe(false);
    if (!dup.ok) expect(dup.reason).toBe("DUPE_LABEL");
  });

  it("appends valid preset", () => {
    const r = addFixtureLibraryLocalPreset([], "MAC Quantum", { role: "Back wash", fixtureProfile: "Wash" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.presets).toHaveLength(1);
      expect(r.presets[0]?.label).toBe("MAC Quantum");
      expect(r.presets[0]?.equipment.role).toBe("Back wash");
    }
  });
});
