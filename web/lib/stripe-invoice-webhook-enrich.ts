import type Stripe from "stripe";

import { stripeInvoiceRetrieveExpandPayments } from "@/lib/stripe-invoice-expand";

/** Best-effort full invoice snapshot after `invoice.payment_failed` (webhook body is often thinner than Retrieve). */

export async function retrieveInvoiceExpandedAfterPaymentFailure(
  stripe: Stripe,
  webhookInvoice: Stripe.Invoice | undefined,
): Promise<Stripe.Invoice | null> {
  if (!webhookInvoice || webhookInvoice.object !== "invoice" || typeof webhookInvoice.id !== "string") return null;

  try {
    return await stripe.invoices.retrieve(webhookInvoice.id, {
      expand: stripeInvoiceRetrieveExpandPayments(),
    });
  } catch (err) {
    console.warn("[stripe webhook] invoice.payment_failed retrieve skipped", err);
    return null;
  }
}
