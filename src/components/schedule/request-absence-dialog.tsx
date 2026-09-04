"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, AlertCircle, CalendarRange } from "lucide-react";
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
import { rangeDayCount } from "@/lib/utils/schedule";

const tomorrowIso = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

export function RequestAbsenceDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [isRange, setIsRange] = React.useState(false);
  // Track values from uncontrolled inputs just for the day-count hint and endDate min
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const startRef = React.useRef<HTMLInputElement>(null);
  const endRef = React.useRef<HTMLInputElement>(null);
  // Key forces uncontrolled inputs to remount on each open
  const [formKey, setFormKey] = React.useState(0);

  function reset() {
    setError(null);
    setIsRange(false);
    setStartDate("");
    setEndDate("");
    setFormKey((k) => k + 1);
  }

  function toggleRange() {
    setIsRange((prev) => {
      if (prev) setEndDate("");
      return !prev;
    });
  }

  const dayCount =
    startDate && (isRange ? endDate : startDate)
      ? rangeDayCount(startDate, isRange ? endDate || startDate : startDate)
      : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const sDate = String(form.get("startDate") ?? "").trim();
    const eDate = isRange
      ? String(form.get("endDate") ?? "").trim() || sDate
      : sDate;
    const reason = String(form.get("reason") ?? "").trim();

    if (!sDate) {
      setError("A date is required.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await requestAbsenceAction(sDate, eDate, reason);
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
        if (!next) reset();
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
        <form key={formKey} onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Request an absence</DialogTitle>
            <DialogDescription>
              Submit an unpaid day-off request for a single day or a date range.
              Once submitted, you will be blocked from the schedule on those days.
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
              <Label htmlFor="absence-start-date">
                {isRange ? "Start date" : "Date"}
              </Label>
              <Input
                ref={startRef}
                id="absence-start-date"
                name="startDate"
                type="date"
                required
                min={tomorrowIso()}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  // keep end date valid if already set
                  if (isRange && endDate && val > endDate) setEndDate(val);
                }}
              />
            </div>

            {isRange ? (
              <div className="grid gap-2">
                <Label htmlFor="absence-end-date">End date</Label>
                <Input
                  ref={endRef}
                  id="absence-end-date"
                  name="endDate"
                  type="date"
                  required
                  min={startDate || tomorrowIso()}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                {dayCount && dayCount > 1 ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarRange className="size-3.5 shrink-0" />
                    {dayCount} days
                  </p>
                ) : null}
              </div>
            ) : null}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={toggleRange}
              className="w-fit"
            >
              <CalendarRange className="size-4" />
              {isRange ? "Single day only" : "Set date range"}
            </Button>

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
