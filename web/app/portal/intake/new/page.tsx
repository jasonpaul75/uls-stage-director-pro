import Link from "next/link";

import { submitIntakeRequest } from "../actions";

import { ProducerGlassCard } from "@/components/producer/producer-glass-card";
import { AppShell, Button, buttonClassName } from "@/components/ui";
import { portalInputClass } from "@/lib/portal-form-classes";

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function IntakeNewPage(props: Props) {
  const sp = (await props.searchParams) ?? {};
  const error = sp.error === "missing_name" ? "Give this production a short name so ULS can find it in the queue." : null;

  return (
    <AppShell id="portal-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">New request</p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">Production intake</h1>
          <p className="max-w-prose text-sm leading-relaxed text-uls-muted">
            Tell ULS about your show. Submitting adds you to the queue; a producer will follow up on scope and contract. Once
            booking is secured, the portal carries operational work — run of show, published cue playlists when ULS enables them,
            <span className="text-uls-subtle"> Production files </span>
            for reference audio/video handoffs, billing mirrors as published, and delivery links nearer show day.
          </p>
        </header>
        <Link href="/portal" className={buttonClassName("ghost", "sm", "shrink-0")}>
          ← Dashboard
        </Link>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-6 rounded-2xl border border-rose-500/35 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-50 backdrop-blur-sm"
        >
          {error}
        </div>
      ) : null}

      <ProducerGlassCard>
        <form action={submitIntakeRequest} className="flex flex-col gap-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-uls-muted">
              Production name <span className="text-red-400">*</span>
            </span>
            <input name="name" required placeholder="e.g. Miss Ohio USA 2027" className={portalInputClass} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uls-muted">Venue</span>
              <input name="venue" placeholder="Venue name" className={portalInputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uls-muted">City / State</span>
              <input name="cityState" placeholder="Columbus, OH" className={portalInputClass} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uls-muted">Preferred start</span>
              <input name="requestedEventStart" type="date" className={portalInputClass} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-uls-muted">End date (if multi-day)</span>
              <input name="requestedEventEnd" type="date" className={portalInputClass} />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-uls-muted">Segments / categories</span>
            <textarea
              name="categoryNotes"
              rows={3}
              placeholder="Opening, swimsuit, interview, evening gown, talent, awards…"
              className={portalInputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-uls-muted">Approximate contestant count</span>
            <input name="contestantApprox" type="number" min={0} placeholder="40" className={portalInputClass} />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-uls-muted">Livestream needs</span>
            <textarea
              name="livestreamNotes"
              rows={2}
              placeholder="Platforms, multi-cam, rehearsal stream, etc."
              className={portalInputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-uls-muted">Budget guidance</span>
            <textarea
              name="budgetNotes"
              rows={2}
              placeholder="Rough range or priorities (lighting, audio, stream, photos…)"
              className={portalInputClass}
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-uls-muted">Anything else</span>
            <textarea
              name="additionalNotes"
              rows={3}
              placeholder="Dressing rooms, ADA, rehearsal window, VIP shots…"
              className={portalInputClass}
            />
          </label>

          <Button type="submit" variant="primary" size="md" className="mt-2 w-fit">
            Submit to ULS
          </Button>
        </form>
      </ProducerGlassCard>
    </AppShell>
  );
}
