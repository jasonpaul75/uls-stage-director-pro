import { describe, expect, it } from "vitest";

import { portalStageDiagramSectionVisible } from "./portal-stage-diagram-visibility";

describe("portalStageDiagramSectionVisible", () => {
  it("hides diagram for non-admin when producer has not published visibility", () => {
    expect(
      portalStageDiagramSectionVisible(
        {
          stageDesign: { canvasJson: {} },
          stageDesignDirectorVisible: false,
        },
        false,
      ),
    ).toBe(false);
    expect(portalStageDiagramSectionVisible({ stageDesign: {}, stageDesignDirectorVisible: null }, false)).toBe(
      false,
    );
  });

  it("shows diagram for director when visibility is on", () => {
    expect(
      portalStageDiagramSectionVisible(
        {
          stageDesign: { title: "x" },
          stageDesignDirectorVisible: true,
        },
        false,
      ),
    ).toBe(true);
  });

  it("shows diagram for admin even when unpublished (preview)", () => {
    expect(
      portalStageDiagramSectionVisible(
        {
          stageDesign: { title: "x" },
          stageDesignDirectorVisible: false,
        },
        true,
      ),
    ).toBe(true);
  });

  it("shows nothing without stageDesign row even for admin", () => {
    expect(portalStageDiagramSectionVisible({ stageDesign: null, stageDesignDirectorVisible: true }, true)).toBe(
      false,
    );
    expect(portalStageDiagramSectionVisible({ stageDesign: undefined }, true)).toBe(false);
  });
});
