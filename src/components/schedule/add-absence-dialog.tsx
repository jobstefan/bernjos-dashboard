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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAbsenceRequestAdminAction } from "@/app/actions/absence-request.actions";
import { rangeDayCount } from "@/lib/utils/schedule";

interface EmployeeOption {
  id: string;
  name: string;
  employeeCode: string;
}

export function AddAbsenceDialog({
  employees,
  defaultDate,
}: {
  employees: EmployeeOption[];
  defaultDate?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState<string>("");
  const [isRange, setIsRange] = React.useState(false);
  // Track for end-date min and day-count hint only
  const [startDate, setStartDate] = React.useState(defaultDate ?? "");
  const [endDate, setEndDate] = React.useState(defaultDate ?? "");
  const [formKey, setFormKey] = React.useState(0);

  function reset() {
    setError(null);
    setEmployeeId("");
    setIsRange(false);
    setStartDate(defaultDate ?? "");
    setEndDate(defaultDate ?? "");
    setFormKey((k) => k + 1);
  }

  function toggleRange() {
    setIsRange((prev) => {
      if (prev) setEndDate(startDate);
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
    const reason = String(form.get("reason") ?? "").trim() || undefined;

    setError(null);
    startTransition(async () => {
      const res = await createAbsenceRequestAdminAction({
        employeeId,
        startDateIso: sDate,
        endDateIso: eDate,
        reason,
      });
      if (res.success) {
        toast.success("Absence recorded and approved.");
        setOpen(false);
        reset();
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
          <Button variant="outline" size="sm">
            <Plus className="size-4" /> Manual Absence
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form key={formKey} onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Record manual absence</DialogTitle>
            <DialogDescription>
              Adds an approved absence for an employee. They will be blocked
              from the schedule on those days.
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
              <Label>Employee</Label>
              <Select
                value={employeeId}
                onValueChange={(v) => setEmployeeId(v ?? "")}
                required
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select employee…">
                    {(value) => {
                      const emp = employees.find((e) => e.id === value);
                      return emp
                        ? `${emp.name} · ${emp.employeeCode}`
                        : "Select employee…";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}{" "}
                      <span className="text-muted-foreground">
                        · {emp.employeeCode}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="manual-absence-start-date">
                {isRange ? "Start date" : "Date"}
              </Label>
              <Input
                id="manual-absence-start-date"
                name="startDate"
                type="date"
                required
                defaultValue={defaultDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  if (isRange && endDate && val > endDate) setEndDate(val);
                }}
              />
            </div>

            {isRange ? (
              <div className="grid gap-2">
                <Label htmlFor="manual-absence-end-date">End date</Label>
                <Input
                  id="manual-absence-end-date"
                  name="endDate"
                  type="date"
                  required
                  min={startDate}
                  defaultValue={defaultDate}
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
              <Label htmlFor="manual-absence-reason">Reason (optional)</Label>
              <Textarea
                id="manual-absence-reason"
                name="reason"
                placeholder="e.g. family emergency, medical leave"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !employeeId}>
              {pending ? "Recording…" : "Record absence"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
