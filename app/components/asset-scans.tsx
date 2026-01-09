"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Modal from "@/app/components/modal";
import ScanViewer from "@/app/components/scan-viewer";
import IconButton from "@/app/components/ui/icon-button";

export default function AssetScans({
  scans,
  assetName,
  assetId,
  editScanAction,
  deleteScanAction,
}: {
  scans: { url: string; title?: string }[];
  assetName: string;
  assetId?: string;
  editScanAction?: (
    formData: FormData
  ) => Promise<{ ok: boolean; message?: string }>;
  deleteScanAction?: (
    formData: FormData
  ) => Promise<{ ok: boolean; message?: string }>;
}) {
  const router = useRouter();
  const [openIdx, setOpenIdx] = React.useState<number | null>(null);
  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [deletingIdx, setDeletingIdx] = React.useState<number | null>(null);
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
            className="rounded-md border border-foreground/10"
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2">
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
                {editScanAction && assetId && (
                  <IconButton
                    ariaLabel="Editează"
                    onClick={() => {
                      setEditingIdx(editingIdx === idx ? null : idx);
                      setEditTitle(s.title || "");
                    }}
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
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </IconButton>
                )}
                {deleteScanAction && assetId && (
                  <IconButton
                    ariaLabel="Șterge"
                    onClick={() => setDeletingIdx(idx)}
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
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </IconButton>
                )}
              </div>
            </div>

            {/* Inline Edit Form */}
            {editingIdx === idx && editScanAction && assetId && (
              <div className="border-t border-foreground/10 px-3 py-3 bg-foreground/5">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (editScanAction && assetId) {
                      const formData = new FormData(e.currentTarget);
                      const res = await editScanAction(formData);
                      if (res.ok) {
                        setEditingIdx(null);
                        setEditTitle("");
                        router.refresh();
                      } else if (res.message) {
                        alert(res.message);
                      }
                    }
                  }}
                  className="space-y-3"
                >
                  <input type="hidden" name="id" value={assetId} />
                  <input type="hidden" name="index" value={String(idx)} />
                  <div>
                    <label
                      htmlFor={`scanTitle-${idx}`}
                      className="block text-xs font-medium mb-1"
                    >
                      Titlu
                    </label>
                    <input
                      type="text"
                      id={`scanTitle-${idx}`}
                      name="scanTitle"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm"
                      placeholder="Titlu opțional"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingIdx(null);
                        setEditTitle("");
                      }}
                      className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                    >
                      Anulează
                    </button>
                    <button
                      type="submit"
                      className="rounded-md bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                    >
                      Salvează
                    </button>
                  </div>
                </form>
              </div>
            )}

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

      {/* Delete Modal */}
      <Modal
        open={deletingIdx !== null}
        onClose={() => setDeletingIdx(null)}
        title="Șterge scan"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (deleteScanAction && assetId) {
              const formData = new FormData(e.currentTarget);
              const res = await deleteScanAction(formData);
              if (res.ok) {
                setDeletingIdx(null);
                router.refresh();
              } else if (res.message) {
                alert(res.message);
              }
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="id" value={assetId} />
          <input type="hidden" name="index" value={String(deletingIdx)} />
          <p className="text-sm text-foreground/80">
            Ești sigur că vrei să ștergi acest scan? Această acțiune nu poate fi
            anulată.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingIdx(null)}
              className="rounded-md border border-foreground/20 px-3 py-2 text-sm hover:bg-foreground/5"
            >
              Anulează
            </button>
            <button
              type="submit"
              className="rounded-md bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700"
            >
              Șterge
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
