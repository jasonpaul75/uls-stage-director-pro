import Stripe from "stripe";

export function getStripe(): Stripe | null {
  const sk = process.env.STRIPE_SECRET_KEY?.trim();
  if (!sk) return null;
  return new Stripe(sk, { typescript: true });
}

export function stripeInvoiceDashboardUrl(stripeInvoiceId: string): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  const base = key.startsWith("sk_test") ? "https://dashboard.stripe.com/test" : "https://dashboard.stripe.com";
  return `${base}/invoices/${stripeInvoiceId}`;
}

export function webhookSecretConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

/** True when the configured Stripe secret matches test-mode keys (`sk_test_…`). UI hint only — never derive security from this alone. */

export function stripeSecretKeyAppearsSandbox(): boolean {
  const sk = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  return sk.startsWith("sk_test");
}
