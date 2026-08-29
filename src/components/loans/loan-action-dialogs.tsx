"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  approveLoanAction,
  cancelLoanAction,
  declineLoanAction,
  disburseLoanAction,
} from "@/app/actions/loan.actions";
import { formatPeso } from "@/lib/utils/payroll";
import type { LoanRow } from "@/lib/types/loan";

function useSubmit(action: () => Promise<{ success: boolean; error?: string }>) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function submit(onSuccess: () => void, onError: (msg: string) => void) {
    startTransition(async () => {
      const res = await action();
      if (res.success) {
        router.refresh();
        onSuccess();
      } else {
        onError(res.error ?? "Something went wrong.");
      }
    });
  }

  return { pending, submit };
}

// ─── Approve ─────────────────────────────────────────────────────────────────

export function ApproveLoanDialog({
  loan,
  open,
  onOpenChange,
}: {
  loan: LoanRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");

  React.useEffect(() => {
    if (open) setNote("");
  }, [open]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loan) return;
    startTransition(async () => {
      const res = await approveLoanAction({ id: loan.id, note });
      if (res.success) {
        toast.success("Loan approved.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Approve loan</DialogTitle>
            <DialogDescription>
              {loan
                ? `${loan.employeeName} is requesting ${formatPeso(loan.amount)} over ${loan.termPeriods} pay period${loan.termPeriods > 1 ? "s" : ""}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Note (optional)</Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Visible to the employee"
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Decline ─────────────────────────────────────────────────────────────────

export function DeclineLoanDialog({
  loan,
  open,
  onOpenChange,
}: {
  loan: LoanRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (open) setReason("");
  }, [open]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loan || !reason.trim()) return;
    startTransition(async () => {
      const res = await declineLoanAction({ id: loan.id, reason });
      if (res.success) {
        toast.success("Loan declined.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Decline loan</DialogTitle>
            <DialogDescription>
              {loan ? `${loan.employeeName} · ${formatPeso(loan.amount)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Reason (required)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why the request was declined"
                required
                minLength={1}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending || !reason.trim()}>
              {pending ? "Declining…" : "Decline"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Disburse ────────────────────────────────────────────────────────────────

export function DisburseLoanDialog({
  loan,
  open,
  onOpenChange,
}: {
  loan: LoanRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onConfirm() {
    if (!loan) return;
    startTransition(async () => {
      const res = await disburseLoanAction({ id: loan.id });
      if (res.success) {
        toast.success("Loan disbursed. Repayment schedule created.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Disburse loan?</AlertDialogTitle>
          <AlertDialogDescription>
            {loan
              ? `This will disburse ${formatPeso(loan.amount)} to ${loan.employeeName} and create ${loan.termPeriods} repayment installment${loan.termPeriods > 1 ? "s" : ""} of ${formatPeso(Math.floor(loan.amount / loan.termPeriods))} each. Deductions will begin in the next payroll run.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending ? "Disbursing…" : "Disburse"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Cancel ──────────────────────────────────────────────────────────────────

export function CancelLoanDialog({
  loan,
  open,
  onOpenChange,
}: {
  loan: LoanRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function onConfirm() {
    if (!loan) return;
    startTransition(async () => {
      const res = await cancelLoanAction({ id: loan.id });
      if (res.success) {
        toast.success("Loan request cancelled.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel loan request?</AlertDialogTitle>
          <AlertDialogDescription>
            {loan
              ? `This will cancel the loan request of ${formatPeso(loan.amount)} for ${loan.employeeName}. This cannot be undone.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Keep
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Cancelling…" : "Cancel loan"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
