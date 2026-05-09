"use client";

import { useEffect, useRef, useState } from "react";

import { peaksFromAudioBuffer, SHOW_MEDIA_WAVEFORM_DECODE_MAX_BYTES } from "@/lib/show-media-waveform-peaks";

const MAX_WAVEFORM_DECODE_BYTES = SHOW_MEDIA_WAVEFORM_DECODE_MAX_BYTES;

type Props = {
  mediaItemId: string;
  contentType: string;
  /** When set and very large, skip client decode to avoid freezing the browser. */
  sizeBytes?: number | null;
  /** Tailwind-friendly surface for the canvas (producer vs portal palette). */
  variant?: "producer" | "portal";
};

function canvasClass(variant: Props["variant"]) {
  if (variant === "producer") {
    return "mt-2 h-10 w-full max-w-lg rounded border border-zinc-800/80 bg-zinc-950";
  }
  return "mt-2 h-10 w-full max-w-lg rounded border border-white/[0.08] bg-black/35";
}

function WaveformOversizedNote({ variant }: { variant: NonNullable<Props["variant"]> }) {
  const cls =
    variant === "producer"
      ? "mt-1 text-[10px] text-zinc-600"
      : "mt-1 text-[10px] text-uls-subtle";
  return (
    <p className={cls}>
      Waveform not shown (file larger than ~{Math.round(MAX_WAVEFORM_DECODE_BYTES / (1024 * 1024))} MB decode cap).
    </p>
  );
}

/** Audio-only: fetches, decodes, draws peaks. Parent guarantees non-oversized audio. */
function WaveformDecodeStrip({ mediaItemId, variant }: { mediaItemId: string; variant: NonNullable<Props["variant"]> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    const ac = new AudioContext();

    void (async () => {
      try {
        const res = await fetch(`/api/show-media/${mediaItemId}?proxy=1`, {
          credentials: "include",
        });
        if (!res.ok || cancelled) {
          if (!cancelled) setState("error");
          return;
        }
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const audio = await ac.decodeAudioData(buf.slice(0));
        if (cancelled) return;
        const peaks = peaksFromAudioBuffer(audio, 160);

        const draw = () => {
          const canvas = canvasRef.current;
          if (!canvas || peaks.length === 0) {
            setState("error");
            return;
          }
          const widthCss = canvas.offsetWidth || 320;
          const heightCss = 40;
          const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
          canvas.width = Math.max(1, Math.floor(widthCss * dpr));
          canvas.height = Math.floor(heightCss * dpr);
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setState("error");
            return;
          }
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          const isProd = variant === "producer";
          ctx.fillStyle = isProd ? "rgba(24, 24, 27, 0.92)" : "rgba(0, 0, 0, 0.45)";
          ctx.fillRect(0, 0, widthCss, heightCss);
          const barW = widthCss / peaks.length;
          ctx.fillStyle = isProd
            ? "rgba(212, 212, 216, 0.88)"
            : "rgba(251, 191, 36, 0.42)";
          for (let i = 0; i < peaks.length; i++) {
            const barH = Math.max(1, peaks[i]! * heightCss * 0.92);
            ctx.fillRect(i * barW, heightCss - barH, Math.max(1, barW - 0.5), barH);
          }
          setState("ready");
        };

        queueMicrotask(draw);
      } catch {
        if (!cancelled) setState("error");
      } finally {
        await ac.close().catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
      void ac.close().catch(() => undefined);
    };
  }, [mediaItemId, variant]);

  if (state === "error") {
    const cls = variant === "producer" ? "mt-1 text-[10px] text-zinc-500" : "mt-1 text-[10px] text-uls-subtle";
    return <p className={cls}>Waveform unavailable — open the stream preview if playback works.</p>;
  }

  const loadingCls =
    variant === "producer" ? "mt-1 text-[10px] text-zinc-500" : "mt-1 text-[10px] text-uls-subtle";

  return (
    <div>
      <canvas
        ref={canvasRef}
        className={canvasClass(variant)}
        height={40}
        style={{ opacity: state === "ready" ? 1 : 0.35 }}
        aria-hidden
      />
      {state === "loading" ? (
        <p className={loadingCls}>
          Generating waveform preview…{" "}
          <span className={variant === "producer" ? "text-zinc-600" : "text-uls-subtle"}>
            (large files may take a few seconds)
          </span>
        </p>
      ) : null}
    </div>
  );
}

/** Decodes same-origin proxied audio from `/api/show-media/[id]?proxy=1` and draws a light-weight peak strip. */
export function ShowMediaWaveformStrip(props: Props) {
  const { mediaItemId, contentType, sizeBytes, variant = "portal" } = props;
  const ct = typeof contentType === "string" ? contentType : "";
  const isAudio = ct.trim().toLowerCase().startsWith("audio/");

  if (!isAudio) {
    return null;
  }

  const oversized = typeof sizeBytes === "number" && sizeBytes > MAX_WAVEFORM_DECODE_BYTES;
  if (oversized) {
    return <WaveformOversizedNote variant={variant} />;
  }

  return <WaveformDecodeStrip mediaItemId={mediaItemId} variant={variant} />;
}
