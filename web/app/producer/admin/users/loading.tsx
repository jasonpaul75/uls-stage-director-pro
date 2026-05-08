import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

export default function ProducerAdminUsersLoading() {
  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-20 rounded-md" />
          <Skeleton className="h-9 w-[min(18rem,100%)] rounded-lg" />
          <Skeleton className="h-14 max-w-prose rounded-lg" />
        </div>
        <Skeleton className="h-9 w-44 shrink-0 rounded-md" />
      </div>

      <ProducerGlassCard className="mt-10 max-w-xl" as="div">
        <Skeleton className="h-5 w-48 rounded-md" />
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <Skeleton className="mt-4 h-9 w-36 rounded-md" />
      </ProducerGlassCard>

      <div className="mt-10">
        <Skeleton className="h-5 w-40 rounded-md" />
        <ul className="mt-4 list-none space-y-3 pl-0">
          {[1, 2, 3].map((k) => (
            <li key={k} className="list-none">
              <ProducerGlassCard as="div" padding="compact">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-full max-w-xs rounded-md" />
                    <Skeleton className="h-3 w-48 rounded-md" />
                  </div>
                  <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
                </div>
              </ProducerGlassCard>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
