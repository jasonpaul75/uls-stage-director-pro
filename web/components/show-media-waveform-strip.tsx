"use client";

import { useEffect, useRef, useState } from "react";

import { peaksFromAudioBuffer } from "@/lib/show-media-waveform-peaks";

const MAX_WAVEFORM_DECODE_BYTES = 35 * 1024 * 1024;

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
  return "mt-2 h-10 w-full max-w-lg rounded border border-neutral-800/80 bg-neutral-950";
}

/** Decodes same-origin proxied audio from `/api/show-media/[id]?proxy=1` and draws a light-weight peak strip. */
export function ShowMediaWaveformStrip(props: Props) {
  const { mediaItemId, contentType, sizeBytes, variant = "portal" } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "skipped" | "error">("loading");

  const isAudio = contentType.trim().toLowerCase().startsWith("audio/");

  useEffect(() => {
    if (!isAudio) {
      setState("skipped");
      return;
    }
    if (typeof sizeBytes === "number" && sizeBytes > MAX_WAVEFORM_DECODE_BYTES) {
      setState("skipped");
      return;
    }

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
          ctx.fillStyle = isProd ? "rgba(24, 24, 27, 0.92)" : "rgba(39, 39, 42, 0.9)";
          ctx.fillRect(0, 0, widthCss, heightCss);
          const barW = widthCss / peaks.length;
          ctx.fillStyle = isProd ? "rgba(212, 212, 216, 0.88)" : "rgba(161, 161, 170, 0.85)";
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
  }, [mediaItemId, contentType, sizeBytes, isAudio, variant]);

  if (!isAudio) return null;

  if (state === "skipped") {
    const cls =
      variant === "producer"
        ? "mt-1 text-[10px] text-zinc-600"
        : "mt-1 text-[10px] text-neutral-600";
    return (
      <p className={cls}>
        Waveform not shown{" "}
        {typeof sizeBytes === "number" && sizeBytes > MAX_WAVEFORM_DECODE_BYTES
          ? `(file larger than ~${Math.round(MAX_WAVEFORM_DECODE_BYTES / (1024 * 1024))} MB decode cap).`
          : null}
      </p>
    );
  }

  if (state === "error") {
    const cls = variant === "producer" ? "mt-1 text-[10px] text-zinc-500" : "mt-1 text-[10px] text-neutral-500";
    return <p className={cls}>Waveform unavailable — open the stream preview if playback works.</p>;
  }

  return (
    <canvas
      ref={canvasRef}
      className={canvasClass(variant)}
      height={40}
      style={{ opacity: state === "ready" ? 1 : 0.35 }}
      aria-hidden
    />
  );
}
