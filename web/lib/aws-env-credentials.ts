/**
 * IAM user keys pasted into Vercel/.env often pick up leading/trailing whitespace,
 * a trailing newline, or wrapping quotes — all of which change the HMAC and surface as
 * S3 **SignatureDoesNotMatch** on presigned URLs while the access key id in the URL still looks valid.
 */
export function normalizeAwsUserSecretEnv(value: string | undefined): string {
  if (value == null) return "";
  let v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v.trim().replace(/\r?\n$/, "");
}

/**
 * When both long-term key parts are present (after normalization), force the SDK to use them.
 * If either is missing, returns `undefined` so `@aws-sdk/credential-providers` default chain still runs
 * (e.g. instance role / web identity) for environments that do not use env-based IAM users.
 */
export function staticIamUserCredentialsFromEnv():
  | { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
  | undefined {
  const accessKeyId = normalizeAwsUserSecretEnv(process.env.AWS_ACCESS_KEY_ID);
  const secretAccessKey = normalizeAwsUserSecretEnv(process.env.AWS_SECRET_ACCESS_KEY);
  const sessionToken = normalizeAwsUserSecretEnv(process.env.AWS_SESSION_TOKEN);
  if (!accessKeyId || !secretAccessKey) return undefined;
  if (sessionToken) return { accessKeyId, secretAccessKey, sessionToken };
  return { accessKeyId, secretAccessKey };
}
