import { redirect } from "next/navigation";
import { Package } from "lucide-react";
import { getCurrentRole, isAdmin } from "@/lib/auth/rbac";
import { getProducts, getCategories } from "@/server/services/inventory-catalog.service";
import { ProductsTable } from "@/components/inventory/products-table";
import { NewProductButton } from "@/components/inventory/product-dialog";
import { InventoryTabs } from "@/components/inventory/inventory-tabs";
import { EmptyState } from "@/components/payroll/empty-state";

export default async function ProductsPage() {
  const role = await getCurrentRole();
  if (!isAdmin(role)) redirect("/");

  const [rows, categories] = await Promise.all([getProducts(), getCategories()]);
  const canManage = isAdmin(role);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} product{rows.length === 1 ? "" : "s"} in the global catalog
          </p>
        </div>
        {rows.length > 0 && canManage ? <NewProductButton categories={categories} /> : null}
      </div>

      <InventoryTabs />

      {rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description={
            categories.length === 0
              ? "Add a category first, then create your sale and production items."
              : "Create your sale items (bread, drinks) and production items (flour, sugar)."
          }
          action={canManage ? <NewProductButton categories={categories} /> : undefined}
        />
      ) : (
        <ProductsTable rows={rows} categories={categories} canManage={canManage} />
      )}
    </div>
  );
}
