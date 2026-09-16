import { redirect } from "next/navigation";
import { Gauge } from "lucide-react";
import { getCurrentRole, isAdmin } from "@/lib/auth/rbac";
import { getBranches } from "@/server/services/branch.service";
import { getProducts, getThresholds } from "@/server/services/inventory-catalog.service";
import { ThresholdsManager } from "@/components/inventory/thresholds-manager";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function ThresholdsPage() {
  const role = await getCurrentRole();
  if (!isAdmin(role)) redirect("/");

  const [branches, products, thresholds] = await Promise.all([
    getBranches(),
    getProducts(),
    getThresholds(),
  ]);

  const ready = branches.length > 0 && products.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reorder Levels</h1>
        <p className="text-sm text-muted-foreground">
          Per-branch par levels. The catalog and prices are global; how much each branch keeps in
          reserve is set here.
        </p>
      </div>


      {ready ? (
        <ThresholdsManager
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          products={products}
          thresholds={thresholds}
        />
      ) : (
        <EmptyState
          icon={Gauge}
          title="Nothing to set yet"
          description="Add at least one branch and one product before configuring reorder levels."
        />
      )}
    </div>
  );
}
