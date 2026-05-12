import {
  DIAGRAM_LAYER_DEFAULT_ID,
  MAX_DIAGRAM_LAYERS,
  sanitizeDiagramLayerGroup,
  type StageDiagramLayer,
} from "./stage-design-diagram-layers";

/** Current on-disk **`uls-diagram-layer-template.json`** envelope. Bump when breaking template shape. */
export const DIAGRAM_LAYER_TEMPLATE_SCHEMA_VERSION = 1 as const;

/** One tier row embedded in templates (**no persisted `id`** — fresh ids on merge). */
export type DiagramLayerTemplateTier = {
  name: string;
  group?: string;
  visible?: boolean;
  bracketReorderLocked?: boolean;
};

export type DiagramLayerTemplateFileV1 = {
  schemaVersion: typeof DIAGRAM_LAYER_TEMPLATE_SCHEMA_VERSION;
  tiers: DiagramLayerTemplateTier[];
};

function newTemplateLayerId(): string {
  return `uls_layer_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Serialize every **custom** tier row (skips **Main**) for templates, downloads, and named presets — no ids. */
export function diagramCustomTiersToTemplateRows(diagramLayers: readonly StageDiagramLayer[]): DiagramLayerTemplateTier[] {
  const tiers: DiagramLayerTemplateTier[] = [];
  for (const row of diagramLayers) {
    if (row.id === DIAGRAM_LAYER_DEFAULT_ID) continue;
    const name = row.name.trim().slice(0, 64) || "Layer";
    const t: DiagramLayerTemplateTier = { name };
    const g = sanitizeDiagramLayerGroup(row.group);
    if (g) t.group = g;
    if (row.visible === false) t.visible = false;
    if (row.bracketReorderLocked === true) t.bracketReorderLocked = true;
    tiers.push(t);
  }
  return tiers;
}

/**
 * Produce JSON for **diagram layer template download** (`schemaVersion`, custom tiers below **Main**, no entity references).
 */
export function diagramLayersToTemplateJson(diagramLayers: readonly StageDiagramLayer[]): string {
  const tiers = diagramCustomTiersToTemplateRows(diagramLayers);
  const env: DiagramLayerTemplateFileV1 = { schemaVersion: DIAGRAM_LAYER_TEMPLATE_SCHEMA_VERSION, tiers };
  return `${JSON.stringify(env, null, 2)}\n`;
}

/**
 * Validates **`uls-diagram-layer-template.json`** (or pasted object) → tier rows suitable for **`appendDiagramLayerTemplateTiers`**.
 */
export function parseDiagramLayerTemplateEnvelope(raw: unknown): DiagramLayerTemplateTier[] | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  if (rec.schemaVersion !== DIAGRAM_LAYER_TEMPLATE_SCHEMA_VERSION) return undefined;
  const rawTiers = rec.tiers;
  if (!Array.isArray(rawTiers) || rawTiers.length === 0) return undefined;
  const tiers: DiagramLayerTemplateTier[] = [];
  const seenKeys = new Set<string>();
  for (const row of rawTiers) {
    if (tiers.length >= MAX_DIAGRAM_LAYERS - 1) break;
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const nameSrc = typeof r.name === "string" ? r.name.trim().slice(0, 96) : "";
    const name = nameSrc.length > 0 ? nameSrc.slice(0, 64) : "Layer";
    const dupKey = `${name}\0${sanitizeDiagramLayerGroup(r.group) ?? ""}`;
    if (seenKeys.has(dupKey)) continue;
    seenKeys.add(dupKey);

    const t: DiagramLayerTemplateTier = { name };
    const g = sanitizeDiagramLayerGroup(r.group);
    if (g) t.group = g;
    const vis = r.visible;
    if (vis === false || vis === 0) t.visible = false;
    const brRaw = r.bracketReorderLocked;
    if (brRaw === true || brRaw === 1) t.bracketReorderLocked = true;
    tiers.push(t);
  }
  return tiers.length > 0 ? tiers : undefined;
}

/**
 * Append template tiers (**new ids**) after the existing stack (**Main** untouched). **`null`** if at cap or **`template`** empty.
 */
export function appendDiagramLayerTemplateTiers(
  diagramLayers: readonly StageDiagramLayer[],
  template: readonly DiagramLayerTemplateTier[],
): StageDiagramLayer[] | null {
  if (diagramLayers.length === 0 || template.length === 0) return null;
  const main = diagramLayers[0]?.id === DIAGRAM_LAYER_DEFAULT_ID ? diagramLayers[0] : null;
  if (!main) return null;

  const room = MAX_DIAGRAM_LAYERS - diagramLayers.length;
  if (room <= 0) return null;

  const added: StageDiagramLayer[] = [];
  const seenKeys = new Set<string>();
  for (const tmpl of template) {
    if (added.length >= room) break;
    const name = tmpl.name.trim().slice(0, 64) || "Layer";
    const dupKey = `${name}\0${sanitizeDiagramLayerGroup(tmpl.group) ?? ""}`;
    if (seenKeys.has(dupKey)) continue;
    seenKeys.add(dupKey);

    const id = newTemplateLayerId();
    const row: StageDiagramLayer = tmpl.visible === false ? { id, name, visible: false } : { id, name };
    const g = sanitizeDiagramLayerGroup(tmpl.group);
    if (g) row.group = g;
    if (tmpl.bracketReorderLocked === true) row.bracketReorderLocked = true;
    added.push(row);
  }
  if (added.length === 0) return null;
  return [...diagramLayers, ...added];
}

/** Browser download — UTF‑8 attachment (producer template export). */
export function triggerUtf8JsonDownload(body: string, filename: string): void {
  const safeName = /\.json$/i.test(filename.trim()) ? filename.trim() : `${filename.trim() || "diagram"}.json`;
  const blob = new Blob([body], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
