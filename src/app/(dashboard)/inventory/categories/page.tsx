import { redirect } from "next/navigation";
import { Tag } from "lucide-react";
import { getCurrentRole, isAdmin } from "@/lib/auth/rbac";
import { getCategories } from "@/server/services/inventory-catalog.service";
import { CategoriesManager } from "@/components/inventory/categories-manager";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function CategoriesPage() {
  const role = await getCurrentRole();
  if (!isAdmin(role)) redirect("/");

  const rows = await getCategories();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
        <p className="text-sm text-muted-foreground">
          Group products for faster lookup in the kiosk and category rollups in reports.
        </p>
      </div>

      <InventoryTabs />

      {rows.length === 0 ? (
        <div className="space-y-4">
          <CategoriesManager rows={rows} />
          <EmptyState
            icon={Tag}
            title="No categories yet"
            description="Add categories like Bread, Pastries, Drinks (sale) or Dry Goods, Dairy, Packaging (production)."
          />
        </div>
      ) : (
        <CategoriesManager rows={rows} />
      )}
    </div>
  );
}
