"use client";

import { useState } from "react";
import Modal from "@/app/components/modal";

export default function InvoiceViewer({
  pdfUrl,
  id,
  title = "Factura",
}: {
  pdfUrl?: string | null;
  id?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const htmlUrl = id ? `/invoices/${encodeURIComponent(id)}/view` : null;
  const pdfFallback =
    pdfUrl || (id ? `/api/invoices/${encodeURIComponent(id)}/pdf` : null);
  if (!htmlUrl && !pdfFallback) return null;
  return (
    <>
      <button
        type="button"
        className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/5"
        onClick={() => setOpen(true)}
      >
        Vezi factura
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        maxWidthClassName="max-w-5xl"
      >
        <div className="p-0">
          {htmlUrl ? (
            <iframe src={htmlUrl} className="w-full h-[75vh]" />
          ) : (
            <object
              data={pdfFallback!}
              type="application/pdf"
              className="w-full h-[75vh]"
            >
              <div className="p-4 text-sm text-foreground/70">
                Nu pot afișa PDF-ul în pagină. Îl poți deschide într-un tab nou:
                <a
                  href={pdfFallback!}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 underline"
                >
                  Deschide factura
                </a>
              </div>
              <iframe src={pdfFallback!} className="w-full h-[75vh]" />
            </object>
          )}
        </div>
      </Modal>
    </>
  );
}
