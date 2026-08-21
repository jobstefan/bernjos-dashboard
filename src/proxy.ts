import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Next.js 16 renamed Middleware to "Proxy" (this file replaces middleware.ts).
// Everything except the sign-in/sign-up routes and public assets requires auth.
const isPublicRoute = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/inngest(.*)",
]);

// Kept in sync with DEV_SESSION_COOKIE in src/lib/auth/dev-session.ts. Inlined
// here (not imported) so this edge middleware avoids pulling in next/headers.
const DEV_SESSION_COOKIE = "dev_session";

// Clerk middleware stays mounted (so Clerk stays happy), but when DEV_AUTH is on
// we gate on the dev-session cookie instead of Clerk and never call auth.protect.
export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;

  if (process.env.DEV_AUTH === "true") {
    if (!req.cookies.get(DEV_SESSION_COOKIE)) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
    return;
  }

  await auth.protect();
});

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static files,
    // unless they appear as a search param.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
