import type { StageDesignCanvas } from "@/lib/stage-design-canvas";
import { STAGE_DESIGN_FIXTURE_LIKE_KINDS } from "@/lib/stage-design-canvas";
import type { FixtureCatalogPresetRow } from "@/lib/stage-design-placements-csv";
import {
  formatSortedIntRanges,
  summarizeEquipmentMetadataForLegend,
  summarizeFixtureCatalogJoinForLegend,
} from "@/lib/stage-diagram-legend-stats";

type Props = {
  canvas: Pick<StageDesignCanvas, "placements">;
  /** Browser + hosted fixture presets (producer only). */
  fixtureCatalog?: readonly FixtureCatalogPresetRow[];
  className?: string;
};

/** Compact equipment / DMX / catalog-join QA for the wide-layout diagram inspector rail. */
export function StageDiagramEquipmentQaReadout(props: Props) {
  const { canvas, fixtureCatalog, className = "" } = props;
  const equipment = summarizeEquipmentMetadataForLegend(canvas.placements);
  const catalogJoin =
    fixtureCatalog !== undefined
      ? summarizeFixtureCatalogJoinForLegend(canvas.placements, fixtureCatalog)
      : null;
  const fixtureSymbolCount = canvas.placements.reduce(
    (acc, p) => acc + (STAGE_DESIGN_FIXTURE_LIKE_KINDS.has(p.kind) ? 1 : 0),
    0,
  );

  const showEquipment =
    equipment.annotatedCount > 0 ||
    equipment.pairedDmxCollidingSlots > 0 ||
    equipment.symbolsWithPartialDmx > 0;
  const showCatalog = catalogJoin?.show === true;
  if (!showEquipment && !showCatalog && fixtureSymbolCount === 0) return null;

  return (
    <div
      className={`space-y-1.5 rounded-lg border border-white/[0.08] bg-black/25 p-2 text-[10px] leading-snug text-uls-muted ${className}`}
      role="group"
      aria-label="Equipment and fixture catalog quality readout"
    >
      <p className="font-semibold uppercase tracking-[0.12em] text-uls-subtle">Equipment QA</p>
      {showEquipment ? (
        <ul className="list-none space-y-1">
          {equipment.annotatedCount > 0 ? (
            <li>
              <span className="tabular-nums text-uls-text/90">{equipment.annotatedCount}</span> symbol
              {equipment.annotatedCount === 1 ? "" : "s"} with equipment metadata
              {equipment.symbolsWithDmxPair > 0 ? (
                <>
                  {" "}
                  · <span className="tabular-nums text-uls-text/90">{equipment.symbolsWithDmxPair}</span> paired DMX
                </>
              ) : null}
            </li>
          ) : null}
          {equipment.pairedDmxDistinctUniverses > 0 ? (
            <li>
              Paired DMX universes{" "}
              <span className="font-mono text-[10px] text-uls-text/90">
                {formatSortedIntRanges(equipment.pairedDmxUniversesSorted)}
              </span>
            </li>
          ) : null}
          {equipment.pairedDmxCollidingSlots > 0 ? (
            <li className="text-amber-200/95">
              {equipment.pairedDmxDuplicateFixtureExtras} duplicate paired-address assignment
              {equipment.pairedDmxDuplicateFixtureExtras === 1 ? "" : "s"} across{" "}
              {equipment.pairedDmxCollidingSlots} DMX slot
              {equipment.pairedDmxCollidingSlots === 1 ? "" : "s"}
            </li>
          ) : null}
          {equipment.symbolsWithPartialDmx > 0 ? (
            <li>
              {equipment.symbolsWithPartialDmx} partial DMX
              {equipment.symbolsWithDmxUniverseOnly > 0 || equipment.symbolsWithDmxChannelOnly > 0
                ? ` (${equipment.symbolsWithDmxUniverseOnly} universe-only · ${equipment.symbolsWithDmxChannelOnly} channel-only)`
                : ""}
            </li>
          ) : null}
        </ul>
      ) : fixtureSymbolCount > 0 ? (
        <p className="text-uls-subtle">
          {fixtureSymbolCount} fixture symbol{fixtureSymbolCount === 1 ? "" : "s"} — no equipment captions yet.
        </p>
      ) : null}
      {showCatalog && catalogJoin ? (
        <p className="border-t border-white/[0.06] pt-1.5">
          Catalog join:{" "}
          <span className="tabular-nums text-uls-text/90">{catalogJoin.joinedCount}</span>/
          <span className="tabular-nums text-uls-text/90">{catalogJoin.fixtureSymbolCount}</span> fixture symbols matched (
          <span className="tabular-nums text-uls-text/90">{catalogJoin.catalogRowCount}</span> catalog row
          {catalogJoin.catalogRowCount === 1 ? "" : "s"})
          {catalogJoin.unmatchedCount > 0 ? (
            <>
              {" "}
              · <span className="font-medium text-amber-200/95">{catalogJoin.unmatchedCount} unmatched</span>
              {catalogJoin.unmatchedPresetLabels.length > 0
                ? `: ${catalogJoin.unmatchedPresetLabels.join(", ")}`
                : ""}
            </>
          ) : null}
          . <span className="text-uls-subtle">See Fixtures CSV + join export.</span>
        </p>
      ) : null}
    </div>
  );
}
