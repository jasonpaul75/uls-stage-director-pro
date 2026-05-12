import type { StageDesignPlacementKind } from "./stage-design-canvas";

export type StagePlacementGlyphStyle = {
  fill: string;
  stroke: string;
  strokeWidth?: number;
};

/** SVG styling for placement glyphs (producer + portal preview stay in sync). */
export const STAGE_PLACEMENT_GLYPH_STYLE: Record<StageDesignPlacementKind, StagePlacementGlyphStyle> = {
  FIXTURE: { fill: "rgba(167,139,250,0.95)", stroke: "rgba(196,181,253,0.45)" },
  LED_WALL: { fill: "rgba(52,211,153,0.35)", stroke: "rgba(16,185,129,0.85)", strokeWidth: 2 },
  POWER: { fill: "rgba(250,204,21,0.9)", stroke: "rgba(253,224,71,0.45)" },
  TRUSS: { fill: "none", stroke: "rgba(244,244,245,0.55)", strokeWidth: 3 },
  DECOR: { fill: "rgba(244,244,245,0.12)", stroke: "rgba(244,244,245,0.45)", strokeWidth: 1.5 },
};
