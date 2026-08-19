import { describe, expect, it } from "vitest";

import { extractValidatedPresetRowsFromBody } from "./fixture-library-shared-server";

describe("extractValidatedPresetRowsFromBody", () => {
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
      presets: [{ label: "Wash", equipment: { fixtureId: "F1" } }],
    });
    expect(rows).toEqual([{ label: "Wash", equipment: { fixtureId: "F1" } }]);
  });

  it("parses explicit presets property", () => {
    expect(
      extractValidatedPresetRowsFromBody({
        presets: [{ label: "  Spot  ", equipment: { role: "LX-2" } }],
      }),
    ).toEqual([{ label: "Spot", equipment: { role: "LX-2" } }]);
  });
});
