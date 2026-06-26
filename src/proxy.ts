import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed Middleware to "Proxy" (this file replaces middleware.ts).
// Clerk's clerkMiddleware() runs on every matched request and makes auth
// available throughout the app. To protect routes, use createRouteMatcher with
// auth().protect() — see https://clerk.com/docs/references/nextjs/clerk-middleware
export default clerkMiddleware();

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static files,
    // unless they appear as a search param.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
  ],
};
