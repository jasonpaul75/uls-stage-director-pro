import { NextResponse } from "next/server";
import Stripe from "stripe";

import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-admin";
import { retrieveInvoiceExpandedAfterPaymentFailure } from "@/lib/stripe-invoice-webhook-enrich";
import {
  applyInvoiceWebhookEvent,
  webhookPayloadForStorage,
} from "@/lib/stripe-webhook-invoice-sync";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!whSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 503 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "STRIPE_SECRET_KEY not set" }, { status: 503 });
  }

  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing Stripe-Signature" }, { status: 400 });
  }

  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const payloadJson = webhookPayloadForStorage(event);

  let paymentFailedRetrieve: Stripe.Invoice | undefined;
  if (event.type === "invoice.payment_failed") {
    const expanded = await retrieveInvoiceExpandedAfterPaymentFailure(
      stripe,
      event.data?.object as Stripe.Invoice | undefined,
    );
    if (expanded) {
      paymentFailedRetrieve = expanded;
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.stripeInboundEvent.create({
        data: {
          stripeEventId: event.id,
          type: event.type,
          livemode: event.livemode ?? false,
          payload: payloadJson,
        },
      });

      await applyInvoiceWebhookEvent(tx, event, {
        ...(paymentFailedRetrieve ? { stripeInvoicePayload: paymentFailedRetrieve } : {}),
      });

      await tx.stripeInboundEvent.update({
        where: { stripeEventId: event.id },
        data: { processedAt: new Date() },
      });
    });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null ? (e as { code?: string }).code : undefined;
    if (code === "P2002") {
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.error("[stripe webhook]", e);
    return NextResponse.json({ error: "Persist failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
