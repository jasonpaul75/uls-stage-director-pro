import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

export default function ProducerIntakeDetailLoading() {
  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-3 w-28 rounded-md" />
          <Skeleton className="h-9 w-[min(20rem,100%)] rounded-lg" />
        </div>
        <Skeleton className="h-9 w-28 shrink-0 rounded-md" />
      </div>

      <Skeleton className="mt-6 h-[4.5rem] w-full max-w-xl rounded-xl" />

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
          {[1, 2, 3, 4, 5].map((k) => (
            <ProducerGlassCard key={k} as="div" className={k > 1 ? "mt-10" : "mt-0"}>
              <Skeleton className="h-5 w-48 rounded-md" />
              <Skeleton className="mt-4 h-28 w-full rounded-xl" />
            </ProducerGlassCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
