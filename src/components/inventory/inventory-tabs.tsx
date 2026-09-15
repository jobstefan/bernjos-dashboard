"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TABS = [
  { label: "Products", href: "/inventory/products" },
  { label: "Categories", href: "/inventory/categories" },
  { label: "Reorder Levels", href: "/inventory/thresholds" },
  { label: "Transfers", href: "/inventory/transfers" },
  { label: "Corrections", href: "/inventory/corrections" },
  { label: "Cash Release", href: "/inventory/unreleased" },
];

/**
 * Route-based sub-navigation for the inventory admin section, styled with the
 * shared `ui/tabs` (matching `employee-profile-tabs`): a desktop tab strip whose
 * triggers are links, plus a mobile Select fallback.
 */
export function InventoryTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const active =
    TABS.find((t) => pathname === t.href || pathname.startsWith(`${t.href}/`))?.href ?? TABS[0].href;

  return (
    <Tabs value={active}>
      {/* Mobile: select dropdown */}
      <div className="sm:hidden">
        <Select value={active} onValueChange={(v) => v && router.push(v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Inventory" />
          </SelectTrigger>
          <SelectContent>
            {TABS.map((t) => (
              <SelectItem key={t.href} value={t.href}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: tab strip (triggers rendered as links) */}
      <TabsList className="hidden sm:inline-flex">
        {TABS.map((t) => (
          <TabsTrigger key={t.href} value={t.href} render={<Link href={t.href} />}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
