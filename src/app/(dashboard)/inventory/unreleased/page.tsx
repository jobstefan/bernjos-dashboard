import { redirect } from "next/navigation";
import { getCurrentRole, isAdmin } from "@/lib/auth/rbac";
import {
  listReleasedUnapplied,
  listUnreleased,
} from "@/server/services/inventory-release.service";
import { UnreleasedView } from "@/components/inventory/unreleased-view";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";

export const dynamic = "force-dynamic";

export default async function UnreleasedPage() {
  const role = await getCurrentRole();
  if (!isAdmin(role)) redirect("/");

  const [unreleased, released] = await Promise.all([listUnreleased(), listReleasedUnapplied()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cash Release Oversight</h1>
        <p className="text-sm text-muted-foreground">
          Cross-branch view of advances and loans awaiting branch release, and released items you
          can still correct.
        </p>
      </div>

      <InventoryTabs />

      <UnreleasedView unreleased={unreleased} released={released} />
    </div>
  );
}
