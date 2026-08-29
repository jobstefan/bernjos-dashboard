"use client";

import * as React from "react";
import { useBreadcrumbTitle } from "@/contexts/breadcrumb-title";

export function SetBreadcrumbTitle({ title }: { title: string }) {
  const { setTitle } = useBreadcrumbTitle();
  React.useEffect(() => {
    setTitle(title);
    return () => setTitle(null);
  }, [title, setTitle]);
  return null;
}
