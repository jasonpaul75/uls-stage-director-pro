"use client";

import { useCallback, useRef, useState } from "react";

import { reorderShowMediaAsDirector } from "@/app/portal/show-media-reorder-actions";
import { ShowMediaWaveformStrip } from "@/components/show-media-waveform-strip";

export type PortalShowMediaCue = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes?: number | null;
};

type Props = {
  tracks: PortalShowMediaCue[];
  /** When set with `reorderAction`, directors get inline ↑/↓ on the rundown (Show workspace only). */
  projectId?: string;
  reorderAction?: typeof reorderShowMediaAsDirector;
};

/** Sequential music rundown: OS/browser audio output; advancing after one cue finishes matches show-flow rehearsal. */
export function PortalMusicSequentialPlayer({ tracks, projectId, reorderAction }: Props) {
  const [idx, setIdx] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const current = tracks[idx];
  const canPrev = idx > 0;
  const canNext = idx < tracks.length - 1;
  const showReorder = Boolean(projectId && reorderAction);

  const setAndScroll = useCallback((nextIdx: number) => {
    setIdx(nextIdx);
    queueMicrotask(() => {
      wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, []);

  if (!current || tracks.length === 0) return null;

  return (
    <div ref={wrapRef} className="space-y-3">
      <div className="rounded border border-neutral-800 bg-neutral-950/80 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Now in rundown</p>
        <p className="mt-1 text-sm text-neutral-100">
          <span className="tabular-nums text-neutral-400">
            {idx + 1}/{tracks.length}
          </span>{" "}
          · {current.fileName}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setAndScroll(idx - 1)}
            className="rounded border border-neutral-600 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous cue
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setAndScroll(idx + 1)}
            className="rounded border border-amber-900/55 bg-amber-950/30 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-950/55 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next cue
          </button>
        </div>
        <audio
          key={current.id}
          controls
          className="mt-3 w-full max-w-lg"
          preload="metadata"
          onEnded={() => {
            setIdx((i) => {
              const n = Math.min(tracks.length - 1, i + 1);
              if (n !== i) {
                queueMicrotask(() =>
                  wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
                );
              }
              return n;
            });
          }}
        >
          <source src={`/api/show-media/${current.id}`} type={current.contentType || "audio/mpeg"} />
          Your browser can&apos;t play this audio inline —{" "}
          <a href={`/api/show-media/${current.id}`} target="_blank" rel="noopener noreferrer" className="text-amber-500">
            open stream in a new tab
          </a>
          .
        </audio>
        <ShowMediaWaveformStrip
          mediaItemId={current.id}
          contentType={current.contentType || "audio/mpeg"}
          sizeBytes={current.sizeBytes}
          variant="portal"
        />
        <p className="mt-2 text-[10px] text-neutral-600">
          When a track ends, playback moves to the next cue in rundown order — pick any row below to jump.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Full rundown</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-neutral-300">
          {tracks.map((t, i) => (
            <li key={t.id}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <button
                  type="button"
                  onClick={() => setAndScroll(i)}
                  className={
                    i === idx
                      ? "text-left font-medium text-amber-400 underline-offset-2 hover:underline"
                      : "text-left text-neutral-400 hover:text-neutral-200 hover:underline"
                  }
                >
                  {t.fileName}
                </button>
                {showReorder && reorderAction ? (
                  <span className="inline-flex gap-1">
                    <form action={reorderAction} className="inline">
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="itemId" value={t.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-900"
                        title="Move up in rundown"
                      >
                        ↑
                      </button>
                    </form>
                    <form action={reorderAction} className="inline">
                      <input type="hidden" name="projectId" value={projectId} />
                      <input type="hidden" name="itemId" value={t.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        className="rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400 hover:bg-neutral-900"
                        title="Move down in rundown"
                      >
                        ↓
                      </button>
                    </form>
                  </span>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
