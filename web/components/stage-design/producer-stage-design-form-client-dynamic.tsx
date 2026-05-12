"use client";

import dynamic from "next/dynamic";

import type { ProducerStageDesignFormProps } from "@/components/stage-design/producer-stage-design-form";

/** Shown until the diagram editor bundle loads (client-only chunk). */
function StageDiagramEditorSkeleton() {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-black/20 p-5 shadow-inner animate-pulse"
      aria-busy
      aria-label="Loading diagram editor"
    >
      <div className="h-4 w-52 rounded-md bg-white/10" />
      <div className="mt-2 h-3 w-full max-w-md rounded bg-white/[0.07]" />
      <div className="mt-5 h-9 w-full max-w-md rounded-lg bg-white/[0.08]" />
      <div className="mt-4 h-[min(28rem,calc(100vh-20rem))] w-full rounded-xl bg-white/[0.04]" />
    </div>
  );
}

const ProducerStageDesignFormLoaded = dynamic(
  () =>
    import("@/components/stage-design/producer-stage-design-form").then((m) => ({
      default: m.ProducerStageDesignForm,
    })),
  {
    /** Dense forms: skip SSR markup so extensions cannot desync hydrated inputs/buttons (`fdprocessedid`, etc.). */
    ssr: false,
    loading: StageDiagramEditorSkeleton,
  },
);

/**
 * Server pages cannot use `next/dynamic` with `ssr: false`; this thin client boundary hosts that import.
 */
export function ProducerStageDesignFormClientDynamic(props: ProducerStageDesignFormProps) {
  return <ProducerStageDesignFormLoaded {...props} />;
}
