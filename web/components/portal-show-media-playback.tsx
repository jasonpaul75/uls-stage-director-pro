"use client";

import { useCallback, useId, useRef, useState } from "react";

import { reorderShowMediaAsDirector } from "@/app/portal/show-media-reorder-actions";
import { ShowMediaWaveformStrip } from "@/components/show-media-waveform-strip";

const rundownFocus =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-uls-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

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
  const audioRegionId = useId();
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
      <div className="rounded-xl border border-white/[0.08] bg-black/30 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-uls-subtle">Now in rundown</p>
        <p className="mt-1 text-sm text-uls-text" id={`${audioRegionId}-label`}>
          <span className="tabular-nums text-uls-muted">
            {idx + 1}/{tracks.length}
          </span>{" "}
          · {current.fileName}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setAndScroll(idx - 1)}
            className={`inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg border border-white/[0.12] bg-white/[0.04] px-3 text-xs text-uls-text hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-40 ${rundownFocus}`}
            aria-label="Previous music cue in rundown"
          >
            Previous cue
          </button>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setAndScroll(idx + 1)}
            className={`inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg border border-amber-500/35 bg-amber-500/[0.12] px-3 text-xs text-amber-50 hover:bg-amber-500/[0.18] disabled:cursor-not-allowed disabled:opacity-40 ${rundownFocus}`}
            aria-label="Next music cue in rundown"
          >
            Next cue
          </button>
        </div>
        <div className="mt-3" role="group" aria-labelledby={`${audioRegionId}-label`}>
        <audio
          key={current.id}
          controls
          className="w-full max-w-lg"
          preload="metadata"
          aria-label={`Music cue ${idx + 1} of ${tracks.length}: ${current.fileName}`}
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
          <a
            href={`/api/show-media/${current.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-amber-400 underline decoration-amber-500/55 underline-offset-2 hover:text-amber-300 ${rundownFocus} rounded px-0.5`}
            aria-label={`Open audio stream for ${current.fileName} in a new tab`}
          >
            open stream in a new tab
          </a>
          .
        </audio>
        </div>
        <ShowMediaWaveformStrip
          mediaItemId={current.id}
          contentType={current.contentType || "audio/mpeg"}
          sizeBytes={current.sizeBytes}
          variant="portal"
        />
        <p className="mt-2 text-[10px] text-uls-subtle">
          When a track ends, playback moves to the next cue in rundown order — pick any row below to jump.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-uls-subtle">Full rundown</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-uls-muted">
          {tracks.map((t, i) => (
            <li key={t.id}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <button
                  type="button"
                  onClick={() => setAndScroll(i)}
                  className={`min-h-9 rounded text-left underline-offset-2 ${
                    i === idx
                      ? `font-medium text-uls-accent-strong hover:underline ${rundownFocus} px-1`
                      : `text-uls-muted hover:text-uls-text hover:underline ${rundownFocus} px-1`
                  }`}
                  aria-current={i === idx ? true : undefined}
                  aria-label={`Jump to cue ${i + 1}: ${t.fileName}`}
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
                        className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded border border-white/[0.12] px-2 text-[10px] text-uls-muted hover:bg-white/[0.06] ${rundownFocus}`}
                        title="Move cue up in rundown"
                        aria-label={`Move music cue up in rundown: ${t.fileName}`}
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
                        className={`inline-flex min-h-9 min-w-9 items-center justify-center rounded border border-white/[0.12] px-2 text-[10px] text-uls-muted hover:bg-white/[0.06] ${rundownFocus}`}
                        title="Move cue down in rundown"
                        aria-label={`Move music cue down in rundown: ${t.fileName}`}
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
