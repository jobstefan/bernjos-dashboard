"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordSavingsAdjustmentAction } from "@/app/actions/savings.actions";
import { formatPeso } from "@/lib/utils/payroll";
import type { SavingsAccountRow } from "@/lib/types/savings";

/** Admin records a manual withdrawal (money paid out) or a positive adjustment. */
export function SavingsAdjustmentDialog({
  account,
  onOpenChange,
}: {
  account: SavingsAccountRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [type, setType] = React.useState<"withdrawal" | "adjustment">(
    "withdrawal",
  );
  const [amount, setAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (account) {
      setType("withdrawal");
      setAmount("");
      setError(null);
    }
  }, [account]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!account) return;
    const form = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await recordSavingsAdjustmentAction({
        employeeId: account.employeeId,
        type,
        amount,
        note: String(form.get("note") ?? ""),
      });
      if (res.success) {
        toast.success(
          type === "withdrawal" ? "Withdrawal recorded." : "Adjustment recorded.",
        );
        onOpenChange(false);
        router.refresh();
      } else {
        setError(res.fieldErrors?.amount?.[0] ?? res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Record savings activity</DialogTitle>
            <DialogDescription>
              {account
                ? `${account.employeeName} · balance ${formatPeso(account.balance)}.`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select
                value={type}
                onValueChange={(v) =>
                  setType((v as "withdrawal" | "adjustment") ?? "withdrawal")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) =>
                      value === "adjustment"
                        ? "Adjustment — add a credit correction"
                        : "Withdrawal — pay out to employee"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="withdrawal">
                    Withdrawal — pay out to employee
                  </SelectItem>
                  <SelectItem value="adjustment">
                    Adjustment — add a credit correction
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Amount (₱)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              {error ? (
                <p className="text-xs text-destructive">{error}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Note (optional)</Label>
              <Textarea name="note" placeholder="Reference or reason" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
