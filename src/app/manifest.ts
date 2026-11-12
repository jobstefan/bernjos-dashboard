import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BernJos Dashboard",
    short_name: "BernJos",
    description:
      "BernJos Bread & Pastries — payroll, people, time & finance in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#1c1917",
    theme_color: "#f97316",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
