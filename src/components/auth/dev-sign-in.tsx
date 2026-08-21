"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-lg bg-[#2563EB] text-white">
          <ShieldCheck className="size-5" />
        </div>
        <div className="leading-tight">
          <div className="text-base font-semibold">Bernjos Payroll</div>
          <div className="text-xs text-muted-foreground">Development login</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid gap-2">
          <Label>Sign in as</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Password</Label>
          <Input
            name="password"
            type="password"
            defaultValue="1234"
            placeholder="Password"
            autoComplete="off"
          />
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Dev mode — Clerk is bypassed. Password is <code>1234</code>.
      </p>
    </div>
  );
}
