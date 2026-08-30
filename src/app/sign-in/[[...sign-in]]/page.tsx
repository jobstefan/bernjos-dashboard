import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { DevSignIn } from "@/components/auth/dev-sign-in";
import { ClerkSignIn } from "@/components/auth/clerk-sign-in";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignInPage() {
  return (
    <AuthShell>{isDevAuthEnabled() ? <DevSignIn /> : <ClerkSignIn />}</AuthShell>
  );
}
