import Link from "next/link";

import { confirmBookingSecured } from "@/app/producer/inbox/booking-actions";
import {
  directorPortalAccessDeadlineUtc,
  isDirectorPortalAccessRevoked,
} from "@/lib/director-portal-access-window";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";

export function ProducerIntakeBookingSection(props: {
  project: Pick<ProducerIntakeDetailProject, "id" | "bookingSecuredAt">;
}) {
  const { project } = props;
  return (
    <section id="booking" className="scroll-mt-6 mt-8 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
      <h2 className="text-sm font-medium text-zinc-200">Booking &amp; show workspace</h2>
      <p className="mt-1 text-xs text-zinc-500">
        After contract and initial payment are in hand, confirm so directors get the separate show workspace for run of
        show, show-day flags, and post-event delivery.
      </p>
      {project.bookingSecuredAt ? (
        <p className="mt-3 text-sm text-zinc-300">
          Secured{" "}
          <span className="text-zinc-100">{project.bookingSecuredAt.toLocaleString()}</span>. Director link:{" "}
          <Link href={`/portal/shows/${project.id}`} className="text-amber-500 hover:text-amber-400">
            /portal/shows/{project.id}
          </Link>
        </p>
      ) : (
        <form action={confirmBookingSecured} className="mt-4">
          <input type="hidden" name="projectId" value={project.id} />
          <button
            type="submit"
            className="rounded-lg border border-amber-700 bg-amber-600/90 px-3 py-2 text-sm font-medium text-black hover:bg-amber-500"
          >
            Confirm booking secured
          </button>
        </form>
      )}
    </section>
  );
}

export function ProducerIntakeSummarySection(props: {
  project: ProducerIntakeDetailProject;
  directorsCsv: string;
}) {
  const { project, directorsCsv } = props;
  return (
    <section
      id="intake-summary"
      className="scroll-mt-6 mt-8 space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-sm text-zinc-300"
    >
      <p>
        <span className="text-zinc-500">Directors:</span> {directorsCsv || "—"}
      </p>
      <p>
        <span className="text-zinc-500">Venue:</span> {project.venue ?? "—"}
        {project.cityState ? ` · ${project.cityState}` : ""}
      </p>
      <p>
        <span className="text-zinc-500">Dates:</span>{" "}
        {project.requestedEventStart?.toISOString().slice(0, 10) ?? "—"} →{" "}
        {project.requestedEventEnd?.toISOString().slice(0, 10) ?? "—"}
      </p>
      <p>
        <span className="text-zinc-500">Contestants (approx):</span> {project.contestantApprox ?? "—"}
      </p>
      {project.eventConclusionAt ? (
        <p>
          <span className="text-zinc-500">Director portal access:</span>{" "}
          {isDirectorPortalAccessRevoked(project.eventConclusionAt) ? (
            <span className="text-rose-400/95">
              Closed — last day was{" "}
              {directorPortalAccessDeadlineUtc(project.eventConclusionAt).toLocaleDateString("en-US", {
                timeZone: "UTC",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}{" "}
              (UTC end of 90-day window).
            </span>
          ) : (
            <span className="text-zinc-300">
              Open through{" "}
              <span className="font-medium text-emerald-400/95">
                {directorPortalAccessDeadlineUtc(project.eventConclusionAt).toLocaleDateString("en-US", {
                  timeZone: "UTC",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>{" "}
              (UTC, 90 days after event conclusion).
            </span>
          )}
        </p>
      ) : (
        <p className="text-zinc-400">
          <span className="text-zinc-500">Director portal access:</span> No event conclusion date yet — set it under
          Internal when the show is closed out; the 90-day director window starts from that date.
        </p>
      )}
      <p>
        <span className="text-zinc-500">Categories:</span>
      </p>
      <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 font-sans text-zinc-400">
        {project.categoryNotes ?? "—"}
      </pre>
      <p>
        <span className="text-zinc-500">Livestream:</span>
      </p>
      <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 font-sans text-zinc-400">
        {project.livestreamNotes ?? "—"}
      </pre>
      <p>
        <span className="text-zinc-500">Budget:</span>
      </p>
      <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 font-sans text-zinc-400">
        {project.budgetNotes ?? "—"}
      </pre>
      <p>
        <span className="text-zinc-500">Director notes:</span>
      </p>
      <pre className="whitespace-pre-wrap rounded bg-black/40 p-2 font-sans text-zinc-400">
        {project.additionalNotes ?? "—"}
      </pre>
    </section>
  );
}
