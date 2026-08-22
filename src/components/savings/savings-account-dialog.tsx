"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertSavingsAccountAction } from "@/app/actions/savings.actions";
import type { SavingsAccountRow } from "@/lib/types/savings";

/**
 * Edit an employee's recurring savings contribution. Every employee is enrolled
 * automatically, so this only adjusts the amount for a fixed employee.
 */
export function SavingsAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account?: SavingsAccountRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState("");

  React.useEffect(() => {
    if (open) {
      setAmount(account ? String(account.contributionAmount) : "");
      setErrors({});
      setFormError(null);
    }
  }, [open, account]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!account) return;
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await upsertSavingsAccountAction({
        employeeId: account.employeeId,
        contributionAmount: amount,
      });
      if (res.success) {
        toast.success("Contribution updated.");
        onOpenChange(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit contribution</DialogTitle>
            <DialogDescription>
              The contribution is withheld from each payroll run and moved into
              the employee&apos;s savings account. It is not a payroll deduction.
            </DialogDescription>
          </DialogHeader>

          {formError ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Employee</Label>
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                {account?.employeeName} · {account?.employeeCode}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Contribution per pay period (₱)</Label>
              <Input
                type="number"
                min="100"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500.00"
              />
              <p className="text-xs text-muted-foreground">
                Minimum ₱100 per pay period.
              </p>
              {errors.contributionAmount?.length ? (
                <p className="text-xs text-destructive">
                  {errors.contributionAmount[0]}
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
