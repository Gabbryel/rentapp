"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/app/components/modal";
import ScanViewer from "@/app/components/scan-viewer";

export type PartnerDocItem = {
  id: string;
  title: string;
  url: string;
  createdAt?: string;
  contentType?: string;
  sizeBytes?: number;
};

export default function DocsList({
  partnerId,
  docs,
  allowDelete = true,
}: {
  partnerId: string;
  docs: PartnerDocItem[];
  allowDelete?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<PartnerDocItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState<string>("");

  const deleteDoc = async (id: string) => {
    if (!confirm("Sigur vrei să ștergi acest document?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/partners/${partnerId}/docs?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );
      if (!res.ok) {
        const txt = await res.text();
        window.dispatchEvent(
          new CustomEvent("app:toast", {
            detail: { message: txt || "Eroare la ștergere", type: "error" },
          })
        );
      } else {
        startTransition(() => router.refresh());
        window.dispatchEvent(
          new CustomEvent("app:toast", {
            detail: { message: "Document șters", type: "success" },
          })
        );
      }
    } finally {
      setDeletingId(null);
    }
  };

  const formatSize = (size?: number) => {
    if (!size && size !== 0) return undefined;
    const kb = size / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const iconFor = (contentType?: string, url?: string) => {
    const u = (url || "").toLowerCase();
    const isPdf =
      /\.pdf(?:$|[?#])/.test(u) || (contentType || "").includes("pdf");
    const isImage =
      (contentType || "").startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|svg)(?:$|[?#])/.test(u);
    const cls = "h-4 w-4";
    if (isPdf) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cls}
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      );
    }
    if (isImage) {
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cls}
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      );
    }
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cls}
        aria-hidden="true"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
    );
  };

  return (
    <div>
      {docs.length > 0 ? (
        <ul id="docs-list" className="mt-4 space-y-2">
          {docs.map((d) => (
            <li
              key={d.id}
              className="rounded-md bg-foreground/5 px-3 py-2 flex flex-wrap items-start gap-3"
            >
              <div className="min-w-0 flex items-start gap-2 flex-1">
                <span className="text-foreground/70">
                  {iconFor(d.contentType, d.url)}
                </span>
                <div className="min-w-0">
                  {editingId === d.id ? (
                    <form
                      className="w-full flex flex-wrap items-center gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const title = draftTitle.trim();
                        if (!title || title === d.title) {
                          setEditingId(null);
                          return;
                        }
                        try {
                          const res = await fetch(
                            `/api/partners/${partnerId}/docs`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ id: d.id, title }),
                            }
                          );
                          if (!res.ok) {
                            const txt = await res.text();
                            window.dispatchEvent(
                              new CustomEvent("app:toast", {
                                detail: {
                                  message: txt || "Eroare la salvare",
                                  type: "error",
                                },
                              })
                            );
                            return;
                          }
                          startTransition(() => router.refresh());
                          window.dispatchEvent(
                            new CustomEvent("app:toast", {
                              detail: {
                                message: "Titlu actualizat",
                                type: "success",
                              },
                            })
                          );
                        } finally {
                          setEditingId(null);
                        }
                      }}
                    >
                      <input
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        autoFocus
                        className="w-full sm:w-auto flex-1 min-w-0 max-w-full sm:max-w-[28rem] rounded-md border border-foreground/20 bg-background px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
                      >
                        Salvează
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
                      >
                        Anulează
                      </button>
                    </form>
                  ) : (
                    <div className="font-medium truncate">{d.title}</div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-foreground/60">
                    {d.createdAt ? <span>{d.createdAt}</span> : null}
                    {d.sizeBytes !== undefined ? (
                      <span>• {formatSize(d.sizeBytes)}</span>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
                  onClick={() => setPreview(d)}
                >
                  Previzualizează
                </button>
                <Link
                  href={d.url}
                  target="_blank"
                  className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
                >
                  Descarcă
                </Link>
                <button
                  type="button"
                  className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
                  onClick={() => {
                    setEditingId(d.id);
                    setDraftTitle(d.title);
                  }}
                  disabled={editingId !== null && editingId !== d.id}
                >
                  Edit
                </button>
                {allowDelete && (
                  <button
                    type="button"
                    onClick={() => deleteDoc(d.id)}
                    disabled={deletingId === d.id || isPending}
                    className="rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/15 disabled:opacity-60"
                  >
                    {deletingId === d.id ? "Se șterge…" : "Șterge"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-foreground/60">
          Nu există documente încă.
        </p>
      )}

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.title}
        maxWidthClassName="max-w-4xl"
      >
        {preview ? (
          <div className="p-4">
            <ScanViewer url={preview.url} title={preview.title} />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
