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
import { editAttendanceAction } from "@/app/actions/attendance.actions";
import type { AttendanceComparisonRow } from "@/lib/types/attendance";

/**
 * Admin manual edit of one employee-day. Prefilled from the row's actuals; saving
 * with both times empty clears (deletes) the record. Any save marks the row as a
 * `manual` override on the server.
 */
export function AttendanceEditDialog({
  row,
  open,
  onOpenChange,
}: {
  row: AttendanceComparisonRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [timeIn, setTimeIn] = React.useState(row.actualIn ?? "");
  const [timeOut, setTimeOut] = React.useState(row.actualOut ?? "");

  const hasRecord = row.actualIn !== null || row.actualOut !== null;

  function submit(clear: boolean) {
    startTransition(async () => {
      const res = await editAttendanceAction({
        employeeId: row.employeeId,
        date: row.date,
        timeIn: clear ? null : timeIn || null,
        timeOut: clear ? null : timeOut || null,
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
              {row.employeeName} · {row.date}. Set the actual clock-in/out. Saved to
              the dashboard database as a manual override. Use Clear to remove the
              record entirely.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="attendance-time-in">Time in</Label>
              <Input
                id="attendance-time-in"
                type="time"
                value={timeIn}
                onChange={(e) => setTimeIn(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="attendance-time-out">Time out</Label>
              <Input
                id="attendance-time-out"
                type="time"
                value={timeOut}
                onChange={(e) => setTimeOut(e.target.value)}
              />
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
