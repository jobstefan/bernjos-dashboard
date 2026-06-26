import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { functions } from "@/inngest/functions";

// Inngest serve endpoint. Point the Inngest Dev Server / Cloud at /api/inngest.
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions,
});
