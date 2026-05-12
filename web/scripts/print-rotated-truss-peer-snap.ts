/**
 * Dev helper: prints peer-align snap for a 90° truss + nearby fixture (same scenario as the hung `tsx -e` probe).
 * Run from `web/`: `npx --yes tsx scripts/print-rotated-truss-peer-snap.ts`
 */
import { StageDesignUnit } from "@prisma/client";

import {
  defaultStageDesignCanvas,
  peerSnapRotationLayoutFromPlotView,
  snapPlotWorldXYToPeerAlignWithMeta,
} from "../lib/stage-design-canvas";
import { plotLayoutForCanvas } from "../lib/stage-design-svg-layout";

const canvas = defaultStageDesignCanvas();
const { lay } = plotLayoutForCanvas(canvas, canvas.plotMargins);
const rotLay = peerSnapRotationLayoutFromPlotView(lay);
const placements = [
  { id: "t90", kind: "TRUSS" as const, x: 20, y: 24, rotationDeg: 90 },
  { id: "fmov", kind: "FIXTURE" as const, x: 20.08, y: 28.18 },
] as const;

const wx = 20.08;
const wy = 28.18;
const out = snapPlotWorldXYToPeerAlignWithMeta(wx, wy, [...placements], [], "FEET", { placementId: "fmov" }, StageDesignUnit.FEET, rotLay);

console.log(JSON.stringify({ input: { wx, wy }, placements, out }, null, 2));
