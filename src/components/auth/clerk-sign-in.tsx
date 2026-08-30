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
    <div className="rounded-2xl border border-white/10 bg-[#2e2219] p-7 shadow-2xl">
      <div className="mb-6 space-y-1">
        <h1 className="text-base font-semibold text-[#ede8dd]">Welcome back</h1>
        <p className="text-sm text-[#b5a898]">Sign in to your BernJos account</p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        {/* Username */}
        <div className="grid gap-1.5">
          <label htmlFor="username" className="text-xs font-medium text-[#ede8dd]">
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
              className="w-full rounded-lg border border-white/15 bg-[#3a2c1e] py-2.5 pl-9 pr-3 text-sm text-[#ede8dd] placeholder-[#7a6e60] outline-none ring-[#e5a44a]/50 transition focus:border-[#e5a44a]/60 focus:ring-2"
            />
            <User className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#7a6e60]" />
          </div>
        </div>

        {/* Password */}
        <div className="grid gap-1.5">
          <label htmlFor="password" className="text-xs font-medium text-[#ede8dd]">
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
              className="w-full rounded-lg border border-white/15 bg-[#3a2c1e] py-2.5 pl-9 pr-10 text-sm text-[#ede8dd] placeholder-[#7a6e60] outline-none ring-[#e5a44a]/50 transition focus:border-[#e5a44a]/60 focus:ring-2"
            />
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#7a6e60]" />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7a6e60] hover:text-[#b5a898]"
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
          <div className="flex items-start gap-2 rounded-lg border border-red-800/40 bg-red-900/20 px-3 py-2 text-sm text-red-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending || !username || !password}
          className="w-full rounded-lg bg-[#e5a44a] px-4 py-2.5 text-sm font-semibold text-[#1e1610] transition hover:bg-[#d4913a] disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-[#7a6e60]">
        Trouble signing in? Contact your administrator.
      </p>
    </div>
  );
}
