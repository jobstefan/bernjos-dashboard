/**
 * Kiosk surface (§5.0) — a distinct top-level route group with its own shell.
 * It deliberately does NOT render the dashboard's HR navigation (payslips,
 * schedule, attendance, self-service). Authentication still comes from the
 * existing employee accounts via the proxy; only the surface is separate.
 *
 * The root layout (src/app/layout.tsx) already supplies <html>/<body>,
 * ClerkProvider, and the Toaster, so this layout only frames kiosk content.
 */
export const metadata = {
  manifest: "/kiosk.webmanifest",
};

export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-muted/30 text-foreground">
      {children}
    </div>
  );
}
