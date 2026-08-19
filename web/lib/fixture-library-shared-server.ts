import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { StagePlacementEquipment } from "@/lib/stage-design-canvas";
import {
  FIXTURE_LIBRARY_TEMPLATE_SCHEMA_VERSION,
  fixtureLibraryTemplateFromDraftStrings,
  mergeFixtureLibraryImportRows,
  parseFixtureLibraryImportRows,
  sanitizeFixtureLibraryPresetLabel,
  type FixtureLibraryNamedLocalEntry,
  type FixtureLibraryPortableEquipment,
  type FixtureLibraryPortablePresetRow,
} from "@/lib/stage-fixture-library-local-presets";

export const FIXTURE_LIBRARY_SHARED_MAX_ENTRIES = 48;

function newSharedPresetId(): string {
  return `ufl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function equipmentFromJson(raw: unknown): StagePlacementEquipment | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  return fixtureLibraryTemplateFromDraftStrings({
    role: typeof o.role === "string" ? o.role : undefined,
    patch: typeof o.patch === "string" ? o.patch : undefined,
    gel: typeof o.gel === "string" ? o.gel : undefined,
    fixtureId: typeof o.fixtureId === "string" ? o.fixtureId : undefined,
    fixtureProfile: typeof o.fixtureProfile === "string" ? o.fixtureProfile : undefined,
  });
}

function pruneEquipmentPortable(eq: StagePlacementEquipment): FixtureLibraryPortableEquipment {
  const o: FixtureLibraryPortableEquipment = {};
  if (eq.role !== undefined) o.role = eq.role;
  if (eq.patch !== undefined) o.patch = eq.patch;
  if (eq.gel !== undefined) o.gel = eq.gel;
  if (eq.fixtureId !== undefined) o.fixtureId = eq.fixtureId;
  if (eq.fixtureProfile !== undefined) o.fixtureProfile = eq.fixtureProfile;
  return o;
}

export function namedEntryFromDbRow(row: {
  id: string;
  label: string;
  equipment: unknown;
  updatedAt: Date;
}): FixtureLibraryNamedLocalEntry | null {
  const equipment = equipmentFromJson(row.equipment);
  if (!equipment) return null;
  return {
    id: row.id,
    label: row.label,
    savedAt: row.updatedAt.toISOString(),
    equipment,
  };
}

/**
 * Parses `{ presets: [...] }`, `{ schemaVersion|version: 1, presets }`, or compatible interchange payloads.
 * Returns **`[]`** when **`presets`** is an empty array (valid full replace). Returns **`null`** when malformed.
 */
export function extractValidatedPresetRowsFromBody(body: unknown): Array<{ label: string; equipment: StagePlacementEquipment }> | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const rec = body as Record<string, unknown>;

  if (Array.isArray(rec.presets)) {
    const arr = rec.presets;
    const out: Array<{ label: string; equipment: StagePlacementEquipment }> = [];
    const seen = new Set<string>();
    for (const p of arr) {
      if (!p || typeof p !== "object" || Array.isArray(p)) continue;
      const o = p as Record<string, unknown>;
      const lab = sanitizeFixtureLibraryPresetLabel(typeof o.label === "string" ? o.label : "");
      const equipment = equipmentFromJson(o.equipment);
      if (!lab || !equipment) continue;
      const lk = lab.toLowerCase();
      if (seen.has(lk)) continue;
      seen.add(lk);
      out.push({ label: lab, equipment });
    }
    return out;
  }

  const parsed = parseFixtureLibraryImportRows(body);
  return parsed ?? null;
}

async function writeAuditLog(actorUserId: string, action: string, detail?: Prisma.InputJsonValue): Promise<void> {
  await prisma.fixtureLibrarySharedAuditLog.create({
    data: {
      actorUserId,
      action,
      ...(detail !== undefined ? { detail } : {}),
    },
  });
}

async function persistEntriesReplacingAll(actorUserId: string, entries: readonly FixtureLibraryNamedLocalEntry[]): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.fixtureLibrarySharedPreset.deleteMany({});
    let sortOrder = 0;
    for (const e of entries) {
      await tx.fixtureLibrarySharedPreset.create({
        data: {
          id: e.id,
          sortOrder,
          label: e.label,
          labelKey: e.label.toLowerCase(),
          equipment: e.equipment as Prisma.InputJsonValue,
          updatedByUserId: actorUserId,
        },
      });
      sortOrder++;
    }
  });
}

export async function listSharedFixtureLibraryPortable(): Promise<{
  schemaVersion: typeof FIXTURE_LIBRARY_TEMPLATE_SCHEMA_VERSION;
  presets: FixtureLibraryPortablePresetRow[];
  updatedAt: string | null;
}> {
  const rows = await prisma.fixtureLibrarySharedPreset.findMany({
    orderBy: { sortOrder: "asc" },
    select: { label: true, equipment: true, updatedAt: true },
  });
  let latest: Date | null = null;
  const presets: FixtureLibraryPortablePresetRow[] = [];
  for (const r of rows) {
    const eq = equipmentFromJson(r.equipment);
    if (!eq) continue;
    presets.push({ label: r.label, equipment: pruneEquipmentPortable(eq) });
    if (!latest || r.updatedAt > latest) latest = r.updatedAt;
  }
  return {
    schemaVersion: FIXTURE_LIBRARY_TEMPLATE_SCHEMA_VERSION,
    presets,
    updatedAt: latest ? latest.toISOString() : null,
  };
}

/** Full replace — caller must enforce admin RBAC. */
export async function replaceSharedFixtureLibrary(
  actorUserId: string,
  rows: readonly { label: string; equipment: StagePlacementEquipment }[],
): Promise<void> {
  if (rows.length > FIXTURE_LIBRARY_SHARED_MAX_ENTRIES) {
    throw new Error("OVER_CAP");
  }
  const entries: FixtureLibraryNamedLocalEntry[] = rows.map((r) => ({
    id: newSharedPresetId(),
    label: r.label,
    savedAt: new Date().toISOString(),
    equipment: r.equipment,
  }));
  await persistEntriesReplacingAll(actorUserId, entries);
  await writeAuditLog(actorUserId, "SHARED_REPLACE", { count: entries.length });
}

/** Merge-import semantics — skips duplicate labels vs existing hosted rows / cap. */
export async function mergeSharedFixtureLibrary(
  actorUserId: string,
  rows: readonly { label: string; equipment: StagePlacementEquipment }[],
): Promise<{ added: number; skipped: number; total: number }> {
  const dbRows = await prisma.fixtureLibrarySharedPreset.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, equipment: true, updatedAt: true },
  });
  const existing: FixtureLibraryNamedLocalEntry[] = [];
  for (const dr of dbRows) {
    const ne = namedEntryFromDbRow(dr);
    if (ne) existing.push(ne);
  }

  const merged = mergeFixtureLibraryImportRows(existing, [...rows]);
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
