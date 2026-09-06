"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { EmployeeCombobox } from "@/components/ui/employee-combobox";
import { BranchCombobox, type BranchOption } from "@/components/ui/branch-combobox";
import { formatEmployeeName } from "@/lib/utils/format-name";
import { createChargeAction } from "@/app/actions/charge.actions";
import { formatPeso } from "@/lib/utils/payroll";

export interface EmployeeOption {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
}

export type { BranchOption };

export function CreateChargeButton({
  employees,
  branches,
}: {
  employees: EmployeeOption[];
  branches: BranchOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [profileId, setProfileId] = React.useState("");
  const [branchId, setBranchId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  function reset() {
    setProfileId("");
    setBranchId("");
    setAmount("");
    setReason("");
    setErrors({});
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    startTransition(async () => {
      const res = await createChargeAction({ profileId, branchId, amount, reason });
      if (res.success) {
        toast.success("Charge created. It will be deducted in the next payroll run.");
        onOpenChange(false);
        router.refresh();
      } else {
        if (res.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.fieldErrors)) {
            if (v?.[0]) mapped[k] = v[0];
          }
          setErrors(mapped);
        }
        toast.error(res.error);
      }
    });
  }

  const selected = employees.find((e) => e.id === profileId);
  const selectedBranch = branches.find((b) => b.id === branchId);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add Charge
      </Button>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onSubmit}>
            <DialogHeader>
              <DialogTitle>Add charge</DialogTitle>
              <DialogDescription>
                {selected
                  ? `${formatEmployeeName(selected.firstName, selected.lastName, selected.middleName)} · ${selected.employeeCode}`
                  : "Select an employee and enter the charge amount. It will be deducted automatically on the next payroll run."}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Employee</Label>
                <EmployeeCombobox
                  employees={employees}
                  value={profileId}
                  onValueChange={setProfileId}
                />
                {errors.profileId ? (
                  <p className="text-xs text-destructive">{errors.profileId}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Branch</Label>
                <BranchCombobox
                  branches={branches}
                  value={branchId}
                  onValueChange={setBranchId}
                />
                {errors.branchId ? (
                  <p className="text-xs text-destructive">{errors.branchId}</p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Amount (₱)</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={!profileId || !branchId}
                />
                {errors.amount ? (
                  <p className="text-xs text-destructive">{errors.amount}</p>
                ) : amount && Number(amount) > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {formatPeso(Number(amount))} will be deducted from the next payroll run.
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label>Reason</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Cash shortage, broken equipment, etc."
                  rows={3}
                  disabled={!profileId || !branchId}
                />
                {errors.reason ? (
                  <p className="text-xs text-destructive">{errors.reason}</p>
                ) : null}
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={pending || !profileId || !branchId}>
                {pending ? "Creating…" : "Add charge"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
