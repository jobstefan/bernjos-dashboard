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
    <div className="rounded-2xl border border-[#eae0d3] bg-white p-7 shadow-lg dark:border-white/10 dark:bg-[#2e2219] dark:shadow-2xl">
      <div className="mb-6 space-y-1">
        <h1 className="text-base font-semibold text-[#3a2c1e] dark:text-[#ede8dd]">
          Welcome back
        </h1>
        <p className="text-sm text-[#8a7c6b] dark:text-[#b5a898]">
          Development mode · Clerk bypassed
        </p>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        {/* Role picker */}
        <div className="grid gap-1.5">
          <label className="text-xs font-medium text-[#3a2c1e] dark:text-[#ede8dd]">
            Sign in as
          </label>
          <div className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={[
                  "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                  role === r
                    ? "border-[#e5a44a]/70 bg-[#e5a44a]/12 text-[#b5721a] dark:border-[#e5a44a]/60 dark:bg-[#e5a44a]/10 dark:text-[#e5a44a]"
                    : "border-[#eae0d3] text-[#8a7c6b] hover:border-[#d8ccbb] hover:text-[#3a2c1e] dark:border-white/10 dark:text-[#b5a898] dark:hover:border-white/20 dark:hover:text-[#ede8dd]",
                ].join(" ")}
              >
                {roleLabel(r)}
              </button>
            ))}
          </div>
        </div>

        {/* Password */}
        <div className="grid gap-1.5">
          <label
            htmlFor="dev-password"
            className="text-xs font-medium text-[#3a2c1e] dark:text-[#ede8dd]"
          >
            Password
          </label>
          <input
            id="dev-password"
            name="password"
            type="password"
            defaultValue="1234"
            autoComplete="off"
            className="w-full rounded-lg border border-[#e2d7c7] bg-[#fbf7f1] px-3 py-2.5 text-sm text-[#3a2c1e] placeholder:text-[#a89a87] outline-none ring-[#e5a44a]/50 transition focus:border-[#e5a44a]/60 focus:ring-2 dark:border-white/15 dark:bg-[#3a2c1e] dark:text-[#ede8dd] dark:placeholder:text-[#7a6e60]"
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/40 dark:bg-red-900/20 dark:text-red-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-[#e5a44a] px-4 py-2.5 text-sm font-semibold text-[#1e1610] transition hover:bg-[#d4913a] disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-[#a89a87] dark:text-[#7a6e60]">
        Password is{" "}
        <code className="font-mono text-[#8a7c6b] dark:text-[#b5a898]">1234</code>
      </p>
    </div>
  );
}
