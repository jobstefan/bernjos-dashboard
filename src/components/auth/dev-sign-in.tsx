"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { devLoginAction } from "@/app/actions/dev-auth.actions";
import { roleLabel } from "@/components/layout/nav";
import type { Role } from "@/lib/types/payroll";

const ROLES: Role[] = ["super_admin", "admin", "manager", "employee"];

export function DevSignIn() {
  const router = useRouter();
  const [role, setRole] = React.useState<Role>("super_admin");
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    setError(null);
    startTransition(async () => {
      const res = await devLoginAction(role, password);
      if (res.success) {
        router.push("/");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-7 text-card-foreground shadow-warm-lg">
      <div className="mb-6 space-y-1">
        <h1 className="text-base font-semibold text-foreground">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Development mode · Clerk bypassed
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        {/* Role picker */}
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-foreground">Sign in as</label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={[
                  "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  role === r
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                ].join(" ")}
              >
                {roleLabel(r)}
              </button>
            ))}
          </div>
        </div>

        {/* Password */}
        <div className="grid gap-1.5">
          <label htmlFor="dev-password" className="text-xs font-medium text-foreground">
            Password
          </label>
          <input
            id="dev-password"
            name="password"
            type="password"
            defaultValue="1234"
            autoComplete="off"
            className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none ring-ring/50 transition focus:border-ring focus:ring-2"
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Password is <code className="font-mono text-foreground">1234</code>
      </p>
    </div>
  );
}
