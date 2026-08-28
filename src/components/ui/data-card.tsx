import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

export interface DataCardField {
  label: string;
  value: React.ReactNode;
}

export function DataCard({
  title,
  subtitle,
  fields,
  actions,
  onClick,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  fields: DataCardField[];
  actions?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "overflow-hidden shadow-warm-sm",
        onClick && "cursor-pointer transition-colors hover:bg-accent/30",
        className,
      )}
      onClick={onClick}
    >
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{title}</div>
            {subtitle ? (
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {subtitle}
              </div>
            ) : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {fields.map((f, i) => (
            <div key={i} className="space-y-0.5">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm">{f.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
