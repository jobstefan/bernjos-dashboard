import { NextRequest, NextResponse } from "next/server";

// Next.js 16 renamed Middleware to "Proxy" (this file replaces middleware.ts).
// Everything except the sign-in/sign-up routes and public assets requires auth.
const PUBLIC_PATHS = [/^\/sign-in/, /^\/sign-up/, /^\/api\/inngest/];

function isPublicRoute(req: NextRequest) {
  return PUBLIC_PATHS.some((p) => p.test(req.nextUrl.pathname));
}

// Kept in sync with DEV_SESSION_COOKIE in src/lib/auth/dev-session.ts. Inlined
// here (not imported) so this edge middleware avoids pulling in next/headers.
const DEV_SESSION_COOKIE = "dev_session";

export default function middleware(req: NextRequest) {
  if (isPublicRoute(req)) return NextResponse.next();
  if (!req.cookies.get(DEV_SESSION_COOKIE)) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static files,
    // unless they appear as a search param.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
