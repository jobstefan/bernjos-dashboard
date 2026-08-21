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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPeriodAction } from "@/app/actions/payroll.actions";

export function NewPeriodDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [frequency, setFrequency] = React.useState<"semi_monthly" | "monthly">(
    "semi_monthly",
  );
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const input = {
      periodLabel: String(form.get("periodLabel") ?? ""),
      periodStart: String(form.get("periodStart") ?? ""),
      periodEnd: String(form.get("periodEnd") ?? ""),
      payDate: String(form.get("payDate") ?? ""),
      frequency,
      notes: String(form.get("notes") ?? ""),
    };
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await createPeriodAction(input);
      if (res.success) {
        toast.success("Payroll period created.");
        setOpen(false);
        router.refresh();
        router.push(`/payroll/${res.data.id}`);
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
            <Plus className="size-4" /> New Period
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>New payroll period</DialogTitle>
            <DialogDescription>
              Define the cut-off dates and pay date for this run.
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
              <Input name="periodLabel" placeholder="e.g. July 1–15 2025" />
            </Field>
            <div className="grid gap-2">
              <Label>Frequency</Label>
              <Select
                value={frequency}
                onValueChange={(v) =>
                  setFrequency(v as "semi_monthly" | "monthly")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semi_monthly">Semi-monthly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Period start" error={errors.periodStart}>
                <Input name="periodStart" type="date" />
              </Field>
              <Field label="Period end" error={errors.periodEnd}>
                <Input name="periodEnd" type="date" />
              </Field>
            </div>
            <Field label="Pay date" error={errors.payDate}>
              <Input name="payDate" type="date" />
            </Field>
            <Field label="Notes (optional)" error={errors.notes}>
              <Input name="notes" placeholder="Anything worth recording" />
            </Field>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create period"}
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
