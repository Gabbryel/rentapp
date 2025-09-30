import React from "react";

function cn(...args: Array<string | undefined | false | null>) {
  return args.filter(Boolean).join(" ");
}

export default function CardsGrid({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 lg:gap-8",
        className
      )}
    >
      {children}
    </section>
  );
}
