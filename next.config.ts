import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Attendance uploads send the workbook (base64, ~+33%) through a Server
    // Action; the default 1 MB cap is too small for real biometric exports.
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
