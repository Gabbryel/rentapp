"use client";

import { useEffect, useMemo, useState } from "react";

type Asset = { id: string; name: string };

type Props = {
  idName: string; // field name for selected asset id
  nameName: string; // hidden field name for asset name
  defaultId?: string;
  defaultName?: string;
  required?: boolean;
};

export default function AssetSelect({
  idName,
  nameName,
  defaultId,
  defaultName,
  required,
}: Props) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedId, setSelectedId] = useState<string>(defaultId || "");

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch("/api/assets", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setAssets(Array.isArray(data) ? data : []);
      } catch {}
    })();
    return () => {
      aborted = true;
    };
  }, []);

  const selectedName = useMemo(() => {
    if (selectedId) {
      const it = assets.find((a) => a.id === selectedId);
      if (it) return it.name;
    }
    return defaultName || "";
  }, [selectedId, assets, defaultName]);

  useEffect(() => {
    if (!selectedId && defaultName && assets.length > 0) {
      const found = assets.find((a) => a.name === defaultName);
      if (found) setSelectedId(found.id);
    }
  }, [selectedId, defaultName, assets]);

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
        {assets.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <input type="hidden" name={nameName} value={selectedName} />
    </div>
  );
}
