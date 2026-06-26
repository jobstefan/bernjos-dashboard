<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project: Bernjos Dashboard

Dashboard app. Package manager is **pnpm**. Stack and conventions:

- **Framework**: Next.js 16 (App Router, `src/` dir). Middleware is now `proxy.ts` — auth runs in `src/proxy.ts`.
- **Auth**: Clerk (`@clerk/nextjs` v7). `<ClerkProvider>` wraps the app in `src/app/layout.tsx`. Protect routes in `src/proxy.ts` with `createRouteMatcher` + `auth().protect()`.
- **Database**: PostgreSQL + Prisma 7. Schema: `prisma/schema.prisma`. The connection URL lives in `prisma.config.ts` (CLI) and is passed to the runtime client via the `@prisma/adapter-pg` driver adapter in `src/lib/db.ts`. The client is generated to `src/generated/prisma` (gitignored) — run `pnpm db:generate` after editing the schema. Import the singleton from `@/lib/db`.
- **Validation**: Zod 4. Server-side env validation in `src/lib/env.ts`.
- **UI**: shadcn/ui (Base UI primitives, `base-nova` style) + Tailwind v4. Components live in `src/components/ui`; add more with `pnpm dlx shadcn@latest add <name>`. The sonner `<Toaster />` is mounted in the root layout.
- **Data grids**: TanStack Table (`@tanstack/react-table`).
- **Charts**: Recharts via shadcn's `chart` component (`src/components/ui/chart.tsx`).
- **Background jobs**: Inngest. Client: `src/inngest/client.ts`; functions: `src/inngest/functions.ts`; served at `src/app/api/inngest/route.ts`. Run `pnpm inngest:dev` next to `pnpm dev`.

Common commands: `pnpm dev`, `pnpm build`, `pnpm db:migrate`, `pnpm db:studio`, `pnpm db:generate`, `pnpm inngest:dev`.
