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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAbsenceRequestAdminAction } from "@/app/actions/absence-request.actions";

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

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const dateIso = String(form.get("date") ?? "");
    const reason = String(form.get("reason") ?? "").trim() || undefined;
    setError(null);
    startTransition(async () => {
      const res = await createAbsenceRequestAdminAction({
        employeeId,
        dateIso,
        reason,
      });
      if (res.success) {
        toast.success("Absence recorded and approved.");
        setOpen(false);
        setEmployeeId("");
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
        if (!next) {
          setError(null);
          setEmployeeId("");
        }
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
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Record manual absence</DialogTitle>
            <DialogDescription>
              Adds an approved absence for an employee. They will be blocked
              from the schedule on that day.
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
              <Label htmlFor="manual-absence-date">Date</Label>
              <Input
                id="manual-absence-date"
                name="date"
                type="date"
                defaultValue={defaultDate}
                required
              />
            </div>
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
