import { notFound } from "next/navigation";

import { ProducerIntakeSectionNav } from "@/components/producer-intake-section-nav";
import {
  ProducerIntakeBookingSection,
  ProducerIntakeSummarySection,
} from "@/components/producer/intake-detail/producer-intake-detail-booking-summary";
import { ProducerIntakeContractsSection } from "@/components/producer/intake-detail/producer-intake-detail-contracts";
import { ProducerIntakeConfidentialFilesSection } from "@/components/producer/intake-detail/producer-intake-detail-confidential-files";
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
import { stripeHasOpenBalanceDue } from "@/lib/stripe-invoice-ui";
import { docuSignConnectHmacSecretConfigured } from "@/lib/docusign-admin";
import { prisma } from "@/lib/prisma";
import {
  PRODUCER_INTAKE_DETAIL_INCLUDE,
  type ProducerIntakeDetailSearchParams,
} from "@/lib/producer-intake-detail";
import { producerEventWorkspaceGate } from "@/lib/producer-event-workspace-gate";
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

  const [project, latestInvoiceStripeWebhook] = await Promise.all([
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
    invoiceCurrencySet.add(inv.currency.toUpperCase() || "USD");
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

  return (
    <main id="producer-main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
      <p className="text-sm uppercase tracking-widest text-amber-500">Intake detail</p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-100">{project.name}</h1>

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
    </main>
  );
}
