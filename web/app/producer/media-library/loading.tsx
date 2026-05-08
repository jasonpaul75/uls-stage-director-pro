import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

export default function ProducerMediaLibraryLoading() {
  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-32 rounded-md" />
          <Skeleton className="h-9 w-[min(14rem,100%)] rounded-lg" />
          <Skeleton className="h-14 max-w-prose rounded-lg" />
        </div>
        <Skeleton className="h-9 w-36 shrink-0 rounded-md" />
      </div>

      <ProducerGlassCard className="mt-10" as="div">
        <Skeleton className="h-5 w-36 rounded-md" />
        <Skeleton className="mt-2 h-10 w-full max-w-xl rounded-lg" />
        <Skeleton className="mt-4 h-28 w-full rounded-xl" />
      </ProducerGlassCard>

      <ul className="mt-10 list-none space-y-3 pl-0">
        {[1, 2, 3, 4, 5].map((k) => (
          <li key={k} className="list-none">
            <ProducerGlassCard as="div" padding="compact">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-5 w-[min(12rem,100%)] rounded-md" />
                  <Skeleton className="h-3 w-full max-w-sm rounded-md" />
                </div>
                <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
              </div>
            </ProducerGlassCard>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
