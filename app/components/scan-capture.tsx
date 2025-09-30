"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function ScanCapture({ partnerId }: { partnerId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [capturing, setCapturing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  // If camera permission is already granted, start automatically without prompting
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!window.isSecureContext) return;
      if (!navigator.mediaDevices) return;
      try {
        if (
          "permissions" in navigator &&
          typeof navigator.permissions?.query === "function"
        ) {
          const status = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          if (cancelled) return;
          if (status.state === "granted" && !stream) {
            await enableCamera();
            return;
          }
          status.onchange = async () => {
            if (status.state === "granted" && !cancelled && !stream) {
              await enableCamera();
            }
          };
        } else {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const camsWithLabels = devices.filter(
            (d) => d.kind === "videoinput" && d.label
          );
          if (!cancelled && camsWithLabels.length > 0 && !stream) {
            await enableCamera();
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    for (const c of tries) {
      try {
        const s = await navigator.mediaDevices.getUserMedia(c);
        return s;
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      throw new Error(
        "Accesul la cameră necesită o conexiune securizată (https)."
      );
    }
    throw new Error(
      (lastErr as Error | undefined)?.message ||
        "Nu s-a putut obține acces la cameră."
    );
  }

  const enableCamera = async () => {
    setPermissionError(null);
    setPermissionState("requesting");
    try {
      const s = await getUserMediaSmart();
      setStream(s);
      setPermissionState("granted");
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        try {
          await new Promise<void>((resolve) => {
            if (!videoRef.current) return resolve();
            const v = videoRef.current;
            if (v.readyState >= 1) return resolve();
            v.onloadedmetadata = () => resolve();
          });
          await videoRef.current.play();
        } catch {}
      }
    } catch (e) {
      setPermissionState("denied");
      setPermissionError((e as Error).message);
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: { message: (e as Error).message, type: "error" },
        })
      );
    }
  };

  const captureAndUpload = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setCapturing(true);
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context indisponibil");
      ctx.drawImage(video, 0, 0, w, h);
      const blob: Blob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b as Blob), "image/jpeg", 0.9)
      );
      const file = new File([blob], `scan-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      const form = new FormData();
      form.append("files", file);
      form.append("titles", "Scan foto");
      const res = await fetch(`/api/partners/${partnerId}/docs`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) throw new Error(await res.text());
      startTransition(() => router.refresh());
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: { message: "Scan încărcat", type: "success" },
        })
      );
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: {
            message: (e as Error).message || "Eroare la scanare",
            type: "error",
          },
        })
      );
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="rounded-md border border-foreground/20 overflow-hidden">
        {!stream ? (
          <div className="p-4 text-sm">
            <div className="mb-2 text-foreground/80">
              Permite accesul la cameră pentru a scana rapid un document.
            </div>
            {typeof window !== "undefined" && !window.isSecureContext ? (
              <div className="mb-2 text-amber-700 dark:text-amber-400">
                Conexiunea nu este securizată. Accesul la cameră necesită https
                sau localhost.
              </div>
            ) : null}
            {permissionError ? (
              <div className="mb-2 text-rose-700 dark:text-rose-400">
                {permissionError}
              </div>
            ) : null}
            <button
              type="button"
              onClick={enableCamera}
              disabled={permissionState === "requesting"}
              className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60"
            >
              {permissionState === "requesting"
                ? "Se solicită permisiunea…"
                : "Permite camera"}
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full aspect-[4/3] bg-black"
              playsInline
              autoPlay
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={captureAndUpload}
          disabled={capturing || isPending || !stream}
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60"
        >
          {capturing ? "Se încarcă…" : "Scanează din cameră"}
        </button>
        {!stream && (
          <span className="text-xs text-foreground/60">
            Acordă permisiunea camerei pentru a scana
          </span>
        )}
      </div>
    </div>
  );
}
