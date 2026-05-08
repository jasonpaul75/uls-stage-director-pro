import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

/** Event workspace mirrors intake layout (TOC + stacked sections). */
export default function ProducerEventWorkspaceLoading() {
  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className="h-9 w-[min(20rem,100%)] rounded-lg" />
          <Skeleton className="h-12 w-full max-w-xl rounded-lg" />
        </div>
        <Skeleton className="h-9 w-52 shrink-0 rounded-md" />
      </div>

      <Skeleton className="mt-6 h-16 w-full max-w-2xl rounded-xl" />

      <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:justify-center lg:gap-10 xl:gap-14">
        <div className="hidden shrink-0 lg:block lg:w-[13.5rem]">
          <aside className="sticky top-6">
            <ProducerGlassCard as="div" padding="compact">
              <Skeleton className="h-[14rem] w-full rounded-xl" />
            </ProducerGlassCard>
          </aside>
        </div>
        <div className="min-w-0 flex-1 lg:max-w-3xl">
          <Skeleton className="mb-6 h-11 w-full rounded-2xl lg:hidden" />
          {[1, 2, 3, 4].map((k) => (
            <ProducerGlassCard key={k} as="div" className={k > 1 ? "mt-10" : "mt-0"}>
              <Skeleton className="h-5 w-40 rounded-md" />
              <Skeleton className="mt-4 h-32 w-full rounded-xl" />
            </ProducerGlassCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
