"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  setNewPasswordAction,
  completeOnboardingAction,
} from "@/app/actions/onboarding.actions";

export function OnboardingFlow() {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

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
    // Password set — clear the onboarding flag and land on the dashboard.
    const done = await completeOnboardingAction();
    if (!done.success) {
      setError(done.error);
      setPending(false);
      return;
    }
    // Hard navigation (not router.push): a soft RSC navigation here stalls, and
    // a full load reliably re-reads the cleared onboarding flag on the server.
    // Keep `pending` true — the page is reloading.
    window.location.href = "/";
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Create your password</CardTitle>
        <CardDescription>
          Replace the temporary password you were given to finish signing in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        ) : null}

        <form onSubmit={onPassword} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="password">New password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving…" : "Finish setup"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
