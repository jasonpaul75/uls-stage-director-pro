import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

export default function ProducerSupportTicketLoading() {
  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <Skeleton className="mb-6 h-4 w-36 rounded-md" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-20 rounded-md" />
        <Skeleton className="h-9 w-full max-w-2xl rounded-lg" />
        <Skeleton className="h-5 w-full max-w-xl rounded-lg" />
      </div>

      <div className="mt-8 space-y-6">
        <ProducerGlassCard as="div">
          <Skeleton className="h-3 w-40 rounded-md" />
          <Skeleton className="mt-3 h-24 w-full rounded-xl" />
        </ProducerGlassCard>
        <ProducerGlassCard as="div">
          <Skeleton className="h-28 w-full rounded-xl" />
        </ProducerGlassCard>
      </div>
    </AppShell>
  );
}
