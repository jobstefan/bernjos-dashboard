import { SignIn } from "@clerk/nextjs";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { DevSignIn } from "@/components/auth/dev-sign-in";

export default function SignInPage() {
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      {isDevAuthEnabled() ? <DevSignIn /> : <SignIn />}
    </main>
  );
}
