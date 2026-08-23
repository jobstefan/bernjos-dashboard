import { currentUser } from "@clerk/nextjs/server";
import { getCurrentRole } from "@/lib/auth/rbac";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { Sidebar, MobileTopbar } from "@/components/layout/sidebar";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";

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
    const user = await currentUser();
    if (user?.publicMetadata?.needsOnboarding === true) {
      return (
        <main className="flex min-h-svh items-center justify-center p-6">
          <OnboardingFlow />
        </main>
      );
    }
  }

  const role = await getCurrentRole();

  return (
    <div className="min-h-screen bg-background">
      <Sidebar role={role} devAuth={devAuth} />
      <div className="md:pl-64">
        <MobileTopbar role={role} devAuth={devAuth} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
