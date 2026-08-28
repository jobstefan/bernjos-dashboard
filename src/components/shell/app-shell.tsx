"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { SidebarBody } from "@/components/layout/sidebar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { CommandPalette } from "@/components/shell/command-palette";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import type { Role } from "@/lib/types/payroll";

const COLLAPSE_KEY = "bernjos:sidebar-collapsed";

export function AppShell({
  role,
  devAuth,
  children,
}: {
  role: Role;
  devAuth: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  // Restore persisted collapse state after mount (avoids hydration mismatch).
  React.useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  // ⌘K / Ctrl+K opens the command palette.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden shrink-0 border-r border-sidebar-border transition-[width] duration-200 md:block",
          collapsed ? "w-[4.5rem]" : "w-64",
        )}
      >
        <SidebarBody
          role={role}
          pathname={pathname}
          devAuth={devAuth}
          collapsed={collapsed}
        />
      </aside>

      <div className={cn("transition-[padding] duration-200", collapsed ? "md:pl-[4.5rem]" : "md:pl-64")}>
        {/* Sticky top bar */}
        <header className="glass sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border px-4 sm:px-6">
          {/* Mobile menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden">
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
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>

          {/* Desktop collapse toggle */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={toggleCollapsed}
            className="hidden md:inline-flex"
          >
            {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          </Button>

          <Breadcrumbs className="hidden min-w-0 sm:flex" />

          <div className="ml-auto flex items-center gap-1.5">
            {/* Command palette trigger */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 w-48 items-center gap-2 rounded-lg border border-border bg-background/60 px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:w-56 md:w-64"
            >
              <Search className="size-4 shrink-0" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[0.65rem]">
                ⌘K
              </kbd>
            </button>

            <ThemeToggle />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>

      <CommandPalette role={role} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
