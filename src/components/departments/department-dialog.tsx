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
  createDepartmentAction,
  updateDepartmentAction,
} from "@/app/actions/department.actions";
import type { DepartmentRow } from "@/lib/types/organization";

/** Shared create/edit form. `department` present = edit mode. */
export function DepartmentDialog({
  department,
  open,
  onOpenChange,
}: {
  department?: DepartmentRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const isEdit = Boolean(department);

  React.useEffect(() => {
    if (open) setName(department?.name ?? "");
  }, [open, department]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = department
        ? await updateDepartmentAction({ id: department.id, name })
        : await createDepartmentAction({ name });
      if (res.success) {
        toast.success(isEdit ? "Department updated." : "Department created.");
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
            <DialogTitle>
              {isEdit ? "Edit department" : "New department"}
            </DialogTitle>
            <DialogDescription>
              Departments group the positions you assign employees to.
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
                placeholder="e.g. Operations"
              />
              {errors.name?.length ? (
                <p className="text-xs text-destructive">{errors.name[0]}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Self-contained "New Department" button that opens a create dialog. */
export function NewDepartmentButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New Department
      </Button>
      <DepartmentDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
