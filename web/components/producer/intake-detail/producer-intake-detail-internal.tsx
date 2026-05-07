import { updateIntakeInternals } from "@/app/producer/inbox/actions";
import { describePlatformRetentionLine } from "@/lib/platform-retention";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";

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
    <section id="internal" className="scroll-mt-6 mt-10">
      <h2 className="text-sm font-medium text-zinc-200">Internal (ULS only)</h2>
      {assigneeBroken ? (
        <p className="mt-2 rounded border border-amber-900/50 bg-amber-950/30 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
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
      <form action={updateIntakeInternals} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Assigned producer</span>
          <select
            name="assignedToUserId"
            defaultValue={project.assignedToUserId ?? ""}
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
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
          <span className="text-zinc-400">Event conclusion date</span>
          <input
            type="date"
            name="eventConclusionAt"
            defaultValue={
              project.eventConclusionAt ? project.eventConclusionAt.toISOString().slice(0, 10) : ""
            }
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
          <span className="text-[11px] leading-snug text-zinc-600">
            Contract-defined end milestone. Directors lose portal access to this production 90 calendar days after this date
            (see product spec). Leave blank until the show is closed out.
          </span>
        </label>

        <div className="space-y-3 rounded border border-zinc-800/80 bg-black/20 px-3 py-3 text-xs text-zinc-400">
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Platform retention (36 months after conclusion, UTC anchor) per product spec —{" "}
            <span className="text-zinc-400">automated purge is not turned on here</span>; use your runbook once legal signs
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
            <span className="text-zinc-400">Hold notes (producer-only)</span>
            <textarea
              name="retentionLegalHoldNote"
              rows={2}
              maxLength={2000}
              defaultValue={project.retentionLegalHoldNote ?? ""}
              placeholder="Ticket id, counsel request, expiry — directors never see this."
              className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Internal notes</span>
          <textarea
            name="internalNotes"
            rows={6}
            defaultValue={project.internalNotes ?? ""}
            placeholder="Triage notes, call outcomes, pricing thoughts — not visible to directors."
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>

        <button type="submit" className="w-fit rounded bg-amber-600 px-4 py-2 text-sm font-medium text-black hover:bg-amber-500">
          Save
        </button>
      </form>
    </section>
  );
}
