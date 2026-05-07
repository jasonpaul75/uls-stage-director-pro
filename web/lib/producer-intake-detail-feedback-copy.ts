export const PRODUCER_INTAKE_INVITE_ERR_COPY: Record<string, string> = {
  missing_email: "Enter a director email before sending.",
  bad_email: "That email doesn’t look valid.",
  invalid_project: "That project isn’t in the intake inbox.",
  already_member: "That email already has director access to this production.",
  producer_account: "That email is tied to production staff — use a director-facing address.",
  server: "Couldn’t create the invite. Try again.",
  mail_failed:
    "Invite email didn’t send (check SES_FROM_EMAIL / recipient verification). The invite wasn’t saved.",
};

export const PRODUCER_INTAKE_STRIPE_ERR_COPY: Record<string, string> = {
  no_key: "Stripe isn’t configured — set STRIPE_SECRET_KEY on the server.",
  already_linked: "This production already has a Stripe customer record.",
  no_directors: "Add at least one director on the intake record before creating a Stripe customer (billing email).",
  stripe_api: "Stripe returned an error — check logs and Dashboard for details.",
  no_customer: "Create a Stripe customer for this production first.",
  bad_amount: "Enter deposit in USD — at least $1.00 (we enforce a 50¢ minimum in cents via Stripe norms).",
  invoice_project_mismatch: "That invoice doesn’t belong to this production.",
  invoice_not_tracked:
    "That invoice wasn’t created from this intake record — refresh the page or manage it in Stripe only.",
  bad_invoice_state: "That action only works while the invoice is a draft or open (depending on what you clicked).",
  bad_line: "Add a description and USD amount ($0.01–$999,999).",
  invalid_project: "That project isn’t in the intake inbox.",
};

export const PRODUCER_INTAKE_DOCUSIGN_ERR_COPY: Record<string, string> = {
  bad_envelope:
    "Envelope ID must be a 36-character GUID copied from DocuSign (open the agreement → copy from the URL or details). Tutorial examples pasted from the web often look valid but aren’t real envelopes.",
  placeholder_envelope:
    "That ID is only a textbook / RFC example (550e8400-…); paste the envelope ID DocuSign shows for your agreement so Connect payloads can match it.",
  envelope_already_linked:
    "Each DocuSigned envelope ID can belong to only one intake at a time. Go to Producer inbox, open **other** productions (titles in the list), expand Contracts — if this same ID appears there, remove that row — or reuse that intake row instead.",
  api: "Couldn’t save DocuSign link.",
  invalid_project: "That project isn’t in the intake inbox.",
};
