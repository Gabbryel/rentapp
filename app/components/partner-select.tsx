"use client";

import { useEffect, useMemo, useState } from "react";

type Partner = {
  id: string;
  name: string;
};

type Props = {
  // Name of the field that will carry the selected partner ID
  idName: string;
  // Name of the field that will carry the selected partner name (hidden input)
  nameName: string;
  // Optional preselected values
  defaultId?: string;
  defaultName?: string;
  required?: boolean;
};

export default function PartnerSelect({
  idName,
  nameName,
  defaultId,
  defaultName,
  required,
}: Props) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedId, setSelectedId] = useState<string>(defaultId || "");
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/partners", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setPartners(Array.isArray(data) ? data : []);
      } catch {}
    })();
    return () => {
      aborted = true;
    };
  }, []);

  // Derive selected name from id or defaultName
  const selectedName = useMemo(() => {
    if (selectedId) {
      const p = partners.find((x) => x.id === selectedId);
      if (p) return p.name;
    }
    // fallback to defaultName when no id is set or not found
    return defaultName || "";
  }, [selectedId, partners, defaultName]);

  // If no id but we have defaultName and the list includes it, pick the matching id
  useEffect(() => {
    if (!selectedId && defaultName && partners.length > 0) {
      const found = partners.find((p) => p.name === defaultName);
      if (found) setSelectedId(found.id);
    }
  }, [selectedId, defaultName, partners]);

  return (
    <div>
      <select
        name={idName}
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        required={required}
        className="mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
      >
        <option value="">— alege —</option>
        {partners.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {/* Keep denormalized name in a hidden field for convenience/display */}
      <input type="hidden" name={nameName} value={selectedName} />
    </div>
  );
}
