import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Skeleton } from "@/components/ui";

export default function PortalProjectLoading() {
  return (
    <AppShell id="portal-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <Skeleton className="mb-6 h-[3.25rem] w-full max-w-2xl rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-40 rounded-md" />
        <Skeleton className="h-9 w-[min(17rem,100%)] rounded-lg" />
      </div>

      <div className="mt-10 flex flex-col gap-8 lg:flex-row lg:justify-center lg:gap-10 xl:gap-14">
        <div className="hidden shrink-0 lg:block lg:w-[13.5rem]">
          <aside className="sticky top-6">
            <ProducerGlassCard as="div" padding="compact">
              <Skeleton className="h-[13rem] w-full rounded-xl" />
            </ProducerGlassCard>
          </aside>
        </div>
        <div className="min-w-0 flex-1 space-y-6 lg:max-w-lg">
          <Skeleton className="h-11 w-full rounded-2xl lg:hidden" />
          {[1, 2, 3].map((k) => (
            <ProducerGlassCard key={k} as="div">
              <Skeleton className="h-4 w-36 rounded-md" />
              <Skeleton className="mt-3 h-28 w-full rounded-xl" />
            </ProducerGlassCard>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
