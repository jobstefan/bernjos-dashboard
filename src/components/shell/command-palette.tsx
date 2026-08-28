"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  LayoutDashboard,
  Wallet,
  Users,
  FileText,
  HandCoins,
  CalendarDays,
  Building2,
  Network,
  PiggyBank,
  Fingerprint,
  Settings,
  Search,
  Plus,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { navForRole, type NavIcon } from "@/components/layout/nav";
import { DialogOverlay } from "@/components/ui/dialog";
import type { Role } from "@/lib/types/payroll";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  payroll: Wallet,
  employees: Users,
  payslip: FileText,
  cashAdvance: HandCoins,
  schedule: CalendarDays,
  branch: Building2,
  department: Network,
  savings: PiggyBank,
  attendance: Fingerprint,
  settings: Settings,
};

/** Role-aware quick actions (navigation shortcuts). */
const QUICK_ACTIONS: {
  label: string;
  href: string;
  roles: Role[];
}[] = [
  { label: "Run Payroll", href: "/payroll", roles: ["super_admin", "admin", "manager"] },
  { label: "Add Employee", href: "/employees/new", roles: ["super_admin", "admin", "manager"] },
  { label: "Manage Employees", href: "/employees", roles: ["super_admin", "admin", "manager"] },
  { label: "Review Attendance", href: "/attendance", roles: ["super_admin", "admin"] },
];

export function CommandPalette({
  role,
  open,
  onOpenChange,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const navItems = navForRole(role);
  const actions = QUICK_ACTIONS.filter((a) => a.roles.includes(role));

  const run = React.useCallback(
    (fn: () => void) => {
      onOpenChange(false);
      fn();
    },
    [onOpenChange],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Popup
          className="fixed top-[12vh] left-1/2 z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-warm-lg ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          aria-label="Command menu"
        >
          <DialogPrimitive.Title className="sr-only">
            Command menu
          </DialogPrimitive.Title>
          <Command
            loop
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <Command.Input
                autoFocus
                placeholder="Search pages and actions…"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Command.List className="max-h-80 overflow-y-auto overflow-x-hidden p-2">
              <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
                No results found.
              </Command.Empty>

              {actions.length > 0 ? (
                <Command.Group heading="Quick actions">
                  {actions.map((action) => (
                    <Item
                      key={action.href}
                      onSelect={() => run(() => router.push(action.href))}
                    >
                      <Plus className="size-4 text-muted-foreground" />
                      {action.label}
                    </Item>
                  ))}
                </Command.Group>
              ) : null}

              <Command.Group heading="Navigate">
                {navItems.map((item) => {
                  const Icon = ICONS[item.icon];
                  return (
                    <Item
                      key={item.href}
                      onSelect={() => run(() => router.push(item.href))}
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      {item.label}
                    </Item>
                  );
                })}
              </Command.Group>

              <Command.Group heading="Preferences">
                <Item
                  onSelect={() =>
                    run(() =>
                      setTheme(resolvedTheme === "dark" ? "light" : "dark"),
                    )
                  }
                >
                  {resolvedTheme === "dark" ? (
                    <Sun className="size-4 text-muted-foreground" />
                  ) : (
                    <Moon className="size-4 text-muted-foreground" />
                  )}
                  Toggle theme
                </Item>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Item({
  children,
  onSelect,
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground outline-none data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground"
    >
      {children}
    </Command.Item>
  );
}
