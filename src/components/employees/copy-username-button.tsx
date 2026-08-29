"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyUsernameButton({ username }: { username: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Copy username"
      onClick={() => navigator.clipboard.writeText(username)}
    >
      <Copy className="size-4" />
    </Button>
  );
}
