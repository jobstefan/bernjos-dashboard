"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, AlertCircle } from "lucide-react";
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
import {
  createBranchAction,
  updateBranchAction,
} from "@/app/actions/branch.actions";
import { listFormats } from "@/lib/attendance/adapters";
import type { BranchRow } from "@/lib/types/schedule";

const NONE = "none";
const FORMATS = listFormats();

/** Shared create/edit form. `branch` present = edit mode. */
export function BranchDialog({
  branch,
  open,
  onOpenChange,
}: {
  branch?: BranchRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [format, setFormat] = React.useState(NONE);
  const isEdit = Boolean(branch);

  // Seed the controlled fields whenever the dialog opens (or the target changes).
  React.useEffect(() => {
    if (open) {
      setName(branch?.name ?? "");
      setAddress(branch?.address ?? "");
      setFormat(branch?.attendanceFormat ?? NONE);
    }
  }, [open, branch]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = {
      name,
      address,
      attendanceFormat: format === NONE ? null : format,
    };
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = branch
        ? await updateBranchAction({ id: branch.id, ...input })
        : await createBranchAction(input);
      if (res.success) {
        toast.success(isEdit ? "Branch updated." : "Branch created.");
        onOpenChange(false);
        router.refresh();
      } else {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setErrors({});
          setFormError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit branch" : "New branch"}</DialogTitle>
            <DialogDescription>
              Branches are the work locations you assign employees to on the
              schedule.
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
              <Label>Name</Label>
              <Input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Main Branch"
              />
              {errors.name?.length ? (
                <p className="text-xs text-destructive">{errors.name[0]}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Address (optional)</Label>
              <Input
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, city"
              />
              {errors.address?.length ? (
                <p className="text-xs text-destructive">{errors.address[0]}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Biometric format (optional)</Label>
              <Select value={format} onValueChange={(v) => setFormat(v ?? NONE)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value) =>
                      value === NONE
                        ? "None — no attendance uploads"
                        : (FORMATS.find((f) => f.format === value)?.label ??
                          String(value))
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None — no attendance uploads</SelectItem>
                  {FORMATS.map((f) => (
                    <SelectItem key={f.format} value={f.format}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Which biometric export this branch uses. Set this to allow
                attendance uploads for the branch.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create branch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Self-contained "New Branch" button that opens a create dialog. */
export function NewBranchButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New Branch
      </Button>
      <BranchDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
