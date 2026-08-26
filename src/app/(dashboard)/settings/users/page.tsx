import { redirect } from "next/navigation";
import { getActor, isAdmin } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RoleSelect } from "@/components/settings/role-select";
import type { Role } from "@/lib/types/payroll";

export default async function UsersSettingsPage() {
  const actor = await getActor();
  if (!isAdmin(actor.role)) redirect("/");

  const users = await prisma.user.findMany({
    include: {
      profile: { where: { deletedAt: null }, select: { id: true, employeeCode: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-sm text-muted-foreground">
          Manage roles for all users. Elevating a user to admin or super admin removes them from payroll.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{users.length} user{users.length === 1 ? "" : "s"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center gap-3 px-6 py-2 border-b bg-muted/40">
            <div className="size-6 shrink-0" />
            <div className="flex-1 text-xs font-medium text-muted-foreground">User</div>
            <div className="w-28 text-xs font-medium text-muted-foreground">Employee</div>
            <div className="w-36 text-xs font-medium text-muted-foreground">Role</div>
          </div>
          <div className="divide-y">
            {users.map((user) => {
              const isSelf = user.clerkId === actor.clerkUserId;
              const name =
                [user.firstName, user.lastName].filter(Boolean).join(" ") || "—";
              const initials = [user.firstName?.[0], user.lastName?.[0]]
                .filter(Boolean)
                .join("")
                .toUpperCase() || "?";
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 px-6 py-3"
                >
                  <Avatar size="sm">
                    {user.imageUrl && <AvatarImage src={user.imageUrl} alt={name} />}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {name}
                      {isSelf && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email ?? "No email"}
                    </p>
                  </div>

                  <div className="w-28">
                    {user.profile ? (
                      <Badge variant="secondary" className="text-xs font-mono">
                        {user.profile.employeeCode}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        No profile
                      </Badge>
                    )}
                  </div>

                  <div className="w-36">
                    <RoleSelect
                      userId={user.id}
                      currentRole={user.role as Role}
                      actorRole={actor.role}
                      isSelf={isSelf}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
