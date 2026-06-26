# Bernjos Dashboard

A dashboard application built with a modern, type-safe stack.

## Stack

| Concern              | Tool                                              |
| -------------------- | ------------------------------------------------- |
| Framework            | [Next.js 16](https://nextjs.org) (App Router)     |
| Language             | TypeScript                                        |
| Database             | PostgreSQL + [Prisma 7](https://www.prisma.io)    |
| Auth                 | [Clerk](https://clerk.com)                        |
| Validation           | [Zod](https://zod.dev)                            |
| UI                   | [shadcn/ui](https://ui.shadcn.com) + Tailwind v4  |
| Data grids           | [TanStack Table](https://tanstack.com/table)      |
| Charts               | [Recharts](https://recharts.org) (shadcn charts)  |
| Background jobs       | [Inngest](https://www.inngest.com)               |
| Package manager      | [pnpm](https://pnpm.io)                            |

## Prerequisites

- Node.js 20.9+ (Node 22 recommended)
- pnpm 10+
- A PostgreSQL database
- A [Clerk](https://dashboard.clerk.com) application (for auth keys)

## Getting started

1. **Install dependencies** (this also runs `prisma generate`):

   ```bash
   pnpm install
   ```

2. **Configure environment variables.** Copy the example file and fill it in:

   ```bash
   cp .env.example .env
   ```

   - `DATABASE_URL` — your PostgreSQL connection string.
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY` — from the Clerk dashboard.

3. **Set up the database.** After defining models in `prisma/schema.prisma`, create and apply a migration:

   ```bash
   pnpm db:migrate
   ```

4. **Run the app:**

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

5. **(Optional) Run the Inngest Dev Server** in a separate terminal to develop background jobs:

   ```bash
   pnpm inngest:dev
   ```

## Scripts

| Script               | Description                                   |
| -------------------- | --------------------------------------------- |
| `pnpm dev`           | Start the dev server                          |
| `pnpm build`         | Production build                              |
| `pnpm start`         | Run the production build                      |
| `pnpm lint`          | Lint with ESLint                              |
| `pnpm db:generate`   | Generate the Prisma client                    |
| `pnpm db:migrate`    | Create + apply a dev migration                |
| `pnpm db:deploy`     | Apply migrations (production)                 |
| `pnpm db:push`       | Push schema without a migration               |
| `pnpm db:studio`     | Open Prisma Studio                            |
| `pnpm inngest:dev`   | Start the Inngest Dev Server                   |

## Project structure

```
src/
  app/
    api/inngest/route.ts   # Inngest serve endpoint
    layout.tsx             # Root layout (ClerkProvider + Toaster)
    page.tsx
  components/ui/           # shadcn/ui components
  inngest/
    client.ts              # Inngest client
    functions.ts           # Inngest functions (registered in route.ts)
  lib/
    db.ts                  # Prisma client singleton (driver adapter)
    env.ts                 # Zod-validated environment variables
    utils.ts               # cn() helper
  generated/prisma/        # Generated Prisma client (gitignored)
  proxy.ts                 # Clerk auth (Next.js 16 "proxy", formerly middleware)
prisma/
  schema.prisma            # Database schema
prisma.config.ts           # Prisma CLI config (schema path, DATABASE_URL)
```

## Notes

- **Auth (`src/proxy.ts`)** — In Next.js 16, Middleware was renamed to **Proxy**, so Clerk's `clerkMiddleware()` lives in `proxy.ts`. Protect routes with `createRouteMatcher` + `auth().protect()`.
- **Database (Prisma 7)** — The runtime client connects through the `@prisma/adapter-pg` driver adapter (`src/lib/db.ts`); the connection URL is no longer stored in the schema. The CLI reads `DATABASE_URL` via `prisma.config.ts`. Import the client singleton from `@/lib/db`.
- **UI** — Add more components with `pnpm dlx shadcn@latest add <name>`. The sonner `<Toaster />` is mounted in the root layout (`toast()` from `sonner`).
- **Validation** — `src/lib/env.ts` validates environment variables with Zod; import `env` for typed, validated access.
