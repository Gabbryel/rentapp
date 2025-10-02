"use client";

import * as React from "react";
import Modal from "@/app/components/modal";
import ScanViewer from "@/app/components/scan-viewer";

export default function ScanSection({
  scanUrl,
  contractName,
}: {
  scanUrl?: string | null;
  contractName: string;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-lg border border-foreground/15 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-foreground/10">
        <h2 className="text-base font-semibold">Scan contract</h2>
        <div className="flex items-center gap-3">
          {scanUrl ? (
            <button
              type="button"
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
              onClick={() => setOpen(true)}
            >
              Vezi scan
            </button>
          ) : (
            <span className="text-sm text-foreground/60">
              Niciun scan disponibil
            </span>
          )}
        </div>
      </div>
      <div className="p-4 text-sm text-foreground/60">
        Apasă „Vezi scan” pentru a deschide documentul într-o fereastră modală.
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Scan: ${contractName}`}
        maxWidthClassName="max-w-5xl"
      >
        {scanUrl ? (
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-foreground/10 text-xs bg-background">
              <div className="text-foreground/60">
                Sfaturi iOS: Dacă nu vezi toate paginile sau nu încape pe ecran,
                folosește „Deschide în filă nouă”.
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <a
                  href={scanUrl}
                  target="_blank"
                  className="rounded-md border border-foreground/20 px-2 py-1 font-semibold hover:bg-foreground/5"
                  rel="noreferrer"
                >
                  Deschide în filă nouă
                </a>
                <a
                  href={scanUrl}
                  download
                  className="rounded-md border border-foreground/20 px-2 py-1 font-semibold hover:bg-foreground/5"
                >
                  Descarcă
                </a>
              </div>
            </div>
            <ScanViewer url={scanUrl} title={`Scan contract ${contractName}`} />
          </div>
        ) : (
          <div className="aspect-[4/3] grid place-items-center text-foreground/60">
            Niciun scan disponibil
          </div>
        )}
      </Modal>
    </div>
  );
}
