import { describe, expect, it } from "vitest";

import { extractValidatedPresetRowsFromBody } from "./diagram-layer-shared-server";

describe("extractValidatedPresetRowsFromBody (diagram layer shared)", () => {
  it("accepts empty presets array", () => {
    expect(extractValidatedPresetRowsFromBody({ presets: [] })).toEqual([]);
  });

  it("returns null for malformed top-level", () => {
    expect(extractValidatedPresetRowsFromBody(null)).toBeNull();
    expect(extractValidatedPresetRowsFromBody([])).toBeNull();
  });

  it("parses schemaVersion interchange envelope", () => {
    const rows = extractValidatedPresetRowsFromBody({
      schemaVersion: 1,
      presets: [{ label: "Tour LX", tiers: [{ name: "LX", group: "Lighting" }] }],
    });
    expect(rows).toEqual([{ label: "Tour LX", tiers: [{ name: "LX", group: "Lighting" }] }]);
  });

  it("parses single-stack tier template with label", () => {
    const rows = extractValidatedPresetRowsFromBody({
      schemaVersion: 1,
      label: "Corporate",
      tiers: [{ name: "Rig", group: "Rigging" }],
    });
    expect(rows).toEqual([{ label: "Corporate", tiers: [{ name: "Rig", group: "Rigging" }] }]);
  });
});
