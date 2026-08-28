import { getCurrentUser } from "@/lib/auth/current-user";
import { getActor, getCurrentRole } from "@/lib/auth/rbac";

import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { AppShell } from "@/components/shell/app-shell";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";
import { AuthShell } from "@/components/auth/auth-shell";
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
        <AuthShell>
          <OnboardingFlow />
        </AuthShell>
      );
    }
  }

  // Resolve role + display name for the shell; tolerate an unreachable database.
  let role: Role = "employee";
  let displayName = "";
  try {
    const actor = await getActor();
    role = actor.role;
    if (!devAuth) {
      const clerkUser = await getCurrentUser();
      displayName =
        clerkUser?.fullName ??
        clerkUser?.firstName ??
        actor.email ??
        "";
    } else {
      displayName = actor.email ?? "";
    }
  } catch {
    role = await getCurrentRole();
  }

  return (
    <AppShell role={role} devAuth={devAuth} displayName={displayName}>
      {children}
    </AppShell>
  );
}
