# ULS Stage Director PRO — monorepo

Internal production desk plus branded director portal — see product decisions in **`ULS_Stage_Director_PRO.md`**.

## Structure

| Path | Purpose |
|------|--------|
| `web/` | Next.js (App Router), Prisma ORM, Auth.js credentials |
| `ULS_Stage_Director_PRO.md` | Locked product / compliance / retention spec |

Application stack: TypeScript · Next.js · PostgreSQL (RDS, **us-east-2**) · Prisma · Auth.js · Stripe/Docusign integrations next.

## Quick start (`web/`)

1. **PostgreSQL**: create a database on Amazon RDS (**PostgreSQL**) in **`us-east-2`**. Allow connect from where you dev/deploy (VPC / security groups).

2. **Environment**:

   ```bash
   cd web
   cp .env.example .env
   ```

   Set `DATABASE_URL` and `AUTH_SECRET` (≥ 32 chars). Optional: `AUTH_URL` for production.

3. **Migrations**:

   ```bash
   cd web
   npm install
   npx prisma migrate deploy
   ```

   During local iteration you can instead run `npm run db:migrate:dev`.

4. **First user**: insert a bcrypt password hash manually or use Prisma Studio:

   ```bash
   npm run db:studio
   ```

   `User.passwordHash` must be a bcrypt hash (e.g. cost 10+) for credential sign-in. Set `globalRole` to `PRODUCER`, `ULS_ADMIN`, or `DIRECTOR` as needed.

5. **Dev server**:

   ```bash
   cd web
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

### Intake email (Amazon SES, optional)

Set `SES_FROM_EMAIL` (verified in SES), `INTAKE_NOTIFY_EMAIL` (comma-separated), `APP_BASE_URL` (e.g. `http://localhost:3000`), and `AWS_REGION=us-east-2` with usable AWS credentials. Until those are configured, intake submit still succeeds; only the outbound email step is skipped (see server logs).

## Roles (v1 scaffolding)

| Area | Roles |
|------|-------|
| `/producer` | `PRODUCER` or `ULS_ADMIN` only |
| `/portal` | `DIRECTOR` or `ULS_ADMIN` (`PRODUCER` is routed to `/producer`) |

## Git

Git root is **`ULS Stage Director Pro`** (workspace root). Nested Git inside `web/` was removed so one repo owns the product spec plus the app.

## Production URL

Target apex: **`https://uls-stage-director-pro.app`**. Point DNS + TLS at your chosen host (**AWS Amplify Hosting**, **App Runner**, **ECS Fargate**, etc.) keeping data plane in **`us-east-2`**.

### S3 uploads troubleshooting (presign 200 → PUT 403)

Your **IAM policy** can look correct while S3 still returns **403** on the browser `PUT`. Check, in order:

1. **Exact error** — In Chrome DevTools → **Network** → failed **PUT** → **Response** tab. S3 returns XML with `<Code>` and `<Message>` (e.g. `AccessDenied`, `SignatureDoesNotMatch`, or a KMS hint). The UI will surface these when possible.
2. **Vercel credentials** — Confirm **Project → Settings → Environment Variables** (`AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`) belong to the IAM user that has this policy, not an old key or a different user.
3. **`AWS_REGION`** — Must match the bucket’s region (same as the S3 hostname). Wrong region often shows up as signature or access errors.
4. **Bucket policy** — A **Deny** (or “KMS only”) on the bucket overrides broad IAM **Allow**s. Open **S3 → bucket → Permissions → Bucket policy** and look for `Deny`, `aws:kms`, or conditions on `s3:x-amz-server-side-encryption` that require **SSE-KMS** while the app uses **SSE-S3 (`AES256`)**. Align policy with the encryption mode you intend.
5. **Organization SCPs** — A service control policy can deny `s3:PutObject` even when IAM allows it.

## Next implementation tickets

Director invite + password-reset · Stripe phased invoices · DocuSign webhooks · strict project RBAC · S3 uploads · retention cron (90‑day director access / 36‑month purge).
