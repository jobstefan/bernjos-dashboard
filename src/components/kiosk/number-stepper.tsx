"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Large touch-friendly quantity stepper for the kiosk (§5.0). Minus / big number
 * field / plus, sized for thumbs. Never goes below `min` (default 0).
 *
 * The input allows an empty string while the user is clearing it; the parent
 * receives 0 for an empty field. External value changes (e.g. preset buttons)
 * sync the display back to the new number.
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

  // Keep a local string so the input can be empty while the parent holds 0.
  const [raw, setRaw] = React.useState<string>(String(value));
  // Track the last value we pushed to the parent so we can distinguish our own
  // onChange round-trips from genuine external changes (e.g. preset buttons).
  const lastPushed = React.useRef<number>(value);

  React.useEffect(() => {
    if (value !== lastPushed.current) {
      // Value changed from outside — sync display.
      lastPushed.current = value;
      setRaw(String(value));
    }
  }, [value]);

  function step(delta: number) {
    const next = clamp(value + delta);
    lastPushed.current = next;
    setRaw(String(next));
    onChange(next);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const text = e.target.value;
    setRaw(text);
    const n = text === "" ? 0 : Number(text);
    if (!Number.isNaN(n)) {
      const clamped = clamp(n);
      lastPushed.current = clamped;
      onChange(clamped);
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-12 shrink-0"
        aria-label="Decrease"
        onClick={() => step(-1)}
        disabled={value <= min}
      >
        <Minus className="size-5" />
      </Button>
      <Input
        type="number"
        inputMode="numeric"
        min={min}
        value={raw}
        onChange={handleChange}
        className="h-12 w-20 text-center text-xl font-semibold"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-12 shrink-0"
        aria-label="Increase"
        onClick={() => step(1)}
      >
        <Plus className="size-5" />
      </Button>
    </div>
  );
}
