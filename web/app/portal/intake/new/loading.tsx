import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

export default function PortalIntakeNewLoading() {
  return (
    <AppShell id="portal-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-28 rounded-md" />
          <Skeleton className="h-9 w-[min(16rem,100%)] rounded-lg" />
          <Skeleton className="h-14 max-w-xl rounded-lg" />
        </div>
        <Skeleton className="h-9 w-32 shrink-0 rounded-md" />
      </div>
      <ProducerGlassCard as="div">
        <Skeleton className="h-5 w-40 rounded-md" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
        <Skeleton className="mt-4 h-9 w-36 rounded-md" />
      </ProducerGlassCard>
    </AppShell>
  );
}
