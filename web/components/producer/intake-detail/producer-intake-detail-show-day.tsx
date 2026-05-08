import {
  addShowDayFlag,
  deleteShowDayFlag,
  saveShowDayFlagsVisibility,
} from "@/app/producer/inbox/show-day-flag-actions";
import { Button } from "@/components/ui";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { producerIntakeFieldClass } from "@/lib/producer-intake-ui";

import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

export function ProducerIntakeShowDaySection(props: {
  project: Pick<ProducerIntakeDetailProject, "id" | "showDayFlags" | "showDayFlagsDirectorVisible">;
}) {
  const { project } = props;

  return (
    <ProducerIntakeSectionShell
      id="show-day"
      title="Show day (Flag-it)"
      description={
        <p>
          Short informational notes directors can read before or during load-in. Not a substitute for the run-of-show or
          contractual obligations — product spec: no SLA.
        </p>
      }
    >
      {project.showDayFlags.length === 0 ? (
        <p className="text-sm text-uls-subtle">No flags yet — add one below.</p>
      ) : (
        <ul className="space-y-3">
          {project.showDayFlags.map((f) => (
            <li
              key={f.id}
              className="flex flex-col gap-2 rounded-uls-card border border-uls-border bg-uls-surface/50 px-3 py-3 text-sm text-uls-muted sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="text-[10px] text-uls-subtle">{f.createdAt.toLocaleString()}</p>
                <p className="mt-2 whitespace-pre-wrap text-uls-text">{f.body}</p>
              </div>
              <form action={deleteShowDayFlag} className="shrink-0">
                <input type="hidden" name="flagId" value={f.id} />
                <button
                  type="submit"
                  className="text-xs text-red-400/90 underline-offset-2 hover:text-red-300 hover:underline"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={addShowDayFlag} className="flex flex-col gap-2">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Add flag</span>
          <textarea
            name="body"
            rows={3}
            maxLength={2000}
            placeholder="e.g. Green room assignment shifted to Suite B — FYI only."
            className={producerIntakeFieldClass}
          />
        </label>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="w-fit border-cyan-900/70 bg-cyan-950/30 text-cyan-100 hover:bg-cyan-900/40"
        >
          Post flag
        </Button>
      </form>
      <form action={saveShowDayFlagsVisibility} className="flex flex-col gap-3 border-t border-uls-border pt-6">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex items-center gap-2 text-xs text-uls-muted">
          <input
            type="checkbox"
            name="showDayFlagsDirectorVisible"
            defaultChecked={project.showDayFlagsDirectorVisible}
          />
          <span>Show show-day flags to directors on this production</span>
        </label>
        <Button type="submit" variant="secondary" size="sm" className="w-fit">
          Save visibility
        </Button>
      </form>
    </ProducerIntakeSectionShell>
  );
}
