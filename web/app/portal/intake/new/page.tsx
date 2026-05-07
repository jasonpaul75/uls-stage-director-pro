import Link from "next/link";

import { submitIntakeRequest } from "../actions";

type Props = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function IntakeNewPage(props: Props) {
  const sp = (await props.searchParams) ?? {};
  const error = sp.error === "missing_name" ? "Give this production a short name so ULS can find it in the queue." : null;

  return (
    <main id="portal-main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
      <p className="mt-6 text-sm uppercase tracking-widest text-amber-500">New request</p>
      <h1 className="mt-2 text-2xl font-semibold">Production intake</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Tell ULS about your show. Submitting adds you to the queue; a producer will follow up on scope and contract.
      </p>

      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      <form action={submitIntakeRequest} className="mt-8 flex flex-col gap-5">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-300">
            Production name <span className="text-red-400">*</span>
          </span>
          <input
            name="name"
            required
            placeholder="e.g. Miss Ohio USA 2027"
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none ring-amber-500/30 focus:border-amber-700 focus:ring-2"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-300">Venue</span>
            <input
              name="venue"
              placeholder="Venue name"
              className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-500/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-300">City / State</span>
            <input
              name="cityState"
              placeholder="Columbus, OH"
              className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-500/30"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-300">Preferred start</span>
            <input
              name="requestedEventStart"
              type="date"
              className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-500/30"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-neutral-300">End date (if multi-day)</span>
            <input
              name="requestedEventEnd"
              type="date"
              className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-500/30"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-300">Segments / categories</span>
          <textarea
            name="categoryNotes"
            rows={3}
            placeholder="Opening, swimsuit, interview, evening gown, talent, awards…"
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-500/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-300">Approximate contestant count</span>
          <input
            name="contestantApprox"
            type="number"
            min={0}
            placeholder="40"
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-500/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-300">Livestream needs</span>
          <textarea
            name="livestreamNotes"
            rows={2}
            placeholder="Platforms, multi-cam, rehearsal stream, etc."
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-500/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-300">Budget guidance</span>
          <textarea
            name="budgetNotes"
            rows={2}
            placeholder="Rough range or priorities (lighting, audio, stream, photos…)"
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-500/30"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-300">Anything else</span>
          <textarea
            name="additionalNotes"
            rows={3}
            placeholder="Dressing rooms, ADA, rehearsal window, VIP shots…"
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100 outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-500/30"
          />
        </label>

        <button
          type="submit"
          className="mt-2 rounded bg-amber-600 px-4 py-2.5 text-sm font-medium text-black hover:bg-amber-500"
        >
          Submit to ULS
        </button>
      </form>
      </div>
    </main>
  );
}
