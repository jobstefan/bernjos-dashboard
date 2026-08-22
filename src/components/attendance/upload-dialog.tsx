"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { uploadAttendanceAction } from "@/app/actions/attendance.actions";
import type { AttendanceBranchOption } from "@/lib/types/attendance";

/** Read a File into a bare base64 string (no data-URL prefix). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function UploadDialog({
  branches,
  open,
  onOpenChange,
}: {
  branches: AttendanceBranchOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [branchId, setBranchId] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setBranchId(branches.length === 1 ? branches[0].id : "");
      setFile(null);
      setFormError(null);
    }
  }, [open, branches]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    if (!branchId) return setFormError("Choose a branch.");
    if (!file) return setFormError("Choose a file to upload.");

    startTransition(async () => {
      const fileBase64 = await fileToBase64(file);
      const res = await uploadAttendanceAction({
        branchId,
        fileName: file.name,
        fileBase64,
      });
      if (res.success) {
        toast.success("Attendance imported — see the results below.");
        onOpenChange(false);
        router.refresh();
      } else {
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
            <DialogTitle>Upload attendance</DialogTitle>
            <DialogDescription>
              Upload a branch&apos;s biometric export (.xlsx). It&apos;s parsed in
              the background and matched to employees.
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
              <Label>Branch</Label>
              <Select value={branchId} onValueChange={(v) => setBranchId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a branch">
                    {(value) =>
                      branches.find((b) => b.id === value)?.name ?? "Select a branch"
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
            </div>

            <div className="grid gap-2">
              <Label>File</Label>
              <input
                type="file"
                accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="block w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/80"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Uploading…" : "Upload"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Self-contained "Upload" button. Disabled (with a hint) when no branch is configured. */
export function UploadAttendanceButton({
  branches,
}: {
  branches: AttendanceBranchOption[];
}) {
  const [open, setOpen] = React.useState(false);
  if (branches.length === 0) {
    return (
      <Button
        disabled
        title="Set a biometric format on a branch first (Branches page)."
      >
        <Upload className="size-4" /> Upload attendance
      </Button>
    );
  }
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Upload className="size-4" /> Upload attendance
      </Button>
      <UploadDialog branches={branches} open={open} onOpenChange={setOpen} />
    </>
  );
}
