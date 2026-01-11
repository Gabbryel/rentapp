"use client";

import { useRouter, useSearchParams } from "next/navigation";

type Owner = {
  id: string;
  name: string;
};

type Props = {
  owners: Owner[];
  selectedOwnerId: string;
  contractCount: number;
  basePath?: string;
};

export default function OwnerFilter({
  owners,
  selectedOwnerId,
  contractCount,
  basePath = "/",
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleChange = (newOwnerId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("ownerId", newOwnerId);
    router.push(`${basePath}?${params.toString()}`);
  };

  return (
    <div className="mb-6 rounded-2xl border border-foreground/10 bg-background p-4 shadow-lg">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <svg
            className="h-5 w-5 text-cyan-600 dark:text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span>Proprietar:</span>
        </label>
        <select
          value={selectedOwnerId}
          onChange={(e) => handleChange(e.target.value)}
          className="flex-1 max-w-md rounded-lg border border-foreground/20 bg-background px-4 py-2 text-sm font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {owners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <div className="text-xs text-foreground/50">
          {contractCount} {contractCount === 1 ? "contract" : "contracte"}
        </div>
      </div>
    </div>
  );
}
