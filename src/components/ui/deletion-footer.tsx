"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatDate } from "@/lib/utils/payroll";

interface DeletionFooterProps {
  /** Whether the current user can directly delete (superadmin). */
  canDelete: boolean;
  /** Whether the current user can request deletion (admin). */
  canRequestDeletion: boolean;
  /** ISO string if deletion has already been requested. */
  deletionRequestedAt: string | null;
  /** Label shown in the confirm-delete dialog (e.g. "₱5,000 cash advance"). */
  itemLabel: string;
  onRequestDeletion: () => Promise<{ success: boolean; error?: string }>;
  onDelete: () => Promise<{ success: boolean; error?: string }>;
  onClose: () => void;
}

export function DeletionFooter({
  canDelete,
  canRequestDeletion,
  deletionRequestedAt,
  itemLabel,
  onRequestDeletion,
  onDelete,
  onClose,
}: DeletionFooterProps) {
  const router = useRouter();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  if (!canDelete && !canRequestDeletion) return null;

  const handleRequestDeletion = () => {
    startTransition(async () => {
      const res = await onRequestDeletion();
      if (res.success) {
        toast.success("Deletion request submitted.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await onDelete();
      if (res.success) {
        toast.success("Record deleted.");
        onClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    });
  };

  return (
    <>
      <div className="space-y-2">
        {deletionRequestedAt && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            <span>Deletion requested on {formatDate(deletionRequestedAt)}</span>
          </div>
        )}

        {canDelete ? (
          <Button
            variant="destructive"
            className="w-full"
            disabled={pending}
            onClick={() => setConfirmDeleteOpen(true)}
          >
            {deletionRequestedAt ? "Confirm Delete" : "Delete"}
          </Button>
        ) : canRequestDeletion && !deletionRequestedAt ? (
          <Button
            variant="outline"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={handleRequestDeletion}
          >
            {pending ? "Requesting…" : "Request Deletion"}
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>
              The {itemLabel} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={pending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
