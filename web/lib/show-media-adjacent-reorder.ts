import type { PrismaClient } from "@prisma/client";

export type ShowMediaAdjacentReorderDb = Pick<PrismaClient, "projectShowMediaItem" | "$transaction">;

/** Pure swap pairing for ascending `sortOrder` neighbor lists with stable tie-break IDs in `orderedNeighbors`. */
export function computeShowMediaAdjacentSwap(
  orderedNeighbors: readonly { id: string; sortOrder: number }[],
  itemId: string,
  direction: "up" | "down",
): { idA: string; idB: string; sortOrderForA: number; sortOrderForB: number } | null {
  const idx = orderedNeighbors.findIndex((n) => n.id === itemId);
  if (idx < 0) return null;
  const j = direction === "up" ? idx - 1 : idx + 1;
  if (j < 0 || j >= orderedNeighbors.length) return null;
  const a = orderedNeighbors[idx]!;
  const b = orderedNeighbors[j]!;
  return { idA: a.id, idB: b.id, sortOrderForA: b.sortOrder, sortOrderForB: a.sortOrder };
}

export async function reorderShowMediaAdjacent(
  prisma: ShowMediaAdjacentReorderDb,
  projectId: string,
  itemId: string,
  direction: "up" | "down",
): Promise<"swapped" | "noop" | "not_found" | "txn_failed"> {
  const item = await prisma.projectShowMediaItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true, lane: true },
  });
  if (!item) return "not_found";

  const neighbors = await prisma.projectShowMediaItem.findMany({
    where: { projectId, lane: item.lane },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, sortOrder: true },
  });

  const patch = computeShowMediaAdjacentSwap(neighbors, itemId, direction);
  if (!patch) return "noop";

  try {
    await prisma.$transaction([
      prisma.projectShowMediaItem.update({
        where: { id: patch.idA },
        data: { sortOrder: patch.sortOrderForA },
      }),
      prisma.projectShowMediaItem.update({
        where: { id: patch.idB },
        data: { sortOrder: patch.sortOrderForB },
      }),
    ]);
  } catch {
    return "txn_failed";
  }

  return "swapped";
}
