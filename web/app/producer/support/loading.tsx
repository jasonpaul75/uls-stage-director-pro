import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

export default function ProducerSupportQueueLoading() {
  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32 rounded-md" />
        <Skeleton className="h-9 w-[min(16rem,100%)] rounded-lg" />
        <Skeleton className="h-12 max-w-prose rounded-lg" />
      </div>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ProducerGlassCard padding="compact" as="div">
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="mt-2 h-8 w-10 rounded-md" />
        </ProducerGlassCard>
        <ProducerGlassCard padding="compact" as="div">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="mt-2 h-8 w-14 rounded-md" />
        </ProducerGlassCard>
      </div>

      <ul className="mt-10 list-none space-y-3 pl-0">
        {[1, 2, 3, 4].map((k) => (
          <li key={k} className="list-none">
            <ProducerGlassCard as="div" padding="compact">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-[min(14rem,100%)] rounded-md" />
                  <Skeleton className="h-4 w-full max-w-md rounded-md" />
                </div>
                <Skeleton className="h-4 w-16 shrink-0 rounded-md" />
              </div>
            </ProducerGlassCard>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
