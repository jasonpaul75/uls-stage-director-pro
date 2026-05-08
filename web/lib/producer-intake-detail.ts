import { Prisma, ProjectRole } from "@prisma/client";

/** Prisma include for `/producer/inbox/[projectId]` — keep in sync with the page loader. */
export const PRODUCER_INTAKE_DETAIL_INCLUDE = {
  memberships: {
    where: { role: ProjectRole.DIRECTOR },
    include: { user: true },
  },
  assignedTo: { select: { id: true, email: true, name: true, disabledAt: true } },
  stripeInvoices: {
    orderBy: { createdAt: "desc" as const },
    take: 12,
    select: {
      id: true,
      stripeInvoiceId: true,
      status: true,
      invoiceNumber: true,
      amountDueCents: true,
      hostedInvoiceUrl: true,
      currency: true,
      updatedAt: true,
      attemptCount: true,
      nextPaymentAttemptAt: true,
      lastStripeErrorSummary: true,
      lastSyncedFromStripeAt: true,
    },
  },
  docuSignEnvelopes: {
    orderBy: { updatedAt: "desc" as const },
    take: 12,
    select: {
      id: true,
      envelopeId: true,
      subject: true,
      status: true,
      statusChangedAt: true,
      completedAt: true,
      voidedAt: true,
      producerNote: true,
      lastWebhookEvent: true,
      updatedAt: true,
    },
  },
  showDayFlags: {
    orderBy: [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: { id: true, body: true, createdAt: true },
  },
  attachments: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      kind: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedBy: { select: { email: true, name: true } },
    },
  },
  showMediaItems: {
    orderBy: [{ lane: "asc" as const }, { sortOrder: "asc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true,
      lane: true,
      sortOrder: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      createdAt: true,
      uploadedBy: { select: { email: true, name: true } },
    },
  },
  directorShares: {
    orderBy: { createdAt: "desc" as const },
    select: {
      id: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      note: true,
      createdAt: true,
      uploadedBy: { select: { id: true, email: true, name: true } },
    },
  },
} satisfies Prisma.ProjectInclude;

export type ProducerIntakeDetailProject = Prisma.ProjectGetPayload<{
  include: typeof PRODUCER_INTAKE_DETAIL_INCLUDE;
}>;

/** Mirrors URL search feedback flags on `/producer/inbox/[projectId]`. */
export type ProducerIntakeDetailSearchParams = {
  saved?: string;
  error?: string;
  invite_sent?: string;
  invite_resend?: string;
  invite_err?: string;
  stripe_customer?: string;
  stripe_invoice?: string;
  stripe_sent?: string;
  stripe_line?: string;
  stripe_cancelled?: string;
  stripe_synced?: string;
  stripe_err?: string;
  proposal_saved?: string;
  docusign_linked?: string;
  docusign_removed?: string;
  docusign_err?: string;
  post_event_saved?: string;
  post_event_err?: string;
  flag_added?: string;
  flag_removed?: string;
  flags_visibility_saved?: string;
  flag_err?: string;
  ros_saved?: string;
  booking_confirmed?: string;
  attach_uploaded?: string;
  attach_deleted?: string;
  attach_err?: string;
  media_uploaded?: string;
  media_deleted?: string;
  media_visibility_saved?: string;
  media_reordered?: string;
  media_err?: string;
  media_duplicated?: string;
  media_imported?: string;
  /** Director → production shared files */
  ds_uploaded?: string;
  ds_deleted?: string;
  ds_err?: string;
  /** Returned when visiting Event workspace before unlock criteria are met */
  event_locked?: string;
};