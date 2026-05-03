"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe-admin";
import { GlobalRole, ProjectRole, ProjectStatus } from "@prisma/client";
import Stripe from "stripe";

async function gateProducer(projectIdForLoginRedirect: string) {
  const session = await auth();
  const role = session?.user?.globalRole as GlobalRole | undefined;
  const ok =
    session?.user?.id && (role === GlobalRole.PRODUCER || role === GlobalRole.ULS_ADMIN);
  if (!ok) {
    redirect(`/login?callbackUrl=/producer/inbox/${encodeURIComponent(projectIdForLoginRedirect)}`);
  }
}

type StripeProjectSlice = { id: string; name: string; stripeCustomerId: string };

async function stripeAndProject(projectId: string): Promise<{ stripe: Stripe; project: StripeProjectSlice }> {
  await gateProducer(projectId);

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/producer/inbox/${projectId}?stripe_err=no_key`);
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
    },
  });

  if (!project) {
    redirect("/producer/inbox?stripe_err=invalid_project");
  }

  if (!project.stripeCustomerId) {
    redirect(`/producer/inbox/${projectId}?stripe_err=no_customer`);
  }

  return { stripe, project: project as StripeProjectSlice };
}

async function assertInvoiceBelongsToProject(
  stripe: Stripe,
  project: StripeProjectSlice,
  stripeInvoiceId: string,
): Promise<Stripe.Invoice> {
  const inv = await stripe.invoices.retrieve(stripeInvoiceId);
  if ((inv.metadata?.projectId ?? "") !== project.id) {
    redirect(`/producer/inbox/${project.id}?stripe_err=invoice_project_mismatch`);
  }
  const cust = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
  if (cust !== project.stripeCustomerId) {
    redirect(`/producer/inbox/${project.id}?stripe_err=invoice_project_mismatch`);
  }
  return inv;
}

async function requireLocalInvoice(projectId: string, stripeInvoiceId: string): Promise<void> {
  const row = await prisma.projectStripeInvoice.findFirst({
    where: { projectId, stripeInvoiceId },
    select: { id: true },
  });
  if (!row) {
    redirect(`/producer/inbox/${projectId}?stripe_err=invoice_not_tracked`);
  }
}

async function persistInvoiceSnapshot(stripe: Stripe, stripeInvoiceId: string): Promise<void> {
  const inv = await stripe.invoices.retrieve(stripeInvoiceId);
  await prisma.projectStripeInvoice.update({
    where: { stripeInvoiceId },
    data: {
      status: inv.status ?? "unknown",
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      invoiceNumber: inv.number ?? null,
      amountDueCents: typeof inv.amount_due === "number" ? inv.amount_due : null,
      currency: inv.currency ?? "usd",
    },
  });
}

export async function ensureStripeCustomerForProject(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  await gateProducer(projectId);

  const stripe = getStripe();
  if (!stripe) {
    redirect(`/producer/inbox/${projectId}?stripe_err=no_key`);
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, status: ProjectStatus.INTAKE_SUBMITTED },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      memberships: {
        where: { role: ProjectRole.DIRECTOR },
        orderBy: { createdAt: "asc" },
        take: 1,
        select: { user: { select: { email: true } } },
      },
    },
  });

  if (!project) {
    redirect("/producer/inbox?stripe_err=invalid_project");
  }

  if (project.stripeCustomerId) {
    redirect(`/producer/inbox/${projectId}?stripe_err=already_linked`);
  }

  const billingEmail = project.memberships[0]?.user.email;
  if (!billingEmail) {
    redirect(`/producer/inbox/${projectId}?stripe_err=no_directors`);
  }

  try {
    const customer = await stripe.customers.create({
      email: billingEmail,
      name: project.name,
      metadata: {
        projectId: project.id,
        app: "uls-stage-director-pro",
      },
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { stripeCustomerId: customer.id },
    });
  } catch (err) {
    console.error("[stripe] customer create:", err);
    redirect(`/producer/inbox/${projectId}?stripe_err=stripe_api`);
  }

  revalidatePath(`/producer/inbox/${projectId}`);
  redirect(`/producer/inbox/${projectId}?stripe_customer=1`);
}

export async function createDepositDraftInvoice(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const { stripe, project } = await stripeAndProject(projectId);

  const amountRaw = String(formData.get("depositUsd") ?? "").trim().replace(",", "");
  const dollars = Number(amountRaw);
  if (!Number.isFinite(dollars) || dollars < 1 || dollars > 999999) {
    redirect(`/producer/inbox/${projectId}?stripe_err=bad_amount`);
  }

  const cents = Math.round(dollars * 100);
  if (cents < 50) {
    redirect(`/producer/inbox/${projectId}?stripe_err=bad_amount`);
  }

  try {
    const invoice = await stripe.invoices.create({
      customer: project.stripeCustomerId,
      collection_method: "send_invoice",
      days_until_due: 14,
      auto_advance: false,
      metadata: { projectId: project.id },
    });

    await stripe.invoiceItems.create({
      customer: project.stripeCustomerId,
      invoice: invoice.id,
      amount: cents,
      currency: "usd",
      description: `Production deposit (${project.name})`,
    });

    const refreshed = await stripe.invoices.retrieve(invoice.id);

    await prisma.projectStripeInvoice.create({
      data: {
        projectId: project.id,
        stripeInvoiceId: refreshed.id,
        status: refreshed.status ?? "draft",
        hostedInvoiceUrl: refreshed.hosted_invoice_url ?? null,
        invoiceNumber: refreshed.number ?? null,
        amountDueCents: typeof refreshed.amount_due === "number" ? refreshed.amount_due : null,
        currency: refreshed.currency ?? "usd",
      },
    });
  } catch (err) {
    console.error("[stripe] invoice draft:", err);
    redirect(`/producer/inbox/${projectId}?stripe_err=stripe_api`);
  }

  revalidatePath(`/producer/inbox/${projectId}`);
  redirect(`/producer/inbox/${projectId}?stripe_invoice=1`);
}

export async function finalizeAndSendStripeInvoice(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const stripeInvoiceId = String(formData.get("stripeInvoiceId") ?? "").trim();

  const { stripe, project } = await stripeAndProject(projectId);
  await requireLocalInvoice(projectId, stripeInvoiceId);

  try {
    const inv = await assertInvoiceBelongsToProject(stripe, project, stripeInvoiceId);
    if (inv.status !== "draft") {
      redirect(`/producer/inbox/${projectId}?stripe_err=bad_invoice_state`);
    }

    await stripe.invoices.finalizeInvoice(stripeInvoiceId);
    await stripe.invoices.sendInvoice(stripeInvoiceId);
    await persistInvoiceSnapshot(stripe, stripeInvoiceId);
  } catch (err) {
    console.error("[stripe] finalize/send:", err);
    redirect(`/producer/inbox/${projectId}?stripe_err=stripe_api`);
  }

  revalidatePath(`/producer/inbox/${projectId}`);
  redirect(`/producer/inbox/${projectId}?stripe_sent=1`);
}

export async function addStripeDraftLineItem(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const stripeInvoiceId = String(formData.get("stripeInvoiceId") ?? "").trim();
  const amountRaw = String(formData.get("lineUsd") ?? "").trim().replace(",", "");
  const description = String(formData.get("lineDescription") ?? "").trim().slice(0, 420);

  const { stripe, project } = await stripeAndProject(projectId);
  await requireLocalInvoice(projectId, stripeInvoiceId);

  const dollars = Number(amountRaw);
  if (!description || !Number.isFinite(dollars) || dollars < 0.01 || dollars > 999999) {
    redirect(`/producer/inbox/${projectId}?stripe_err=bad_line`);
  }

  const cents = Math.round(dollars * 100);
  if (cents < 1) {
    redirect(`/producer/inbox/${projectId}?stripe_err=bad_line`);
  }

  try {
    const inv = await assertInvoiceBelongsToProject(stripe, project, stripeInvoiceId);
    if (inv.status !== "draft") {
      redirect(`/producer/inbox/${projectId}?stripe_err=bad_invoice_state`);
    }

    await stripe.invoiceItems.create({
      customer: project.stripeCustomerId,
      invoice: stripeInvoiceId,
      amount: cents,
      currency: "usd",
      description,
    });

    await persistInvoiceSnapshot(stripe, stripeInvoiceId);
  } catch (err) {
    console.error("[stripe] add line:", err);
    redirect(`/producer/inbox/${projectId}?stripe_err=stripe_api`);
  }

  revalidatePath(`/producer/inbox/${projectId}`);
  redirect(`/producer/inbox/${projectId}?stripe_line=1`);
}

export async function cancelStripeInvoice(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const stripeInvoiceId = String(formData.get("stripeInvoiceId") ?? "").trim();

  const { stripe, project } = await stripeAndProject(projectId);
  await requireLocalInvoice(projectId, stripeInvoiceId);

  try {
    const inv = await assertInvoiceBelongsToProject(stripe, project, stripeInvoiceId);

    if (inv.status === "draft") {
      await stripe.invoices.del(stripeInvoiceId);
      await prisma.projectStripeInvoice.deleteMany({ where: { stripeInvoiceId } });
    } else if (inv.status === "open") {
      await stripe.invoices.voidInvoice(stripeInvoiceId);
      await persistInvoiceSnapshot(stripe, stripeInvoiceId);
    } else {
      redirect(`/producer/inbox/${projectId}?stripe_err=bad_invoice_state`);
    }
  } catch (err) {
    console.error("[stripe] cancel:", err);
    redirect(`/producer/inbox/${projectId}?stripe_err=stripe_api`);
  }

  revalidatePath(`/producer/inbox/${projectId}`);
  redirect(`/producer/inbox/${projectId}?stripe_cancelled=1`);
}
