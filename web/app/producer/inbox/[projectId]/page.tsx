import Link from "next/link";
import { notFound } from "next/navigation";

import { ProducerIntakeSectionNav } from "@/components/producer-intake-section-nav";
import {
  ProducerIntakeBookingSection,
  ProducerIntakeSummarySection,
} from "@/components/producer/intake-detail/producer-intake-detail-booking-summary";
import { ProducerIntakeContractsSection } from "@/components/producer/intake-detail/producer-intake-detail-contracts";
import { ProducerIntakeConfidentialFilesSection } from "@/components/producer/intake-detail/producer-intake-detail-confidential-files";
import { ProducerIntakeDirectorSharesSection } from "@/components/producer/intake-detail/producer-intake-director-shares-section";
import { ProducerIntakeDirectorInviteSection } from "@/components/producer/intake-detail/producer-intake-detail-director-invite";
import {
  ProducerIntakeFlashMessages,
  ProducerIntakeIntegrationWarnings,
} from "@/components/producer/intake-detail/producer-intake-detail-feedback";
import { ProducerIntakeEventWorkspaceCallout } from "@/components/producer/intake-detail/producer-intake-event-workspace-callout";
import { ProducerIntakeInternalSection } from "@/components/producer/intake-detail/producer-intake-detail-internal";
import { ProducerIntakeProposalSection } from "@/components/producer/intake-detail/producer-intake-detail-proposal";
import { ProducerIntakeStripeSection } from "@/components/producer/intake-detail/producer-intake-detail-stripe";
import {
  stripeSecretKeyAppearsSandbox,
  webhookSecretConfigured,
} from "@/lib/stripe-admin";
import { normalizedStripeCurrencyCode, stripeHasOpenBalanceDue } from "@/lib/stripe-invoice-ui";
import { docuSignConnectHmacSecretConfigured } from "@/lib/docusign-admin";
import { prisma } from "@/lib/prisma";
import {
  PRODUCER_INTAKE_DETAIL_INCLUDE,
  type ProducerIntakeDetailSearchParams,
} from "@/lib/producer-intake-detail";
import { producerEventWorkspaceGate } from "@/lib/producer-event-workspace-gate";
import { producerCrewQuestionnaireMissingAndDraftCounts } from "@/lib/producer-crew-questionnaire-stats";
import { AppShell, buttonClassName } from "@/components/ui";
import { GlobalRole, ProjectStatus } from "@prisma/client";

type Props = {
  params: Promise<{ projectId: string }>;
  searchParams?: Promise<ProducerIntakeDetailSearchParams>;
};

export default async function IntakeDetailPage(props: Props) {
  const { projectId } = await props.params;
  const sp = (await props.searchParams) ?? {};

  const webhookOk = webhookSecretConfigured();
  const docusignConnectOk = docuSignConnectHmacSecretConfigured();
  const appBase = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const [project, latestInvoiceStripeWebhook, crewAssignedCount, questionnaireRowCount, questionnairesSubmittedCount] =
    await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
      include: PRODUCER_INTAKE_DETAIL_INCLUDE,
    }),
    prisma.stripeInboundEvent.findFirst({
      where: {
        processedAt: { not: null },
        type: { startsWith: "invoice." },
      },
      orderBy: { processedAt: "desc" },
      select: { processedAt: true },
    }),
    prisma.projectStaffAssignment.count({ where: { projectId } }),
    prisma.staffEventQuestionnaire.count({ where: { projectId } }),
    prisma.staffEventQuestionnaire.count({
      where: { projectId, submittedAt: { not: null } },
    }),
  ]);

  if (!project) notFound();

  const stripeSandbox = stripeSecretKeyAppearsSandbox();

  const inflightForTotals = project.stripeInvoices.filter(
    (inv) => inv.status === "draft" || inv.status === "open",
  );
  let combinedDueCentsInFlight = 0;
  const invoiceCurrencySet = new Set<string>();
  for (const inv of inflightForTotals) {
    if (typeof inv.amountDueCents === "number") {
      combinedDueCentsInFlight += inv.amountDueCents;
    }
    invoiceCurrencySet.add(normalizedStripeCurrencyCode(inv.currency));
  }
  const totalsSingleCurrency = invoiceCurrencySet.size === 1 ? [...invoiceCurrencySet][0] : null;
  const openInvoiceRetryCoach = stripeHasOpenBalanceDue(project.stripeInvoices);

  const eventGate = producerEventWorkspaceGate({
    docuSignEnvelopes: project.docuSignEnvelopes,
    stripeInvoices: project.stripeInvoices,
  });

  const producers = await prisma.user.findMany({
    where: {
      globalRole: { in: [GlobalRole.PRODUCER, GlobalRole.ULS_ADMIN] },
      disabledAt: null,
    },
    select: { id: true, email: true, name: true },
    orderBy: { email: "asc" },
  });

  const directors = project.memberships.map((m) => m.user.email).join(", ");

  const now = new Date();
  const pendingInvites = await prisma.directorInvite.findMany({
    where: {
      projectId: project.id,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
    select: { email: true, expiresAt: true },
  });

  const activeInviteRows = pendingInvites.map((inv) => ({
    ...inv,
    stale: inv.expiresAt <= now,
  }));

  const {
    missingQuestionnaireRows: crewQuestionnaireMissingRows,
    draftQuestionnaireRows: crewQuestionnaireDraftRows,
  } = producerCrewQuestionnaireMissingAndDraftCounts({
    assignmentCount: crewAssignedCount,
    questionnaireRowCount,
    questionnaireSubmittedCount: questionnairesSubmittedCount,
  });

  const crewOpsAriaLabel =
    crewAssignedCount > 0
      ? `Crew and ops: ${crewAssignedCount} internal assignment${crewAssignedCount === 1 ? "" : "s"}. Questionnaires ${questionnairesSubmittedCount} of ${crewAssignedCount} submitted.${
          crewQuestionnaireMissingRows > 0
            ? ` ${crewQuestionnaireMissingRows} questionnaire row gap — prepare rows on Crew and ops.`
            : crewQuestionnaireDraftRows > 0
              ? ` ${crewQuestionnaireDraftRows} draft${crewQuestionnaireDraftRows === 1 ? "" : "s"} pending crew submission.`
              : " All questionnaires submitted."
        } Opens crew workspace.`
      : "Crew and ops — assign internal crew, questionnaires, and expense ledger. Opens crew workspace.";

  return (
    <AppShell id="producer-main-content" outerMaxWidth="wide" contentMaxWidth="full" className="pt-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <header className="min-w-0 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-uls-subtle">Intake detail</p>
          <h1 className="text-pretty text-3xl font-semibold tracking-tight text-uls-text md:text-[2rem]">{project.name}</h1>
        </header>
        <div className="flex flex-wrap items-start justify-end gap-2">
          <div className="flex flex-col items-end gap-1">
            <Link
              href={`/producer/inbox/${project.id}/crew`}
              className={buttonClassName("primary", "sm")}
              aria-label={crewOpsAriaLabel}
            >
              Crew & ops
            </Link>
            {crewAssignedCount > 0 ? (
              <p className="max-w-[18rem] text-right text-[11px] leading-snug text-uls-muted">
                Questionnaires ·{" "}
                <span className="font-medium text-uls-subtle">{questionnairesSubmittedCount}</span>
                <span className="text-uls-subtle">/{crewAssignedCount}</span> submitted
                {crewQuestionnaireMissingRows > 0 ? (
                  <span className="text-amber-200/95">
                    {" "}
                    · −{crewQuestionnaireMissingRows} row{crewQuestionnaireMissingRows === 1 ? "" : "s"}
                  </span>
                ) : crewQuestionnaireDraftRows > 0 ? (
                  <span className="text-amber-100/90">
                    {" "}
                    · {crewQuestionnaireDraftRows} draft{crewQuestionnaireDraftRows === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="text-emerald-200/85"> · complete</span>
                )}
              </p>
            ) : null}
          </div>
          <Link href="/producer/inbox" className={buttonClassName("secondary", "sm")}>
            ← Inbox
          </Link>
        </div>
      </div>

      <ProducerIntakeFlashMessages sp={sp} project={project} />

      <ProducerIntakeEventWorkspaceCallout projectId={project.id} gate={eventGate} />

      <div className="flex flex-col gap-8 lg:flex-row lg:justify-center lg:gap-10 xl:gap-14">
        <ProducerIntakeSectionNav />
        <div className="min-w-0 flex-1 lg:max-w-3xl">
          <ProducerIntakeBookingSection project={project} />
          <ProducerIntakeIntegrationWarnings
            webhookOk={webhookOk}
            docusignConnectOk={docusignConnectOk}
            appBase={appBase}
          />
          <ProducerIntakeSummarySection project={project} directorsCsv={directors} />

          <ProducerIntakeDirectorInviteSection projectId={project.id} activeInviteRows={activeInviteRows} />
          <ProducerIntakeProposalSection project={project} />
          <ProducerIntakeContractsSection projectId={project.id} envelopes={project.docuSignEnvelopes} />
          <ProducerIntakeConfidentialFilesSection projectId={project.id} attachments={project.attachments} />
          <ProducerIntakeDirectorSharesSection projectId={project.id} shares={project.directorShares} returnTo="intake" />
          <ProducerIntakeStripeSection
            project={project}
            directorsCsv={directors}
            stripeSandbox={stripeSandbox}
            webhookOk={webhookOk}
            latestInvoiceStripeWebhookProcessedAt={latestInvoiceStripeWebhook?.processedAt ?? null}
            combinedDueCentsInFlight={combinedDueCentsInFlight}
            totalsSingleCurrency={totalsSingleCurrency}
            openInvoiceRetryCoach={openInvoiceRetryCoach}
          />
          <ProducerIntakeInternalSection project={project} producers={producers} />
        </div>
      </div>
    </AppShell>
  );
}
