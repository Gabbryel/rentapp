"use client";

import * as React from "react";
import Modal from "@/app/components/modal";
import ScanViewer from "@/app/components/scan-viewer";

export default function ContractScans({
  scans,
  contractName,
}: {
  scans: { url: string; title?: string }[];
  contractName: string;
}) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  if (!scans || scans.length === 0) {
    return (
      <div className="mb-8 rounded-md border border-sky-300/40 bg-sky-50/60 dark:bg-sky-900/20 p-4 text-[#F5F1DC]">
        <div className="text-sm mb-2">Documente (scan-uri)</div>
        <div className="text-sm">Niciun fișier</div>
      </div>
    );
  }
  return (
    <div className="mb-8 rounded-md border border-sky-300/40 bg-sky-50/60 dark:bg-sky-900/20 p-4 text-[#F5F1DC]">
      <div className="text-sm mb-3">Documente (scan-uri)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {scans.map((s, idx) => (
          <div
            key={`${s.url}-${idx}`}
            className="flex items-center justify-between gap-2 rounded-md border border-foreground/10 px-3 py-2 bg-background/60"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {s.title || `Scan ${idx + 1}`}
              </div>
              <div className="truncate text-xs text-[#F5F1DC]/80" title={s.url}>
                {s.url}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <a
                href={s.url}
                target="_blank"
                className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
              >
                Deschide
              </a>
              <button
                className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
                onClick={() => setOpenIdx(idx)}
              >
                Vezi
              </button>
            </div>
            <Modal
              open={openIdx === idx}
              onClose={() => setOpenIdx(null)}
              title={`Scan: ${s.title || `#${idx + 1}`} – ${contractName}`}
              maxWidthClassName="max-w-5xl"
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-foreground/10 text-xs bg-background">
                  <div className="text-foreground/60">
                    Deschide în filă nouă sau descarcă pentru vizualizare
                    completă.
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <a
                      href={s.url}
                      target="_blank"
                      className="rounded-md border border-foreground/20 px-2 py-1 font-semibold hover:bg-foreground/5"
                      rel="noreferrer"
                    >
                      Filă nouă
                    </a>
                    <a
                      href={s.url}
                      download
                      className="rounded-md border border-foreground/20 px-2 py-1 font-semibold hover:bg-foreground/5"
                    >
                      Descarcă
                    </a>
                  </div>
                </div>
                <ScanViewer
                  url={s.url}
                  title={`Scan ${s.title || `#${idx + 1}`} – ${contractName}`}
                />
              </div>
            </Modal>
          </div>
        ))}
      </div>
    </div>
  );
}
