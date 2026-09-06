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
import { Textarea } from "@/components/ui/textarea";
import { approveAbsenceRequestAction } from "@/app/actions/absence-request.actions";
import { formatDateRange, rangeDayCount } from "@/lib/utils/schedule";
import type { AbsenceRequestRow } from "@/server/services/absence-request.service";

export function ApproveAbsenceDialog({
  request,
  onOpenChange,
}: {
  request: AbsenceRequestRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  // Derive initial values directly from prop — no useEffect delay, so
  // defaultValue is always correct on first render for this request.
  const initStart = request?.startDate ?? "";
  const initEnd = request?.endDate ?? request?.startDate ?? "";
  const isRange = request?.endDate !== null && request?.endDate !== undefined;

  // Track current picker values only for the live day-count hint.
  // The submit handler reads from FormData instead of from this state.
  const [startDate, setStartDate] = React.useState(initStart);
  const [endDate, setEndDate] = React.useState(initEnd);

  // Sync display state when a new request is opened.
  React.useEffect(() => {
    setStartDate(request?.startDate ?? "");
    setEndDate(request?.endDate ?? request?.startDate ?? "");
    setError(null);
  }, [request?.id]);

  const dayCount =
    isRange && startDate && endDate ? rangeDayCount(startDate, endDate) : null;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!request) return;
    const form = new FormData(e.currentTarget);
    const start = String(form.get("startDate") ?? "").trim();
    const end = isRange ? String(form.get("endDate") ?? "").trim() : start;
    const note = String(form.get("note") ?? "").trim() || undefined;
    if (!start || (isRange && !end)) {
      setError("Date is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await approveAbsenceRequestAction(request.id, start, end, note);
      if (res.success) {
        toast.success(`Approved ${request.employeeName}'s absence.`);
        onOpenChange(false);
        router.refresh();
      } else {
        setError(res.error ?? null);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={request !== null}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setError(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Approve absence request</DialogTitle>
            <DialogDescription>
              {request
                ? `${request.employeeName} · ${request.employeeCode} requested ${formatDateRange(request.startDate, request.endDate)}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {isRange ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="approve-start">Start date</Label>
                    {/* key forces a fresh mount (and fresh defaultValue) each
                        time a different request is opened, avoiding base-ui's
                        "changing defaultValue after init" warning. */}
                    <Input
                      key={`start-${request?.id}`}
                      id="approve-start"
                      name="startDate"
                      type="date"
                      defaultValue={initStart}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="approve-end">End date</Label>
                    <Input
                      key={`end-${request?.id}`}
                      id="approve-end"
                      name="endDate"
                      type="date"
                      min={startDate}
                      defaultValue={initEnd}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
                {dayCount !== null ? (
                  <p className="text-xs text-muted-foreground">
                    {dayCount === 1 ? "1 day" : `${dayCount} days`}
                  </p>
                ) : null}
              </>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="approve-date">Date</Label>
                <Input
                  key={`date-${request?.id}`}
                  id="approve-date"
                  name="startDate"
                  type="date"
                  defaultValue={initStart}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="approve-note">Note (optional)</Label>
              <Textarea
                id="approve-note"
                name="note"
                placeholder="Add an approval note if needed"
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Approving…" : "Approve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
