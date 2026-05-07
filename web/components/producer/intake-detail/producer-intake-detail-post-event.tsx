import { savePostEventVaultPointers } from "@/app/producer/inbox/post-event-actions";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";

export function ProducerIntakePostEventSection(props: {
  project: Pick<
    ProducerIntakeDetailProject,
    "id" | "postEventSmugMugUrl" | "postEventCastrUrl" | "postEventVaultDirectorVisible"
  >;
}) {
  const { project } = props;

  return (
    <section id="post-event" className="scroll-mt-6 mt-10">
      <h2 className="text-sm font-medium text-zinc-200">Post-event delivery</h2>
      <p className="mt-1 text-xs text-zinc-500">
        After the show, add HTTPS links for the photo gallery (smugmug.com / Pageant Expressions) and, if used, Castr for
        livestream or replay. Media stays on those platforms — the portal only lists handoffs for directors.
      </p>
      <form action={savePostEventVaultPointers} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Photo gallery — SmugMug / Pageant Expressions (optional)</span>
          <input
            type="url"
            name="postEventSmugMugUrl"
            defaultValue={project.postEventSmugMugUrl ?? ""}
            placeholder="https://…"
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
          <span className="text-[11px] text-zinc-600">
            One link — Pageant Expressions galleries are delivered through SmugMug.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Castr livestream / replay (optional)</span>
          <input
            type="url"
            name="postEventCastrUrl"
            defaultValue={project.postEventCastrUrl ?? ""}
            placeholder="https://…"
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="flex items-center gap-2 rounded border border-zinc-800/80 bg-black/20 px-3 py-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            name="postEventVaultDirectorVisible"
            defaultChecked={project.postEventVaultDirectorVisible}
          />
          <span>Show post-event links to directors on this production</span>
        </label>
        <button
          type="submit"
          className="w-fit rounded border border-violet-800/70 bg-violet-950/40 px-4 py-2 text-sm font-medium text-violet-100 hover:bg-violet-900/50"
        >
          Save post-event pointers
        </button>
      </form>
    </section>
  );
}
