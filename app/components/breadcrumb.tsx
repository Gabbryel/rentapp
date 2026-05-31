import Link from "next/link";

type BreadcrumbItem = { label: string; href?: string };

export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-foreground/60">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden="true" className="text-foreground/30">/</span>
          )}
          {item.href ? (
            <Link
              href={item.href}
              className="hover:text-foreground transition-colors hover:underline decoration-dotted underline-offset-2"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium truncate max-w-[28ch]">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
