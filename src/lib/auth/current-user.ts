import "server-only";
import { cache } from "react";
import { currentUser } from "@clerk/nextjs/server";

/**
 * Request-scoped cache around Clerk's `currentUser()`. Clerk fetches the user
 * from its Backend API on every call with no internal dedup, so a single
 * dashboard render otherwise fires 4 identical round-trips. `cache()` collapses
 * them into one per server request.
 */
export const getCurrentUser = cache(() => currentUser());
