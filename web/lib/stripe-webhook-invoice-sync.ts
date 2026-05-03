import type { Prisma } from "@prisma/client";
import type Stripe from "stripe";

export function webhookPayloadForStorage(event: Stripe.Event): Prisma.InputJsonValue {
  try {
    return JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;
  } catch {
    return {
      id: event.id,
      type: event.type,
      livemode: event.livemode ?? false,
    } as Prisma.InputJsonValue;
  }
}

export async function upsertInvoiceFromStripeObject(
  tx: Prisma.TransactionClient,
  inv: Stripe.Invoice,
): Promise<void> {
  const projectIdRaw = inv.metadata?.projectId;
  if (!projectIdRaw || typeof projectIdRaw !== "string") return;

  await tx.projectStripeInvoice.upsert({
    where: { stripeInvoiceId: inv.id },
    create: {
      projectId: projectIdRaw,
      stripeInvoiceId: inv.id,
      status: inv.status ?? "unknown",
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoiceNumber: inv.number ?? null,
      amountDueCents: typeof inv.amount_due === "number" ? inv.amount_due : null,
      currency: inv.currency ?? "usd",
    },
    update: {
      status: inv.status ?? "unknown",
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoiceNumber: inv.number ?? null,
      amountDueCents: typeof inv.amount_due === "number" ? inv.amount_due : null,
      currency: inv.currency ?? "usd",
    },
  });
}

export async function applyInvoiceWebhookEvent(
  tx: Prisma.TransactionClient,
  event: Stripe.Event,
): Promise<void> {
  if (!event.type.startsWith("invoice.")) return;

  const obj = event.data?.object as Stripe.Invoice | undefined;
  if (!obj || obj.object !== "invoice") return;

  if (event.type === "invoice.deleted") {
    await tx.projectStripeInvoice.deleteMany({
      where: { stripeInvoiceId: obj.id },
    });
    return;
  }

  await upsertInvoiceFromStripeObject(tx, obj);
}
