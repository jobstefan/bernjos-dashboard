"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSignIn } from "@clerk/nextjs";
import { User, KeyRound, Eye, EyeOff, AlertCircle } from "lucide-react";

/**
 * Custom username + password sign-in built on Clerk's headless `useSignIn`
 * (the signals / "Future" API), styled to match the onboarding / dev-login
 * cards. We roll our own form (rather than Clerk's prebuilt <SignIn />) so the
 * UI stays on-brand and only asks for a username — employees have no email. On
 * success we land on `/`; the dashboard layout handles the first-login
 * onboarding gate from there.
 */
export function ClerkSignIn() {
  const router = useRouter();
  const { signIn } = useSignIn();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    // Submit the password for the given username.
    const { error: pwError } = await signIn.password({
      identifier: username.trim(),
      password,
    });
    if (pwError) {
      setError(pwError.longMessage ?? pwError.message);
      setPending(false);
      return;
    }

    // Activate the new session and navigate to the dashboard. `finalize`
    // errors if the sign-in isn't complete (e.g. MFA), which we surface.
    const { error: finalizeError } = await signIn.finalize({
      navigate: () => router.push("/"),
    });
    if (finalizeError) {
      setError(finalizeError.longMessage ?? finalizeError.message);
      setPending(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-warm-lg">
      <div className="mb-6 space-y-1">
        <h1 className="text-base font-semibold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your BernJos account
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        {/* Username */}
        <div className="grid gap-1.5">
          <label htmlFor="username" className="text-xs font-medium text-foreground">
            Username
          </label>
          <div className="relative">
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-ring/50 transition focus:border-ring focus:ring-2"
            />
            <User className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        {/* Password */}
        <div className="grid gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-foreground">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-ring/50 transition focus:border-ring focus:ring-2"
            />
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </button>
          </div>
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending || !username || !password}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Trouble signing in? Contact your administrator.
      </p>
    </div>
  );
}
