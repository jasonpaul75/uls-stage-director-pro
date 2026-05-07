import { saveProposalDraft } from "@/app/producer/inbox/proposal-actions";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";

export function ProducerIntakeProposalSection(props: {
  project: Pick<
    ProducerIntakeDetailProject,
    | "id"
    | "proposalPricingNotes"
    | "proposalTechRiderNotes"
    | "proposalCrewNotes"
    | "proposalDirectorVisible"
    | "contractsDirectorVisible"
    | "stripeBillingDirectorVisible"
  >;
}) {
  const { project } = props;

  return (
    <section id="proposal" className="scroll-mt-6 mt-10">
      <h2 className="text-sm font-medium text-zinc-200">Proposal draft (pricing &amp; rider)</h2>
      <p className="mt-1 text-xs text-zinc-500">
        MVP scaffolding: capture how you&apos;ll describe fees, tech, and crew rhythm. Directors never see these fields until
        ULS publishes with the checkbox below — use internal notes above for unfinished thinking.
      </p>
      <form action={saveProposalDraft} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Pricing / phased payments summary</span>
          <textarea
            name="proposalPricingNotes"
            rows={6}
            defaultValue={project.proposalPricingNotes ?? ""}
            placeholder="Deposits, milestones, recurring fees, Stripe invoice language — prose for eventual client-visible copy."
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Technical / rider cues</span>
          <textarea
            name="proposalTechRiderNotes"
            rows={6}
            defaultValue={project.proposalTechRiderNotes ?? ""}
            placeholder="Power, signal paths, LX/audio guardrails — enough for a future formal rider attachment."
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-400">Crew &amp; rehearsal rhythm</span>
          <textarea
            name="proposalCrewNotes"
            rows={5}
            defaultValue={project.proposalCrewNotes ?? ""}
            placeholder="Call times, departmental ownership, escalation — still internal until published."
            className="rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100"
          />
        </label>
        <fieldset className="space-y-2 rounded border border-zinc-800/80 bg-black/20 px-3 py-3 text-xs text-zinc-400">
          <legend className="px-1 text-zinc-300">Director portal visibility</legend>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="proposalDirectorVisible" defaultChecked={project.proposalDirectorVisible} />
            <span>Show proposal notes (pricing / rider / crew) to directors</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="contractsDirectorVisible" defaultChecked={project.contractsDirectorVisible} />
            <span>Show mirrored DocuSign contract status to directors</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="stripeBillingDirectorVisible"
              defaultChecked={project.stripeBillingDirectorVisible}
            />
            <span>Show Stripe invoices &amp; payment links to directors</span>
          </label>
        </fieldset>
        <button
          type="submit"
          className="w-fit rounded border border-emerald-800/70 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-900/40"
        >
          Save proposal draft
        </button>
      </form>
    </section>
  );
}
