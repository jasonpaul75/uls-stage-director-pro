import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

/** Matches `/producer` command center grid — distinct from generic deep-route fallbacks. */
export default function ProducerCommandCenterLoading() {
  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_min(20rem,100%)] xl:gap-10">
        <div className="min-w-0 space-y-8">
          <header className="space-y-2">
            <Skeleton className="h-3 w-28 rounded-md" />
            <Skeleton className="h-9 w-[min(14rem,100%)] rounded-lg" />
            <Skeleton className="h-14 max-w-prose rounded-lg" />
          </header>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((k) => (
              <ProducerGlassCard key={k} padding="compact" as="div" className="relative overflow-hidden">
                <Skeleton className="h-3 w-20 rounded-md" />
                <Skeleton className="mt-2 h-8 w-12 rounded-md" />
              </ProducerGlassCard>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {[1, 2].map((k) => (
              <ProducerGlassCard key={k} as="div">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-5 w-40 rounded-md" />
                    <Skeleton className="h-10 w-full max-w-xs rounded-lg" />
                  </div>
                  <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
                </div>
              </ProducerGlassCard>
            ))}
          </div>

          <ProducerGlassCard as="div" className="space-y-5">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-8 w-full max-w-md rounded-lg" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[1, 2, 3].map((k) => (
                <div key={k} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
                  <Skeleton className="h-3 w-24 rounded-md" />
                  <Skeleton className="mt-2 h-7 w-14 rounded-md" />
                </div>
              ))}
            </div>
            <Skeleton className="h-10 w-full max-w-lg rounded-lg" />
          </ProducerGlassCard>
        </div>

        <aside className="xl:sticky xl:top-24 xl:self-start xl:pb-12">
          <ProducerGlassCard className="space-y-5" as="div">
            <div>
              <Skeleton className="h-3 w-28 rounded-md" />
              <div className="mt-4 flex flex-col gap-2">
                {[1, 2, 3, 4].map((k) => (
                  <Skeleton key={k} className="h-11 w-full rounded-xl" />
                ))}
              </div>
            </div>
            <div className="border-t border-white/[0.06] pt-5">
              <Skeleton className="h-3 w-48 rounded-md" />
              <ul className="mt-4 space-y-2">
                {[1, 2, 3, 4].map((k) => (
                  <li key={k}>
                    <Skeleton className="h-14 w-full rounded-xl" />
                  </li>
                ))}
              </ul>
            </div>
          </ProducerGlassCard>
        </aside>
      </div>
    </AppShell>
  );
}
