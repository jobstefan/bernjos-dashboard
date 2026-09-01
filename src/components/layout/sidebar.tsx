"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Wallet,
  Users,
  FileText,
  HandCoins,
  TriangleAlert,
  CalendarDays,
  Building2,
  Network,
  PiggyBank,
  Fingerprint,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import {
  navGroupsForRole,
  roleLabel,
  type NavIcon,
} from "@/components/layout/nav";
import { devLogoutAction } from "@/app/actions/dev-auth.actions";
import type { Role } from "@/lib/types/payroll";

const ICONS: Record<NavIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  payroll: Wallet,
  employees: Users,
  payslip: FileText,
  cashAdvance: HandCoins,
  charge: TriangleAlert,
  schedule: CalendarDays,
  branch: Building2,
  department: Network,
  savings: PiggyBank,
  attendance: Fingerprint,
  settings: Settings,
};

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarBody({
  role,
  pathname,
  onNavigate,
  devAuth,
  collapsed = false,
  displayName = "",
}: {
  role: Role;
  pathname: string;
  onNavigate?: () => void;
  devAuth?: boolean;
  collapsed?: boolean;
  displayName?: string;
}) {
  const groups = navGroupsForRole(role);
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "flex h-16 items-center px-5",
          collapsed && "justify-center px-0",
        )}
      >
        <Logo collapsed={collapsed} />
      </div>

      <div className="mt-1 flex-1 overflow-y-auto px-3 pb-4">
        <nav className="flex flex-col gap-4" aria-label="Main">
          {groups.map((group, gi) => (
            <div key={group.label ?? `group-${gi}`} className="flex flex-col gap-1">
              {group.label && !collapsed ? (
                <div className="px-3 pt-2 pb-1 text-[0.68rem] font-semibold tracking-wider text-sidebar-foreground/45 uppercase">
                  {group.label}
                </div>
              ) : null}
              {group.label && collapsed && gi > 0 ? (
                <div className="mx-auto my-1 h-px w-6 bg-sidebar-border" />
              ) : null}
              {group.items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center px-0",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    {active ? (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                    ) : null}
                    <Icon className="size-4 shrink-0" />
                    {!collapsed ? item.label : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      <div
        className={cn(
          "flex items-center gap-3 border-t border-sidebar-border px-4 py-4",
          collapsed && "justify-center px-0",
        )}
      >
        {/* Avatar — initial from name, falls back to role label initial */}
        <div
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/15 text-sm font-semibold text-sidebar-primary"
          aria-hidden
        >
          {(displayName || roleLabel(role)).charAt(0).toUpperCase()}
        </div>

        {!collapsed ? (
          <>
            <div className="min-w-0 flex-1 text-xs">
              <div className="truncate font-medium text-sidebar-foreground">
                {displayName || roleLabel(role)}
              </div>
              <div className="truncate text-sidebar-foreground/60">
                {roleLabel(role)}
              </div>
            </div>
            {devAuth ? (
              <form action={devLogoutAction} className="shrink-0">
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Log out"
                  title="Log out"
                  className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <LogOut className="size-4" />
                </Button>
              </form>
            ) : (
              <SignOutButton>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Log out"
                  title="Log out"
                  className="shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                >
                  <LogOut className="size-4" />
                </Button>
              </SignOutButton>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
