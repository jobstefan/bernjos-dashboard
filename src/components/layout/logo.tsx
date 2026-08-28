import { cn } from "@/lib/utils";

/** Simple chef-hat mark echoing the BernJos baker mascots. */
function ChefHatMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M6 14.5C4.2 14.5 3 13.1 3 11.4c0-1.5 1-2.8 2.5-3.1C5.7 5.9 7.6 4 10 4c1.4 0 2.7.7 3.5 1.7A3.8 3.8 0 0 1 15.5 5c2 0 3.6 1.5 3.9 3.4C20.7 8.8 21.5 10 21.5 11.4c0 1.7-1.3 3.1-3.1 3.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.5 14v4.5A1.5 1.5 0 0 0 8 20h8a1.5 1.5 0 0 0 1.5-1.5V14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-amber text-brand-espresso shadow-warm-sm">
        <ChefHatMark className="size-5" />
      </span>
      {!collapsed ? (
        <span className="font-heading text-lg leading-none font-extrabold tracking-tight">
          <span className="text-brand-orange">Bern</span>
          <span className="text-brand-red">Jos</span>
        </span>
      ) : null}
    </div>
  );
}
