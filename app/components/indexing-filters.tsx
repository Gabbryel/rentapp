"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  owners: { id: string; name: string }[];
};

export default function IndexingFilters({ owners }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urgency = params.get("urgency") || "all";
  const ownerId = params.get("ownerId") || "";

  const set = (key: string, value: string) => {
    const usp = new URLSearchParams(params.toString());
    if (!value || (key === "urgency" && value === "all")) usp.delete(key);
    else usp.set(key, value);
    router.replace(`${pathname}?${usp.toString()}`);
  };

  const urgencyTabs = [
    { value: "all", label: "Toate" },
    { value: "overdue", label: "Depășite" },
    { value: "urgent", label: "Urgente" },
    { value: "soon", label: "În curând" },
    { value: "ok", label: "În termen" },
    { value: "none", label: "Fără indexare" },
  ];

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-wrap">
      {/* Owner select */}
      {owners.length > 1 && (
        <select
          value={ownerId}
          onChange={(e) => set("ownerId", e.target.value)}
          className="rounded-lg border border-foreground/20 bg-background px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="">Toți proprietarii</option>
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      )}

      {/* Urgency tabs */}
      <div className="flex items-center gap-1 rounded-lg border border-foreground/15 bg-foreground/5 p-0.5">
        {urgencyTabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => set("urgency", tab.value)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              urgency === tab.value
                ? "bg-background shadow-sm text-foreground"
                : "text-foreground/60 hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
