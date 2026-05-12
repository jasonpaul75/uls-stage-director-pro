/** Typed cable runs for LINE / POLYLINE — aligns with spreadsheet-style rigging/power legends (`canvasJson` only). */

export const STAGE_DIAGRAM_CABLE_RUN_ORDER = [
  "EDISON_120",
  "SOCAPEX",
  "STAGE_PIN_20",
  "STAGE_PIN_60",
  "CEE_50A",
  "LED_TRUNK",
  "SDI_SOLID",
  "SDI_DASHED",
] as const;

export type StageDiagramCableRunKind = (typeof STAGE_DIAGRAM_CABLE_RUN_ORDER)[number];

const CABLE_RUN_SET = new Set<string>(STAGE_DIAGRAM_CABLE_RUN_ORDER);

export const STAGE_DIAGRAM_CABLE_RUN_LABELS: Record<StageDiagramCableRunKind, string> = {
  EDISON_120: "120V Edison cord",
  SOCAPEX: "Socapex / mult",
  STAGE_PIN_20: "20A stage pin",
  STAGE_PIN_60: "60A stage pin distro",
  CEE_50A: "50A CEE / Hubbell",
  LED_TRUNK: "LED feed / truss data",
  SDI_SOLID: "SDI / video trunk (solid)",
  SDI_DASHED: "SDI cam → ATEM (dash)",
};

export type CableRunStrokePreset = {
  stroke: string;
  strokeDasharray?: string;
  strokeWidthPx?: number;
};

/** Presentation stroke presets (diagram + exports). Operator may still override with custom `shape.stroke`. */
export const STAGE_DIAGRAM_CABLE_RUN_PRESET: Record<StageDiagramCableRunKind, CableRunStrokePreset> = {
  /** Magenta-ish */
  EDISON_120: { stroke: "rgba(232,121,249,0.92)", strokeDasharray: "4 4", strokeWidthPx: 2 },
  SOCAPEX: { stroke: "rgba(239,68,68,0.92)", strokeWidthPx: 2.25 },
  STAGE_PIN_20: { stroke: "rgba(74,222,128,0.92)", strokeWidthPx: 2 },
  STAGE_PIN_60: { stroke: "rgba(251,146,60,0.92)", strokeWidthPx: 2.5 },
  CEE_50A: { stroke: "rgba(59,130,246,0.92)", strokeWidthPx: 2.5 },
  LED_TRUNK: { stroke: "rgba(167,139,250,0.94)", strokeWidthPx: 3 },
  SDI_SOLID: { stroke: "rgba(56,189,248,0.92)", strokeWidthPx: 2 },
  SDI_DASHED: { stroke: "rgba(192,132,252,0.92)", strokeDasharray: "6 5", strokeWidthPx: 2 },
};

export function sanitizeDiagramCableRunKind(raw: unknown): StageDiagramCableRunKind | undefined {
  if (typeof raw !== "string") return undefined;
  const k = raw.trim();
  return CABLE_RUN_SET.has(k) ? (k as StageDiagramCableRunKind) : undefined;
}

export function cableRunPresentationStroke(kind: StageDiagramCableRunKind): CableRunStrokePreset {
  return STAGE_DIAGRAM_CABLE_RUN_PRESET[kind];
}
