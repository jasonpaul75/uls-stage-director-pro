import { describe, expect, it } from "vitest";

import { cloneStageDiagramSnapshot, snapshotsEqualDiagramHistory } from "./stage-design-diagram-history";

describe("cloneStageDiagramSnapshot", () => {
  it("round-trips a minimal diagram snapshot independently", () => {
    const a = {
      fw: 32,
      fd: 28,
      plotMargins: { downstage: 2, upstage: 6, stageLeft: 3, stageRight: 8 },
      placements: [{ id: "p1", kind: "FIXTURE" as const, x: 1, y: 2 }],
      shapes: [] as [],
      deckPolygons: [] as [],
    };
    const b = cloneStageDiagramSnapshot(a);
    expect(b).not.toBe(a as unknown as typeof b);
    expect(b.placements).not.toBe(a.placements);
    expect(b.plotMargins).not.toBe(a.plotMargins);
    expect(snapshotsEqualDiagramHistory(a, b)).toBe(true);
    b.placements[0]!.x = 999;
    expect(snapshotsEqualDiagramHistory(a, b)).toBe(false);
  });
});

describe("snapshotsEqualDiagramHistory", () => {
  it("compares keyed fields only", () => {
    expect(
      snapshotsEqualDiagramHistory(
        {
          fw: 10,
          fd: 20,
          plotMargins: { downstage: 0, upstage: 0, stageLeft: 0, stageRight: 0 },
          placements: [],
          shapes: [],
          deckPolygons: [],
        },
        {
          fw: 10,
          fd: 20,
          plotMargins: { downstage: 0, upstage: 0, stageLeft: 0, stageRight: 0 },
          placements: [],
          shapes: [],
          deckPolygons: [],
        },
      ),
    ).toBe(true);
  });
});
