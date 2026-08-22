"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SignOutButton, UserButton } from "@clerk/nextjs";
import {
  LayoutDashboard,
  Wallet,
  Users,
  FileText,
  HandCoins,
  CalendarDays,
  Building2,
  PiggyBank,
  Fingerprint,
  LogOut,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { navForRole, roleLabel, type NavItem } from "@/components/layout/nav";
import { devLogoutAction } from "@/app/actions/dev-auth.actions";
import type { Role } from "@/lib/types/payroll";

const ICONS = {
  dashboard: LayoutDashboard,
  payroll: Wallet,
  employees: Users,
  payslip: FileText,
  cashAdvance: HandCoins,
  schedule: CalendarDays,
  branch: Building2,
  savings: PiggyBank,
  attendance: Fingerprint,
} as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white/10 text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  role,
  pathname,
  onNavigate,
  devAuth,
}: {
  role: Role;
  pathname: string;
  onNavigate?: () => void;
  devAuth?: boolean;
}) {
  const items = navForRole(role);
  return (
    <div className="flex h-full flex-col bg-[#0F172A] text-white">
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex size-8 items-center justify-center rounded-md bg-[#2563EB] font-bold">
          B
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">Bernjos</div>
          <div className="text-xs text-slate-400">Payroll</div>
        </div>
      </div>
      <div className="mt-2 flex-1 overflow-y-auto">
        <NavLinks items={items} pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-4">
        {devAuth ? (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white">
            {roleLabel(role).charAt(0)}
          </div>
        ) : (
          <UserButton />
        )}
        <div className="text-xs">
          <div className="font-medium text-white">Signed in</div>
          <div className="text-slate-400">{roleLabel(role)}</div>
        </div>
        {devAuth ? (
          <form action={devLogoutAction} className="ml-auto">
            <Button
              type="submit"
              variant="ghost"
              size="icon-sm"
              aria-label="Log out"
              title="Log out"
              className="text-slate-300 hover:bg-white/5 hover:text-white"
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
              className="ml-auto text-slate-300 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="size-4" />
            </Button>
          </SignOutButton>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ role, devAuth }: { role: Role; devAuth?: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 md:block">
      <div className="fixed inset-y-0 left-0 w-64">
        <SidebarBody role={role} pathname={pathname} devAuth={devAuth} />
      </div>
    </aside>
  );
}

export function MobileTopbar({ role, devAuth }: { role: Role; devAuth?: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-14 items-center gap-3 border-b border-border bg-white px-4 md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarBody
            role={role}
            pathname={pathname}
            devAuth={devAuth}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>
      <span className="font-semibold">Bernjos Payroll</span>
    </div>
  );
}
