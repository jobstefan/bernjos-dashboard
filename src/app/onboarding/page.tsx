import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { OnboardingFlow } from "@/components/auth/onboarding-flow";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function OnboardingPage() {
  if (isDevAuthEnabled()) redirect("/");

  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.publicMetadata?.needsOnboarding !== true) redirect("/");

  return (
    <AuthShell>
      <OnboardingFlow />
    </AuthShell>
  );
}
