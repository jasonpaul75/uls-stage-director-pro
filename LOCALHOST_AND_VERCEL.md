# Local hosting and Vercel deployment (reference)

This note is tailored to **ULS Stage Director Pro**: the Next.js app lives in the **`web/`** folder (`package.json`, `next.config.ts`, Prisma schema). Run installs and scripts from **`web/`**, not from the repo root unless you deliberately wrap them.

---

## Part 1 — Run the app on your machine (“localhost”)

### 1. Prerequisites

- **Git** installed.
- **Node.js** — use an LTS version compatible with Next 16 / this repo (check Vercel or `web/package.json` if you pin a version elsewhere).
- **npm** — this repo uses **`web/package-lock.json`** (npm, not necessarily pnpm).

### 2. Clone and enter the app directory

```bash
git clone <your-repo-url>
cd "<path-to-repo>/web"
```

All commands below assume your shell’s current directory is **`web/`**.

### 3. Install dependencies

```bash
npm install
```

Generate the Prisma client (needed before **`next dev`** or **`next build`**):

```bash
npx prisma generate
```

### 4. Environment variables

Copy the example env and edit locally (never commit real secrets):

```bash
copy .env.example .env
```

Minimum for a basic boot (see **`web/.env.example`** for the full list and comments):

- **`DATABASE_URL`** — PostgreSQL connection string (RDS or local Postgres).
- **`AUTH_SECRET`** — long random string (Auth.js requirement).

Restore anything else your features need (Stripe, SES, S3, DocuSign, etc.) using **`.env.example`** as the checklist.

**LAN / alternate host:** If you open dev from another machine (e.g. `http://172.20.x.x:3000`), you may need **`NEXT_ALLOWED_DEV_ORIGINS`** — see **`web/.env.example`**.

### 5. Database migrations (local/staging DB)

Against the database **`DATABASE_URL`** points to:

- **Fresh schema from repo migrations:**

  ```bash
  npm run db:migrate:dev
  ```

  (`prisma migrate dev` — applies migrations and updates dev history.)

- **Production-style apply only (CI / ops):**

  ```bash
  npm run db:migrate
  ```

  (`prisma migrate deploy` — does **not** create new migrations.)

### 6. Start the dev server

```bash
npm run dev
```

Default URL: **`http://localhost:3000`**.

Optional Turbopack dev (if you prefer):

```bash
npm run dev:turbo
```

### 7. Quick validation before committing

From **`web/`**:

```bash
npm run lint
npm run test
npm run build
```

Fix failures locally before pushing.

---

## Part 2 — Push your changes with Git (“push changes”)

### 1. See what changed

```bash
cd "<path-to-repo>"
git status
```

### 2. Stage and commit (from repo root)

```bash
git add .
git commit -m "Clear, specific message describing the change."
```

Commit from **repo root** or **`web/`** — either works; **`git`** tracks the whole monorepo if that’s how the project is set up.

### 3. Push to your remote (GitHub/GitLab/etc.)

Ensure **`origin`** is set (`git remote -v`):

```bash
git push origin <branch-name>
```

Examples:

```bash
git push origin main
git push origin feature/diagram-peer-snap
```

**First push for a new branch:**

```bash
git push -u origin <branch-name>
```

---

## Part 3 — Deploy on Vercel

Vercel deploys **from Git** by default: each push can trigger an automatic **Production** deploy (configured branch, often `main`) and **Preview** deploys for other branches and PRs.

### 1. One-time project setup

1. Sign in at [vercel.com](https://vercel.com) (GitHub/GitLab SSO is typical).
2. **Add New → Project** and **import your Git repository**.
3. **Root Directory**: set to **`web`** (critical — Next app is not at repo root).
4. Framework preset: **Next.js** (Vercel should detect).

### 2. Build & install commands (recommended)

Still in Project **Settings → General → Build & Development**:

- **Install Command:** default **`npm install`** (from `web/`) is fine.
- **Build Command:** Prisma client is not auto-generated unless you wire it — use:

  ```bash
  npx prisma generate && npm run build
  ```

Adjust only if your team agrees on something else.

**Output Directory:** Next default (leave as `.next` / Framework default unless you customized).

### 3. Environment variables on Vercel

In **Project → Settings → Environment Variables**, recreate what you rely on locally, per environment (**Production**, **Preview**, **Development**) as needed:

- **`DATABASE_URL`**, **`AUTH_SECRET`** (required baseline).
- Copy the rest from **`web/.env.example`** (Stripe, SES, S3 prefixes, OAuth/DocuSign, `APP_BASE_URL` for prod, etc.).

**Rule of thumb:** production **`APP_BASE_URL`** should be your real site URL (`https://…`), not localhost.

Secrets must **never** be committed — only pasted in Vercel (or pulled from Vercel’s integrations).

### 4. Database migrations in production

`prisma migrate deploy` **does not** have to run on every preview build unless you automate it. Typical patterns:

- Run **`npm run db:migrate`** manually (or via a trusted CI job) **when you ship schema changes**, against the production **`DATABASE_URL`**, **before** or **right after** deploying code that expects the new columns.

Skipping this when migrations landed in `web/prisma/migrations/` is a common source of runtime errors after deploy.

### 5. What happens after you **`git push`**

- Push to **`main`** (or whatever you set as **Production Branch**): Vercel runs install + build → **Production** deployment.
- Push other branches / open PRs: **Preview** URLs (unique per deployment).

Rollback: Vercel **Deployments** tab → redeploy or promote an older successful deployment.

### 6. Sanity check after deploy

- Open Production / Preview URL.
- Smoke-test login and one critical flow.
- Tail **Logs** in Vercel if something fails (build vs runtime clearly separated there).

---

## Troubleshooting snippets

| Symptom | Things to verify |
|--------|-------------------|
| **Build fails — Prisma** | Build command includes **`npx prisma generate`**; **`DATABASE_URL`** not required only for generate, but migrations must match deployed code. |
| **Auth/session errors** | **`AUTH_SECRET`** set on Vercel; same app not mixing localhost cookies with prod domain. |
| **API 403 / CORS / LAN** | Local LAN: **`NEXT_ALLOWED_DEV_ORIGINS`**; prod: **`APP_BASE_URL`** and HTTPS. |
| **S3 signing errors** | See comments in **`web/.env.example`** (region, keys without stray quotes/newlines, SDK version notes). |

---

## One-line mental model

- **localhost:** install in **`web/`**, **`.env`**, **`prisma generate`**, migrate if needed, **`npm run dev`**, **`git`** from repo root.  
- **Vercel:** connect repo, **Root Directory = `web`**, **`npx prisma generate && npm run build`**, paste env vars, **`git push`** → deploy.

For deeper product semantics, keep **`ULS_Stage_Director_PRO.md`** and **`web/.env.example`** as sources of truth.
