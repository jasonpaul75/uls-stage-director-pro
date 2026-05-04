/**
 * DocuSign OAuth (JWT grant) — prerequisites for REST APIs (create/send envelopes, download PDFs).
 * One-time admin consent is still required per integration key in DocuSign.
 */

import jwt from "jsonwebtoken";

function normalizePem(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

function defaultAuthServer(): string {
  const v = process.env.DOCUSIGN_USE_DEMO?.trim().toLowerCase();
  const demo = v === "1" || v === "true" || v === "yes";
  return demo ? "account-d.docusign.com" : "account.docusign.com";
}

export function docusignJwtConfigured(): boolean {
  return Boolean(
    process.env.DOCUSIGN_INTEGRATION_KEY?.trim() &&
      process.env.DOCUSIGN_USER_ID?.trim() &&
      process.env.DOCUSIGN_RSA_PRIVATE_KEY?.trim(),
  );
}

/** Exchange JWT for a bearer token, or null when env incomplete / consent / key issues. */

export async function fetchDocuSignAccessToken(): Promise<string | null> {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY?.trim();
  const userId = process.env.DOCUSIGN_USER_ID?.trim();
  const pemRaw = process.env.DOCUSIGN_RSA_PRIVATE_KEY?.trim();
  if (!integrationKey || !userId || !pemRaw) {
    return null;
  }

  const authServer =
    process.env.DOCUSIGN_AUTH_SERVER?.trim().replace(/^https?:\/\//, "") ?? defaultAuthServer();
  const pem = normalizePem(pemRaw);

  const now = Math.floor(Date.now() / 1000);
  let assertion: string;
  try {
    assertion = jwt.sign(
      {
        iss: integrationKey,
        sub: userId,
        aud: authServer,
        iat: now,
        exp: now + 600,
        scope: "signature impersonation",
      },
      pem,
      { algorithm: "RS256" },
    );
  } catch {
    return null;
  }

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  try {
    const res = await fetch(`https://${authServer}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { access_token?: string };
    return data.access_token ?? null;
  } catch {
    return null;
  }
}
