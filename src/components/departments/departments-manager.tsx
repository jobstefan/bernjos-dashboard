"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { DepartmentDialog } from "@/components/departments/department-dialog";
import { PositionDialog } from "@/components/departments/position-dialog";
import { deleteDepartmentAction } from "@/app/actions/department.actions";
import { deletePositionAction } from "@/app/actions/position.actions";
import type {
  DepartmentWithPositions,
  PositionRow,
} from "@/lib/types/organization";

export function DepartmentsManager({
  departments,
}: {
  departments: DepartmentWithPositions[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const [editDept, setEditDept] =
    React.useState<DepartmentWithPositions | null>(null);
  const [deleteDept, setDeleteDept] =
    React.useState<DepartmentWithPositions | null>(null);

  // Adding a position under a specific department (picker locked).
  const [addUnder, setAddUnder] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [editPosition, setEditPosition] = React.useState<PositionRow | null>(
    null,
  );
  const [deletePos, setDeletePos] = React.useState<PositionRow | null>(null);

  const departmentChoices = React.useMemo(
    () => departments.map((d) => ({ id: d.id, name: d.name })),
    [departments],
  );

  return (
    <div className="space-y-4">
      {departments.map((dept) => (
        <Card key={dept.id}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-x-2 gap-y-2 space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base">{dept.name}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {dept.positionCount} position
                {dept.positionCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setAddUnder({ id: dept.id, name: dept.name })
                }
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Add position</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Department actions"
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditDept(dept)}>
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteDept(dept)}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardHeader>
          <CardContent>
            {dept.positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No positions yet.
              </p>
            ) : (
              <ul className="divide-y">
                {dept.positions.map((pos) => (
                  <li
                    key={pos.id}
                    className="flex items-center justify-between gap-2 py-2"
                  >
                    <span className="min-w-0 truncate text-sm">{pos.name}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Position actions"
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        }
                      />
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditPosition(pos)}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeletePos(pos)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Edit department */}
      <DepartmentDialog
        department={editDept}
        open={editDept !== null}
        onOpenChange={(open) => !open && setEditDept(null)}
      />

      {/* Add position under a specific department (locked picker) */}
      <PositionDialog
        departments={departmentChoices}
        defaultDepartmentId={addUnder?.id}
        lockDepartment
        open={addUnder !== null}
        onOpenChange={(open) => !open && setAddUnder(null)}
      />

      {/* Edit position (picker available to move it) */}
      <PositionDialog
        position={editPosition}
        departments={departmentChoices}
        open={editPosition !== null}
        onOpenChange={(open) => !open && setEditPosition(null)}
      />

      {/* Delete department */}
      <AlertDialog
        open={deleteDept !== null}
        onOpenChange={(open) => !open && setDeleteDept(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this department?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDept
                ? `"${deleteDept.name}" and its ${deleteDept.positionCount} position${
                    deleteDept.positionCount === 1 ? "" : "s"
                  } will be removed. Employees keep their stored department name, but it won't be selectable.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!deleteDept) return;
                startTransition(async () => {
                  const res = await deleteDepartmentAction(deleteDept.id);
                  if (res.success) {
                    toast.success("Department deleted.");
                    setDeleteDept(null);
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

      {/* Delete position */}
      <AlertDialog
        open={deletePos !== null}
        onOpenChange={(open) => !open && setDeletePos(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this position?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletePos
                ? `"${deletePos.name}" will be removed and won't be selectable on the employee form.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!deletePos) return;
                startTransition(async () => {
                  const res = await deletePositionAction(deletePos.id);
                  if (res.success) {
                    toast.success("Position deleted.");
                    setDeletePos(null);
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
    </div>
  );
}
