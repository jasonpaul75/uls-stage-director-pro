import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = () => process.env.AWS_REGION ?? "us-east-2";

/** Bucket for `ProjectAttachment` blobs — separate IAM policy recommended (private, no static website). */
export function attachmentsBucketConfigured(): boolean {
  return Boolean(process.env.AWS_S3_ATTACHMENTS_BUCKET?.trim());
}

export function getAttachmentsBucket(): string | null {
  const b = process.env.AWS_S3_ATTACHMENTS_BUCKET?.trim();
  return b || null;
}

function client(): S3Client {
  // Avoid AWS SDK 3.729+ auto-CRC32 on PutObject (breaks host-only presigned browser PUTs); see package.json pin 3.726.1.
  return new S3Client({
    region: region(),
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
}

export async function putProjectAttachmentObject(
  storageKey: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const bucket = getAttachmentsBucket();
  if (!bucket) throw new Error("attachments_bucket_missing");
  await client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: body,
      ContentType: contentType,
      ServerSideEncryption: "AES256",
    }),
  );
}

export async function deleteProjectAttachmentObject(storageKey: string): Promise<void> {
  const bucket = getAttachmentsBucket();
  if (!bucket) return;
  await client().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    }),
  );
}

/** Server-side copy within the attachments bucket (used to duplicate show-media rows without re-uploading). */
export async function copyObjectInAttachmentsBucket(sourceKey: string, destKey: string): Promise<void> {
  const bucket = getAttachmentsBucket();
  if (!bucket) throw new Error("attachments_bucket_missing");
  const copySource = `${bucket}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`;
  await client().send(
    new CopyObjectCommand({
      Bucket: bucket,
      CopySource: copySource,
      Key: destKey,
      ServerSideEncryption: "AES256",
    }),
  );
}

export async function signedGetAttachmentUrl(storageKey: string, expiresSeconds = 120): Promise<string> {
  const bucket = getAttachmentsBucket();
  if (!bucket) throw new Error("attachments_bucket_missing");
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: storageKey });
  return getSignedUrl(client(), cmd, { expiresIn: expiresSeconds });
}

export async function headAttachmentObject(
  storageKey: string,
): Promise<{ contentLength: number; contentType: string } | null> {
  const bucket = getAttachmentsBucket();
  if (!bucket) throw new Error("attachments_bucket_missing");
  try {
    const out = await client().send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey }));
    const len = out.ContentLength ?? 0;
    const ct = out.ContentType?.trim().toLowerCase() || "application/octet-stream";
    return { contentLength: len, contentType: ct };
  } catch (e: unknown) {
    const name = e && typeof e === "object" && "name" in e ? String((e as { name?: string }).name) : "";
    const status =
      e && typeof e === "object" && "$metadata" in e
        ? (e as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined;
    if (name === "NotFound" || status === 404) return null;
    throw e;
  }
}

/** Browser uploads: presigner leaves `content-type` unsigned (`X-Amz-SignedHeaders` is usually **`host` only`).
 * PUT **must omit** `Content-Type` — use `new Blob([file], { type: "" })`. Do not add `x-amz-server-side-encryption` unless the presign command signs it; mismatch causes **SignatureDoesNotMatch**. Bucket **default encryption** applies at rest without client headers.
 * `_contentType` is validated by callers before presign only; finalize MIME uses HeadObject + filename. */
export async function signedPutAttachmentUrl(
  storageKey: string,
  _contentType: string,
  expiresSeconds = 900,
): Promise<string> {
  const bucket = getAttachmentsBucket();
  if (!bucket) throw new Error("attachments_bucket_missing");
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
  });
  return getSignedUrl(client(), cmd, { expiresIn: expiresSeconds });
}
