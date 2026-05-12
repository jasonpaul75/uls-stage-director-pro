"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  MAX_DIAGRAM_LAYER_JSON_CHARS,
  parseDiagramLayersJsonString,
  reconcileDiagramLayersOnCanvas,
} from "@/lib/stage-design-diagram-layers";
import {
  clampFootprint,
  clampPlotMargins,
  defaultDiagramPaintOrder,
  footprintFromDeckStructure,
  MAX_DECK_POLYGONS_JSON_CHARS,
  MAX_DIAGRAM_PAINT_ORDER_JSON_CHARS,
  parseDeckPolygonsFromJsonString,
  parseDiagramPaintOrderJsonString,
  parsePlacementsFromJsonString,
  parseShapesFromJsonString,
  paintDiagramOrdersEqual,
  repairDiagramPaintOrder,
  STAGE_DESIGN_SCHEMA_VERSION,
  type StageDesignCanvas,
  type StageDesignPlotMargins,
} from "@/lib/stage-design-canvas";
import { prisma } from "@/lib/prisma";
import { revalidateProjectMirrorCache } from "@/lib/revalidate-project-mirror-cache";
import { GlobalRole, ProjectStatus, StageDesignUnit } from "@prisma/client";

const MAX_TITLE_LEN = 200;
/** Guard rail for JSON column growth / abuse (~256 KB). */
const MAX_CANVAS_JSON_CHARS = 256_000;
/** Separate bound for placements array POST payload. */
const MAX_PLACEMENTS_JSON_CHARS = 480_000;
const MAX_SHAPES_JSON_CHARS = 480_000;
const MAX_PLOT_MARGINS_JSON_CHARS = 16_000;

function canProduce(role: GlobalRole | undefined): boolean {
  return role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN;
}

function parseUnit(raw: string): StageDesignUnit | null {
  if (raw === "FEET") return StageDesignUnit.FEET;
  if (raw === "METERS") return StageDesignUnit.METERS;
  return null;
}

export async function saveProjectStageDesign(formData: FormData) {
  const session = await auth();
  const uid = session?.user?.id;
  const role = session?.user?.globalRole as GlobalRole | undefined;
  if (!uid || !canProduce(role)) {
    redirect("/login?callbackUrl=/producer");
  }

  const projectId = String(formData.get("projectId") ?? "").trim();
  const titleRaw = String(formData.get("title") ?? "").trim().slice(0, MAX_TITLE_LEN);
  const unit = parseUnit(String(formData.get("unit") ?? ""));
  const widthRaw = Number(formData.get("width"));
  const depthRaw = Number(formData.get("depth"));
  const stageDesignDirectorVisible = formData.get("stageDesignDirectorVisible") === "on";

  if (!projectId || !unit) {
    redirect("/producer/inbox");
  }

  const footprintNominal = clampFootprint(widthRaw, depthRaw);

  let plotMargins = clampPlotMargins(undefined);
  const pmRaw = String(formData.get("plotMarginsJson") ?? "")
    .trim()
    .slice(0, MAX_PLOT_MARGINS_JSON_CHARS);
  if (pmRaw.length > 0) {
    try {
      const obj = JSON.parse(pmRaw) as unknown;
      plotMargins = clampPlotMargins(
        typeof obj === "object" && obj !== null ? (obj as Partial<StageDesignPlotMargins>) : undefined,
      );
    } catch {
      plotMargins = clampPlotMargins(undefined);
    }
  }

  const deckBlob = String(formData.get("deckPolygonsJson") ?? "")
    .trim()
    .slice(0, MAX_DECK_POLYGONS_JSON_CHARS);
  const deckParsed = parseDeckPolygonsFromJsonString(deckBlob, footprintNominal);
  const footprint = footprintFromDeckStructure({
    footprint: footprintNominal,
    deckPolygons: deckParsed.length > 0 ? deckParsed : undefined,
  });
  const deckForClamp = deckParsed.length > 0 ? deckParsed : undefined;

  const placementsBlob = String(formData.get("placementsJson") ?? "")
    .trim()
    .slice(0, MAX_PLACEMENTS_JSON_CHARS);
  const placementsParsed = parsePlacementsFromJsonString(
    placementsBlob,
    footprint,
    plotMargins,
    unit,
    deckForClamp,
  );

  const shapesBlob = String(formData.get("shapesJson") ?? "")
    .trim()
    .slice(0, MAX_SHAPES_JSON_CHARS);
  const shapesParsed = parseShapesFromJsonString(shapesBlob, footprint, plotMargins, deckForClamp);

  const diagramOrderBlob = String(formData.get("diagramPaintOrderJson") ?? "")
    .trim()
    .slice(0, MAX_DIAGRAM_PAINT_ORDER_JSON_CHARS);
  const parsedDiagramPaintOrder = parseDiagramPaintOrderJsonString(diagramOrderBlob);

  const diagramLayersBlob = String(formData.get("diagramLayersJson") ?? "")
    .trim()
    .slice(0, MAX_DIAGRAM_LAYER_JSON_CHARS);
  const parsedDiagramLayers = parseDiagramLayersJsonString(diagramLayersBlob);

  const canvasBase = {
    version: STAGE_DESIGN_SCHEMA_VERSION,
    footprint,
    ...(deckParsed.length > 0 ? { deckPolygons: deckParsed } : {}),
    plotMargins,
    placements: placementsParsed,
    shapes: shapesParsed,
    ...(parsedDiagramLayers && parsedDiagramLayers.length > 0 ? { diagramLayers: parsedDiagramLayers } : {}),
  };
  const withPaintGuess = parsedDiagramPaintOrder?.length
    ? { ...canvasBase, diagramPaintOrder: parsedDiagramPaintOrder }
    : canvasBase;
  const repairedPaint = repairDiagramPaintOrder(withPaintGuess);
  const defaultPaint = defaultDiagramPaintOrder(canvasBase);
  let canvas: StageDesignCanvas = paintDiagramOrdersEqual(repairedPaint, defaultPaint)
    ? canvasBase
    : { ...canvasBase, diagramPaintOrder: repairedPaint };
  canvas = reconcileDiagramLayersOnCanvas(canvas);

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: { id: true },
  });
  if (!project) {
    redirect("/producer/inbox");
  }

  const title =
    titleRaw.length > 0 ? titleRaw : "Stage diagram";

  const canvasString = JSON.stringify(canvas);
  if (canvasString.length > MAX_CANVAS_JSON_CHARS) {
    redirect(`/producer/inbox/${projectId}/stage-design?stage_design_err=too_large`);
  }

  const parsedCanvas = JSON.parse(canvasString) as object;

  await prisma.$transaction([
    prisma.projectStageDesign.upsert({
      where: { projectId },
      create: {
        projectId,
        title,
        unit,
        canvasJson: parsedCanvas,
        updatedByUserId: uid,
      },
      update: {
        title,
        unit,
        canvasJson: parsedCanvas,
        updatedByUserId: uid,
      },
    }),
    prisma.project.update({
      where: { id: projectId },
      data: { stageDesignDirectorVisible },
    }),
  ]);

  revalidateProjectMirrorCache(projectId);
  revalidatePath(`/producer/inbox/${projectId}/stage-design`);
  revalidatePath(`/producer/inbox/${projectId}/event`);
  redirect(`/producer/inbox/${projectId}/stage-design?saved=1`);
}
