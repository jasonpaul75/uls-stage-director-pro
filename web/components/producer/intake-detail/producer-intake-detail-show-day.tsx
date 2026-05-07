import {
  addShowDayFlag,
  deleteShowDayFlag,
  saveShowDayFlagsVisibility,
} from "@/app/producer/inbox/show-day-flag-actions";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";

export function ProducerIntakeShowDaySection(props: {
  project: Pick<ProducerIntakeDetailProject, "id" | "showDayFlags" | "showDayFlagsDirectorVisible">;
}) {
  const { project } = props;

  return (
    <section id="show-day" className="scroll-mt-6 mt-10">
      <h2 className="text-sm font-medium text-zinc-200">Show day (Flag-it)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Short informational notes directors can read before or during load-in. Not a substitute for the run-of-show or
        contractual obligations — product spec: no SLA.
      </p>
      {project.showDayFlags.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600">No flags yet — add one below.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {project.showDayFlags.map((f) => (
            <li
              key={f.id}
              className="flex flex-col gap-2 rounded border border-zinc-800 bg-zinc-950/60 px-3 py-3 text-sm text-zinc-200 sm:flex-row sm:items-start sm:justify-between"
            >
              <div>
                <p className="text-[10px] text-zinc-500">{f.createdAt.toLocaleString()}</p>
                <p className="mt-2 whitespace-pre-wrap">{f.body}</p>
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
      <form action={addShowDayFlag} className="mt-4 flex flex-col gap-2">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Add flag</span>
          <textarea
            name="body"
            rows={3}
            maxLength={2000}
            placeholder="e.g. Green room assignment shifted to Suite B — FYI only."
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <button
          type="submit"
          className="w-fit rounded border border-cyan-900/70 bg-cyan-950/30 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-900/40"
        >
          Post flag
        </button>
      </form>
      <form action={saveShowDayFlagsVisibility} className="mt-6 flex flex-col gap-3 border-t border-zinc-800 pt-6">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            name="showDayFlagsDirectorVisible"
            defaultChecked={project.showDayFlagsDirectorVisible}
          />
          <span>Show show-day flags to directors on this production</span>
        </label>
        <button
          type="submit"
          className="w-fit rounded border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
        >
          Save visibility
        </button>
      </form>
    </section>
  );
}
