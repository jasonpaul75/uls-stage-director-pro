import { saveRunOfShow } from "@/app/producer/inbox/run-of-show-actions";
import { Button } from "@/components/ui";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { producerIntakeMonoFieldClass } from "@/lib/producer-intake-ui";

import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

export function ProducerIntakeRunOfShowSection(props: {
  project: Pick<
    ProducerIntakeDetailProject,
    "id" | "runOfShowBody" | "runOfShowDirectorVisible" | "runOfShowFrozen"
  >;
}) {
  const { project } = props;

  return (
    <ProducerIntakeSectionShell
      id="run-of-show"
      title="Run of show"
      description={
        <p>
          Single working schedule / cue narrative for this production. Directors never edit it here (v1) — ULS owns updates.
          Turn on <span className="text-uls-text">freeze</span> during show window to signal view-only; comments stay off in the
          product spec during freeze.
        </p>
      }
    >
      <form action={saveRunOfShow} className="flex flex-col gap-4">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Schedule &amp; cues (plain text)</span>
          <textarea
            name="runOfShowBody"
            rows={14}
            defaultValue={project.runOfShowBody ?? ""}
            placeholder="Doors, contest flow, LX/audio handoffs, hold points — whatever the team agreed."
            className={producerIntakeMonoFieldClass}
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-uls-muted">
          <input
            type="checkbox"
            name="runOfShowDirectorVisible"
            defaultChecked={project.runOfShowDirectorVisible}
          />
          <span>Show run of show to directors</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-uls-muted">
          <input type="checkbox" name="runOfShowFrozen" defaultChecked={project.runOfShowFrozen} />
          <span>Freeze (show window — directors view only; ULS still edits from this screen)</span>
        </label>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="w-fit border-teal-800/70 bg-teal-950/35 text-teal-100 hover:bg-teal-900/45"
        >
          Save run of show
        </Button>
      </form>
    </ProducerIntakeSectionShell>
  );
}
