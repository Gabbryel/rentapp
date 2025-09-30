"use client";

import { PropsWithChildren } from "react";

// Wrap tables to provide horizontal scrolling on small screens and reduce padding
export default function ResponsiveTableWrapper({
  children,
}: PropsWithChildren) {
  return (
    <div className="overflow-x-auto rounded-lg border border-foreground/15 bg-background/60">
      {children}
    </div>
  );
}
