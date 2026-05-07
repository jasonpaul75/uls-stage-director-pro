import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { platformDataPurgeEligibleAtUtc } from "@/lib/platform-retention";

/** Secured CSV-style JSON for purge runbooks: projects past 36‑month retention anchor without legal hold. */
export async function GET(req: Request) {
  const secret = process.env.CRON_RETENTION_PREVIEW_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "Cron secret not configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization")?.trim();
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const projects = await prisma.project.findMany({
    where: {
      eventConclusionAt: { not: null },
      retentionLegalHold: false,
    },
    select: {
      id: true,
      name: true,
      eventConclusionAt: true,
    },
    orderBy: { eventConclusionAt: "asc" },
  });

  const eligible = [];
  for (const p of projects) {
    if (!p.eventConclusionAt) continue;
    const anchor = platformDataPurgeEligibleAtUtc(p.eventConclusionAt);
    if (now.getTime() > anchor.getTime()) {
      eligible.push({
        id: p.id,
        name: p.name,
        eventConclusionAt: p.eventConclusionAt.toISOString(),
        earliestPurgeEligibleAtUtc: anchor.toISOString(),
      });
    }
  }

  return NextResponse.json({
    generatedAtUtc: now.toISOString(),
    eligibleCount: eligible.length,
    eligible,
  });
}
