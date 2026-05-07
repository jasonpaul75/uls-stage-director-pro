/**
 * Event workspace (run of show, show media, day-of, post-event) unlock rules for producers.
 * Mirrors product intent: contracts fully signed in DocuSign and deposit recorded as paid in Stripe.
 */
export type ProducerEventWorkspaceGateInput = {
  docuSignEnvelopes: { completedAt: Date | null }[];
  stripeInvoices: { status: string }[];
};

export type ProducerEventWorkspaceGateResult = {
  unlocked: boolean;
  hasSignedContract: boolean;
  hasDepositInvoicePaid: boolean;
};

export function producerEventWorkspaceGate(
  input: ProducerEventWorkspaceGateInput,
): ProducerEventWorkspaceGateResult {
  const hasSignedContract = input.docuSignEnvelopes.some((e) => e.completedAt != null);
  const hasDepositInvoicePaid = input.stripeInvoices.some((inv) => inv.status.trim().toLowerCase() === "paid");
  return {
    unlocked: hasSignedContract && hasDepositInvoicePaid,
    hasSignedContract,
    hasDepositInvoicePaid,
  };
}
