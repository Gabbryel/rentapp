"use client";

import * as React from "react";
import Modal from "@/app/components/modal";
import ScanViewer from "@/app/components/scan-viewer";
import IconButton from "@/app/components/ui/icon-button";

export default function AssetScans({
  scans,
  assetName,
}: {
  scans: { url: string; title?: string }[];
  assetName: string;
}) {
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  if (!scans || scans.length === 0) {
    return (
      <div className="rounded-md border border-foreground/10 p-4">
        <div className="text-sm text-foreground/60 mb-2">
          Documente (scan-uri)
        </div>
        <div className="text-sm text-foreground/60">Niciun fișier</div>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-foreground/10 p-4">
      <div className="text-sm text-foreground/60 mb-3">
        Documente (scan-uri)
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {scans.map((s, idx) => (
          <div
            key={`${s.url}-${idx}`}
            className="flex items-center justify-between gap-2 rounded-md border border-foreground/10 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {s.title || `Scan ${idx + 1}`}
              </div>
              <div
                className="truncate text-xs text-foreground/60"
                title={s.url}
              >
                {s.url}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <IconButton ariaLabel="Deschide" href={s.url} target="_blank">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-2 w-2"
                  aria-hidden="true"
                >
                  <path d="M14 3h7v7" />
                  <path d="M10 14L21 3" />
                  <path d="M5 7v11a2 2 0 0 0 2 2h11" />
                </svg>
              </IconButton>
              <IconButton ariaLabel="Vezi" onClick={() => setOpenIdx(idx)}>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-2 w-2"
                  aria-hidden="true"
                >
                  <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </IconButton>
            </div>
            <Modal
              open={openIdx === idx}
              onClose={() => setOpenIdx(null)}
              title={`Scan: ${s.title || `#${idx + 1}`} – ${assetName}`}
              maxWidthClassName="max-w-5xl"
            >
              <div className="flex flex-col">
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-foreground/10 text-xs bg-background">
                  <div className="text-foreground/60">
                    Deschide în filă nouă sau descarcă pentru vizualizare
                    completă.
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <IconButton
                      ariaLabel="Filă nouă"
                      href={s.url}
                      target="_blank"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-2 w-2"
                        aria-hidden="true"
                      >
                        <path d="M14 3h7v7" />
                        <path d="M10 14L21 3" />
                        <path d="M5 7v11a2 2 0 0 0 2 2h11" />
                      </svg>
                    </IconButton>
                    <IconButton ariaLabel="Descarcă" href={s.url} download>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-2 w-2"
                        aria-hidden="true"
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <path d="M7 10l5 5 5-5" />
                        <path d="M12 15V3" />
                      </svg>
                    </IconButton>
                  </div>
                </div>
                <ScanViewer
                  url={s.url}
                  title={`Scan ${s.title || `#${idx + 1}`} – ${assetName}`}
                />
              </div>
            </Modal>
          </div>
        ))}
      </div>
    </div>
  );
}
