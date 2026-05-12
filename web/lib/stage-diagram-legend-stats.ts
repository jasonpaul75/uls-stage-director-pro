import type { StageDiagramCableRunKind } from "./stage-design-cable-run";
import { STAGE_DIAGRAM_CABLE_RUN_ORDER } from "./stage-design-cable-run";
import type {
  StageDesignCanvas,
  StageDesignPlacement,
  StageDesignPlacementKind,
  StageDesignShape,
  StageDesignShapeKind,
} from "./stage-design-canvas";
import { placementKindAllowsDmxEquipment } from "./stage-design-canvas";
import {
  STAGE_DESIGN_PLACEMENT_KIND_ORDER,
  STAGE_DESIGN_SHAPE_KIND_ORDER,
} from "./stage-design-canvas";
import { normalizeDiagramLayers, DIAGRAM_LAYER_DEFAULT_ID, sanitizeDiagramLayerGroup } from "./stage-design-diagram-layers";

/** Count placements per authored symbol kind (zero for kinds not present — map still has every canonical kind). */
export function histogramPlacementKinds(placements: readonly StageDesignPlacement[]): Map<StageDesignPlacementKind, number> {
  const m = new Map<StageDesignPlacementKind, number>();
  for (const k of STAGE_DESIGN_PLACEMENT_KIND_ORDER) m.set(k, 0);
  for (const p of placements) {
    m.set(p.kind, (m.get(p.kind) ?? 0) + 1);
  }
  return m;
}

/** Count shapes per shape kind — map includes each canonical shape kind. */
export function histogramShapeKinds(shapes: readonly StageDesignShape[]): Map<StageDesignShapeKind, number> {
  const m = new Map<StageDesignShapeKind, number>();
  for (const k of STAGE_DESIGN_SHAPE_KIND_ORDER) m.set(k, 0);
  for (const s of shapes) {
    m.set(s.kind, (m.get(s.kind) ?? 0) + 1);
  }
  return m;
}

/** Count LINE / POLYLINE shapes that carry a cable-run preset (custom stroke overrides still draw, but BOM lists the typed cable when set). */
export function histogramCableRunKinds(shapes: readonly StageDesignShape[]): Map<StageDiagramCableRunKind, number> {
  const m = new Map<StageDiagramCableRunKind, number>();
  for (const k of STAGE_DIAGRAM_CABLE_RUN_ORDER) m.set(k, 0);
  for (const s of shapes) {
    if (s.kind !== "LINE" && s.kind !== "POLYLINE") continue;
    const r = s.cableRun;
    if (!r) continue;
    m.set(r, (m.get(r) ?? 0) + 1);
  }
  return m;
}

export type LegendTierSummary = {
  /** Legend should show drafting-tier context (anything beyond implicit Main-only authoring). */
  show: boolean;
  /** Visible diagram tier display names stacked bottom→top (`normalizeDiagramLayers` order). */
  visibleLabelsBottomToTop: string[];
  /** Visible tiers with stable ids (legend ↔ inspector; Show reads folder + lock cues from producer). */
  visibleTierRowsBottomToTop: ReadonlyArray<{
    id: string;
    name: string;
    /** **`bracketReorderLocked`** tiers — intra-tier **`[` `]`** nudges disabled in producer. */
    drawOrderLocked?: boolean;
    /** Folder path (**`diagramLayers[].group`**) when set (≤32 chars in canvas). */
    folderPathHint?: string;
  }>;
  hiddenTierLabels: readonly string[];
};

/**
 * Readable tier strip for legends — mirrors producer **Diagram layers** stack; hidden tiers listed by label for clarity.
 */
export function summarizeDiagramTiersForLegend(canvas: StageDesignCanvas): LegendTierSummary {
  const normalized = normalizeDiagramLayers(canvas);
  const rows = normalized.map((l) => {
    const grp = sanitizeDiagramLayerGroup(l.group);
    const isMain = l.id === DIAGRAM_LAYER_DEFAULT_ID;
    return {
      visible: l.visible !== false,
      name: l.name.trim().length > 0 ? l.name : "Tier",
      id: l.id,
      drawOrderLocked: !isMain && l.bracketReorderLocked === true,
      folderPathHint: grp,
    };
  });
  const visibleRows = rows.filter((r) => r.visible);
  const visibleLabelsBottomToTop = visibleRows.map((r) => r.name);
  const visibleTierRowsBottomToTop = visibleRows.map((r) => ({
    id: r.id,
    name: r.name,
    ...(r.drawOrderLocked ? { drawOrderLocked: true as const } : {}),
    ...(r.folderPathHint ? { folderPathHint: r.folderPathHint } : {}),
  }));
  const hiddenTierLabels = rows.filter((r) => !r.visible).map((r) => r.name);
  const show = rows.length > 1 || hiddenTierLabels.length > 0;
  return { show, visibleLabelsBottomToTop, visibleTierRowsBottomToTop, hiddenTierLabels };
}

export type LegendEquipmentMetaSummary = {
  /** Placements surfaced in legend (**cue**, **paired/partial DMX**, **patch**, **gel**, **fixture id/profile**). Empty `equipment` `{}` omitted. */
  annotatedCount: number;
  symbolsWithCueRole: number;
  symbolsWithPatchNote: number;
  symbolsWithGelNote: number;
  symbolsWithFixtureId: number;
  symbolsWithFixtureProfile: number;
  symbolsWithDmxPair: number;
  /** Universe or channel without its partner — still documented but titles skip U·ch until paired. */
  symbolsWithPartialDmx: number;
  /** Fixture / LED-wall rows where **Plot BOM** has `dmx_universe` but not `dmx_channel`. */
  symbolsWithDmxUniverseOnly: number;
  /** Fixture / LED-wall rows where **Plot BOM** has `dmx_channel` but not `dmx_universe`. */
  symbolsWithDmxChannelOnly: number;
  /** Distinct universes that appear on **paired** DMX addresses (fixture-capable symbols only). */
  pairedDmxDistinctUniverses: number;
  /** Sorted unique universe ints backing paired DMX (same scope as collisions). */
  pairedDmxUniversesSorted: readonly number[];
  /** Paired (`U`,`ch`) slots referenced by more than one fixture-capable symbol. */
  pairedDmxCollidingSlots: number;
  /** Fixtures beyond the first at each colliding paired slot (`sum(count - 1)` per duplicate slot). */
  pairedDmxDuplicateFixtureExtras: number;
};

function finiteEquipmentInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/** Compact ascending integers as `1, 3–5, 9` for legend footers (expects deduped sorted input). */
export function formatSortedIntRanges(sortedUnique: readonly number[]): string {
  if (sortedUnique.length === 0) return "";
  const parts: string[] = [];
  let s = sortedUnique[0]!;
  let p = s;
  for (let i = 1; i < sortedUnique.length; i++) {
    const n = sortedUnique[i]!;
    if (n === p + 1) {
      p = n;
      continue;
    }
    parts.push(s === p ? `${s}` : `${s}–${p}`);
    s = p = n;
  }
  parts.push(s === p ? `${s}` : `${s}–${p}`);
  return parts.join(", ");
}

/**
 * Lightweight readout matching MVP **`equipment`** semantics (producer / BOM / SVG titles).
 */
export function summarizeEquipmentMetadataForLegend(
  placements: readonly StageDesignPlacement[],
): LegendEquipmentMetaSummary {
  let annotatedCount = 0;
  let symbolsWithCueRole = 0;
  let symbolsWithPatchNote = 0;
  let symbolsWithGelNote = 0;
  let symbolsWithFixtureId = 0;
  let symbolsWithFixtureProfile = 0;
  let symbolsWithDmxPair = 0;
  let symbolsWithPartialDmx = 0;
  let symbolsWithDmxUniverseOnly = 0;
  let symbolsWithDmxChannelOnly = 0;

  const pairedAddrCounts = new Map<string, number>();

  for (const p of placements) {
    const e = p.equipment;
    if (!e) continue;

    const allowDmx = placementKindAllowsDmxEquipment(p.kind);
    const roleOk = typeof e.role === "string" && e.role.trim().length > 0;
    const patchOk = typeof e.patch === "string" && e.patch.trim().length > 0;
    const gelOk = typeof e.gel === "string" && e.gel.trim().length > 0;
    const fixtureIdOk = typeof e.fixtureId === "string" && e.fixtureId.trim().length > 0;
    const fixtureProfileOk = typeof e.fixtureProfile === "string" && e.fixtureProfile.trim().length > 0;
    const uPresent = finiteEquipmentInt(e.dmxUniverse);
    const chPresent = finiteEquipmentInt(e.dmxChannel);
    const uOk = allowDmx && uPresent;
    const chOk = allowDmx && chPresent;
    const dmxPair = uOk && chOk;
    const partialDmx = allowDmx && !dmxPair && (uPresent || chPresent);

    if (!roleOk && !dmxPair && !partialDmx && !patchOk && !gelOk && !fixtureIdOk && !fixtureProfileOk) continue;

    annotatedCount++;
    if (roleOk) symbolsWithCueRole++;
    if (patchOk) symbolsWithPatchNote++;
    if (gelOk) symbolsWithGelNote++;
    if (fixtureIdOk) symbolsWithFixtureId++;
    if (fixtureProfileOk) symbolsWithFixtureProfile++;
    if (dmxPair) symbolsWithDmxPair++;
    if (partialDmx) {
      symbolsWithPartialDmx++;
      if (uOk && !chOk) symbolsWithDmxUniverseOnly++;
      if (chOk && !uOk) symbolsWithDmxChannelOnly++;
    }

    if (
      placementKindAllowsDmxEquipment(p.kind) &&
      dmxPair &&
      e.dmxUniverse !== undefined &&
      e.dmxChannel !== undefined &&
      e.dmxUniverse >= 1 &&
      e.dmxUniverse <= 256 &&
      e.dmxChannel >= 1 &&
      e.dmxChannel <= 512
    ) {
      const key = `${e.dmxUniverse}:${e.dmxChannel}`;
      pairedAddrCounts.set(key, (pairedAddrCounts.get(key) ?? 0) + 1);
    }
  }

  let pairedDmxCollidingSlots = 0;
  let pairedDmxDuplicateFixtureExtras = 0;
  for (const c of pairedAddrCounts.values()) {
    if (c > 1) {
      pairedDmxCollidingSlots++;
      pairedDmxDuplicateFixtureExtras += c - 1;
    }
  }

  const universeSet = new Set<number>();
  for (const k of pairedAddrCounts.keys()) {
    const u = Number.parseInt(k.split(":")[0]!, 10);
    if (Number.isFinite(u)) universeSet.add(u);
  }
  const pairedDmxUniversesSorted = [...universeSet].sort((a, b) => a - b);

  return {
    annotatedCount,
    symbolsWithCueRole,
    symbolsWithPatchNote,
    symbolsWithGelNote,
    symbolsWithFixtureId,
    symbolsWithFixtureProfile,
    symbolsWithDmxPair,
    symbolsWithPartialDmx,
    symbolsWithDmxUniverseOnly,
    symbolsWithDmxChannelOnly,
    pairedDmxDistinctUniverses: pairedDmxUniversesSorted.length,
    pairedDmxUniversesSorted,
    pairedDmxCollidingSlots,
    pairedDmxDuplicateFixtureExtras,
  };
}
