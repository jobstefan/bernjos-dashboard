"use client";

import * as React from "react";
import { toast } from "sonner";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildScheduleText } from "@/lib/utils/schedule";
import type { AbsentEntry } from "@/lib/utils/schedule";
import type { ScheduleRow } from "@/lib/types/schedule";

export function CopyScheduleButton({
  dateIso,
  rows,
  absentEmployees = [],
}: {
  dateIso: string;
  rows: ScheduleRow[];
  absentEmployees?: AbsentEntry[];
}) {
  const [copied, setCopied] = React.useState(false);

  async function onCopy() {
    const text = buildScheduleText(dateIso, rows, absentEmployees);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Schedule copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  return (
    <Button type="button" variant="outline" onClick={onCopy}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      Copy
    </Button>
  );
}
