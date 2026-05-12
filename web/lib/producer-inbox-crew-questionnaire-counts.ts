import { prisma } from "@/lib/prisma";

/** Per-project questionnaire row totals and submitted counts for producer inbox/calendar triage. */
export async function questionnaireSubmissionCountsByProject(projectIds: readonly string[]): Promise<{
  rowsByProject: Map<string, number>;
  submittedByProject: Map<string, number>;
}> {
  const ids = [...new Set(projectIds.filter(Boolean))];
  if (ids.length === 0) {
    return { rowsByProject: new Map(), submittedByProject: new Map() };
  }

  const [rows, submitted] = await Promise.all([
    prisma.staffEventQuestionnaire.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.staffEventQuestionnaire.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, submittedAt: { not: null } },
      _count: { _all: true },
    }),
  ]);

  return {
    rowsByProject: new Map(rows.map((r) => [r.projectId, r._count._all])),
    submittedByProject: new Map(submitted.map((r) => [r.projectId, r._count._all])),
  };
}
