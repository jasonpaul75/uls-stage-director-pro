import type { StageDesignPlacementKind } from "./stage-design-canvas";

export type StagePlacementGlyphStyle = {
  fill: string;
  stroke: string;
  strokeWidth?: number;
};

/** SVG styling for placement glyphs (producer + portal preview stay in sync). */
export const STAGE_PLACEMENT_GLYPH_STYLE: Record<StageDesignPlacementKind, StagePlacementGlyphStyle> = {
  FIXTURE: { fill: "rgba(167,139,250,0.95)", stroke: "rgba(196,181,253,0.45)" },
  WASH_MOVING: { fill: "rgba(196,181,253,0.92)", stroke: "rgba(233,213,255,0.55)" },
  BEAM_MOVING: { fill: "rgba(129,140,248,0.94)", stroke: "rgba(165,180,252,0.52)" },
  PAR_STATIC: { fill: "rgba(244,114,182,0.9)", stroke: "rgba(251,207,232,0.5)" },
  UPLIGHT: { fill: "rgba(217,70,239,0.88)", stroke: "rgba(245,208,254,0.55)" },
  STRIP_FIXED: { fill: "rgba(52,211,153,0.45)", stroke: "rgba(16,185,129,0.88)", strokeWidth: 2 },
  LED_WALL: { fill: "rgba(52,211,153,0.35)", stroke: "rgba(16,185,129,0.85)", strokeWidth: 2 },
  POWER_DROP: { fill: "rgba(253,224,71,0.95)", stroke: "rgba(250,204,21,0.55)" },
  POWER: { fill: "rgba(250,204,21,0.9)", stroke: "rgba(253,224,71,0.45)" },
  TRUSS: { fill: "none", stroke: "rgba(244,244,245,0.55)", strokeWidth: 3 },
  DECOR: { fill: "rgba(244,244,245,0.12)", stroke: "rgba(244,244,245,0.45)", strokeWidth: 1.5 },
  PROJECTOR_SYM: { fill: "rgba(56,189,248,0.35)", stroke: "rgba(14,165,233,0.9)", strokeWidth: 2 },
};
