"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { resetEmployeePasswordAction } from "@/app/actions/employee.actions";

/**
 * Admin-only "reset password" control. Resets the employee's Clerk login back to
 * the temporary password (`1234`) and re-arms first-login onboarding, for the
 * common case where an employee with no email forgets their password.
 */
export function ResetPasswordButton({ employeeId }: { employeeId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onConfirm() {
    setPending(true);
    const res = await resetEmployeePasswordAction(employeeId);
    setPending(false);
    if (res.success) {
      setOpen(false);
      toast.success("Password reset.", {
        description:
          'Temporary password is "1234" again. The employee sets a new one on next sign-in.',
        duration: 10000,
      });
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button variant="outline" size="sm">
            <KeyRound className="size-4" /> Reset password
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset this employee&apos;s password?</AlertDialogTitle>
          <AlertDialogDescription>
            Their password becomes the temporary <strong>1234</strong> again and
            they&apos;ll be asked to set a new one the next time they sign in.
            Their current password stops working immediately.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {pending ? "Resetting…" : "Reset password"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
