"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  clampFootprint,
  clampPlacement,
  clampPlotMargins,
  clampShape,
  footprintFromDeckStructure,
  MAX_STAGE_DECK_MODULES,
  type StageDeckPolygon,
  type StageDesignCanvas,
  type StageDesignPlotMargins,
  type StageDiagramPaintRef,
} from "@/lib/stage-design-canvas";
import type { StageDesignUnit } from "@prisma/client";
import { keyboardFocusIsTypingField } from "@/lib/keyboard-focus-is-typing-field";
import {
  cloneStageDiagramSnapshot,
  snapshotsEqualDiagramHistory,
  STAGE_DIAGRAM_MAX_UNDO,
  type ProducerDiagramHistoryCallbacks,
  type StageDiagramHistorySnapshot,
} from "@/lib/stage-design-diagram-history";
import { normalizeDiagramLayers, type StageDiagramLayer } from "@/lib/stage-design-diagram-layers";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { ProducerStageFloorPlacements } from "@/components/stage-design/producer-stage-floor-placements";
import { Button } from "@/components/ui";
import { saveProjectStageDesign } from "@/app/producer/inbox/[projectId]/stage-design/actions";

export type ProducerStageDesignFormProps = {
  projectId: string;
  initialTitle: string;
  unit: StageDesignUnit;
  canvas: StageDesignCanvas;
  directorVisible: boolean;
};

const unitLabel = (u: StageDesignUnit) =>
  u === "METERS" ? "Meters — metric stage dimensions" : "Feet — US customary stage dimensions";

export function ProducerStageDesignForm(props: ProducerStageDesignFormProps) {
  const { projectId, initialTitle, unit, canvas, directorVisible } = props;

  const [fw, setFw] = useState(canvas.footprint.width);
  const [fd, setFd] = useState(canvas.footprint.depth);
  const footprint = useMemo(() => clampFootprint(fw, fd), [fw, fd]);
  const [plotMargins, setPlotMargins] = useState<StageDesignPlotMargins>(clampPlotMargins(canvas.plotMargins));
  const [placements, setPlacements] = useState(canvas.placements);
  const [shapes, setShapes] = useState(canvas.shapes);
  const [deckPolygons, setDeckPolygons] = useState<StageDeckPolygon[]>(() => canvas.deckPolygons ?? []);
  const [diagramPaintOrder, setDiagramPaintOrder] = useState<StageDiagramPaintRef[] | undefined>(
    () => canvas.diagramPaintOrder,
  );
  const [diagramLayers, setDiagramLayers] = useState<StageDiagramLayer[]>(() => normalizeDiagramLayers(canvas));
  const deckClamp = deckPolygons.length > 0 ? deckPolygons : undefined;

  const placementsPinned = useMemo(
    () => placements.map((p) => clampPlacement(p, footprint, plotMargins, unit, deckClamp)),
    [placements, footprint, plotMargins, unit, deckClamp],
  );
  const shapesPinned = useMemo(
    () => shapes.map((s) => clampShape(s, footprint, plotMargins, deckClamp)),
    [shapes, footprint, plotMargins, deckClamp],
  );

  const handleDeckPolygonsChange = useCallback(
    (next: StageDeckPolygon[]) => {
      const sliced = next.slice(0, MAX_STAGE_DECK_MODULES);
      setDeckPolygons(sliced);
      if (sliced.length === 0) return;
      const nominal = footprintFromDeckStructure({
        footprint: clampFootprint(fw, fd),
        deckPolygons: sliced,
      });
      setFw(nominal.width);
      setFd(nominal.depth);
    },
    [fw, fd],
  );

  const diagramLiveRef = useRef({
    fw,
    fd,
    plotMargins,
    placements,
    shapes,
    deckPolygons,
    diagramPaintOrder,
    diagramLayers,
  });
  useLayoutEffect(() => {
    diagramLiveRef.current = {
      fw,
      fd,
      plotMargins,
      placements,
      shapes,
      deckPolygons,
      diagramPaintOrder,
      diagramLayers,
    };
  }, [fw, fd, plotMargins, placements, shapes, deckPolygons, diagramPaintOrder, diagramLayers]);

  const pastSnapshotsRef = useRef<StageDiagramHistorySnapshot[]>([]);
  const redoSnapshotsRef = useRef<StageDiagramHistorySnapshot[]>([]);
  const gestureHistoryLockRef = useRef(false);
  /** Stack lengths so Undo/Redo disabled state tracks ref mutations without reading refs during render. */
  const [undoDepth, setUndoDepth] = useState(0);
  const [redoDepth, setRedoDepth] = useState(0);

  const refreshDiagramHistoryUi = useCallback(() => {
    setUndoDepth(pastSnapshotsRef.current.length);
    setRedoDepth(redoSnapshotsRef.current.length);
  }, []);

  const captureDiagramLiveSnapshot = useCallback((): StageDiagramHistorySnapshot => {
    const c = diagramLiveRef.current;
    return cloneStageDiagramSnapshot({
      fw: c.fw,
      fd: c.fd,
      plotMargins: c.plotMargins,
      placements: c.placements,
      shapes: c.shapes,
      deckPolygons: c.deckPolygons,
      diagramPaintOrder: c.diagramPaintOrder,
      diagramLayers: c.diagramLayers,
    });
  }, []);

  const pushDiagramUndoCheckpoint = useCallback(() => {
    const snap = captureDiagramLiveSnapshot();
    const tip = pastSnapshotsRef.current.at(-1);
    if (tip && snapshotsEqualDiagramHistory(tip, snap)) return;
    pastSnapshotsRef.current.push(cloneStageDiagramSnapshot(snap));
    if (pastSnapshotsRef.current.length > STAGE_DIAGRAM_MAX_UNDO) pastSnapshotsRef.current.shift();
    redoSnapshotsRef.current = [];
    refreshDiagramHistoryUi();
  }, [captureDiagramLiveSnapshot, refreshDiagramHistoryUi]);

  const hydrateDiagramFromSnapshot = useCallback(
    (snap: StageDiagramHistorySnapshot) => {
      const h = cloneStageDiagramSnapshot(snap);
      setFw(h.fw);
      setFd(h.fd);
      setPlotMargins(clampPlotMargins(h.plotMargins));
      setPlacements(structuredClone(h.placements));
      setShapes(structuredClone(h.shapes));
      setDeckPolygons(structuredClone(h.deckPolygons).slice(0, MAX_STAGE_DECK_MODULES));
      setDiagramPaintOrder(h.diagramPaintOrder ? structuredClone(h.diagramPaintOrder) : undefined);
      const nextLayers =
        h.diagramLayers && h.diagramLayers.length > 0
          ? structuredClone(h.diagramLayers)
          : normalizeDiagramLayers({
              version: canvas.version,
              footprint: clampFootprint(h.fw, h.fd),
              plotMargins: clampPlotMargins(h.plotMargins),
              placements: h.placements,
              shapes: h.shapes,
              ...(h.deckPolygons.length > 0 ? { deckPolygons: h.deckPolygons } : {}),
            });
      setDiagramLayers(nextLayers);
    },
    [canvas.version],
  );

  const undoDiagramEditing = useCallback(() => {
    gestureHistoryLockRef.current = false;
    if (pastSnapshotsRef.current.length === 0) return;
    const restoreTo = pastSnapshotsRef.current.pop();
    if (!restoreTo) return;
    redoSnapshotsRef.current.push(captureDiagramLiveSnapshot());
    hydrateDiagramFromSnapshot(restoreTo);
    refreshDiagramHistoryUi();
  }, [captureDiagramLiveSnapshot, hydrateDiagramFromSnapshot, refreshDiagramHistoryUi]);

  const redoDiagramEditing = useCallback(() => {
    gestureHistoryLockRef.current = false;
    const fwd = redoSnapshotsRef.current.pop();
    if (!fwd) return;
    pastSnapshotsRef.current.push(captureDiagramLiveSnapshot());
    hydrateDiagramFromSnapshot(fwd);
    refreshDiagramHistoryUi();
  }, [captureDiagramLiveSnapshot, hydrateDiagramFromSnapshot, refreshDiagramHistoryUi]);

  const diagramHistoryCallbacks = useMemo<ProducerDiagramHistoryCallbacks>(
    () => ({
      beginContinuousDiagramGesture() {
        if (gestureHistoryLockRef.current) return;
        gestureHistoryLockRef.current = true;
        pushDiagramUndoCheckpoint();
      },
      endContinuousDiagramGesture() {
        gestureHistoryLockRef.current = false;
      },
      beforeDiscreteDiagramMutation() {
        pushDiagramUndoCheckpoint();
      },
    }),
    [pushDiagramUndoCheckpoint],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keyboardFocusIsTypingField()) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey || e.key.toLowerCase() !== "z") return;
      e.preventDefault();
      if (e.shiftKey) redoDiagramEditing();
      else undoDiagramEditing();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [redoDiagramEditing, undoDiagramEditing]);

  const nominalFootprintLocked = deckPolygons.length > 0;

  const canUndoDiagramStep = undoDepth > 0;
  const canRedoDiagramStep = redoDepth > 0;

  return (
    <ProducerGlassCard as="div">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-uls-text">Stage plot · symbols &amp; shapes</h2>
          <p className="mt-1 text-xs leading-relaxed text-uls-muted">
            Deck size plus working margins for FOH, wings, and off‑deck truss. When published, directors see the same read‑only
            snapshot — a clean plot without the authoring grid — in Show workspace.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-keyshortcuts="Meta+Z Control+Z"
            disabled={!canUndoDiagramStep}
            title="Undo last diagram edit (⌘ or Ctrl Z)"
            onClick={undoDiagramEditing}
          >
            Undo
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
            disabled={!canRedoDiagramStep}
            title="Redo diagram edit (⌘ or Ctrl ⇧ Z)"
            onClick={redoDiagramEditing}
          >
            Redo
          </Button>
        </div>
      </div>
      <form action={saveProjectStageDesign} autoComplete="off" className="mt-4 space-y-4">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="plotMarginsJson" value={JSON.stringify(plotMargins)} readOnly />
        <input type="hidden" name="deckPolygonsJson" value={JSON.stringify(deckPolygons)} readOnly />
        <input type="hidden" name="shapesJson" value={JSON.stringify(shapes)} readOnly />
        <input type="hidden" name="diagramPaintOrderJson" value={JSON.stringify(diagramPaintOrder ?? null)} readOnly />
        <label className="block text-xs font-medium text-uls-muted">
          Plan title
          <input
            name="title"
            type="text"
            maxLength={200}
            defaultValue={initialTitle}
            className="mt-1 w-full max-w-md rounded-lg border border-white/[0.1] bg-black/35 px-3 py-2 text-sm text-uls-text outline-none placeholder:text-uls-subtle focus-visible:ring-2 focus-visible:ring-uls-accent/45"
          />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-uls-muted">Real-world linear unit</legend>
          <label className="flex items-center gap-2 text-sm text-uls-text">
            <input type="radio" name="unit" value="FEET" defaultChecked={unit === "FEET"} /> Feet
          </label>
          <label className="flex items-center gap-2 text-sm text-uls-text">
            <input type="radio" name="unit" value="METERS" defaultChecked={unit === "METERS"} /> Meters
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-4">
          <label className="text-xs font-medium text-uls-muted">
            Stage width ({unit === "METERS" ? "m" : "ft"})
            <input
              name="width"
              type="number"
              min={1}
              max={500}
              step="0.01"
              value={Number.isFinite(fw) ? fw : ""}
              onChange={(e) => {
                if (!nominalFootprintLocked) pushDiagramUndoCheckpoint();
                setFw(Number(e.target.value));
              }}
              disabled={nominalFootprintLocked}
              title={
                nominalFootprintLocked
                  ? "Nominal footprint is synced from drawn deck modules — remove modules to edit manually."
                  : undefined
              }
              className={`mt-1 block w-32 rounded-lg border border-white/[0.1] bg-black/35 px-3 py-2 text-sm tabular-nums text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/45 ${
                nominalFootprintLocked ? "cursor-not-allowed opacity-55" : ""
              }`}
              required
            />
          </label>
          <label className="text-xs font-medium text-uls-muted">
            Stage depth ({unit === "METERS" ? "m" : "ft"})
            <input
              name="depth"
              type="number"
              min={1}
              max={500}
              step="0.01"
              value={Number.isFinite(fd) ? fd : ""}
              onChange={(e) => {
                if (!nominalFootprintLocked) pushDiagramUndoCheckpoint();
                setFd(Number(e.target.value));
              }}
              disabled={nominalFootprintLocked}
              title={
                nominalFootprintLocked
                  ? "Nominal footprint is synced from drawn deck modules — remove modules to edit manually."
                  : undefined
              }
              className={`mt-1 block w-32 rounded-lg border border-white/[0.1] bg-black/35 px-3 py-2 text-sm tabular-nums text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/45 ${
                nominalFootprintLocked ? "cursor-not-allowed opacity-55" : ""
              }`}
              required
            />
          </label>
        </div>
        {nominalFootprintLocked ? (
          <p className="text-[10px] text-uls-accent">
            Multi-module deck: nominal width/depth follow the bounding span of polygons (stored on Save). Clear all deck modules below
            to unlock manual dimensions.
          </p>
        ) : null}

        <div className="rounded-xl border border-white/[0.08] bg-black/15 p-4">
          <h3 className="text-xs font-semibold text-uls-text">Plot margins (past the deck)</h3>
          <p className="mt-1 text-[10px] text-uls-subtle">
            Downstage extends toward the audience (−Y). Left/right are from house facing the stage.
          </p>
          <div className="mt-3 grid max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ["downstage", "Downstage / FOH"],
                ["upstage", "Upstage"],
                ["stageLeft", "Stage left"],
                ["stageRight", "Stage right"],
              ] as const
            ).map(([key, lab]) => (
              <label key={key} className="block text-[10px] font-medium text-uls-muted">
                {lab}
                <input
                  type="number"
                  min={0}
                  max={400}
                  step="0.5"
                  value={plotMargins[key]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    pushDiagramUndoCheckpoint();
                    setPlotMargins((prev) =>
                      clampPlotMargins({ ...prev, [key]: Number.isFinite(v) ? v : prev[key] }),
                    );
                  }}
                  className="mt-1 block w-full rounded-lg border border-white/[0.1] bg-black/35 px-2 py-1.5 text-xs tabular-nums text-uls-text outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35"
                />
              </label>
            ))}
          </div>
        </div>

        <ProducerStageFloorPlacements
          unit={unit}
          footprint={footprint}
          deckPolygons={deckPolygons}
          onDeckPolygonsChange={handleDeckPolygonsChange}
          diagramHistoryCallbacks={diagramHistoryCallbacks}
          plotMargins={plotMargins}
          placements={placementsPinned}
          shapes={shapesPinned}
          diagramPaintOrder={diagramPaintOrder}
          onDiagramPaintOrderChange={setDiagramPaintOrder}
          diagramLayers={diagramLayers}
          onDiagramLayersChange={setDiagramLayers}
          onPlacementsChange={setPlacements}
          onShapesChange={setShapes}
          diagramExportFileSlug={projectId}
        />
        <p className="text-[10px] text-uls-subtle">{unitLabel(unit)} · not drafting-scale.</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3">
          <input
            type="checkbox"
            name="stageDesignDirectorVisible"
            value="on"
            defaultChecked={directorVisible}
            className="mt-1 h-4 w-4 rounded border-white/25 accent-uls-accent"
          />
          <span className="text-xs leading-relaxed text-uls-muted">
            <span className="font-medium text-uls-text">Publish diagram to Show workspace</span>
            <span className="block mt-0.5">
              Directors see a clean read-only snapshot in Show workspace after booking — not the authoring grid. They reach ULS/routing through{" "}
              <span className="text-uls-text">Production support tickets</span> linked from that section — same visibility trust pattern as run of show.
            </span>
          </span>
        </label>
        <Button type="submit" variant="primary" size="md" className="mt-2">
          Save diagram
        </Button>
      </form>
    </ProducerGlassCard>
  );
}
