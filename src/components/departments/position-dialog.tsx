"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
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
  createPositionAction,
  updatePositionAction,
} from "@/app/actions/position.actions";
import type { PositionRow } from "@/lib/types/organization";

interface DepartmentChoice {
  id: string;
  name: string;
}

/**
 * Shared create/edit form for positions. `position` present = edit mode.
 * `lockDepartment` hides the picker when the parent department is fixed (the
 * "add position under X" flow).
 */
export function PositionDialog({
  position,
  departments,
  defaultDepartmentId,
  lockDepartment = false,
  open,
  onOpenChange,
}: {
  position?: PositionRow | null;
  departments: DepartmentChoice[];
  defaultDepartmentId?: string;
  lockDepartment?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Record<string, string[]>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [departmentId, setDepartmentId] = React.useState("");
  const [shiftHours, setShiftHours] = React.useState<number>(8);
  const isEdit = Boolean(position);

  React.useEffect(() => {
    if (open) {
      setName(position?.name ?? "");
      setDepartmentId(position?.departmentId ?? defaultDepartmentId ?? "");
      setShiftHours(position?.shiftHours ?? 8);
    }
  }, [open, position, defaultDepartmentId]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const res = position
        ? await updatePositionAction({ id: position.id, name, departmentId, shiftHours })
        : await createPositionAction({ name, departmentId, shiftHours });
      if (res.success) {
        toast.success(isEdit ? "Position updated." : "Position created.");
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
              {isEdit ? "Edit position" : "New position"}
            </DialogTitle>
            <DialogDescription>
              Positions are the job titles nested under a department.
            </DialogDescription>
          </DialogHeader>

          {formError ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}

          <div className="grid gap-4 py-4">
            {!lockDepartment ? (
              <div className="grid gap-2">
                <Label>Department</Label>
                <Select
                  value={departmentId}
                  onValueChange={(v) => setDepartmentId(v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a department">
                      {(value) =>
                        departments.find((d) => d.id === value)?.name ??
                        "Select a department"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.departmentId?.length ? (
                  <p className="text-xs text-destructive">
                    {errors.departmentId[0]}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Cashier"
              />
              {errors.name?.length ? (
                <p className="text-xs text-destructive">{errors.name[0]}</p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Standard shift</Label>
              <div className="flex gap-2">
                {[8, 10, 12].map((h) => (
                  <Button
                    key={h}
                    type="button"
                    variant={shiftHours === h ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setShiftHours(h)}
                  >
                    {h}h
                  </Button>
                ))}
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={shiftHours}
                  onChange={(e) => setShiftHours(Number(e.target.value))}
                  className="w-20 text-center"
                  aria-label="Custom shift hours"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Used to compute the per-minute rate for deductions and overtime.
              </p>
              {errors.shiftHours?.length ? (
                <p className="text-xs text-destructive">{errors.shiftHours[0]}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create position"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
