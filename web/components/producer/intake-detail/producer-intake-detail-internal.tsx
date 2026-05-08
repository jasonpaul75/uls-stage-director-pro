import { updateIntakeInternals } from "@/app/producer/inbox/actions";
import { describePlatformRetentionLine } from "@/lib/platform-retention";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { Button } from "@/components/ui";
import { producerIntakeFieldClass } from "@/lib/producer-intake-ui";

import { ProducerIntakeCollapsible } from "./producer-intake-collapsible";
import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

export type ProducerIntakeInternalAssigneeOption = {
  id: string;
  email: string;
  name: string | null;
};

export function ProducerIntakeInternalSection(props: {
  project: Pick<
    ProducerIntakeDetailProject,
    | "id"
    | "assignedToUserId"
    | "assignedTo"
    | "eventConclusionAt"
    | "internalNotes"
    | "retentionLegalHold"
    | "retentionLegalHoldNote"
  >;
  producers: ProducerIntakeInternalAssigneeOption[];
}) {
  const { project, producers } = props;
  const retentionLine = describePlatformRetentionLine(project.eventConclusionAt);
  const assigneeBroken =
    Boolean(project.assignedToUserId) &&
    (!project.assignedTo || project.assignedTo.disabledAt != null);

  return (
    <ProducerIntakeSectionShell
      id="internal"
      title="Internal (ULS only)"
      description={<p>Assignee, conclusion date, retention posture, and triage notes — never shown to directors.</p>}
    >
      {assigneeBroken ? (
        <p className="rounded-md border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
          {!project.assignedTo ? (
            <>
              This row still references a removed staff account — choose an active producer below (or leave unassigned)
              before saving other internal fields.
            </>
          ) : (
            <>
              The listed assignee is a <strong className="font-medium">disabled</strong> staff account — reassign to an
              active producer (disabling an account clears assignments going forward; this message covers legacy rows).
            </>
          )}
        </p>
      ) : null}
      <form action={updateIntakeInternals} className="flex flex-col gap-4">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Assigned producer</span>
          <select
            name="assignedToUserId"
            defaultValue={project.assignedToUserId ?? ""}
            className={producerIntakeFieldClass}
          >
            <option value="">— Unassigned —</option>
            {project.assignedToUserId && !project.assignedTo ? (
              <option value={project.assignedToUserId}>Orphaned assignee id — pick an active producer</option>
            ) : null}
            {project.assignedTo && project.assignedTo.disabledAt != null ? (
              <option value={project.assignedTo.id}>
                {(project.assignedTo.name ?? "").trim() || project.assignedTo.email} — disabled account (reassign)
              </option>
            ) : null}
            {producers.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name ?? "").trim() || u.email}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Event conclusion date</span>
          <input
            type="date"
            name="eventConclusionAt"
            defaultValue={project.eventConclusionAt ? project.eventConclusionAt.toISOString().slice(0, 10) : ""}
            className={producerIntakeFieldClass}
          />
          <span className="text-[11px] leading-snug text-uls-subtle">
            Contract-defined end milestone. Directors lose portal access to this production 90 calendar days after this date
            (see product spec). Leave blank until the show is closed out.
          </span>
        </label>

        <ProducerIntakeCollapsible
          title="Retention & legal hold (36-month policy)"
          defaultOpen={project.retentionLegalHold || Boolean(project.retentionLegalHoldNote?.trim())}
        >
          <div className="space-y-3 text-xs text-uls-muted">
            <p className="text-[11px] leading-relaxed text-uls-subtle">
              Platform retention (36 months after conclusion, UTC anchor) per product spec —{" "}
              <span className="text-uls-muted">automated purge is not turned on here</span>; use your runbook once legal signs
              off. {retentionLine}
            </p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                name="retentionLegalHold"
                value="on"
                defaultChecked={project.retentionLegalHold}
                className="mt-1"
              />
              <span>Legal hold / pause purge eligibility — block runbook deletes until cleared (counsel-reviewed).</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-uls-muted">Hold notes (producer-only)</span>
              <textarea
                name="retentionLegalHoldNote"
                rows={2}
                maxLength={2000}
                defaultValue={project.retentionLegalHoldNote ?? ""}
                placeholder="Ticket id, counsel request, expiry — directors never see this."
                className={producerIntakeFieldClass}
              />
            </label>
          </div>
        </ProducerIntakeCollapsible>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Internal notes</span>
          <textarea
            name="internalNotes"
            rows={6}
            defaultValue={project.internalNotes ?? ""}
            placeholder="Triage notes, call outcomes, pricing thoughts — not visible to directors."
            className={producerIntakeFieldClass}
          />
        </label>

        <Button type="submit" variant="primary" size="sm" className="w-fit">
          Save
        </Button>
      </form>
    </ProducerIntakeSectionShell>
  );
}
