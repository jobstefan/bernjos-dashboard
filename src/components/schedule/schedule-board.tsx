"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { BranchRow, ScheduleRow } from "@/lib/types/schedule";

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

export function ScheduleBoard({
  dateIso,
  rows,
  branches,
  canEdit,
}: {
  dateIso: string;
  rows: ScheduleRow[];
  branches: BranchRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
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
          <CopyScheduleButton dateIso={dateIso} rows={previewRows} />
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
            {rows.map((row) => {
              const d = drafts[row.employeeId];
              if (!d) return null;
              const isOff = !d.startTime && !d.endTime;
              return (
                <TableRow
                  key={row.employeeId}
                  className={cn(invalid.has(row.employeeId) && "bg-destructive/5")}
                >
                  <TableCell>
                    <div className="font-medium">{row.employeeName}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.employeeCode}
                      {isOff ? " · Day off" : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select
                        value={d.branchId}
                        onValueChange={(v) =>
                          update(row.employeeId, { branchId: v as string })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(value) =>
                              value === NO_BRANCH
                                ? "Unassigned"
                                : (branches.find((b) => b.id === value)?.name ??
                                  "Unassigned")
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
                      <span className="text-sm">
                        {d.branchId === NO_BRANCH
                          ? "—"
                          : (branches.find((b) => b.id === d.branchId)?.name ??
                            "—")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={d.startTime}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(row.employeeId, { startTime: e.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="time"
                      value={d.endTime}
                      disabled={!canEdit}
                      onChange={(e) =>
                        update(row.employeeId, { endTime: e.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={d.note}
                      disabled={!canEdit}
                      placeholder="e.g. half day"
                      onChange={(e) =>
                        update(row.employeeId, { note: e.target.value })
                      }
                    />
                  </TableCell>
                </TableRow>
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
