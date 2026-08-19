import type { StagePlacementEquipment } from "./stage-design-canvas";
import {
  sanitizeStagePlacementEquipment,
  STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS,
  STAGE_PLACEMENT_EQUIPMENT_FIXTURE_PROFILE_MAX_CHARS,
  STAGE_PLACEMENT_EQUIPMENT_GEL_MAX_CHARS,
  STAGE_PLACEMENT_EQUIPMENT_PATCH_MAX_CHARS,
  STAGE_PLACEMENT_EQUIPMENT_ROLE_MAX_CHARS,
} from "./stage-design-canvas";
import { csvEscapeDiagramField } from "./stage-design-placements-csv";

/** Browser **localStorage** envelope for reusable fixture metadata rows (per producer project key). */
export const FIXTURE_LIBRARY_LOCAL_PRESETS_VERSION = 1 as const;

/** Portable **`{slug}-fixture-library.json`** interchange (`schemaVersion`); numeric **1** aligns with **`version`** backups for parsing. */
export const FIXTURE_LIBRARY_TEMPLATE_SCHEMA_VERSION = 1 as const;

const MAX_LOCAL_ENTRIES = 48;
/** Saved row title length — matches producer draft input clamp. */
export const FIXTURE_LIBRARY_LABEL_MAX_CHARS = 48;
const STORAGE_PREFIX = "uls_fixture_library_presets_v1:";

export type FixtureLibraryNamedLocalEntry = {
  id: string;
  label: string;
  savedAt: string;
  /** Text-only equipment slice (`role` · `patch` · `gel` · `fixtureId` · `fixtureProfile`). */
  equipment: StagePlacementEquipment;
};

export type FixtureLibraryLocalPresetsFileV1 = {
  version: typeof FIXTURE_LIBRARY_LOCAL_PRESETS_VERSION;
  presets: FixtureLibraryNamedLocalEntry[];
};

function storageKey(projectKey: string): string {
  const t = projectKey.trim().slice(0, 96) || "default";
  return `${STORAGE_PREFIX}${t}`;
}

/** Preset list label (producer UI). */
export function sanitizeFixtureLibraryPresetLabel(raw: string): string | undefined {
  const t = raw.replace(/\s+/g, " ").trim().slice(0, FIXTURE_LIBRARY_LABEL_MAX_CHARS);
  if (t.length === 0) return undefined;
  if (/[\u0000-\u001f]/.test(t)) return undefined;
  return t;
}

function newPresetListId(): string {
  return `ufl_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Draft strings → sanitized template (fixture placement kind baseline — strings only). */
export function fixtureLibraryTemplateFromDraftStrings(draft: {
  role?: string;
  patch?: string;
  gel?: string;
  fixtureId?: string;
  fixtureProfile?: string;
}): StagePlacementEquipment | undefined {
  const partial: StagePlacementEquipment = {};
  if (typeof draft.role === "string") partial.role = draft.role;
  if (typeof draft.patch === "string") partial.patch = draft.patch;
  if (typeof draft.gel === "string") partial.gel = draft.gel;
  if (typeof draft.fixtureId === "string") partial.fixtureId = draft.fixtureId;
  if (typeof draft.fixtureProfile === "string") partial.fixtureProfile = draft.fixtureProfile;
  const s = sanitizeStagePlacementEquipment(partial, "FIXTURE");
  if (!s) return undefined;
  const rest = { ...s };
  delete rest.dmxUniverse;
  delete rest.dmxChannel;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

/** Merge saved library **`template`** fields onto **`base`** (overwrites overlapping keys only). */
export function mergeFixtureLibraryTemplateOntoEquipment(
  base: StagePlacementEquipment | undefined,
  template: StagePlacementEquipment,
): StagePlacementEquipment {
  const next: StagePlacementEquipment = { ...(base ?? {}) };
  if (template.role !== undefined) next.role = template.role;
  if (template.patch !== undefined) next.patch = template.patch;
  if (template.gel !== undefined) next.gel = template.gel;
  if (template.fixtureId !== undefined) next.fixtureId = template.fixtureId;
  if (template.fixtureProfile !== undefined) next.fixtureProfile = template.fixtureProfile;
  return next;
}

function parseEquipmentSlice(raw: unknown): StagePlacementEquipment | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const draft = {
    role: typeof o.role === "string" ? o.role : undefined,
    patch: typeof o.patch === "string" ? o.patch : undefined,
    gel: typeof o.gel === "string" ? o.gel : undefined,
    fixtureId: typeof o.fixtureId === "string" ? o.fixtureId : undefined,
    fixtureProfile: typeof o.fixtureProfile === "string" ? o.fixtureProfile : undefined,
  };
  return fixtureLibraryTemplateFromDraftStrings(draft);
}

export function parseFixtureLibraryLocalPresets(raw: unknown): FixtureLibraryNamedLocalEntry[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rec = raw as Record<string, unknown>;
  if (rec.version !== FIXTURE_LIBRARY_LOCAL_PRESETS_VERSION) return [];
  const arr = rec.presets;
  if (!Array.isArray(arr)) return [];
  const out: FixtureLibraryNamedLocalEntry[] = [];
  for (const p of arr) {
    if (out.length >= MAX_LOCAL_ENTRIES) break;
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const o = p as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim().slice(0, 40) : "";
    const label = typeof o.label === "string" ? o.label.trim().slice(0, FIXTURE_LIBRARY_LABEL_MAX_CHARS) : "";
    if (!/^ufl_[\w]+$/.test(id) || !label) continue;
    const equipment = parseEquipmentSlice(o.equipment);
    if (!equipment) continue;
    const savedAt = typeof o.savedAt === "string" ? o.savedAt.trim() : "";
    out.push({
      id,
      label,
      savedAt: savedAt.length > 0 ? savedAt : new Date(0).toISOString(),
      equipment,
    });
  }
  return out;
}

export function loadFixtureLibraryLocalPresets(projectKey: string): FixtureLibraryNamedLocalEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(projectKey));
    if (!raw?.trim()) return [];
    const parsed = JSON.parse(raw) as unknown;
    return parseFixtureLibraryLocalPresets(parsed);
  } catch {
    return [];
  }
}

export function saveFixtureLibraryLocalPresets(projectKey: string, presets: readonly FixtureLibraryNamedLocalEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const file: FixtureLibraryLocalPresetsFileV1 = {
      version: FIXTURE_LIBRARY_LOCAL_PRESETS_VERSION,
      presets: [...presets].slice(0, MAX_LOCAL_ENTRIES),
    };
    window.localStorage.setItem(storageKey(projectKey), JSON.stringify(file));
  } catch {
    /* quota / private mode */
  }
}

export function maxFixtureLibraryLocalPresets(): typeof MAX_LOCAL_ENTRIES {
  return MAX_LOCAL_ENTRIES;
}

export type AddFixtureLibraryPresetResult =
  | { ok: true; presets: FixtureLibraryNamedLocalEntry[] }
  | { ok: false; reason: "EMPTY_LABEL" | "NO_EQUIPMENT_FIELDS" | "CAP" | "DUPE_LABEL" };

/** Append after validating caps; caller persists with **`saveFixtureLibraryLocalPresets`**. */
export function addFixtureLibraryLocalPreset(
  existing: readonly FixtureLibraryNamedLocalEntry[],
  label: string | undefined,
  equipment: StagePlacementEquipment | undefined,
): AddFixtureLibraryPresetResult {
  const lab = sanitizeFixtureLibraryPresetLabel(label ?? "");
  if (!lab) return { ok: false, reason: "EMPTY_LABEL" };
  const cleaned = equipment
    ? fixtureLibraryTemplateFromDraftStrings({
        role: equipment.role,
        patch: equipment.patch,
        gel: equipment.gel,
        fixtureId: equipment.fixtureId,
        fixtureProfile: equipment.fixtureProfile,
      })
    : undefined;
  if (!cleaned) return { ok: false, reason: "NO_EQUIPMENT_FIELDS" };
  if (existing.length >= MAX_LOCAL_ENTRIES) return { ok: false, reason: "CAP" };
  if (existing.some((p) => p.label.toLowerCase() === lab.toLowerCase())) return { ok: false, reason: "DUPE_LABEL" };

  const next: FixtureLibraryNamedLocalEntry = {
    id: newPresetListId(),
    label: lab,
    savedAt: new Date().toISOString(),
    equipment: cleaned,
  };
  return { ok: true, presets: [...existing, next] };
}

export function removeFixtureLibraryLocalPreset(
  existing: readonly FixtureLibraryNamedLocalEntry[],
  id: string,
): FixtureLibraryNamedLocalEntry[] {
  return existing.filter((p) => p.id !== id);
}

/** Compact preview for dropdown / list labels (avoid huge strings). */
export function summarizeFixtureLibraryEntry(entry: FixtureLibraryNamedLocalEntry): string {
  const parts: string[] = [];
  const e = entry.equipment;
  if (e.fixtureId?.trim()) parts.push(e.fixtureId.trim());
  if (e.fixtureProfile?.trim()) parts.push(e.fixtureProfile.trim().slice(0, 28) + (e.fixtureProfile.trim().length > 28 ? "…" : ""));
  if (e.role?.trim()) parts.push(`cue:${e.role.trim().slice(0, 24)}`);
  if (parts.length === 0) return entry.label;
  return `${entry.label} · ${parts.slice(0, 2).join(" · ")}`;
}

export type FixtureLibraryPortableEquipment = Pick<
  StagePlacementEquipment,
  "role" | "patch" | "gel" | "fixtureId" | "fixtureProfile"
>;

export type FixtureLibraryPortablePresetRow = {
  label: string;
  equipment: FixtureLibraryPortableEquipment;
};

export type FixtureLibraryTemplateFileV1 = {
  schemaVersion: typeof FIXTURE_LIBRARY_TEMPLATE_SCHEMA_VERSION;
  presets: FixtureLibraryPortablePresetRow[];
};

function pruneEquipmentForPortable(eq: StagePlacementEquipment): FixtureLibraryPortableEquipment {
  const o: FixtureLibraryPortableEquipment = {};
  if (eq.role !== undefined) o.role = eq.role;
  if (eq.patch !== undefined) o.patch = eq.patch;
  if (eq.gel !== undefined) o.gel = eq.gel;
  if (eq.fixtureId !== undefined) o.fixtureId = eq.fixtureId;
  if (eq.fixtureProfile !== undefined) o.fixtureProfile = eq.fixtureProfile;
  return o;
}

/** JSON suitable for **`{slug}-fixture-library.json`** downloads (RFC-ish interchange). */
export function fixtureLibraryEntriesToPortableJson(entries: readonly FixtureLibraryNamedLocalEntry[]): string {
  const presets: FixtureLibraryPortablePresetRow[] = entries.map((e) => ({
    label: e.label,
    equipment: pruneEquipmentForPortable(e.equipment),
  }));
  const env: FixtureLibraryTemplateFileV1 = {
    schemaVersion: FIXTURE_LIBRARY_TEMPLATE_SCHEMA_VERSION,
    presets,
  };
  return `${JSON.stringify(env, null, 2)}\n`;
}

export type FixtureLibraryImportMergeResult = {
  presets: FixtureLibraryNamedLocalEntry[];
  added: number;
  skipped: number;
};

/**
 * Parses **`schemaVersion`** portable files or **`version`** **`localStorage`** backups — dedupes by label inside the file.
 */
export function parseFixtureLibraryImportRows(raw: unknown): Array<{ label: string; equipment: StagePlacementEquipment }> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const marker = rec.schemaVersion ?? rec.version;
  if (marker !== FIXTURE_LIBRARY_TEMPLATE_SCHEMA_VERSION && marker !== FIXTURE_LIBRARY_LOCAL_PRESETS_VERSION) return undefined;
  const arr = rec.presets;
  if (!Array.isArray(arr)) return undefined;
  const out: Array<{ label: string; equipment: StagePlacementEquipment }> = [];
  const seen = new Set<string>();
  for (const p of arr) {
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const o = p as Record<string, unknown>;
    const lab = sanitizeFixtureLibraryPresetLabel(typeof o.label === "string" ? o.label : "");
    const equipment = parseEquipmentSlice(o.equipment);
    if (!lab || !equipment) continue;
    const lk = lab.toLowerCase();
    if (seen.has(lk)) continue;
    seen.add(lk);
    out.push({ label: lab, equipment });
  }
  return out.length > 0 ? out : undefined;
}

/** Append imported rows — skips labels already in **`existing`** (case-insensitive) or when over cap. */
export function mergeFixtureLibraryImportRows(
  existing: readonly FixtureLibraryNamedLocalEntry[],
  rows: readonly { label: string; equipment: StagePlacementEquipment }[],
): FixtureLibraryImportMergeResult {
  const next = [...existing];
  let added = 0;
  let skipped = 0;
  const taken = new Set(next.map((e) => e.label.toLowerCase()));
  for (const row of rows) {
    if (next.length >= MAX_LOCAL_ENTRIES) {
      skipped++;
      continue;
    }
    const lk = row.label.toLowerCase();
    if (taken.has(lk)) {
      skipped++;
      continue;
    }
    taken.add(lk);
    next.push({
      id: newPresetListId(),
      label: row.label,
      savedAt: new Date().toISOString(),
      equipment: row.equipment,
    });
    added++;
  }
  return { presets: next, added, skipped };
}

/** BOM-aligned headers for **`{slug}-fixture-library.csv`** (spreadsheet round-trip). */
export const FIXTURE_LIBRARY_CSV_HEADERS = [
  "library_label",
  "cue_role",
  "patch_note",
  "gel_note",
  "fixture_id",
  "fixture_profile",
] as const;

function csvRowFixtureLibrary(cells: string[]): string {
  return `${cells.map(csvEscapeDiagramField).join(",")}\r\n`;
}

/** Single-header spreadsheet export — pairs with {@link parseFixtureLibraryImportCsv}. */
export function fixtureLibraryEntriesToCsv(entries: readonly FixtureLibraryNamedLocalEntry[]): string {
  let out = csvRowFixtureLibrary([...FIXTURE_LIBRARY_CSV_HEADERS]);
  for (const e of entries) {
    const eq = e.equipment;
    out += csvRowFixtureLibrary([
      e.label,
      eq.role ?? "",
      eq.patch ?? "",
      eq.gel ?? "",
      eq.fixtureId ?? "",
      eq.fixtureProfile ?? "",
    ]);
  }
  return out;
}

function normalizeCsvHeaderCell(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_");
}

function csvColumnIndex(headers: readonly string[], candidates: readonly string[]): number {
  const norm = headers.map(normalizeCsvHeaderCell);
  for (const c of candidates) {
    const key = normalizeCsvHeaderCell(c);
    const ix = norm.indexOf(key);
    if (ix >= 0) return ix;
  }
  return -1;
}

/** Minimal RFC 4180-style splitter for fixture-library CSV rows (comma or semicolon field delimiter). */
export function splitCsvRecords(text: string, delimiter: "," | ";" = ","): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let i = 0;
  let inQuotes = false;
  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      if (text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.length > 0)) rows.push(row);
      row = [];
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      cell = "";
      if (row.some((x) => x.length > 0)) rows.push(row);
      row = [];
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  row.push(cell);
  if (row.some((x) => x.length > 0)) rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/**
 * Parses **`library_label`** (+ optional BOM symbol cue columns) spreadsheet exports — dedupes by label inside file.
 */
export function parseFixtureLibraryImportCsv(text: string): Array<{ label: string; equipment: StagePlacementEquipment }> | undefined {
  const trimmed = text.replace(/^\ufeff/, "").trimEnd();
  if (!trimmed) return undefined;
  let delimiter: "," | ";" = ",";
  let records = splitCsvRecords(trimmed, delimiter);
  if (records.length < 2) return undefined;
  let headers = records[0];
  let labelIx = csvColumnIndex(headers, ["library_label", "preset_label", "label"]);
  if (labelIx < 0 && trimmed.includes(";")) {
    delimiter = ";";
    records = splitCsvRecords(trimmed, delimiter);
    if (records.length < 2) return undefined;
    headers = records[0];
    labelIx = csvColumnIndex(headers, ["library_label", "preset_label", "label"]);
  }
  if (labelIx < 0) return undefined;
  const cueIx = csvColumnIndex(headers, ["cue_role", "role", "cue"]);
  const patchIx = csvColumnIndex(headers, ["patch_note", "patch"]);
  const gelIx = csvColumnIndex(headers, ["gel_note", "gel"]);
  const fidIx = csvColumnIndex(headers, ["fixture_id", "fixtureid"]);
  const profIx = csvColumnIndex(headers, ["fixture_profile", "fixtureprofile", "profile"]);

  const out: Array<{ label: string; equipment: StagePlacementEquipment }> = [];
  const seen = new Set<string>();
  for (let r = 1; r < records.length; r++) {
    const cells = records[r];
    const labRaw = (cells[labelIx] ?? "").trim();
    const lab = sanitizeFixtureLibraryPresetLabel(labRaw);
    if (!lab) continue;
    const lk = lab.toLowerCase();
    if (seen.has(lk)) continue;
    seen.add(lk);
    const draft: Parameters<typeof fixtureLibraryTemplateFromDraftStrings>[0] = {};
    if (cueIx >= 0 && (cells[cueIx] ?? "").trim()) draft.role = cells[cueIx]!;
    if (patchIx >= 0 && (cells[patchIx] ?? "").trim()) draft.patch = cells[patchIx]!;
    if (gelIx >= 0 && (cells[gelIx] ?? "").trim()) draft.gel = cells[gelIx]!;
    if (fidIx >= 0 && (cells[fidIx] ?? "").trim()) draft.fixtureId = cells[fidIx]!;
    if (profIx >= 0 && (cells[profIx] ?? "").trim()) draft.fixtureProfile = cells[profIx]!;
    const equipment = fixtureLibraryTemplateFromDraftStrings(draft);
    if (!equipment) continue;
    out.push({ label: lab, equipment });
  }
  return out.length > 0 ? out : undefined;
}

export const FIXTURE_LIBRARY_DRAFT_FIELD_LIMITS = {
  role: STAGE_PLACEMENT_EQUIPMENT_ROLE_MAX_CHARS,
  patch: STAGE_PLACEMENT_EQUIPMENT_PATCH_MAX_CHARS,
  gel: STAGE_PLACEMENT_EQUIPMENT_GEL_MAX_CHARS,
  fixtureId: STAGE_PLACEMENT_EQUIPMENT_FIXTURE_ID_MAX_CHARS,
  fixtureProfile: STAGE_PLACEMENT_EQUIPMENT_FIXTURE_PROFILE_MAX_CHARS,
} as const;
