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
import { requestAbsenceAction } from "@/app/actions/absence-request.actions";

export function RequestAbsenceDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dateIso = String(form.get("date") ?? "");
    const reason = String(form.get("reason") ?? "").trim();
    setError(null);
    startTransition(async () => {
      const res = await requestAbsenceAction(dateIso, reason);
      if (res.success) {
        toast.success("Absence request submitted.");
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" /> Request Absence
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Request an absence</DialogTitle>
            <DialogDescription>
              Submit an unpaid day-off request. Once submitted, you will be
              blocked from the schedule on that day.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="absence-date">Date</Label>
              <Input
                id="absence-date"
                name="date"
                type="date"
                required
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="absence-reason">Reason</Label>
              <Textarea
                id="absence-reason"
                name="reason"
                placeholder="Briefly explain the reason for your absence"
                required
                minLength={3}
              />
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
