"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Tab {
  value: string;
  label: string;
  content: React.ReactNode;
}

export function EmployeeProfileTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = React.useState(tabs[0]?.value ?? "");

  return (
    <Tabs value={active} onValueChange={setActive}>
      {/* Mobile: select dropdown */}
      <div className="sm:hidden">
        <Select value={active} onValueChange={(v) => { if (v) setActive(v); }}>
          <SelectTrigger className="w-full">
            <SelectValue>
              {(value) => tabs.find((t) => t.value === value)?.label ?? value}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tabs.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: tab strip */}
      <TabsList className="hidden sm:inline-flex">
        {tabs.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabs.map((t) => (
        <TabsContent key={t.value} value={t.value} className="mt-4">
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
