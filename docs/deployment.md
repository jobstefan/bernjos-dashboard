# Deployment & Environments

This project runs in **three isolated tiers**, each with its own database. Deploys
are fully automatic — you never run a deploy command by hand.

| Tier | Git branch | Deploys to | Database | Clerk |
|------|-----------|-----------|----------|-------|
| **Local dev** | your working tree | `pnpm dev` | Docker Postgres (`127.0.0.1:54332`) | dev keys / `DEV_AUTH` |
| **Staging / UAT** | `staging` | Vercel "Staging" environment | Neon **staging** DB | Clerk **development** instance |
| **Production** | `main` | Vercel Production | Neon **production** DB | Clerk **production** instance |

## Day-to-day flow

```
work locally  →  push to `staging`  →  test on the Staging URL  →  PR staging → main  →  merge → Production
```

1. **Push to `staging`.** Vercel builds the Staging environment, applies any new
   migrations to the **staging** Neon DB, and deploys. Test on the staging URL.
2. **Open a PR from `staging` into `main`.** Review the diff.
3. **Merge the PR.** Vercel redeploys Production and applies migrations to the
   **production** Neon DB.

### Why databases update automatically

`vercel.json`'s build command is:

```
pnpm run db:generate && pnpm run db:deploy && pnpm run build
```

`db:deploy` (`prisma migrate deploy`) applies pending migrations over that
environment's **`DIRECT_URL`** (see connection split below). So a Staging build
migrates the staging DB and a Production build migrates the production DB — no
branching logic needed. Because production already has every migration applied,
the first prod build after enabling this is a no-op.

### Connection split: pooled vs direct

Each cloud environment has **two** Neon connection strings:

| Variable | Endpoint | Used by |
|----------|----------|---------|
| `DATABASE_URL` | **pooled** (`-pooler` host) | the app at runtime (`src/lib/db.ts`) — pooling suits serverless |
| `DIRECT_URL` | **direct** (no `-pooler`) | migrations (`prisma.config.ts`) and seeds — need a real session |

Prisma's migration engine can't run over a PgBouncer pool (it needs advisory
locks + DDL), so migrations use `DIRECT_URL`. Both fall back to `DATABASE_URL`
when `DIRECT_URL` is unset — which is why **local dev only needs `DATABASE_URL`**
(Docker has no pooler).

> **Migrations must be non-destructive.** They run during the build, before the
> new code goes live. Prefer additive changes; avoid dropping columns the current
> production code still reads.

## One-time setup

### 1. Neon — create the staging database
Create a new **empty** Neon database (a separate project or a fresh branch — do
**not** copy production data; staging must contain no real employee PII). Copy its
**direct (non-pooled)** connection string.

### 2. Clerk — split instances
- **Production instance** → production keys, used by the Vercel Production env.
- **Development instance** (the existing `pk_test_` / `sk_test_` keys) → used by
  the Vercel Staging env.

### 3. Vercel — environments & variables
On the free (Hobby) plan there are no named custom environments — use the built-in
**Preview** environment as staging. Every push to `staging` creates a Preview
deployment (stable URL `…-git-staging-<scope>.vercel.app`); production stays on
`main`.

Set variables **per scope** (Project → Settings → Environment Variables). Each
`DATABASE_URL` / `DIRECT_URL` is a **separate row** — a Production row has no Git
Branch; a Preview row can be scoped to the `staging` branch. Don't reuse one row
across scopes (editing its scope silently repurposes the value).

| Variable | Production (no branch) | Preview (branch `staging`) |
|----------|------------------------|----------------------------|
| `DATABASE_URL` | prod Neon **pooled** | staging Neon **pooled** |
| `DIRECT_URL` | prod Neon **direct** | staging Neon **direct** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk prod (`pk_…`) | Clerk dev (`pk_test_…`) |
| `CLERK_SECRET_KEY` | Clerk prod (`sk_…`) | Clerk dev (`sk_test_…`) |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | prod keys | staging keys |

Leave `DEV_AUTH` and `PAYROLL_RBAC_BYPASS` set to **`false`** in both so real
Clerk auth and RBAC are enforced.

### 4. Git — create the staging branch
```
git switch -c staging
git push -u origin staging
```

### 5. Seed the staging database (once)
Migrations create the schema on first deploy; load sample (non-PII) data with the
staging **direct** URL (migrations/seeds prefer `DIRECT_URL`):
```
DIRECT_URL="<staging-direct-url>" pnpm db:deploy       # schema (also runs on deploy)
DIRECT_URL="<staging-direct-url>" pnpm db:seed
DIRECT_URL="<staging-direct-url>" pnpm db:seed:users
```

## Local development

```
pnpm db:local:up                 # start Docker Postgres
pnpm db:deploy && pnpm db:seed   # first time: create + populate local schema
pnpm dev
```

Your local `.env` `DATABASE_URL` points at Docker, so local work never touches the
staging or production databases.
