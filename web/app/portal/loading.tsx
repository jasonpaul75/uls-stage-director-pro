import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

/** Matches `/portal` dashboard — KPI row + productions list; deeper routes use segment `loading.tsx` files. */
export default function PortalDashboardLoading() {
  return (
    <AppShell id="portal-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="space-y-8">
        <header className="space-y-2">
          <Skeleton className="h-3 w-36 rounded-md" />
          <Skeleton className="h-9 w-[min(18rem,100%)] rounded-lg" />
          <Skeleton className="h-4 w-full max-w-md rounded-lg" />
        </header>

        <Skeleton className="h-[3.75rem] w-full max-w-2xl rounded-2xl" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,260px)_1fr] sm:items-stretch md:gap-4">
          <ProducerGlassCard padding="compact" as="div" className="relative overflow-hidden">
            <Skeleton className="h-3 w-28 rounded-md" />
            <Skeleton className="mt-2 h-8 w-14 rounded-md" />
            <Skeleton className="mt-4 h-10 w-full rounded-md" />
          </ProducerGlassCard>
          <ProducerGlassCard padding="compact" as="div" className="flex min-h-[5.5rem] items-center justify-center">
            <Skeleton className="h-11 w-full max-w-xs rounded-uls-md sm:w-56" />
          </ProducerGlassCard>
        </div>

        <ProducerGlassCard as="div">
          <Skeleton className="h-5 w-48 rounded-md" />
          <Skeleton className="mt-2 h-10 w-full max-w-xl rounded-lg" />
          <ul className="mt-5 space-y-3">
            {[1, 2, 3].map((k) => (
              <li key={k}>
                <Skeleton className="h-24 w-full rounded-xl" />
              </li>
            ))}
          </ul>
        </ProducerGlassCard>
      </div>
    </AppShell>
  );
}
