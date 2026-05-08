import { saveProposalDraft } from "@/app/producer/inbox/proposal-actions";
import type { ProducerIntakeDetailProject } from "@/lib/producer-intake-detail";
import { Button } from "@/components/ui";
import { producerIntakeFieldClass, producerIntakeInsetFieldsetClass } from "@/lib/producer-intake-ui";

import { ProducerIntakeCollapsible } from "./producer-intake-collapsible";
import { ProducerIntakeSectionShell } from "./producer-intake-section-shell";

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
  const anyPublished =
    project.proposalDirectorVisible ||
    project.contractsDirectorVisible ||
    project.stripeBillingDirectorVisible;

  return (
    <ProducerIntakeSectionShell
      id="proposal"
      title="Proposal draft (pricing & rider)"
      description={
        <p>
          Sketch how you&apos;ll describe fees, tech, and crew rhythm before publishing. Directors never see these fields until ULS
          turns visibility on below — safe for internal notes while you iterate.
        </p>
      }
    >
      <form action={saveProposalDraft} className="flex flex-col gap-4">
        <input type="hidden" name="projectId" value={project.id} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Pricing / phased payments summary</span>
          <textarea
            name="proposalPricingNotes"
            rows={6}
            defaultValue={project.proposalPricingNotes ?? ""}
            placeholder="Deposits, milestones, recurring fees, Stripe invoice language — prose for eventual client-visible copy."
            className={producerIntakeFieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Technical / rider cues</span>
          <textarea
            name="proposalTechRiderNotes"
            rows={6}
            defaultValue={project.proposalTechRiderNotes ?? ""}
            placeholder="Power, signal paths, LX/audio guardrails — enough for a future formal rider attachment."
            className={producerIntakeFieldClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-uls-muted">Crew & rehearsal rhythm</span>
          <textarea
            name="proposalCrewNotes"
            rows={5}
            defaultValue={project.proposalCrewNotes ?? ""}
            placeholder="Call times, departmental ownership, escalation — still internal until published."
            className={producerIntakeFieldClass}
          />
        </label>

        <ProducerIntakeCollapsible title="Director portal visibility" defaultOpen={anyPublished}>
          <fieldset className={producerIntakeInsetFieldsetClass}>
            <legend className="px-1 text-uls-text">Publish to directors</legend>
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
              <span>Show Stripe invoices & payment links to directors</span>
            </label>
          </fieldset>
        </ProducerIntakeCollapsible>

        <Button type="submit" variant="secondary" size="sm" className="w-fit border-emerald-800/55 text-emerald-100 hover:bg-emerald-950/50">
          Save proposal draft
        </Button>
      </form>
    </ProducerIntakeSectionShell>
  );
}
