import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Button } from "@/components/ui";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GlobalRole, StaffAvailabilityStatus } from "@prisma/client";

import { upsertStaffAvailability } from "../actions";

type Props = { searchParams?: Promise<Record<string, string | undefined>> };

const inputClass = "rounded-md border border-white/[0.12] bg-black/35 px-2 py-2 text-sm text-uls-text";

function labelStatus(s: StaffAvailabilityStatus): string {
  return s === StaffAvailabilityStatus.AVAILABLE ? "Available" : "Unavailable";
}

export default async function StaffAvailabilityPage(props: Props) {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.globalRole;
  if (!userId || role !== GlobalRole.STAFF) return null;

  const sp = (await props.searchParams) ?? {};

  const today = new Date();
  const horizonStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  horizonStart.setUTCDate(horizonStart.getUTCDate() - 14);

  const days = await prisma.staffAvailabilityDay.findMany({
    where: { userId, date: { gte: horizonStart } },
    orderBy: { date: "asc" },
  });

  const err = sp.avail_err === "bad" ? "Pick a valid calendar date and status." : null;

  return (
    <AppShell id="staff-main-content" outerMaxWidth="standard" contentMaxWidth="full" className="pt-10">
      <header className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Planning</p>
        <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">Availability</h1>
        <p className="text-sm text-uls-muted">
          Mark holds around scheduled productions so production can see conflicts. This does not replace a confirmed call — it is a
          lightweight signal only.
        </p>
      </header>

      {sp.avail_saved === "1" ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-emerald-500/25 bg-emerald-950/25">
          <p role="status" className="text-sm text-emerald-100">
            Availability saved.
          </p>
        </ProducerGlassCard>
      ) : null}
      {err ? (
        <ProducerGlassCard padding="compact" className="mt-6 border-rose-500/25 bg-rose-950/25">
          <p role="alert" className="text-sm text-rose-100">
            {err}
          </p>
        </ProducerGlassCard>
      ) : null}

      <ProducerGlassCard className="mt-8 space-y-4">
        <p className="text-sm font-semibold text-uls-text">Add or update a day</p>
        <form action={upsertStaffAvailability} className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs text-uls-muted">
            <span>Date</span>
            <input type="date" name="date" required className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-uls-muted">
            <span>Status</span>
            <select name="status" required className={inputClass}>
              <option value="AVAILABLE">{labelStatus(StaffAvailabilityStatus.AVAILABLE)}</option>
              <option value="UNAVAILABLE">{labelStatus(StaffAvailabilityStatus.UNAVAILABLE)}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-uls-muted">
            <span>Note (optional)</span>
            <input name="note" maxLength={500} placeholder="Hold for travel day…" className={inputClass} />
          </label>
          <div className="sm:col-span-3">
            <Button type="submit" variant="primary" size="sm">
              Save day
            </Button>
          </div>
        </form>
      </ProducerGlassCard>

      <ProducerGlassCard className="mt-8 space-y-3">
        <p className="text-sm font-semibold text-uls-text">Recent entries</p>
        {days.length === 0 ? (
          <p className="text-sm text-uls-muted">No availability logged in this window yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-uls-muted">
            {days.map((d) => (
              <li key={d.id} className="flex flex-wrap justify-between gap-2 rounded-lg border border-white/[0.06] bg-black/15 px-3 py-2">
                <span className="tabular-nums text-uls-subtle">{d.date.toISOString().slice(0, 10)}</span>
                <span className="font-medium text-uls-text">{labelStatus(d.status)}</span>
                {d.note?.trim() ? <span className="w-full text-xs">{d.note.trim()}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </ProducerGlassCard>
    </AppShell>
  );
}
