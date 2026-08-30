"use client";

import * as React from "react";
import { Eye, EyeOff, KeyRound, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  setNewPasswordAction,
  completeOnboardingAction,
} from "@/app/actions/onboarding.actions";

function StrengthBar({ password }: { password: string }) {
  const score =
    (password.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(password) ? 1 : 0) +
    (/[0-9]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0);

  const colors = ["bg-red-500", "bg-orange-400", "bg-amber-400", "bg-green-400"];
  const labels = ["Weak", "Fair", "Good", "Strong"];

  if (!password) return null;

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={[
              "h-1 flex-1 rounded-full transition-colors",
              i < score ? colors[score - 1] : "bg-border",
            ].join(" ")}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{labels[score - 1] ?? ""}</p>
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  label,
  autoComplete,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoComplete: string;
}) {
  const [show, setShow] = React.useState(false);
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          className="w-full rounded-lg border border-input bg-background py-2.5 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-ring/50 transition focus:border-ring focus:ring-2"
          placeholder="••••••••"
        />
        <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
        </button>
      </div>
    </div>
  );
}

export function OnboardingFlow() {
  const [pending, setPending] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  const mismatch = confirm.length > 0 && password !== confirm;

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setPending(true);
    const res = await setNewPasswordAction(password);
    if (!res.success) {
      setError(res.error);
      setPending(false);
      return;
    }
    const done = await completeOnboardingAction();
    if (!done.success) {
      setError(done.error);
      setPending(false);
      return;
    }
    setDone(true);
    // Hard navigation — reliably re-reads cleared onboarding flag server-side.
    window.location.href = "/";
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-warm-lg">
      <div className="mb-6 space-y-1">
        <h1 className="text-base font-semibold text-foreground">Create your password</h1>
        <p className="text-sm text-muted-foreground">
          Replace the temporary password you were given to finish signing in.
        </p>
      </div>

      {done ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="size-8 text-green-500" />
          <p className="text-sm text-foreground">Password set! Taking you to the dashboard…</p>
        </div>
      ) : (
        <form onSubmit={onPassword} className="grid gap-4">
          <div>
            <PasswordInput
              id="password"
              label="New password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
            />
            <StrengthBar password={password} />
          </div>

          <div>
            <PasswordInput
              id="confirm"
              label="Confirm password"
              autoComplete="new-password"
              value={confirm}
              onChange={setConfirm}
            />
            {mismatch ? (
              <p className="mt-1 text-xs text-destructive">Passwords don't match.</p>
            ) : null}
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={pending || mismatch || !password || !confirm}
            className="mt-1 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Finish setup"}
          </button>
        </form>
      )}
    </div>
  );
}
