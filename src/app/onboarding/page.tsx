import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";

export default async function OnboardingPage() {
  // Dev-cookie mode has no Clerk onboarding; nobody should land here.
  if (isDevAuthEnabled()) redirect("/");

  const user = await currentUser();
  if (!user) redirect("/sign-in");
  // Already onboarded (or an existing user) — skip straight to the dashboard.
  if (user.publicMetadata?.needsOnboarding !== true) redirect("/");

  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <OnboardingFlow />
    </main>
  );
}
