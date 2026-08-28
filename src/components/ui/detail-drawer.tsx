"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface DetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Optional sticky footer (e.g. a save button row). */
  footer?: React.ReactNode;
  /** Max-width class, defaults to sm:max-w-md. */
  className?: string;
  children: React.ReactNode;
}

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  footer,
  className,
  children,
}: DetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex w-full flex-col sm:max-w-md", className)}
      >
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">{children}</div>

        {footer && (
          <div className="border-t px-4 py-3">{footer}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
