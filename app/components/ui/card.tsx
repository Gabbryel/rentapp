import React from "react";

function cn(...args: Array<string | undefined | false | null>) {
  return args.filter(Boolean).join(" ");
}

export default function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "rounded-xl border border-foreground/15 p-6 sm:p-7 hover:border-foreground/30 transition-colors",
        "text-base bg-background/60 shadow-sm space-y-4 sm:space-y-5 overflow-hidden",
        className
      )}
    >
      {children}
    </article>
  );
}
