import type {
  StageDesignCanvas,
  StageDesignPlacement,
  StageDesignPlacementKind,
  StageDesignShape,
  StageDesignShapeKind,
} from "./stage-design-canvas";
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
  /** Placements surfaced in legend (**cue**, **paired DMX**, or **partial DMX** only). Empty `equipment` `{}` omitted. */
  annotatedCount: number;
  symbolsWithCueRole: number;
  symbolsWithDmxPair: number;
  /** Universe or channel without its partner — still documented but titles skip U·ch until paired. */
  symbolsWithPartialDmx: number;
  /** Fixture / LED-wall rows where **Plot BOM** has `dmx_universe` but not `dmx_channel`. */
  symbolsWithDmxUniverseOnly: number;
  /** Fixture / LED-wall rows where **Plot BOM** has `dmx_channel` but not `dmx_universe`. */
  symbolsWithDmxChannelOnly: number;
};

function finiteEquipmentInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Lightweight readout matching MVP **`equipment`** semantics (producer / BOM / SVG titles).
 */
export function summarizeEquipmentMetadataForLegend(
  placements: readonly StageDesignPlacement[],
): LegendEquipmentMetaSummary {
  let annotatedCount = 0;
  let symbolsWithCueRole = 0;
  let symbolsWithDmxPair = 0;
  let symbolsWithPartialDmx = 0;
  let symbolsWithDmxUniverseOnly = 0;
  let symbolsWithDmxChannelOnly = 0;

  for (const p of placements) {
    const e = p.equipment;
    if (!e) continue;

    const roleOk = typeof e.role === "string" && e.role.trim().length > 0;
    const uOk = finiteEquipmentInt(e.dmxUniverse);
    const chOk = finiteEquipmentInt(e.dmxChannel);
    const dmxPair = uOk && chOk;
    const partialDmx = !dmxPair && (uOk || chOk);

    if (!roleOk && !dmxPair && !partialDmx) continue;

    annotatedCount++;
    if (roleOk) symbolsWithCueRole++;
    if (dmxPair) symbolsWithDmxPair++;
    if (partialDmx) {
      symbolsWithPartialDmx++;
      if (uOk && !chOk) symbolsWithDmxUniverseOnly++;
      if (chOk && !uOk) symbolsWithDmxChannelOnly++;
    }
  }

  return {
    annotatedCount,
    symbolsWithCueRole,
    symbolsWithDmxPair,
    symbolsWithPartialDmx,
    symbolsWithDmxUniverseOnly,
    symbolsWithDmxChannelOnly,
  };
}
