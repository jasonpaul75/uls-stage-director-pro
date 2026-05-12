import { describe, expect, it } from "vitest";

import {
  footprintViewLayout,
  STAGE_DRAW_INNER_MAX_H,
  STAGE_DRAW_INNER_MAX_W,
  STAGE_SVG_VIEW_H,
  STAGE_SVG_VIEW_W,
  svgFootprintPointToWorld,
  worldFootprintPointToSvg,
} from "./stage-design-svg-layout";

describe("stage-design-svg-layout", () => {
  it("round-trips footprint corners via world ⇄ svg", () => {
    const footprint = { width: 48, depth: 20 };
    const lay = footprintViewLayout(footprint);

    const bl = worldFootprintPointToSvg(0, 0, footprint, lay);
    const tl = worldFootprintPointToSvg(0, 20, footprint, lay);
    const br = worldFootprintPointToSvg(48, 0, footprint, lay);

    expect(svgFootprintPointToWorld(bl.sx, bl.sy, footprint, lay)).toEqual({
      wx: 0,
      wy: 0,
    });

    const tlHit = svgFootprintPointToWorld(tl.sx, tl.sy, footprint, lay);
    expect(tlHit).not.toBeNull();
    expect(tlHit!.wx).toBeCloseTo(0, 7);
    expect(tlHit!.wy).toBeCloseTo(20, 7);

    const brHit = svgFootprintPointToWorld(br.sx, br.sy, footprint, lay);
    expect(brHit).not.toBeNull();
    expect(brHit!.wx).toBeCloseTo(48, 7);
    expect(brHit!.wy).toBeCloseTo(0, 7);
  });

  it("rejects points outside polygon", () => {
    expect(
      svgFootprintPointToWorld(0.5, 0.5, { width: 10, depth: 10 }, footprintViewLayout({ width: 10, depth: 10 })),
    ).toBeNull();
  });
});

describe("stage plot view box constants", () => {
  it("uses a drawable box wider than tall for panorama-friendly tiles", () => {
    expect(STAGE_DRAW_INNER_MAX_W).toBeGreaterThan(STAGE_DRAW_INNER_MAX_H);
    expect(STAGE_SVG_VIEW_W / STAGE_SVG_VIEW_H).toBeGreaterThan(1.65);
  });
});
