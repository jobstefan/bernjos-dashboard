"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requestCashAdvanceAction } from "@/app/actions/cash-advance.actions";

export function RequestCashAdvanceDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = {
      amount: String(form.get("amount") ?? ""),
      reason: String(form.get("reason") ?? ""),
    };
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await requestCashAdvanceAction(input);
      if (res.success) {
        toast.success("Cash advance request submitted.");
        setOpen(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setErrors({});
          setFormError(null);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" /> Request Advance
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Request a cash advance</DialogTitle>
            <DialogDescription>
              Your request will be reviewed by an approver. Once approved, the amount is
              deducted from your next payroll.
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
              <Label>Amount (₱)</Label>
              <Input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 5000"
              />
              {errors.amount?.length ? (
                <p className="text-xs text-destructive">{errors.amount[0]}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Reason</Label>
              <Textarea
                name="reason"
                placeholder="Briefly explain what this advance is for"
              />
              {errors.reason?.length ? (
                <p className="text-xs text-destructive">{errors.reason[0]}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Submitting…" : "Submit request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
