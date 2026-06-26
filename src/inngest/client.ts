import { Inngest } from "inngest";

// Single Inngest client for the app. The `id` identifies this app in Inngest.
export const inngest = new Inngest({ id: "bernjos-dashboard" });
