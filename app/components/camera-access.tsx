"use client";

import { useState } from "react";

export default function CameraAccess({
  onGranted,
}: {
  onGranted: (stream: MediaStream) => void;
}) {
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function getUserMediaSmart(): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Acest dispozitiv/navigator nu suportă acces la cameră.");
    }
    const tries: MediaStreamConstraints[] = [
      { video: { facingMode: { ideal: "environment" } } },
      { video: { facingMode: { ideal: "user" } } },
      { video: true },
    ];
    let lastErr: unknown = null;
    for (const constraints of tries) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(constraints);
        return s;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    const msg = (() => {
      if (typeof window !== "undefined" && !window.isSecureContext) {
        return "Accesul la cameră necesită o conexiune securizată (https).";
      }
      const err = lastErr as Error | undefined;
      return err?.message || "Nu s-a putut obține acces la cameră.";
    })();
    throw new Error(msg);
  }

  const request = async () => {
    setError(null);
    setRequesting(true);
    try {
      const s = await getUserMediaSmart();
      onGranted(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="p-4 text-sm">
      <div className="mb-2 text-foreground/80">
        Permite accesul la cameră pentru a continua.
      </div>
      {typeof window !== "undefined" && !window.isSecureContext ? (
        <div className="mb-2 text-amber-700 dark:text-amber-400">
          Accesul la cameră necesită https sau localhost.
        </div>
      ) : null}
      {error ? (
        <div className="mb-2 text-rose-700 dark:text-rose-400">{error}</div>
      ) : null}
      <button
        type="button"
        onClick={request}
        disabled={requesting}
        className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60"
      >
        {requesting ? "Se solicită permisiunea…" : "Permite camera"}
      </button>
    </div>
  );
}
