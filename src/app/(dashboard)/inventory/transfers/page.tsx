import { redirect } from "next/navigation";
import { getCurrentRole, canManageInventory, isAdmin } from "@/lib/auth/rbac";
import { getAllTransfers } from "@/server/services/stock-transfer.service";
import { TransfersAdmin } from "@/components/inventory/transfers-admin";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const role = await getCurrentRole();
  if (!canManageInventory(role)) redirect("/");

  const transfers = await getAllTransfers();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Stock Transfers</h1>
        <p className="text-sm text-muted-foreground">
          Approve branch requests and resolve prepared-vs-received discrepancies.
        </p>
      </div>


      <TransfersAdmin transfers={transfers} canResolve={isAdmin(role)} />
    </div>
  );
}
