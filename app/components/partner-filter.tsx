"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type PartnerOption = { id: string; name: string };

export default function PartnerFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  const [loading, setLoading] = useState(false);

  const selected = searchParams.get("partner") || "";

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/partners");
        const data = (await res.json()) as { id: string; name: string }[];
        if (active)
          setPartners(
            data
              .filter((p) => p && p.id && p.name)
              .sort((a, b) => a.name.localeCompare(b.name))
          );
      } catch {
        if (active) setPartners([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const onChange = (id: string) => {
    const params = new URLSearchParams(Array.from(searchParams.entries()));
    if (id) params.set("partner", id);
    else params.delete("partner");
    router.replace(`${pathname}?${params.toString()}`);
  };

  const opts = useMemo(() => partners, [partners]);

  return (
    <div className="relative w-full sm:w-72">
      <select
        className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Filtrează după partener"
        title="Filtrează după partener"
      >
        <option value="">Toți partenerii</option>
        {loading ? (
          <option disabled>Se încarcă…</option>
        ) : (
          opts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
