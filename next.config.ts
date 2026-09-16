import type { NextConfig } from "next";

// When the app is accessed through a forwarded port (VS Code devtunnels, ngrok,
// etc.) the tunnel proxy injects x-forwarded-host with the public URL while
// the browser's Origin header stays "localhost:3000". Next.js's server-action
// CSRF check compares those two and rejects the mismatch.
//
// Fix: add the Origin value the browser actually sends to allowedOrigins so
// Next.js lets it through. In practice that is always "localhost:3000" when
// the tunnel rewrites the host header.
//
// SERVER_ACTION_ALLOWED_ORIGIN can be a comma-separated list if you need to
// whitelist more origins (e.g. the tunnel URL itself if your proxy keeps it).
const extraOrigins: string[] = [
  // Always allow localhost in development — needed when any reverse proxy /
  // tunnel injects x-forwarded-host and breaks the default host comparison.
  ...(process.env.NODE_ENV === "development"
    ? ["localhost:3000", "http://localhost:3000"]
    : []),
  // Any additional origins configured explicitly.
  ...(process.env.SERVER_ACTION_ALLOWED_ORIGIN
    ? process.env.SERVER_ACTION_ALLOWED_ORIGIN
        .split(",")
        .map((o) => o.trim().replace(/\/$/, ""))
        .filter(Boolean)
    : []),
];

const nextConfig: NextConfig = {
  experimental: {
    // Attendance uploads send the workbook (base64, ~+33%) through a Server
    // Action; the default 1 MB cap is too small for real biometric exports.
    serverActions: {
      bodySizeLimit: "10mb",
      ...(extraOrigins.length > 0 && { allowedOrigins: extraOrigins }),
    },
  },
};

export default nextConfig;
