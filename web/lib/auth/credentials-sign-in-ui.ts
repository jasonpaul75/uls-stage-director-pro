/**
 * next-auth/react `signIn("credentials", { redirect: false })` does not always surface
 * `DirectorPortalAccessEndedSignin.code`; check `code` and fall back to parsing `url`.
 */

export const PORTAL_ACCESS_ENDED_SIGN_IN_MESSAGE =
  "Director portal access has ended for every production on this account (90 days after each recorded event conclusion). Contact ULS production or start a new intake for a future event.";

export function isPortalAccessEndedSignInResult(
  result: { error?: string | null; code?: unknown; url?: string | null } | null | undefined,
): boolean {
  if (result && typeof result === "object" && result.code === "portal_access_ended") return true;
  const url = typeof result?.url === "string" ? result.url : "";
  return url.includes("portal_access_ended");
}
