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
import { requestLoanAction } from "@/app/actions/loan.actions";
import { formatPeso } from "@/lib/utils/payroll";

const TERM_OPTIONS = [
  { value: 1, label: "1 pay period" },
  { value: 2, label: "2 pay periods" },
  { value: 3, label: "3 pay periods" },
  { value: 4, label: "4 pay periods" },
];

/** Employee requests a loan against their savings balance. */
export function RequestLoanDialog({
  availableToBorrow,
  branches,
}: {
  availableToBorrow: number;
  branches: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [amount, setAmount] = React.useState("");
  const [termPeriods, setTermPeriods] = React.useState<number>(1);
  const [branchId, setBranchId] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const parsedAmount = parseFloat(amount) || 0;
  const estimatedInstallment =
    termPeriods > 0 && parsedAmount > 0
      ? Math.floor(parsedAmount / termPeriods)
      : 0;

  React.useEffect(() => {
    if (open) {
      setAmount("");
      setTermPeriods(1);
      setBranchId("");
      setErrors({});
    }
  }, [open]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setErrors({});
    startTransition(async () => {
      const res = await requestLoanAction({
        branchId,
        amount,
        termPeriods,
        reason: String(form.get("reason") ?? ""),
      });
      if (res.success) {
        toast.success("Loan request submitted. An admin will review it shortly.");
        setOpen(false);
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
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={availableToBorrow <= 0}>
            <Plus className="size-4" /> Request Loan
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Request a loan</DialogTitle>
            <DialogDescription>
              You may borrow up to {formatPeso(availableToBorrow)} against your
              savings balance.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={(v) => setBranchId(v ?? "")} required>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select branch">
                    {(value) => branches.find((b) => b.id === value)?.name ?? "Select branch"}
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

            <div className="grid gap-2">
              <Label>Amount (₱)</Label>
              <Input
                type="number"
                min="1"
                max={availableToBorrow}
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
              {errors.amount ? (
                <p className="text-xs text-destructive">{errors.amount}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Maximum: {formatPeso(availableToBorrow)}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Repayment term</Label>
              <Select
                value={String(termPeriods)}
                onValueChange={(v) => setTermPeriods(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) =>
                      TERM_OPTIONS.find((o) => String(o.value) === value)?.label ??
                      value
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TERM_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {estimatedInstallment > 0 && (
                <p className="text-xs text-muted-foreground">
                  Estimated installment: {formatPeso(estimatedInstallment)} / period
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label>Reason</Label>
              <Textarea
                name="reason"
                placeholder="Purpose of the loan"
                required
                minLength={5}
              />
              {errors.reason ? (
                <p className="text-xs text-destructive">{errors.reason}</p>
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
