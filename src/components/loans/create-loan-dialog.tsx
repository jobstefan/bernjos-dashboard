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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { adminCreateLoanAction } from "@/app/actions/loan.actions";
import { formatPeso } from "@/lib/utils/payroll";
import type { SavingsAccountRow } from "@/lib/types/savings";

export interface BranchOption {
  id: string;
  name: string;
}

const PRESET_TERMS = [
  { value: "1", label: "1 pay period" },
  { value: "2", label: "2 pay periods" },
  { value: "3", label: "3 pay periods" },
  { value: "4", label: "4 pay periods" },
];

// ─── Controlled (pre-seeded from savings table row) ───────────────────────────

/** Controlled variant: caller manages open state and supplies the account. */
export function CreateLoanDialog({
  account,
  availableToBorrow,
  open,
  onOpenChange,
}: {
  account: SavingsAccountRow | null;
  availableToBorrow: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <CreateLoanDialogInner
      account={account}
      availableToBorrow={availableToBorrow}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}

// ─── Standalone (admin button in loans section) ───────────────────────────────

/**
 * Self-contained trigger + dialog for admins to create a loan from the loans
 * section, with a built-in employee selector.
 */
export function AdminCreateLoanButton({
  accounts,
  availableToBorrowMap,
  branches,
}: {
  accounts: SavingsAccountRow[];
  availableToBorrowMap: Record<string, number>;
  branches: BranchOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string>("");

  const eligibleAccounts = accounts.filter((a) => !a.frozen);
  const account = eligibleAccounts.find((a) => a.employeeId === selectedId) ?? null;
  const availableToBorrow = selectedId ? (availableToBorrowMap[selectedId] ?? 0) : 0;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Create Loan
      </Button>
      <CreateLoanDialogInner
        account={account}
        availableToBorrow={availableToBorrow}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSelectedId("");
        }}
        branches={branches}
        employeePicker={
          <div className="grid gap-2">
            <Label>Employee</Label>
            <Select
              value={selectedId}
              onValueChange={(v) => v && setSelectedId(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select employee…">
                  {(value) => {
                    const a = eligibleAccounts.find((a) => a.employeeId === value);
                    return a ? `${a.employeeName} (${a.employeeCode})` : "Select employee…";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {eligibleAccounts.map((a) => (
                  <SelectItem key={a.employeeId} value={a.employeeId}>
                    <span className="font-medium">{a.employeeName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {a.employeeCode} · available {formatPeso(availableToBorrowMap[a.employeeId] ?? 0)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
    </>
  );
}

// ─── Shared form ──────────────────────────────────────────────────────────────

function CreateLoanDialogInner({
  account,
  availableToBorrow,
  open,
  onOpenChange,
  employeePicker,
  branches = [],
}: {
  account: SavingsAccountRow | null;
  availableToBorrow: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeePicker?: React.ReactNode;
  branches?: BranchOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [amount, setAmount] = React.useState("");
  const [termSelect, setTermSelect] = React.useState<string>("1");
  const [branchId, setBranchId] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const termPeriods = parseInt(termSelect, 10);
  const parsedAmount = parseFloat(amount) || 0;
  const estimatedInstallment =
    termPeriods > 0 && parsedAmount > 0
      ? Math.floor(parsedAmount / termPeriods)
      : 0;

  React.useEffect(() => {
    if (open) {
      setAmount("");
      setTermSelect("1");
      setBranchId("");
      setErrors({});
    }
  }, [open]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!account) return;
    const form = new FormData(e.currentTarget);
    setErrors({});
    startTransition(async () => {
      const res = await adminCreateLoanAction({
        profileId: account.employeeId,
        branchId,
        amount,
        termPeriods,
        reason: String(form.get("reason") ?? ""),
      });
      if (res.success) {
        toast.success("Loan created and disbursed.");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Create loan</DialogTitle>
            <DialogDescription>
              {account
                ? `${account.employeeName} · savings balance ${formatPeso(account.balance)} · available to borrow ${formatPeso(availableToBorrow)}.`
                : "Select an employee to create a loan for them."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {employeePicker}

            {branches.length > 0 && (
              <div className="grid gap-2">
                <Label>Branch</Label>
                <Select
                  value={branchId}
                  onValueChange={(v) => v && setBranchId(v)}
                  disabled={!account}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select branch…">
                      {(value) =>
                        branches.find((b) => b.id === value)?.name ?? "Select branch…"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.branchId ? (
                  <p className="text-xs text-destructive">{errors.branchId}</p>
                ) : null}
              </div>
            )}

            <div className="grid gap-2">
              <Label>Amount (₱)</Label>
              <Input
                type="number"
                min="1"
                max={availableToBorrow || undefined}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={!account}
              />
              {errors.amount ? (
                <p className="text-xs text-destructive">{errors.amount}</p>
              ) : account ? (
                <p className="text-xs text-muted-foreground">
                  Maximum: {formatPeso(availableToBorrow)}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Repayment term</Label>
              <Select
                value={termSelect}
                onValueChange={(v) => v && setTermSelect(v)}
                disabled={!account}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) =>
                      PRESET_TERMS.find((o) => o.value === value)?.label ?? value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRESET_TERMS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {errors.termPeriods ? (
                <p className="text-xs text-destructive">{errors.termPeriods}</p>
              ) : estimatedInstallment > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Estimated installment: {formatPeso(estimatedInstallment)} / period
                  {termPeriods > 0 && ` · ${termPeriods} period${termPeriods === 1 ? "" : "s"}`}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label>Reason</Label>
              <Textarea
                name="reason"
                placeholder="Purpose of the loan"
                required
                minLength={5}
                disabled={!account}
              />
              {errors.reason ? (
                <p className="text-xs text-destructive">{errors.reason}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={pending || !account || (branches.length > 0 && !branchId)}
            >
              {pending ? "Creating…" : "Create & disburse"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
