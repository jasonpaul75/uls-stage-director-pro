import Link from "next/link";

import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

import { confirmBookingSecured } from "@/app/producer/inbox/booking-actions";
import {
  directorPortalAccessDeadlineUtc,
  isDirectorPortalAccessRevoked,
} from "@/lib/director-portal-access-window";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { Button, buttonClassName } from "@/components/ui";

export function ProducerIntakeBookingSection(props: {
  project: Pick<ProducerIntakeDetailProject, "id" | "bookingSecuredAt">;
}) {
  const { project } = props;
  return (
    <ProducerIntakeSectionShell
      id="booking"
      sectionClassName="scroll-mt-6 mt-8 first:mt-0"
      title="Booking & show workspace"
      description={
        <p>
          After contract and initial payment are in hand, confirm so directors get the separate show workspace for run of show,
          show-day flags, and post-event delivery.
        </p>
      }
    >
      {project.bookingSecuredAt ? (
        <p role="status" className="text-sm text-uls-muted">
          Secured{" "}
          <span className="text-uls-text">{project.bookingSecuredAt.toLocaleString()}</span>. Director link:{" "}
          <Link href={`/portal/shows/${project.id}`} className={buttonClassName("link", "sm")}>
            /portal/shows/{project.id}
          </Link>
        </p>
      ) : (
        <form action={confirmBookingSecured}>
          <input type="hidden" name="projectId" value={project.id} />
          <Button type="submit" variant="primary" size="sm">
            Confirm booking secured
          </Button>
        </form>
      )}
    </ProducerIntakeSectionShell>
  );
}

export function ProducerIntakeSummarySection(props: {
  project: ProducerIntakeDetailProject;
  directorsCsv: string;
}) {
  const { project, directorsCsv } = props;
  return (
    <ProducerIntakeSectionShell
      id="intake-summary"
      title="Intake summary"
      description={<p>Facts mirrored from submission — retention and access rules apply from Internal.</p>}
    >
      <div className="space-y-2 text-sm text-uls-muted">
        <p>
          <span className="text-uls-subtle">Directors:</span> {directorsCsv || "—"}
        </p>
        <p>
          <span className="text-uls-subtle">Venue:</span> {project.venue ?? "—"}
          {project.cityState ? ` · ${project.cityState}` : ""}
        </p>
        <p>
          <span className="text-uls-subtle">Dates:</span>{" "}
          {project.requestedEventStart?.toISOString().slice(0, 10) ?? "—"} →{" "}
          {project.requestedEventEnd?.toISOString().slice(0, 10) ?? "—"}
        </p>
        <p>
          <span className="text-uls-subtle">Contestants (approx):</span> {project.contestantApprox ?? "—"}
        </p>
        {project.eventConclusionAt ? (
          <p role="status">
            <span className="text-uls-subtle">Director portal access:</span>{" "}
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
              <span className="text-uls-text">
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
          <p role="status" className="text-uls-muted">
            <span className="text-uls-subtle">Director portal access:</span> No event conclusion date yet — set it under
            Internal when the show is closed out; the 90-day director window starts from that date.
          </p>
        )}
        <div className="space-y-4 border-t border-uls-border pt-4">
          <div>
            <p className="text-uls-subtle">Categories</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-uls-surface-inset/90 p-2 font-sans text-xs text-uls-muted">
              {project.categoryNotes ?? "—"}
            </pre>
          </div>
          <div>
            <p className="text-uls-subtle">Livestream</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-uls-surface-inset/90 p-2 font-sans text-xs text-uls-muted">
              {project.livestreamNotes ?? "—"}
            </pre>
          </div>
          <div>
            <p className="text-uls-subtle">Budget</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-uls-surface-inset/90 p-2 font-sans text-xs text-uls-muted">
              {project.budgetNotes ?? "—"}
            </pre>
          </div>
          <div>
            <p className="text-uls-subtle">Director notes</p>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-uls-surface-inset/90 p-2 font-sans text-xs text-uls-muted">
              {project.additionalNotes ?? "—"}
            </pre>
          </div>
        </div>
      </div>
    </ProducerIntakeSectionShell>
  );
}
