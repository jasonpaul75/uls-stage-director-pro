/**
 * Retrieve invoice nested payment objects needed to read payer-side failures (`last_payment_error`, charge outcomes).
 */

export function stripeInvoiceRetrieveExpandPayments(): string[] {
  return ["payments.data.payment.payment_intent", "payments.data.payment.charge"];
}
