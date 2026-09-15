"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Large touch-friendly quantity stepper for the kiosk (§5.0). Minus / big number
 * field / plus, sized for thumbs. Never goes below `min` (default 0).
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  className,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  className?: string;
}) {
  const clamp = (n: number) => (Number.isFinite(n) ? Math.max(min, Math.round(n)) : min);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-12 shrink-0"
        aria-label="Decrease"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= min}
      >
        <Minus className="size-5" />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="h-12 w-20 text-center text-xl font-semibold"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-12 shrink-0"
        aria-label="Increase"
        onClick={() => onChange(clamp(value + 1))}
      >
        <Plus className="size-5" />
      </Button>
    </div>
  );
}
