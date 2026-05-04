import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";

import { prismaInvoicePayloadFromStripe } from "@/lib/stripe-invoice-sync-from-api";

/** Small audit trail — full Stripe objects can hold PII / card metadata; Stripe Dashboard retains originals. */

export function webhookPayloadForStorage(event: Stripe.Event): Prisma.InputJsonValue {
  const obj = event.data?.object as { id?: unknown; object?: unknown } | undefined;
  const base: Record<string, Prisma.InputJsonValue | undefined> = {
    id: event.id,
    type: event.type,
    livemode: event.livemode ?? false,
    created: event.created,
  };
  if (event.type.startsWith("invoice.") && obj?.object === "invoice" && typeof obj.id === "string") {
    base.invoiceId = obj.id;
  }
  return JSON.parse(JSON.stringify(base)) as Prisma.InputJsonValue;
}

export async function upsertInvoiceFromStripeObject(
  tx: Prisma.TransactionClient,
  inv: Stripe.Invoice,
): Promise<void> {
  const projectIdRaw = inv.metadata?.projectId;
  if (!projectIdRaw || typeof projectIdRaw !== "string") return;

  const incoming = prismaInvoicePayloadFromStripe(inv);

  const existing = await tx.projectStripeInvoice.findUnique({
    where: { stripeInvoiceId: inv.id },
    select: { lastStripeErrorSummary: true },
  });

  const payload =
    !incoming.lastStripeErrorSummary &&
    existing?.lastStripeErrorSummary &&
    incoming.status === "open"
      ? {
          ...incoming,
          lastStripeErrorSummary: existing.lastStripeErrorSummary,
        }
      : incoming;

  await tx.projectStripeInvoice.upsert({
    where: { stripeInvoiceId: inv.id },
    create: {
      projectId: projectIdRaw,
      stripeInvoiceId: inv.id,
      ...payload,
    },
    update: payload,
  });
}

export async function applyInvoiceWebhookEvent(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
  opts?: {
    stripeInvoicePayload?: Stripe.Invoice;
  },
): Promise<void> {
  if (!event.type.startsWith("invoice.")) return;

  const obj =
    opts?.stripeInvoicePayload ?? (event.data?.object as Stripe.Invoice | undefined);
  if (!obj || obj.object !== "invoice") return;

  if (event.type === "invoice.deleted") {
    await tx.projectStripeInvoice.deleteMany({
      where: { stripeInvoiceId: obj.id },
    });
    return;
  }

  await upsertInvoiceFromStripeObject(tx, obj);
}
