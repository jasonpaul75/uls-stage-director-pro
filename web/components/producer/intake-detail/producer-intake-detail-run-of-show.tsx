import { saveRunOfShow } from "@/app/producer/inbox/run-of-show-actions";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";

export function ProducerIntakeRunOfShowSection(props: {
  project: Pick<
    ProducerIntakeDetailProject,
    "id" | "runOfShowBody" | "runOfShowDirectorVisible" | "runOfShowFrozen"
  >;
}) {
  const { project } = props;

  return (
    <section id="run-of-show" className="scroll-mt-6 mt-10">
      <h2 className="text-sm font-medium text-zinc-200">Run of show</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Single working schedule / cue narrative for this production. Directors never edit it here (v1) — ULS owns updates.
        Turn on <span className="text-zinc-400">freeze</span> during show window to signal view-only; comments stay off in
        the product spec during freeze.
      </p>
      <form action={saveRunOfShow} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Schedule &amp; cues (plain text)</span>
          <textarea
            name="runOfShowBody"
            rows={14}
            defaultValue={project.runOfShowBody ?? ""}
            placeholder="Doors, contest flow, LX/audio handoffs, hold points — whatever the team agreed."
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-[13px] text-zinc-100"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            name="runOfShowDirectorVisible"
            defaultChecked={project.runOfShowDirectorVisible}
          />
          <span>Show run of show to directors</span>
        </label>
        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input type="checkbox" name="runOfShowFrozen" defaultChecked={project.runOfShowFrozen} />
          <span>Freeze (show window — directors view only; ULS still edits from this screen)</span>
        </label>
        <button
          type="submit"
          className="w-fit rounded border border-teal-800/70 bg-teal-950/35 px-4 py-2 text-sm font-medium text-teal-100 hover:bg-teal-900/45"
        >
          Save run of show
        </button>
      </form>
    </section>
  );
}
