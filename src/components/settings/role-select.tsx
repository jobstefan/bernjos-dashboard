"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateUserRoleAction } from "@/app/actions/user.actions";
import { roleLabel } from "@/components/layout/nav";
import type { Role } from "@/lib/types/payroll";

const ALL_ROLES: Role[] = ["super_admin", "admin", "manager", "employee"];

export function RoleSelect({
  userId,
  currentRole,
  actorRole,
  isSelf,
}: {
  userId: string;
  currentRole: Role;
  actorRole: Role;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (isSelf) {
    return (
      <Select value={currentRole} disabled>
        <SelectTrigger className="w-36">
          <SelectValue>{roleLabel(currentRole)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={currentRole}>{roleLabel(currentRole)}</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  function handleChange(newRole: string | null) {
    if (!newRole) return;
    startTransition(async () => {
      const res = await updateUserRoleAction({ userId, role: newRole });
      if (res.success) {
        toast.success("Role updated.");
      } else {
        toast.error(res.error ?? "Failed to update role.");
      }
    });
  }

  return (
    <Select
      value={currentRole}
      onValueChange={handleChange}
      disabled={pending}
    >
      <SelectTrigger className="w-36">
        <SelectValue>{roleLabel(currentRole)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {ALL_ROLES.map((role) => {
          // Admins cannot assign admin/super_admin — only super_admin can
          const restricted =
            actorRole === "admin" &&
            (role === "admin" || role === "super_admin");
          return (
            <SelectItem key={role} value={role} disabled={restricted}>
              {roleLabel(role)}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
