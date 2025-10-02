"use client";

import { useEffect, useMemo, useState } from "react";

type Owner = {
  id: string;
  name: string;
};

type Props = {
  // Name of the field that will carry the selected owner ID
  idName: string;
  // Name of the field that will carry the selected owner name (hidden input)
  nameName: string;
  // Optional preselected values
  defaultId?: string;
  defaultName?: string;
  required?: boolean;
};

export default function OwnerSelect({
  idName,
  nameName,
  defaultId,
  defaultName,
  required,
}: Props) {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selectedId, setSelectedId] = useState<string>(defaultId || "");

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/owners", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setOwners(Array.isArray(data) ? data : []);
      } catch {}
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const selectedName = useMemo(() => {
    if (selectedId) {
      const o = owners.find((x) => x.id === selectedId);
      if (o) return o.name;
    }
    return defaultName || "";
  }, [selectedId, owners, defaultName]);

  useEffect(() => {
    if (!selectedId && defaultName && owners.length > 0) {
      const found = owners.find((o) => o.name === defaultName);
      if (found) setSelectedId(found.id);
    }
  }, [selectedId, defaultName, owners]);

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
        {owners.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <input type="hidden" name={nameName} value={selectedName} />
    </div>
  );
}
