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
import {
  approveCashAdvanceAction,
  declineCashAdvanceAction,
} from "@/app/actions/cash-advance.actions";
import { formatPeso } from "@/lib/utils/payroll";
import type { CashAdvanceRow } from "@/lib/types/payroll";
import type { BranchOption } from "@/components/cash-advances/admin-create-cash-advance-button";

export function ApproveDialog({
  advance,
  onOpenChange,
  branches = [],
}: {
  advance: CashAdvanceRow | null;
  onOpenChange: (open: boolean) => void;
  branches?: BranchOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState<string>("");
  const [branchId, setBranchId] = React.useState<string>("");

  React.useEffect(() => {
    if (advance) {
      setAmount(String(advance.amount));
      setBranchId(advance.branchId ?? "");
      setError(null);
    }
  }, [advance]);

  const changed = advance !== null && Number(amount) !== advance.amount;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!advance) return;
    const form = new FormData(e.currentTarget);
    const input = {
      id: advance.id,
      branchId,
      approvedAmount: String(form.get("approvedAmount") ?? ""),
      note: String(form.get("note") ?? ""),
    };
    setError(null);
    startTransition(async () => {
      const res = await approveCashAdvanceAction(input);
      if (res.success) {
        toast.success("Cash advance approved.");
        onOpenChange(false);
        router.refresh();
      } else {
        setError(
          res.fieldErrors?.approvedAmount?.[0] ??
            res.fieldErrors?.note?.[0] ??
            res.error,
        );
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={advance !== null}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Approve cash advance</DialogTitle>
            <DialogDescription>
              {advance
                ? `${advance.employeeName} requested ${formatPeso(advance.amount)}. The approved amount below is what gets deducted from their next calculated payroll.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {branches.length > 0 && (
              <div className="grid gap-2">
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={(v) => v && setBranchId(v)}>
                  <SelectTrigger className="w-full">
                    {branchId ? (
                      <span>{branches.find((b) => b.id === branchId)?.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Select branch…</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Approved amount (₱)</Label>
              <Input
                name="approvedAmount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>{changed ? "Note (required)" : "Note (optional)"}</Label>
              <Textarea
                name="note"
                placeholder={
                  changed
                    ? "Explain why the approved amount differs from the request"
                    : "Add an approval note if needed"
                }
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || (branches.length > 0 && !branchId)}>
              {pending ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeclineDialog({
  advance,
  onOpenChange,
}: {
  advance: CashAdvanceRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!advance) return;
    const form = new FormData(e.currentTarget);
    const input = { id: advance.id, reason: String(form.get("reason") ?? "") };
    setError(null);
    startTransition(async () => {
      const res = await declineCashAdvanceAction(input);
      if (res.success) {
        toast.success("Cash advance declined.");
        onOpenChange(false);
        router.refresh();
      } else {
        setError(res.fieldErrors?.reason?.[0] ?? res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={advance !== null}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Decline cash advance</DialogTitle>
            <DialogDescription>
              {advance
                ? `${advance.employeeName} · ${formatPeso(advance.amount)}. Please provide a reason — the employee will see it.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label>Reason</Label>
            <Textarea name="reason" placeholder="Why is this request being declined?" />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={pending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {pending ? "Declining…" : "Decline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
