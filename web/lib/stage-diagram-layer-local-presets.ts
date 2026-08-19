import type { DiagramLayerTemplateTier } from "./stage-diagram-layer-template";
import { sanitizeDiagramLayerGroup } from "./stage-design-diagram-layers";

/** Browser **localStorage** envelope for named tier stacks (per producer project key). */
export const DIAGRAM_LAYER_LOCAL_PRESETS_VERSION = 1 as const;

const MAX_LOCAL_PRESETS = 24;
const MAX_LABEL_CHARS = 48;
const STORAGE_PREFIX = "uls_diagram_layer_presets_v1:";

export type DiagramLayerNamedLocalPreset = {
  id: string;
  label: string;
  savedAt: string;
  tiers: DiagramLayerTemplateTier[];
};

export type DiagramLayerPortablePresetRow = {
  label: string;
  tiers: DiagramLayerTemplateTier[];
};

export type DiagramLayerImportMergeResult = {
  presets: DiagramLayerNamedLocalPreset[];
  added: number;
  skipped: number;
};

export type DiagramLayerLocalPresetsFileV1 = {
  version: typeof DIAGRAM_LAYER_LOCAL_PRESETS_VERSION;
  presets: DiagramLayerNamedLocalPreset[];
};

function storageKey(projectKey: string): string {
  const t = projectKey.trim().slice(0, 96) || "default";
  return `${STORAGE_PREFIX}${t}`;
}

/** One-line label for saved stacks (producer UI). */
export function sanitizeDiagramLayerPresetLabel(raw: string): string | undefined {
  const t = raw.replace(/\s+/g, " ").trim().slice(0, MAX_LABEL_CHARS);
  if (t.length === 0) return undefined;
  if (/[\u0000-\u001f]/.test(t)) return undefined;
  return t;
}

function newPresetListId(): string {
  return `ulp_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Normalize tier rows from interchange JSON or DB payloads. */
export function normalizeDiagramLayerTemplateTierRows(raw: unknown): DiagramLayerTemplateTier[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const normalizedTiers: DiagramLayerTemplateTier[] = [];
  for (const row of raw) {
    if (normalizedTiers.length >= 31) break;
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const nameSrc = typeof r.name === "string" ? r.name.trim().slice(0, 96) : "";
    const name = nameSrc.length > 0 ? nameSrc.slice(0, 64) : "Layer";
    const t: DiagramLayerTemplateTier = { name };
    const g = sanitizeDiagramLayerGroup(r.group);
    if (g) t.group = g;
    const vis = r.visible;
    if (vis === false || vis === 0) t.visible = false;
    const brRaw = r.bracketReorderLocked;
    if (brRaw === true || brRaw === 1) t.bracketReorderLocked = true;
    normalizedTiers.push(t);
  }
  return normalizedTiers;
}

export function parseDiagramLayerLocalPresets(raw: unknown): DiagramLayerNamedLocalPreset[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const rec = raw as Record<string, unknown>;
  if (rec.version !== DIAGRAM_LAYER_LOCAL_PRESETS_VERSION) return [];
  const arr = rec.presets;
  if (!Array.isArray(arr)) return [];
  const out: DiagramLayerNamedLocalPreset[] = [];
  for (const p of arr) {
    if (out.length >= MAX_LOCAL_PRESETS) break;
    if (!p || typeof p !== "object" || Array.isArray(p)) continue;
    const o = p as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim().slice(0, 40) : "";
    const label = typeof o.label === "string" ? o.label.trim().slice(0, MAX_LABEL_CHARS) : "";
    if (!/^ulp_[\w]+$/.test(id) || !label) continue;
    const savedAt = typeof o.savedAt === "string" ? o.savedAt.trim() : "";
    const tiers = o.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0) continue;
    const normalizedTiers = normalizeDiagramLayerTemplateTierRows(tiers);
    if (normalizedTiers.length === 0) continue;
    out.push({
      id,
      label,
      savedAt: savedAt.length > 0 ? savedAt : new Date(0).toISOString(),
      tiers: normalizedTiers,
    });
  }
  return out;
}

export function loadDiagramLayerLocalPresets(projectKey: string): DiagramLayerNamedLocalPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(projectKey));
    if (!raw?.trim()) return [];
    const parsed = JSON.parse(raw) as unknown;
    return parseDiagramLayerLocalPresets(parsed);
  } catch {
    return [];
  }
}

export function saveDiagramLayerLocalPresets(projectKey: string, presets: readonly DiagramLayerNamedLocalPreset[]): void {
  if (typeof window === "undefined") return;
  try {
    const file: DiagramLayerLocalPresetsFileV1 = {
      version: DIAGRAM_LAYER_LOCAL_PRESETS_VERSION,
      presets: [...presets].slice(0, MAX_LOCAL_PRESETS),
    };
    window.localStorage.setItem(storageKey(projectKey), JSON.stringify(file));
  } catch {
    /* quota / private mode */
  }
}

export function maxDiagramLayerLocalPresets(): typeof MAX_LOCAL_PRESETS {
  return MAX_LOCAL_PRESETS;
}

export type AddLocalPresetResult =
  | { ok: true; presets: DiagramLayerNamedLocalPreset[] }
  | { ok: false; reason: "EMPTY_LABEL" | "NO_CUSTOM_TIERS" | "CAP" | "DUPE_LABEL" };

/** Append a preset after validating caps; caller should persist with **`saveDiagramLayerLocalPresets`**. */
export function addDiagramLayerLocalPreset(
  existing: readonly DiagramLayerNamedLocalPreset[],
  label: string | undefined,
  tiers: readonly DiagramLayerTemplateTier[],
): AddLocalPresetResult {
  const lab = sanitizeDiagramLayerPresetLabel(label ?? "");
  if (!lab) return { ok: false, reason: "EMPTY_LABEL" };
  if (tiers.length === 0) return { ok: false, reason: "NO_CUSTOM_TIERS" };
  if (existing.length >= MAX_LOCAL_PRESETS) return { ok: false, reason: "CAP" };
  if (existing.some((p) => p.label.toLowerCase() === lab.toLowerCase())) return { ok: false, reason: "DUPE_LABEL" };

  const next: DiagramLayerNamedLocalPreset = {
    id: newPresetListId(),
    label: lab,
    savedAt: new Date().toISOString(),
    tiers: [...tiers],
  };
  return { ok: true, presets: [...existing, next] };
}

export function removeDiagramLayerLocalPreset(
  existing: readonly DiagramLayerNamedLocalPreset[],
  id: string,
): DiagramLayerNamedLocalPreset[] {
  return existing.filter((p) => p.id !== id);
}

export function diagramLayerPresetsToPortableJson(presets: readonly DiagramLayerNamedLocalPreset[]): string {
  const rows: DiagramLayerPortablePresetRow[] = presets.map((p) => ({ label: p.label, tiers: p.tiers }));
  const env = { schemaVersion: DIAGRAM_LAYER_LOCAL_PRESETS_VERSION, presets: rows };
  return `${JSON.stringify(env, null, 2)}\n`;
}

/** Merge-import semantics — skips duplicate labels vs existing browser rows / cap. */
export function mergeDiagramLayerImportPresets(
  existing: readonly DiagramLayerNamedLocalPreset[],
  rows: readonly { label: string; tiers: DiagramLayerTemplateTier[] }[],
): DiagramLayerImportMergeResult {
  const next = [...existing];
  let added = 0;
  let skipped = 0;
  const taken = new Set(next.map((e) => e.label.toLowerCase()));
  for (const row of rows) {
    if (next.length >= MAX_LOCAL_PRESETS) {
      skipped++;
      continue;
    }
    const lab = sanitizeDiagramLayerPresetLabel(row.label);
    if (!lab || row.tiers.length === 0) {
      skipped++;
      continue;
    }
    const lk = lab.toLowerCase();
    if (taken.has(lk)) {
      skipped++;
      continue;
    }
    taken.add(lk);
    next.push({
      id: newPresetListId(),
      label: lab,
      savedAt: new Date().toISOString(),
      tiers: [...row.tiers],
    });
    added++;
  }
  return { presets: next, added, skipped };
}
