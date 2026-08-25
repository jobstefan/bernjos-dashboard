"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CopyScheduleButton } from "@/components/schedule/copy-schedule-button";
import { saveDayScheduleAction } from "@/app/actions/schedule.actions";
import { departmentAccent } from "@/lib/utils/schedule";
import { cn } from "@/lib/utils";
import type { BranchRow, ScheduleRow } from "@/lib/types/schedule";
import type { AbsenceRequestRow } from "@/server/services/absence-request.service";

const NO_BRANCH = "__none__";

interface Draft {
  branchId: string;
  startTime: string;
  endTime: string;
  note: string;
}

function toDraft(row: ScheduleRow): Draft {
  return {
    branchId: row.branchId ?? NO_BRANCH,
    startTime: row.startTime ?? "",
    endTime: row.endTime ?? "",
    note: row.note ?? "",
  };
}

function rowBgClass(
  isBlocked: boolean,
  isApproved: boolean,
  isInvalid: boolean,
  accentTint: string,
): string {
  if (isBlocked) return isApproved ? "bg-red-50/60 opacity-70" : "bg-yellow-50/60 opacity-70";
  if (isInvalid) return "bg-destructive/5";
  return accentTint;
}

function dotColorClass(isBlocked: boolean, isApproved: boolean, accentDot: string): string {
  if (!isBlocked) return accentDot;
  return isApproved ? "bg-red-400" : "bg-yellow-400";
}

function BoardRow({
  row,
  draft,
  isInvalid,
  absenceReq,
  branches,
  canEdit,
  onUpdate,
}: Readonly<{
  row: ScheduleRow;
  draft: Draft;
  isInvalid: boolean;
  absenceReq: AbsenceRequestRow | undefined;
  branches: BranchRow[];
  canEdit: boolean;
  onUpdate: (patch: Partial<Draft>) => void;
}>) {
  const isBlocked = Boolean(absenceReq);
  const isApproved = absenceReq?.status === "approved";
  const isOff = !draft.startTime && !draft.endTime;
  const accent = departmentAccent(row.department);

  return (
    <TableRow className={cn(rowBgClass(isBlocked, isApproved, isInvalid, accent.tint))}>
      <TableCell>
        <div className="flex items-center gap-2">
          <span
            className={cn("size-2 shrink-0 rounded-full", dotColorClass(isBlocked, isApproved, accent.dot))}
            aria-hidden
          />
          <span className={cn("font-medium", isBlocked && "line-through text-muted-foreground")}>
            {row.employeeName}
          </span>
          {isBlocked ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-medium",
                isApproved ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800",
              )}
            >
              {isApproved ? "Approved Absence" : "Pending Absence"}
            </span>
          ) : null}
        </div>
        <div className="pl-4 text-xs text-muted-foreground">
          {row.employeeCode}
          {row.department ? ` · ${row.department}` : ""}
          {!isBlocked && isOff ? " · Day off" : ""}
        </div>
      </TableCell>
      <TableCell>
        {canEdit && !isBlocked ? (
          <Select
            value={draft.branchId}
            onValueChange={(v) => onUpdate({ branchId: v ?? NO_BRANCH })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(value) =>
                  value === NO_BRANCH
                    ? "Unassigned"
                    : (branches.find((b) => b.id === value)?.name ?? "Unassigned")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BRANCH}>Unassigned</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Input
          type="time"
          value={draft.startTime}
          disabled={!canEdit || isBlocked}
          onChange={(e) => onUpdate({ startTime: e.target.value })}
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Input
            type="time"
            value={draft.endTime}
            disabled={!canEdit || isBlocked}
            onChange={(e) => onUpdate({ endTime: e.target.value })}
          />
          {canEdit && !isBlocked ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Clear times (mark day off)"
              title="Clear times"
              disabled={!draft.startTime && !draft.endTime}
              onClick={() => onUpdate({ startTime: "", endTime: "" })}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Input
          value={draft.note}
          disabled={!canEdit || isBlocked}
          placeholder="e.g. half day"
          onChange={(e) => onUpdate({ note: e.target.value })}
        />
      </TableCell>
    </TableRow>
  );
}

export function ScheduleBoard({
  dateIso,
  rows,
  branches,
  canEdit,
  absenceRequests = [],
}: Readonly<{
  dateIso: string;
  rows: ScheduleRow[];
  branches: BranchRow[];
  canEdit: boolean;
  absenceRequests?: AbsenceRequestRow[];
}>) {
  // Employees with pending or approved absence requests are blocked from scheduling.
  const blockedEmployees = React.useMemo<
    Map<string, AbsenceRequestRow>
  >(
    () =>
      new Map(
        absenceRequests
          .filter((r) => r.status !== "declined")
          .map((r) => [r.employeeId, r]),
      ),
    [absenceRequests],
  );
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pending, startTransition] = React.useTransition();
  const [drafts, setDrafts] = React.useState<Record<string, Draft>>(() =>
    Object.fromEntries(rows.map((r) => [r.employeeId, toDraft(r)])),
  );
  const [invalid, setInvalid] = React.useState<Set<string>>(new Set());

  // Re-sync when the day (and therefore the server rows) changes.
  React.useEffect(() => {
    setDrafts(Object.fromEntries(rows.map((r) => [r.employeeId, toDraft(r)])));
    setInvalid(new Set());
  }, [rows]);

  function update(employeeId: string, patch: Partial<Draft>) {
    setDrafts((prev) => ({
      ...prev,
      [employeeId]: { ...prev[employeeId], ...patch },
    }));
  }

  // Live preview rows so the Copy button reflects unsaved edits.
  const previewRows = React.useMemo<ScheduleRow[]>(
    () =>
      rows.map((r) => {
        const d = drafts[r.employeeId];
        const working = Boolean(d?.startTime && d?.endTime);
        const branch =
          d && d.branchId !== NO_BRANCH
            ? branches.find((b) => b.id === d.branchId)
            : undefined;
        return {
          ...r,
          branchId: branch?.id ?? null,
          branchName: branch?.name ?? null,
          startTime: working ? d.startTime : null,
          endTime: working ? d.endTime : null,
          note: d?.note ? d.note : null,
          isDayOff: !working,
        };
      }),
    [rows, drafts, branches],
  );

  // Display order: group by assigned branch first, then department, then name.
  // Uses the live draft branch so rows regroup as branches are (re)assigned;
  // unassigned employees sort to the bottom of each grouping.
  const sortedRows = React.useMemo<ScheduleRow[]>(() => {
    const branchNameFor = (row: ScheduleRow): string | null => {
      const d = drafts[row.employeeId];
      if (!d || d.branchId === NO_BRANCH) return null;
      return branches.find((b) => b.id === d.branchId)?.name ?? null;
    };
    // Nulls (unassigned / no department) always sort last.
    const cmp = (a: string | null, b: string | null): number => {
      if (a === b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    };
    const startTimeFor = (row: ScheduleRow): string | null =>
      drafts[row.employeeId]?.startTime || null;

    const absenceWeight = (row: ScheduleRow): number =>
      blockedEmployees.has(row.employeeId) ? 1 : 0;

    return [...rows].sort((a, b) => {
      return (
        absenceWeight(a) - absenceWeight(b) ||
        cmp(branchNameFor(a), branchNameFor(b)) ||
        cmp(a.department || null, b.department || null) ||
        cmp(startTimeFor(a), startTimeFor(b)) ||
        a.employeeName.localeCompare(b.employeeName)
      );
    });
  }, [rows, drafts, branches, blockedEmployees]);

  function onDateChange(value: string) {
    if (value) router.push(`/schedule?date=${value}`);
  }

  function onSave() {
    const entries: {
      employeeId: string;
      branchId: string | null;
      startTime: string;
      endTime: string;
      note: string | null;
    }[] = [];
    const bad = new Set<string>();

    for (const row of rows) {
      const d = drafts[row.employeeId];
      if (blockedEmployees.has(row.employeeId)) continue; // absence requested — skip
      const hasStart = Boolean(d.startTime);
      const hasEnd = Boolean(d.endTime);
      if (!hasStart && !hasEnd) continue; // day off
      if (!hasStart || !hasEnd || d.endTime < d.startTime) {
        bad.add(row.employeeId);
        continue;
      }
      entries.push({
        employeeId: row.employeeId,
        branchId: d.branchId === NO_BRANCH ? null : d.branchId,
        startTime: d.startTime,
        endTime: d.endTime,
        note: d.note.trim() ? d.note.trim() : null,
      });
    }

    if (bad.size > 0) {
      setInvalid(bad);
      toast.error(
        "Some rows have missing or invalid times. A working shift needs both a start and end, with end after start.",
      );
      return;
    }
    setInvalid(new Set());

    startTransition(async () => {
      const res = await saveDayScheduleAction({ date: dateIso, entries });
      if (res.success) {
        toast.success("Schedule saved.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Label htmlFor="schedule-date">Day</Label>
          <Input
            id="schedule-date"
            type="date"
            value={dateIso}
            className="w-48"
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <CopyScheduleButton
            dateIso={dateIso}
            rows={previewRows}
            absentEmployees={absenceRequests
              .filter((r) => r.status !== "declined")
              .map((r) => ({ employeeName: r.employeeName, status: r.status as "pending" | "approved" }))}
          />
          {canEdit ? (
            <Button type="button" onClick={onSave} disabled={pending}>
              <Save className="size-4" />
              {pending ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-48">Employee</TableHead>
              <TableHead className="min-w-40">Branch</TableHead>
              <TableHead className="w-32">Start</TableHead>
              <TableHead className="w-32">End</TableHead>
              <TableHead className="min-w-40">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row) => {
              const d = drafts[row.employeeId];
              if (!d) return null;
              return (
                <BoardRow
                  key={row.employeeId}
                  row={row}
                  draft={d}
                  isInvalid={invalid.has(row.employeeId)}
                  absenceReq={blockedEmployees.get(row.employeeId)}
                  branches={branches}
                  canEdit={canEdit}
                  onUpdate={(patch) => update(row.employeeId, patch)}
                />
              );
            })}
          </TableBody>
        </Table>
      </div>

      {canEdit ? (
        <p className="text-xs text-muted-foreground">
          Leave both times blank to mark an employee as day off. Saving replaces
          the whole day&apos;s schedule.
        </p>
      ) : null}
    </div>
  );
}
