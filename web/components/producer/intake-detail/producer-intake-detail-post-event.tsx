import { savePostEventVaultPointers } from "@/app/producer/inbox/post-event-actions";
import { Button } from "@/components/ui";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { producerIntakeFieldClass, producerIntakeInsetFieldsetClass } from "@/lib/producer-intake-ui";

import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

export function ProducerIntakePostEventSection(props: {
  project: Pick<
    ProducerIntakeDetailProject,
    "id" | "postEventSmugMugUrl" | "postEventCastrUrl" | "postEventVaultDirectorVisible"
  >;
}) {
  const { project } = props;

  return (
    <ProducerIntakeSectionShell
      id="post-event"
      title="Post-event delivery"
      description={
        <p>
          After the show, add HTTPS links for the photo gallery (smugmug.com / Pageant Expressions) and, if used, Castr for
          livestream or replay. Media stays on those platforms — the portal only lists handoffs for directors.
        </p>
      }
    >
      <form action={savePostEventVaultPointers} className="flex flex-col gap-4">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Photo gallery — SmugMug / Pageant Expressions (optional)</span>
          <input
            type="url"
            name="postEventSmugMugUrl"
            defaultValue={project.postEventSmugMugUrl ?? ""}
            placeholder="https://…"
            className={producerIntakeFieldClass}
          />
          <span className="text-[11px] text-uls-subtle">
            One link — Pageant Expressions galleries are delivered through SmugMug.
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Castr livestream / replay (optional)</span>
          <input
            type="url"
            name="postEventCastrUrl"
            defaultValue={project.postEventCastrUrl ?? ""}
            placeholder="https://…"
            className={producerIntakeFieldClass}
          />
        </label>
        <fieldset className={producerIntakeInsetFieldsetClass}>
          <legend className="sr-only">Director visibility</legend>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="postEventVaultDirectorVisible"
              defaultChecked={project.postEventVaultDirectorVisible}
            />
            <span>Show post-event links to directors on this production</span>
          </label>
        </fieldset>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          className="w-fit border-violet-800/70 bg-violet-950/40 text-violet-100 hover:bg-violet-900/50"
        >
          Save post-event pointers
        </Button>
      </form>
    </ProducerIntakeSectionShell>
  );
}
