import * as React from "react";
import { Logo } from "@/components/layout/logo";

/** Shared full-screen wrapper for sign-in and onboarding pages. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-[#1e1610] p-6">
      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[700px] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-72 w-72 rounded-full bg-orange-700/8 blur-3xl"
        aria-hidden
      />

      {/* Brand header */}
      <div className="relative mb-8 flex flex-col items-center gap-3">
        <Logo />
        <p className="text-sm text-[#b5a898]">Payroll &amp; HR · Bakery Operations</p>
      </div>

      {/* Main content (sign-in widget, onboarding card, etc.) */}
      <div className="relative w-full max-w-sm">{children}</div>

      <p className="relative mt-8 text-center text-xs text-[#7a6e60]">
        © {new Date().getFullYear()} BernJos Bread &amp; Pastries
      </p>
    </div>
  );
}
