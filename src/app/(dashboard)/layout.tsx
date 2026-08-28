import { getCurrentUser } from "@/lib/auth/current-user";
import { getActor, getCurrentRole } from "@/lib/auth/rbac";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { AppShell } from "@/components/shell/app-shell";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";
import type { Role } from "@/lib/types/payroll";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const devAuth = isDevAuthEnabled();

  // Clerk mode: force new employees through first-login onboarding (set a real
  // password) before any dashboard route is reachable. Render the flow INLINE
  // rather than redirecting — a server redirect issued during Clerk's post
  // sign-in soft navigation renders a blank page (only a hard refresh recovers).
  // Returning the onboarding UI as normal 200 content avoids that entirely.
  if (!devAuth) {
    const user = await getCurrentUser();
    if (user?.publicMetadata?.needsOnboarding === true) {
      return (
        <main className="flex min-h-svh items-center justify-center p-6">
          <OnboardingFlow />
        </main>
      );
    }
  }

  // Resolve role for the shell; tolerate an unreachable database.
  let role: Role = "employee";
  try {
    const actor = await getActor();
    role = actor.role;
  } catch {
    role = await getCurrentRole();
  }

  return (
    <AppShell role={role} devAuth={devAuth}>
      {children}
    </AppShell>
  );
}
