import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DIAGRAM_LAYER_LOCAL_PRESETS_VERSION,
  mergeDiagramLayerImportPresets,
  normalizeDiagramLayerTemplateTierRows,
  sanitizeDiagramLayerPresetLabel,
  type DiagramLayerNamedLocalPreset,
  type DiagramLayerPortablePresetRow,
} from "@/lib/stage-diagram-layer-local-presets";
import type { DiagramLayerTemplateTier } from "@/lib/stage-diagram-layer-template";
import { parseDiagramLayerTemplateEnvelope } from "@/lib/stage-diagram-layer-template";

export const DIAGRAM_LAYER_SHARED_MAX_ENTRIES = 24;

function newSharedPresetId(): string {
  return `udl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function tiersFromJson(raw: unknown): DiagramLayerTemplateTier[] | undefined {
  const tiers = normalizeDiagramLayerTemplateTierRows(raw);
  return tiers.length > 0 ? tiers : undefined;
}

export function namedEntryFromDbRow(row: {
  id: string;
  label: string;
  tiers: unknown;
  updatedAt: Date;
}): DiagramLayerNamedLocalPreset | null {
  const tiers = tiersFromJson(row.tiers);
  if (!tiers) return null;
  return {
    id: row.id,
    label: row.label,
    savedAt: row.updatedAt.toISOString(),
    tiers,
  };
}

/**
 * Parses `{ presets: [...] }`, `{ schemaVersion|version: 1, presets }`, or `{ schemaVersion: 1, tiers }` single-stack payloads.
 * Returns **`[]`** when **`presets`** is an empty array (valid full replace). Returns **`null`** when malformed.
 */
export function extractValidatedPresetRowsFromBody(
  body: unknown,
): Array<{ label: string; tiers: DiagramLayerTemplateTier[] }> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const rec = body as Record<string, unknown>;

  if (Array.isArray(rec.presets)) {
    const arr = rec.presets;
    const out: Array<{ label: string; tiers: DiagramLayerTemplateTier[] }> = [];
    const seen = new Set<string>();
    for (const p of arr) {
      if (!p || typeof p !== "object" || Array.isArray(p)) continue;
      const o = p as Record<string, unknown>;
      const lab = sanitizeDiagramLayerPresetLabel(typeof o.label === "string" ? o.label : "");
      const tiers = tiersFromJson(o.tiers);
      if (!lab || !tiers) continue;
      const lk = lab.toLowerCase();
      if (seen.has(lk)) continue;
      seen.add(lk);
      out.push({ label: lab, tiers });
    }
    return out;
  }

  const templateTiers = parseDiagramLayerTemplateEnvelope(body);
  if (templateTiers?.length) {
    const lab = sanitizeDiagramLayerPresetLabel(typeof rec.label === "string" ? rec.label : "Imported stack");
    if (!lab) return null;
    return [{ label: lab, tiers: templateTiers }];
  }

  return null;
}

async function writeAuditLog(actorUserId: string, action: string, detail?: Prisma.InputJsonValue): Promise<void> {
  await prisma.diagramLayerSharedAuditLog.create({
    data: {
      actorUserId,
      action,
      ...(detail !== undefined ? { detail } : {}),
    },
  });
}

async function persistEntriesReplacingAll(
  actorUserId: string,
  entries: readonly DiagramLayerNamedLocalPreset[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.diagramLayerSharedPreset.deleteMany({});
    let sortOrder = 0;
    for (const e of entries) {
      await tx.diagramLayerSharedPreset.create({
        data: {
          id: e.id,
          sortOrder,
          label: e.label,
          labelKey: e.label.toLowerCase(),
          tiers: e.tiers as Prisma.InputJsonValue,
          updatedByUserId: actorUserId,
        },
      });
      sortOrder++;
    }
  });
}

export async function listSharedDiagramLayerPortable(): Promise<{
  schemaVersion: typeof DIAGRAM_LAYER_LOCAL_PRESETS_VERSION;
  presets: DiagramLayerPortablePresetRow[];
  updatedAt: string | null;
}> {
  const rows = await prisma.diagramLayerSharedPreset.findMany({
    orderBy: { sortOrder: "asc" },
    select: { label: true, tiers: true, updatedAt: true },
  });
  let latest: Date | null = null;
  const presets: DiagramLayerPortablePresetRow[] = [];
  for (const r of rows) {
    const tiers = tiersFromJson(r.tiers);
    if (!tiers) continue;
    presets.push({ label: r.label, tiers });
    if (!latest || r.updatedAt > latest) latest = r.updatedAt;
  }
  return {
    schemaVersion: DIAGRAM_LAYER_LOCAL_PRESETS_VERSION,
    presets,
    updatedAt: latest ? latest.toISOString() : null,
  };
}

/** Full replace — caller must enforce admin RBAC. */
export async function replaceSharedDiagramLayerLibrary(
  actorUserId: string,
  rows: readonly { label: string; tiers: DiagramLayerTemplateTier[] }[],
): Promise<void> {
  if (rows.length > DIAGRAM_LAYER_SHARED_MAX_ENTRIES) {
    throw new Error("OVER_CAP");
  }
  const entries: DiagramLayerNamedLocalPreset[] = rows.map((r) => ({
    id: newSharedPresetId(),
    label: r.label,
    savedAt: new Date().toISOString(),
    tiers: r.tiers,
  }));
  await persistEntriesReplacingAll(actorUserId, entries);
  await writeAuditLog(actorUserId, "SHARED_REPLACE", { count: entries.length });
}

/** Merge-import semantics — skips duplicate labels vs existing hosted rows / cap. */
export async function mergeSharedDiagramLayerLibrary(
  actorUserId: string,
  rows: readonly { label: string; tiers: DiagramLayerTemplateTier[] }[],
): Promise<{ added: number; skipped: number; total: number }> {
  const dbRows = await prisma.diagramLayerSharedPreset.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, tiers: true, updatedAt: true },
  });
  const existing: DiagramLayerNamedLocalPreset[] = [];
  for (const dr of dbRows) {
    const ne = namedEntryFromDbRow(dr);
    if (ne) existing.push(ne);
  }

  const merged = mergeDiagramLayerImportPresets(existing, [...rows]);
  await persistEntriesReplacingAll(actorUserId, merged.presets);
  await writeAuditLog(actorUserId, "SHARED_MERGE", {
    added: merged.added,
    skipped: merged.skipped,
    totalAfter: merged.presets.length,
  });

  return {
    added: merged.added,
    skipped: merged.skipped,
    total: merged.presets.length,
  };
}
