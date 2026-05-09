/** Director / producer-facing copy for cached DocuSign envelope status strings — tolerates null / blank DB values. */

export function docuSignEnvelopeStatusLabel(status: string | null | undefined): string {
  if (typeof status !== "string") return "Status pending";
  const trimmed = status.trim();
  if (!trimmed) return "Status pending";

  const s = trimmed.toLowerCase().replace(/\s+/g, "_");

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
      return trimmed.replace(/_/g, " ");
  }
}
