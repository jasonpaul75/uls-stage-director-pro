/** Director / producer-facing copy for cached DocuSign envelope status strings (lowercase from API/webhooks). */

export function docuSignEnvelopeStatusLabel(status: string): string {
  const s = status.trim().toLowerCase().replace(/\s+/g, "_");

  switch (s) {
    case "unknown":
      return "Status pending";
    case "created":
      return "Created";
    case "sent":
      return "Sent — awaiting signatures";
    case "delivered":
      return "Delivered";
    case "signed":
      return "Signer action recorded";
    case "completed":
      return "Completed";
    case "declined":
      return "Declined";
    case "voided":
      return "Voided";
    case "deleted":
      return "Deleted";
    case "correct":
      return "Corrected (see DocuSign)";
    default:
      return status.replace(/_/g, " ");
  }
}
