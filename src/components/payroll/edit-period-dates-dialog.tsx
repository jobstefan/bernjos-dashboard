"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, AlertCircle } from "lucide-react";
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
import { updatePeriodDatesAction } from "@/app/actions/payroll.actions";

interface Props {
  periodId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  payDate: string;
  notes?: string | null;
  frequency: "semi_monthly" | "monthly";
}

export function EditPeriodDatesDialog({
  periodId,
  periodLabel,
  periodStart,
  periodEnd,
  payDate,
  notes,
  frequency,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function toDateInput(iso: string) {
    return iso.slice(0, 10);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = {
      id: periodId,
      periodLabel: String(form.get("periodLabel") ?? ""),
      periodStart: String(form.get("periodStart") ?? ""),
      periodEnd: String(form.get("periodEnd") ?? ""),
      payDate: String(form.get("payDate") ?? ""),
      notes: String(form.get("notes") ?? ""),
    };
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await updatePeriodDatesAction(input);
      if (res.success) {
        toast.success("Period updated.");
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
          <Button variant="outline">
            <Pencil className="size-4" /> Edit Dates
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit payroll period</DialogTitle>
            <DialogDescription>
              Update the label, cut-off dates, and pay date.{" "}
              <span className="font-medium">
                Frequency ({frequency === "semi_monthly" ? "Semi-monthly" : "Monthly"}) cannot be changed.
              </span>
            </DialogDescription>
          </DialogHeader>

          {formError ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}

          <div className="grid gap-4 py-4">
            <Field label="Period label" error={errors.periodLabel}>
              <Input name="periodLabel" defaultValue={periodLabel} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Period start" error={errors.periodStart}>
                <Input name="periodStart" type="date" defaultValue={toDateInput(periodStart)} />
              </Field>
              <Field label="Period end" error={errors.periodEnd}>
                <Input name="periodEnd" type="date" defaultValue={toDateInput(periodEnd)} />
              </Field>
            </div>
            <Field label="Pay date" error={errors.payDate}>
              <Input name="payDate" type="date" defaultValue={toDateInput(payDate)} />
            </Field>
            <Field label="Notes (optional)" error={errors.notes}>
              <Input name="notes" defaultValue={notes ?? ""} placeholder="Anything worth recording" />
            </Field>
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

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
      {error?.length ? (
        <p className="text-xs text-destructive">{error[0]}</p>
      ) : null}
    </div>
  );
}
