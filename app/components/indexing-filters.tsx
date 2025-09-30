"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function IndexingFilters() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const range = params.get("range") || ""; // "15" | "60" | ""
  const filterBy = params.get("filterBy") || "indexing"; // "indexing" | "end"

  const setRange = (value: string) => {
    const usp = new URLSearchParams(params.toString());
    if (!value) usp.delete("range");
    else usp.set("range", value);
    router.replace(`${pathname}?${usp.toString()}`);
  };

  const setFilterBy = (value: "indexing" | "end") => {
    const usp = new URLSearchParams(params.toString());
    if (value === "indexing") usp.delete("filterBy");
    else usp.set("filterBy", value);
    router.replace(`${pathname}?${usp.toString()}`);
  };

  return (
    <div className="flex items-center gap-3 text-xs flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-foreground/60">Filtrează după:</span>
        <button
          type="button"
          onClick={() => setFilterBy("indexing")}
          className={`rounded-md border px-2 py-1 ${
            filterBy === "indexing"
              ? "bg-foreground/10 border-foreground/40"
              : "border-foreground/20 hover:bg-foreground/5"
          }`}
          aria-pressed={filterBy === "indexing"}
        >
          dată indexare
        </button>
        <button
          type="button"
          onClick={() => setFilterBy("end")}
          className={`rounded-md border px-2 py-1 ${
            filterBy === "end"
              ? "bg-foreground/10 border-foreground/40"
              : "border-foreground/20 hover:bg-foreground/5"
          }`}
          aria-pressed={filterBy === "end"}
        >
          dată expirare
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-foreground/60">În următoarele:</span>
        <button
          type="button"
          onClick={() => setRange(range === "15" ? "" : "15")}
          className={`rounded-md border px-2 py-1 ${
            range === "15"
              ? "bg-foreground/10 border-foreground/40"
              : "border-foreground/20 hover:bg-foreground/5"
          }`}
          aria-pressed={range === "15"}
        >
          15 zile
        </button>
        <button
          type="button"
          onClick={() => setRange(range === "60" ? "" : "60")}
          className={`rounded-md border px-2 py-1 ${
            range === "60"
              ? "bg-foreground/10 border-foreground/40"
              : "border-foreground/20 hover:bg-foreground/5"
          }`}
          aria-pressed={range === "60"}
        >
          60 zile
        </button>
      </div>
    </div>
  );
}
