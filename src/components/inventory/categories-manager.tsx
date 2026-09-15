"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from "@/app/actions/inventory-catalog.actions";
import type { CategoryRow } from "@/lib/types/inventory";

export function CategoriesManager({ rows }: { rows: CategoryRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [newName, setNewName] = React.useState("");
  const [editing, setEditing] = React.useState<string | null>(null);
  const [editName, setEditName] = React.useState("");
  const [toDelete, setToDelete] = React.useState<CategoryRow | null>(null);

  function add() {
    const name = newName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await createCategoryAction({ name });
      if (res.success) {
        toast.success("Category added.");
        setNewName("");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function saveEdit(id: string) {
    const name = editName.trim();
    if (!name) return;
    startTransition(async () => {
      const res = await updateCategoryAction({ id, name });
      if (res.success) {
        toast.success("Category updated.");
        setEditing(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New category name (e.g. Bread, Dry Goods)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="max-w-xs"
        />
        <Button onClick={add} disabled={pending || !newName.trim()}>
          <Plus className="size-4" /> Add
        </Button>
      </div>

      <div className="divide-y divide-border rounded-xl border border-border bg-card">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 px-4 py-3">
            {editing === row.id ? (
              <>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="max-w-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      saveEdit(row.id);
                    }
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
                <Button size="sm" onClick={() => saveEdit(row.id)} disabled={pending}>
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <span className="font-medium">{row.name}</span>
                <span className="text-xs text-muted-foreground">
                  {row.productCount} product{row.productCount === 1 ? "" : "s"}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit"
                    onClick={() => {
                      setEditing(row.id);
                      setEditName(row.name);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Delete"
                    className="text-destructive"
                    onClick={() => setToDelete(row)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete
                ? `"${toDelete.name}" will be removed. Categories still used by a product can't be deleted.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (!toDelete) return;
                startTransition(async () => {
                  const res = await deleteCategoryAction(toDelete.id);
                  if (res.success) {
                    toast.success("Category deleted.");
                    setToDelete(null);
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
