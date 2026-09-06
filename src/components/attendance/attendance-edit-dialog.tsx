"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { editAttendanceAction } from "@/app/actions/attendance.actions";
import type { AttendanceComparisonRow } from "@/lib/types/attendance";

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function AttendanceEditDialog({
  row,
  branches,
  open,
  onOpenChange,
}: {
  row: AttendanceComparisonRow;
  branches: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [timeIn, setTimeIn] = React.useState(row.actualIn ?? "");
  const [gapStart, setGapStart] = React.useState(row.gapStart ?? "");
  const [gapEnd, setGapEnd] = React.useState(row.gapEnd ?? "");
  const [gap2Start, setGap2Start] = React.useState(row.gap2Start ?? "");
  const [gap2End, setGap2End] = React.useState(row.gap2End ?? "");
  const [timeOut, setTimeOut] = React.useState(row.actualOut ?? "");

  // Branch transfer state
  const existingSeg = row.branchSegments.length >= 2 ? row.branchSegments : null;
  const [primaryBranchId, setPrimaryBranchId] = React.useState(row.attendanceBranchId ?? "");

  function handlePrimaryBranchChange(v: string | null) {
    setPrimaryBranchId(v ?? "");
    if (transferBranchId && transferBranchId === v) setTransferBranchId("");
  }
  const [hasTransfer, setHasTransfer] = React.useState(existingSeg !== null);
  const [transferTime, setTransferTime] = React.useState(existingSeg ? existingSeg[0].timeTo : "");
  const [transferBranchId, setTransferBranchId] = React.useState(existingSeg ? (existingSeg[1].branchId ?? "") : "");

  const hasRecord = row.actualIn !== null || row.actualOut !== null;

  function validate(): string | null {
    if (!gap2Start && !gap2End) {
      // no extra gap to validate
    } else {
      if (gap2Start && gap2End && toMin(gap2End) <= toMin(gap2Start)) {
        return "Extra in must be after Extra out.";
      }
      if (gap2Start && timeIn && toMin(gap2Start) < toMin(timeIn)) {
        return "Extra out cannot be before Time in.";
      }
      if (gap2End && timeOut && toMin(gap2End) > toMin(timeOut)) {
        return "Extra in cannot be after Time out.";
      }
      if (gap2Start && gapEnd && toMin(gap2Start) < toMin(gapEnd)) {
        return "Extra out cannot be before Mid-day in.";
      }
    }

    if (hasTransfer) {
      if (!transferTime) return "Enter the branch transfer time.";
      if (timeIn && toMin(transferTime) <= toMin(timeIn))
        return "Transfer time must be after Time in.";
      if (timeOut && toMin(transferTime) >= toMin(timeOut))
        return "Transfer time must be before Time out.";
    }

    return null;
  }

  function submit(clear: boolean) {
    if (!clear) {
      const err = validate();
      if (err) { toast.error(err); return; }
    }
    startTransition(async () => {
      const res = await editAttendanceAction({
        employeeId: row.employeeId,
        date: row.date,
        branchId: primaryBranchId || null,
        timeIn: clear ? null : timeIn || null,
        timeOut: clear ? null : timeOut || null,
        gapStart: clear ? null : gapStart || null,
        gapEnd: clear ? null : gapEnd || null,
        gap2Start: clear ? null : gap2Start || null,
        gap2End: clear ? null : gap2End || null,
        branchTransfer:
          !clear && hasTransfer && transferTime
            ? { transferTime, branchId: transferBranchId || null }
            : null,
      });
      if (res.success) {
        toast.success(clear ? "Attendance cleared." : "Attendance saved.");
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submit(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Edit attendance</DialogTitle>
            <DialogDescription>
              {row.employeeName} · {row.date}. Mid-day out/in is the main break.
              Extra out/in is optional — for a second departure within the shift.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="att-time-in">Time in</Label>
              <Input
                id="att-time-in"
                type="time"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="att-gap-start">Mid-day out</Label>
              <Input
                id="att-gap-start"
                type="time"
                value={gapStart}
                onChange={(e) => setGapStart(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="att-gap-end">Mid-day in</Label>
              <Input
                id="att-gap-end"
                type="time"
                value={gapEnd}
                onChange={(e) => setGapEnd(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="att-time-out">Time out</Label>
              <Input
                id="att-time-out"
                type="time"
                value={timeOut}
                onChange={(e) => setTimeOut(e.target.value)}
              />
            </div>

            <div className="col-span-2 border-t pt-3">
              <p className="text-xs text-muted-foreground mb-3">
                Extra departure — optional, must fall within the shift above.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="att-gap2-start">Extra out</Label>
                  <Input
                    id="att-gap2-start"
                    type="time"
                    value={gap2Start}
                    onChange={(e) => setGap2Start(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="att-gap2-end">Extra in</Label>
                  <Input
                    id="att-gap2-end"
                    type="time"
                    value={gap2End}
                    onChange={(e) => setGap2End(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Branch assignment */}
            <div className="col-span-2 border-t pt-3 space-y-3">
              <div className="grid gap-2">
                <Label>Primary branch</Label>
                <Select value={primaryBranchId} onValueChange={handlePrimaryBranchChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="— Unassigned —">
                      {(value) => branches.find((b) => b.id === value)?.name ?? "— Unassigned —"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Unassigned —</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="att-has-transfer"
                  type="checkbox"
                  checked={hasTransfer}
                  onChange={(e) => setHasTransfer(e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-primary"
                />
                <Label htmlFor="att-has-transfer" className="cursor-pointer font-normal">
                  Employee transferred to another branch mid-shift
                </Label>
              </div>

              {hasTransfer && (
                <div className="grid grid-cols-2 gap-4 pl-6">
                  <div className="grid gap-2">
                    <Label htmlFor="att-transfer-time">Transfer at</Label>
                    <Input
                      id="att-transfer-time"
                      type="time"
                      value={transferTime}
                      onChange={(e) => setTransferTime(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Transfer to branch</Label>
                    <Select value={transferBranchId} onValueChange={(v) => setTransferBranchId(v ?? "")}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select branch">
                          {(value) => branches.find((b) => b.id === value)?.name ?? "Select branch"}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {branches
                          .filter((b) => b.id !== primaryBranchId)
                          .map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            {hasRecord ? (
              <Button
                type="button"
                variant="outline"
                className="text-destructive"
                disabled={pending}
                onClick={() => submit(true)}
              >
                Clear
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
