import { NextRequest, NextResponse } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed Middleware to "Proxy" (this file replaces middleware.ts).
// Everything except the sign-in route and public assets requires auth.
// (No self-service sign-up — employees are provisioned by admins.)
const PUBLIC_PATHS = [/^\/sign-in/, /^\/api\/inngest/];

function isPublicRoute(req: NextRequest) {
  return PUBLIC_PATHS.some((p) => p.test(req.nextUrl.pathname));
}

// Kept in sync with DEV_SESSION_COOKIE in src/lib/auth/dev-session.ts. Inlined
// here (not imported) so this edge middleware avoids pulling in next/headers.
const DEV_SESSION_COOKIE = "dev_session";

// Local dev-login mode: a trivial cookie-presence check, no Clerk involved.
function devMiddleware(req: NextRequest) {
  if (isPublicRoute(req)) return NextResponse.next();
  if (!req.cookies.get(DEV_SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
  return NextResponse.next();
}

// Clerk mode: MUST run clerkMiddleware so the request carries Clerk auth context
// — otherwise `auth()`/`currentUser()` in server components and actions throw
// "auth() was called but Clerk can't detect usage of clerkMiddleware()".
// `auth.protect()` handles the redirect to /sign-in for unauthenticated users.
const clerkAuthMiddleware = clerkMiddleware(async (auth, req) => {
  // Redirect unauthenticated users to our own /sign-in page rather than Clerk's
  // hosted Account Portal (…accounts.dev). Without `unauthenticatedUrl`,
  // `protect()` falls back to the Account Portal; the <ClerkProvider signInUrl>
  // prop only affects client-side redirects, not this edge middleware.
  if (!isPublicRoute(req)) {
    await auth.protect({
      unauthenticatedUrl: new URL("/sign-in", req.url).toString(),
    });
  }
});

// Pick the middleware at module load. `DEV_AUTH` is read from the environment
// once, so switching it requires a dev-server restart.
export default process.env.DEV_AUTH === "true"
  ? devMiddleware
  : clerkAuthMiddleware;

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static files,
    // unless they appear as a search param.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Required for Clerk's auto-proxy on *.vercel.app domains.
    "/__clerk/:path*",
  ],
};
