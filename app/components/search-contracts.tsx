"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  initialQuery?: string;
  placeholder?: string;
};

export default function SearchContracts({
  initialQuery = "",
  placeholder = "Caută contracte (nume, partener)",
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);

  // Keep in sync if user navigates back/forward
  useEffect(() => {
    const q = searchParams.get("q") || "";
    setValue(q);
  }, [searchParams]);

  // Debounced push to URL
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams(Array.from(searchParams.entries()));
      if (value) params.set("q", value);
      else params.delete("q");
      router.replace(`${pathname}?${params.toString()}`);
    }, 250);
    return () => clearTimeout(t);
  }, [value, pathname, router, searchParams]);

  const onClear = () => setValue("");

  return (
    <div className="relative w-full sm:w-80">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none ring-offset-0 focus:border-foreground/40"
      />
      {value ? (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/50 hover:text-foreground/80 text-xs"
          aria-label="Șterge căutarea"
          title="Șterge căutarea"
        >
          ✕
        </button>
      ) : null}
    </div>
  );
}
