import { SignIn } from "@clerk/nextjs";
import { isDevAuthEnabled } from "@/lib/auth/dev-session";
import { DevSignIn } from "@/components/auth/dev-sign-in";
import { AuthShell } from "@/components/auth/auth-shell";

const clerkAppearance = {
  variables: {
    colorPrimary: "#e5a44a",
    colorBackground: "#2e2219",
    colorText: "#ede8dd",
    colorTextSecondary: "#b5a898",
    colorInputBackground: "#3a2c1e",
    colorInputText: "#ede8dd",
    colorDanger: "#c0432e",
    borderRadius: "0.625rem",
    fontFamily: "inherit",
    fontSize: "0.9375rem",
  },
  elements: {
    card: "shadow-2xl !border !border-white/10",
    headerTitle: "!text-[#ede8dd]",
    headerSubtitle: "!text-[#b5a898]",
    socialButtonsBlockButton: "!border-white/15 hover:!border-white/30",
    dividerLine: "!bg-white/10",
    dividerText: "!text-[#b5a898]",
    formFieldLabel: "!text-[#ede8dd]",
    footerActionText: "!text-[#b5a898]",
    footerActionLink: "!text-[#e5a44a] hover:!text-[#d4913a]",
  },
};

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
