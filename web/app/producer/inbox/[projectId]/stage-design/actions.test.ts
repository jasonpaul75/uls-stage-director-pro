import { beforeEach, describe, expect, it, vi } from "vitest";

import { GlobalRole, ProjectStatus } from "@prisma/client";

import { DIAGRAM_LAYER_DEFAULT_ID } from "@/lib/stage-design-diagram-layers";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: () => authMock(),
}));

const upsertMock = vi.fn(() => Promise.resolve({}));
const projectFindFirstMock = vi.fn();
const projectUpdateMock = vi.fn(() => Promise.resolve({}));
const transactionMock = vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transactionMock,
    projectStageDesign: { upsert: upsertMock },
    project: {
      findFirst: projectFindFirstMock,
      update: projectUpdateMock,
    },
  },
}));

const revalidateProjectMirrorCacheMock = vi.fn();

vi.mock("@/lib/revalidate-project-mirror-cache", () => ({
  revalidateProjectMirrorCache: revalidateProjectMirrorCacheMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));

function producerSession(role: GlobalRole.PRODUCER | GlobalRole.ULS_ADMIN = GlobalRole.PRODUCER) {
  return { user: { id: "sd_op", globalRole: role } };
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionMock.mockImplementation((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]));
  upsertMock.mockImplementation(() => Promise.resolve({}));
  projectFindFirstMock.mockReset();
  projectUpdateMock.mockReset();
  authMock.mockReset();
});

function stageForm(
  projectId: string,
  parts: {
    visible?: boolean;
    width?: number;
    depth?: number;
    placementsJson?: string;
    plotMarginsJson?: string;
    shapesJson?: string;
    deckPolygonsJson?: string;
    diagramLayersJson?: string;
  } = {},
) {
  const fd = new FormData();
  fd.set("projectId", projectId);
  fd.set("title", "Main deck");
  fd.set("unit", "FEET");
  fd.set("width", String(parts.width ?? 40));
  fd.set("depth", String(parts.depth ?? 24));
  fd.set("placementsJson", parts.placementsJson ?? "[]");
  fd.set("diagramPaintOrderJson", "null");
  if (parts.plotMarginsJson !== undefined) fd.set("plotMarginsJson", parts.plotMarginsJson);
  if (parts.shapesJson !== undefined) fd.set("shapesJson", parts.shapesJson);
  if (parts.deckPolygonsJson !== undefined) fd.set("deckPolygonsJson", parts.deckPolygonsJson);
  if (parts.diagramLayersJson !== undefined) fd.set("diagramLayersJson", parts.diagramLayersJson);
  if (parts.visible) fd.set("stageDesignDirectorVisible", "on");
  return fd;
}

describe("saveProjectStageDesign", () => {
  it("gates unauthenticated or non-producer roles", async () => {
    const { saveProjectStageDesign } = await import("./actions");
    authMock.mockResolvedValueOnce(null);
    await expect(saveProjectStageDesign(stageForm("p1"))).rejects.toThrow("redirect:/login?callbackUrl=/producer");

    authMock.mockResolvedValueOnce({ user: { id: "dx", globalRole: GlobalRole.DIRECTOR } });
    await expect(saveProjectStageDesign(stageForm("p1"))).rejects.toThrow("redirect:/login?callbackUrl=/producer");
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it("writes diagram and director visibility=false when checkbox omitted", async () => {
    projectFindFirstMock.mockResolvedValueOnce({ id: "proj_a" });
    authMock.mockResolvedValueOnce(producerSession());

    const { saveProjectStageDesign } = await import("./actions");

    await expect(saveProjectStageDesign(stageForm("proj_a", { visible: false }))).rejects.toThrow(
      "redirect:/producer/inbox/proj_a/stage-design?saved=1",
    );

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(projectUpdateMock).toHaveBeenCalledWith({
      where: { id: "proj_a" },
      data: { stageDesignDirectorVisible: false },
    });
    expect(revalidateProjectMirrorCacheMock).toHaveBeenCalledWith("proj_a");
    expect(projectFindFirstMock).toHaveBeenCalledWith({
      where: { id: "proj_a", status: ProjectStatus.INTAKE_SUBMITTED },
      select: { id: true },
    });
  });

  it("sets director visibility=true when checkbox on", async () => {
    projectFindFirstMock.mockResolvedValueOnce({ id: "proj_b" });
    authMock.mockResolvedValueOnce(producerSession(GlobalRole.ULS_ADMIN));

    const { saveProjectStageDesign } = await import("./actions");

    await expect(saveProjectStageDesign(stageForm("proj_b", { visible: true }))).rejects.toThrow(
      "redirect:/producer/inbox/proj_b/stage-design?saved=1",
    );

    expect(projectUpdateMock).toHaveBeenCalledWith({
      where: { id: "proj_b" },
      data: { stageDesignDirectorVisible: true },
    });
  });

  it("parses placements payload into canvasJson", async () => {
    projectFindFirstMock.mockResolvedValueOnce({ id: "proj_c" });
    authMock.mockResolvedValueOnce(producerSession());

    const { saveProjectStageDesign } = await import("./actions");
    const placements = [{ id: "z1", kind: "LED_WALL", x: 12, y: 10, rotationDeg: 0 }];

    await expect(
      saveProjectStageDesign(stageForm("proj_c", { placementsJson: JSON.stringify(placements) })),
    ).rejects.toThrow("redirect:/producer/inbox/proj_c/stage-design?saved=1");

    const upsertArg = upsertMock.mock.calls[0][0] as {
      create: { canvasJson: { placements: unknown[] } };
    };
    expect(upsertArg.create.canvasJson.placements).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "z1", kind: "LED_WALL" })]),
    );
  });

  it("persists plotMargins and shapes in canvasJson", async () => {
    projectFindFirstMock.mockResolvedValueOnce({ id: "proj_plot" });
    authMock.mockResolvedValueOnce(producerSession());

    const { saveProjectStageDesign } = await import("./actions");
    await expect(
      saveProjectStageDesign(
        stageForm("proj_plot", {
          plotMarginsJson: JSON.stringify({
            downstage: 80,
            upstage: 10,
            stageLeft: 20,
            stageRight: 20,
          }),
          shapesJson: JSON.stringify([
            {
              id: "s1",
              kind: "RECT",
              x: 5,
              y: -40,
              width: 8,
              height: 3,
              rotationDeg: 0,
              label: "FOH truss",
            },
          ]),
        }),
      ),
    ).rejects.toThrow("redirect:/producer/inbox/proj_plot/stage-design?saved=1");

    const upsertArg = upsertMock.mock.calls[0][0] as {
      create: {
        canvasJson: {
          plotMargins: Record<string, number>;
          shapes: Array<{ id: string; kind: string; label?: string }>;
        };
      };
    };
    expect(upsertArg.create.canvasJson.plotMargins).toEqual(
      expect.objectContaining({ downstage: 80, upstage: 10, stageLeft: 20, stageRight: 20 }),
    );
    expect(upsertArg.create.canvasJson.shapes).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "s1", kind: "RECT", label: "FOH truss" })]),
    );
  });

  it("persists deckPolygons in canvasJson when deck payload is non-empty", async () => {
    projectFindFirstMock.mockResolvedValueOnce({ id: "proj_deck" });
    authMock.mockResolvedValueOnce(producerSession());

    const { saveProjectStageDesign } = await import("./actions");
    const deck = [
      {
        id: "mod_a",
        points: [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 6 },
          { x: 0, y: 6 },
        ],
      },
    ];

    await expect(
      saveProjectStageDesign(stageForm("proj_deck", { deckPolygonsJson: JSON.stringify(deck) })),
    ).rejects.toThrow("redirect:/producer/inbox/proj_deck/stage-design?saved=1");

    const upsertArg = upsertMock.mock.calls[0][0] as {
      create: { canvasJson: { deckPolygons?: Array<{ id: string }> } };
    };
    expect(upsertArg.create.canvasJson.deckPolygons).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "mod_a" })]),
    );
  });

  it("persists reconciled diagram layers from diagramLayersJson", async () => {
    projectFindFirstMock.mockResolvedValueOnce({ id: "proj_layers" });
    authMock.mockResolvedValueOnce(producerSession());

    const { saveProjectStageDesign } = await import("./actions");
    const lid = "uls_layer_saved";
    const layers = [{ id: lid, name: "LX" }];

    await expect(
      saveProjectStageDesign(stageForm("proj_layers", { diagramLayersJson: JSON.stringify(layers) })),
    ).rejects.toThrow("redirect:/producer/inbox/proj_layers/stage-design?saved=1");

    const upsertArg = upsertMock.mock.calls[0][0] as {
      create: { canvasJson: { diagramLayers?: Array<{ id: string; name: string }> } };
    };
    const rows = upsertArg.create.canvasJson.diagramLayers;
    expect(rows?.some((row) => row.id === DIAGRAM_LAYER_DEFAULT_ID)).toBe(true);
    expect(rows).toEqual(expect.arrayContaining([expect.objectContaining({ id: lid, name: "LX" })]));
  });
});
