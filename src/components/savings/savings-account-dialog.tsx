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
import { upsertSavingsAccountAction } from "@/app/actions/savings.actions";
import type { SavingsAccountRow } from "@/lib/types/savings";

export interface EmployeeOption {
  id: string;
  name: string;
  code: string;
}

/**
 * Create/edit an employee's recurring savings contribution. When `account` is
 * present it's edit mode (employee fixed); otherwise the admin picks an employee
 * from `employees` (those without an account yet).
 */
export function SavingsAccountDialog({
  account,
  employees,
  open,
  onOpenChange,
}: {
  account?: SavingsAccountRow | null;
  employees: EmployeeOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [employeeId, setEmployeeId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [active, setActive] = React.useState("true");
  const isEdit = Boolean(account);

  React.useEffect(() => {
    if (open) {
      setEmployeeId(account?.employeeId ?? "");
      setAmount(account ? String(account.contributionAmount) : "");
      setActive(account ? (account.active ? "true" : "false") : "true");
      setErrors({});
      setFormError(null);
    }
  }, [open, account]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = await upsertSavingsAccountAction({
        employeeId,
        contributionAmount: amount,
        active: active === "true",
      });
      if (res.success) {
        toast.success(isEdit ? "Contribution updated." : "Contribution set.");
        onOpenChange(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? "Edit contribution" : "Set up savings"}
            </DialogTitle>
            <DialogDescription>
              The contribution is withheld from each payroll run and moved into
              the employee&apos;s savings account. It is not a payroll deduction.
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
              <Label>Employee</Label>
              {isEdit ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  {account?.employeeName} · {account?.employeeCode}
                </div>
              ) : (
                <Select
                  value={employeeId}
                  onValueChange={(v) => setEmployeeId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select an employee">
                      {(value) => {
                        const emp = employees.find((e) => e.id === value);
                        return emp ? `${emp.name} · ${emp.code}` : "";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} · {emp.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {errors.employeeId?.length ? (
                <p className="text-xs text-destructive">{errors.employeeId[0]}</p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Contribution per pay period (₱)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500.00"
              />
              {errors.contributionAmount?.length ? (
                <p className="text-xs text-destructive">
                  {errors.contributionAmount[0]}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={active} onValueChange={(v) => setActive(v ?? "true")}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) =>
                      value === "true"
                        ? "Active — contributing"
                        : "Paused — no contribution"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active — contributing</SelectItem>
                  <SelectItem value="false">Paused — no contribution</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Set up savings"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Self-contained "Set up savings" button that opens a create dialog. */
export function NewSavingsButton({
  employees,
}: {
  employees: EmployeeOption[];
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={employees.length === 0}>
        <Plus className="size-4" /> Set up savings
      </Button>
      <SavingsAccountDialog
        employees={employees}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
