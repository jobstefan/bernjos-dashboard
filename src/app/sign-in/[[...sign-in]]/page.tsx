import { SignIn } from "@clerk/nextjs";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { DevSignIn } from "@/components/auth/dev-sign-in";
import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <AuthShell>
      {isDevAuthEnabled() ? (
        <DevSignIn />
      ) : (
        <SignIn fallbackRedirectUrl="/" appearance={clerkAppearance} />
      )}
    </AuthShell>
  );
}
