"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteImportAction,
  mapDeviceAction,
} from "@/app/actions/attendance.actions";
import { formatDate } from "@/lib/utils/payroll";
import type { AttendanceImportRow } from "@/lib/types/attendance";

export interface EmployeeOption {
  id: string;
  code: string;
  name: string;
}

const STATUS_VARIANT: Record<string, "secondary" | "destructive" | "outline"> = {
  completed: "secondary",
  processing: "outline",
  failed: "destructive",
};

/**
 * One unmatched device id → pick an employee and save the mapping. Stays
 * editable after saving: pick a different employee and click Update to change it.
 */
function MapRow({
  branchId,
  deviceUserId,
  employees,
}: {
  branchId: string;
  deviceUserId: string;
  employees: EmployeeOption[];
}) {
  const [pending, startTransition] = React.useTransition();
  const [employeeId, setEmployeeId] = React.useState("");
  const [savedId, setSavedId] = React.useState<string | null>(null);

  function onMap() {
    if (!employeeId) return toast.error("Choose an employee.");
    startTransition(async () => {
      const res = await mapDeviceAction({ branchId, deviceUserId, employeeId });
      if (res.success) {
        setSavedId(employeeId);
        toast.success("Device mapped. Re-upload the file to apply.");
      } else {
        toast.error(res.error);
      }
    });
  }

  const savedName = savedId
    ? employees.find((e) => e.id === savedId)?.name
    : null;

  return (
    <div className="flex items-center gap-2">
      <code className="w-24 shrink-0 rounded bg-muted px-2 py-1 text-xs">
        {deviceUserId}
      </code>
      <Select value={employeeId} onValueChange={(v) => setEmployeeId(v ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select employee">
            {(value) =>
              employees.find((e) => e.id === value)?.name ?? "Select employee"
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name} · {e.code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={onMap}
        disabled={pending || !employeeId || employeeId === savedId}
      >
        {pending ? "Saving…" : savedId ? "Update" : "Map"}
      </Button>
      {savedName ? (
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          <Check className="size-3.5" /> {savedName}
        </span>
      ) : null}
    </div>
  );
}

/** Delete-import button with a confirmation dialog. */
function DeleteImportButton({ importId }: { importId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Delete import"
        title="Delete import"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this import?</AlertDialogTitle>
            <AlertDialogDescription>
              The uploaded file&apos;s attendance records will be removed. Device
              mappings you created are kept. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const res = await deleteImportAction(importId);
                  if (res.success) {
                    toast.success("Import deleted.");
                    setOpen(false);
                    router.refresh();
                  } else {
                    toast.error(res.error);
                  }
                });
              }}
              disabled={pending}
              className="bg-destructive/10 text-destructive hover:bg-destructive/20"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function UnmatchedPanel({
  imports,
  employees,
}: {
  imports: AttendanceImportRow[];
  employees: EmployeeOption[];
}) {
  if (imports.length === 0) {
    return <p className="text-sm text-muted-foreground">No uploads yet.</p>;
  }

  return (
    <div className="space-y-3">
      {imports.map((imp) => (
        <div key={imp.id} className="rounded-xl border border-border bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium">{imp.fileName}</div>
              <div className="text-xs text-muted-foreground">
                {imp.branchName} · {formatDate(imp.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant={STATUS_VARIANT[imp.status] ?? "outline"}>
                {imp.status}
              </Badge>
              {imp.status === "completed" ? (
                <span className="text-muted-foreground">
                  {imp.matchedRows}/{imp.totalRows} matched
                </span>
              ) : null}
              <DeleteImportButton importId={imp.id} />
            </div>
          </div>

          {imp.errorMessage ? (
            <p className="mt-2 text-sm text-destructive">{imp.errorMessage}</p>
          ) : null}

          {imp.unmatchedIds.length > 0 ? (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-muted-foreground">
                {imp.unmatchedIds.length} device id
                {imp.unmatchedIds.length === 1 ? "" : "s"} with no matching employee
                code. Fix the code on the employee, or map here as an override, then
                re-upload:
              </p>
              {imp.unmatchedIds.map((id) => (
                <MapRow
                  key={id}
                  branchId={imp.branchId}
                  deviceUserId={id}
                  employees={employees}
                />
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
