import * as React from "react";
import { Clock, Banknote, Users } from "lucide-react";
import { Logo } from "@/components/layout/logo";

/** Selling points shown on the brand panel (desktop only). */
const FEATURES = [
  { icon: Clock, label: "Time & attendance", hint: "Biometric punches, synced" },
  { icon: Banknote, label: "Payroll runs", hint: "Cutoffs, payslips, deductions" },
  { icon: Users, label: "People & pay", hint: "Employees, loans, savings" },
] as const;

/**
 * Shared full-screen wrapper for the sign-in, sign-up, and onboarding pages.
 * Two-column on desktop — a branded marketing panel on the left, the auth form
 * on the right — collapsing to a single centered column with a compact header
 * on mobile.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh md:grid-cols-2 lg:grid-cols-[1.05fr_0.95fr]">
      {/* Left — brand panel (desktop only) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#1e1610] p-10 lg:p-14 md:flex">
        {/* Ambient warmth */}
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[760px] -translate-x-1/2 rounded-full bg-amber-500/12 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-700/10 blur-3xl"
          aria-hidden
        />

        {/* Top: logo */}
        <div className="relative">
          <Logo />
        </div>

        {/* Middle: headline + feature list */}
        <div className="relative max-w-md">
          <h2 className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-[#ede8dd] lg:text-4xl">
            Payroll &amp; HR for bakery operations.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-[#b5a898]">
            Time, people, and finance for BernJos Bread &amp; Pastries — in one
            place.
          </p>

          <ul className="mt-8 space-y-4">
            {FEATURES.map(({ icon: Icon, label, hint }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#e5a44a]">
                  <Icon className="size-4" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-[#ede8dd]">{label}</p>
                  <p className="text-xs text-[#7a6e60]">{hint}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: copyright */}
        <p className="relative text-xs text-[#7a6e60]">
          {`© ${new Date().getFullYear()} BernJos Bread & Pastries`}
        </p>
      </aside>

      {/* Right — form panel */}
      <main className="relative flex flex-col items-center justify-center overflow-hidden bg-[#241a12] p-6">
        {/* Subtle glow on mobile, where the brand panel is hidden */}
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-72 w-96 -translate-x-1/2 rounded-full bg-amber-500/8 blur-3xl md:hidden"
          aria-hidden
        />

        {/* Compact brand header (mobile only) */}
        <div className="relative mb-8 flex flex-col items-center gap-3 md:hidden">
          <Logo />
          <p className="text-sm text-[#b5a898]">Payroll &amp; HR · Bakery Operations</p>
        </div>

        <div className="relative w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
