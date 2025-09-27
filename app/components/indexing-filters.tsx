"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function IndexingFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = params.get("range") || ""; // "15" | "60" | ""

  const setRange = (value: string) => {
    const usp = new URLSearchParams(params.toString());
    if (!value) usp.delete("range"); else usp.set("range", value);
    router.replace(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-foreground/60">Indexare în:</span>
      <button
        type="button"
        onClick={() => setRange(range === "15" ? "" : "15")}
        className={`rounded-md border px-2 py-1 ${range === "15" ? "bg-foreground/10 border-foreground/40" : "border-foreground/20 hover:bg-foreground/5"}`}
        aria-pressed={range === "15"}
      >
        15 zile
      </button>
      <button
        type="button"
        onClick={() => setRange(range === "60" ? "" : "60")}
        className={`rounded-md border px-2 py-1 ${range === "60" ? "bg-foreground/10 border-foreground/40" : "border-foreground/20 hover:bg-foreground/5"}`}
        aria-pressed={range === "60"}
      >
        60 zile
      </button>
    </div>
  );
}
