"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Props = {
  partnerId: string;
};

export default function DocsUploader({ partnerId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      setSending(true);
      const res = await fetch(`/api/partners/${partnerId}/docs`, {
        method: "POST",
        body: data,
      });
      if (!res.ok) {
        let message = "Eroare la încărcare";
        try {
          const t = await res.text();
          message = t || message;
        } catch {}
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("app:toast", { detail: { message, type: "error" } })
          );
        }
      } else {
        form.reset();
        // Refresh server data to show newly uploaded docs
        startTransition(() => router.refresh());
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("app:toast", {
              detail: { message: "Fișiere încărcate", type: "success" },
            })
          );
        }
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3" encType="multipart/form-data">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          name="titles"
          placeholder="Titlu (opțional, se poate repeta)"
          className="rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-sm"
        />
        <input
          name="files"
          type="file"
          accept="application/pdf,image/*"
          multiple
          className="rounded-md border border-foreground/20 bg-background px-2 py-1.5 text-sm"
        />
      </div>
      <p className="mt-1 text-xs text-foreground/60">
        Poți selecta mai multe fișiere deodată. Tipuri permise: PDF, PNG,
        JPG/JPEG, GIF, WEBP, SVG.
      </p>
      <button
        type="submit"
        disabled={sending || isPending}
        className="mt-2 rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60"
      >
        {sending || isPending ? "Se încarcă…" : "Încarcă"}
      </button>
    </form>
  );
}
