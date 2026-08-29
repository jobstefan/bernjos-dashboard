"use client";

import * as React from "react";

interface BreadcrumbTitleContextValue {
  title: string | null;
  setTitle: (title: string | null) => void;
}

const BreadcrumbTitleContext = React.createContext<BreadcrumbTitleContextValue>({
  title: null,
  setTitle: () => {},
});

export function BreadcrumbTitleProvider({ children }: { children: React.ReactNode }) {
  const [title, setTitle] = React.useState<string | null>(null);
  return (
    <BreadcrumbTitleContext value={{ title, setTitle }}>
      {children}
    </BreadcrumbTitleContext>
  );
}

export function useBreadcrumbTitle() {
  return React.useContext(BreadcrumbTitleContext);
}
