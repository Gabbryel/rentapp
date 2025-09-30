"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PDFDocument } from "pdf-lib";
import NextImage from "next/image";

// Minimal typings for the subset of OpenCV.js APIs we use to avoid `any`.
type CvIntPtr = Int32Array;
interface CvMat {
  rows: number;
  delete(): void;
  clone(): CvMat;
  intPtr(row: number, col: number): CvIntPtr;
}
interface CvMatVector {
  size(): number;
  get(index: number): CvMat;
  delete(): void;
}
interface CvSize {
  width: number;
  height: number;
}
interface CvApi {
  Mat: new () => CvMat;
  MatVector: new () => CvMatVector;
  Size: new (w: number, h: number) => CvSize;
  CV_32FC2: number;
  COLOR_RGBA2GRAY: number;
  RETR_EXTERNAL: number;
  CHAIN_APPROX_SIMPLE: number;
  imread(canvas: HTMLCanvasElement): CvMat;
  imshow(canvas: HTMLCanvasElement, mat: CvMat): void;
  cvtColor(src: CvMat, dst: CvMat, code: number): void;
  GaussianBlur(src: CvMat, dst: CvMat, ksize: CvSize, sigmaX: number): void;
  Canny(src: CvMat, dst: CvMat, threshold1: number, threshold2: number): void;
  findContours(
    src: CvMat,
    contours: CvMatVector,
    hierarchy: CvMat,
    mode: number,
    method: number
  ): void;
  arcLength(curve: CvMat, closed: boolean): number;
  approxPolyDP(
    curve: CvMat,
    approxCurve: CvMat,
    epsilon: number,
    closed: boolean
  ): void;
  contourArea(contour: CvMat): number;
  matFromArray(rows: number, cols: number, type: number, data: number[]): CvMat;
  getPerspectiveTransform(src: CvMat, dst: CvMat): CvMat;
  warpPerspective(src: CvMat, dst: CvMat, M: CvMat, dsize: CvSize): void;
}

declare global {
  // OpenCV.js attaches `cv` to the window
  var cv: CvApi | undefined;
}

type Page = {
  id: string;
  srcDataUrl: string; // unprocessed cropped capture (A4 aspect)
  dataUrl: string; // processed preview used for PDF
  w: number;
  h: number;
  rotation: 0 | 90 | 180 | 270;
  contrast: number; // 0.5 .. 2.0
  threshold: number; // 0..255 ; 0 means disabled
};

export default function DocScan({ partnerId }: { partnerId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const processRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionState, setPermissionState] = useState<
    "idle" | "requesting" | "granted" | "denied"
  >("idle");
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [enhance, setEnhance] = useState(true);
  const [portrait, setPortrait] = useState(true);
  const [autoDetect, setAutoDetect] = useState(true);
  const [pages, setPages] = useState<Page[]>([]);
  const [title, setTitle] = useState("Scan document");
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  async function loadCV(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    // Already loaded
    if (
      typeof window !== "undefined" &&
      window.cv &&
      typeof window.cv.imread === "function"
    )
      return true;
    // Load script
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://docs.opencv.org/4.x/opencv.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () =>
        reject(new Error("Nu s-a putut încărca OpenCV.js"));
      document.head.appendChild(script);
    });
    // Wait for cv to be ready
    await new Promise<void>((resolve) => {
      const check = () => {
        if (window.cv && typeof window.cv.imread === "function") resolve();
        else setTimeout(check, 50);
      };
      check();
    });
    return true;
  }

  // Stop camera when component unmounts or stream changes
  useEffect(() => {
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [stream]);

  // If camera permission is already granted, start automatically without prompting
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined") return;
      if (!window.isSecureContext) return; // avoid triggering prompts on insecure contexts
      if (!navigator.mediaDevices) return;
      try {
        if (
          "permissions" in navigator &&
          typeof navigator.permissions?.query === "function"
        ) {
          // Use the Permissions API where available
          const status = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          if (cancelled) return;
          if (status.state === "granted" && !stream) {
            // Safe to start without user gesture
            await enableCamera();
            return;
          }
          // If permission becomes granted later (e.g., via browser UI), auto-start
          status.onchange = async () => {
            if (status.state === "granted" && !cancelled && !stream) {
              await enableCamera();
            }
          };
        } else {
          // Fallback heuristic: if labels are available for video inputs, permission likely granted
          const devices = await navigator.mediaDevices.enumerateDevices();
          const camsWithLabels = devices.filter(
            (d) => d.kind === "videoinput" && d.label
          );
          if (!cancelled && camsWithLabels.length > 0 && !stream) {
            await enableCamera();
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getUserMediaSmart(
    deviceId?: string | null
  ): Promise<MediaStream> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Acest dispozitiv/navigator nu suportă acces la cameră.");
    }
    // If a specific device was chosen, try it first
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId } },
        });
      } catch {
        // fall through to generic tries
      }
    }
    // Try environment (rear) camera first, then fallback
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

  const enableCamera = async () => {
    setPermissionError(null);
    setPermissionState("requesting");
    try {
      const s = await getUserMediaSmart(selectedDeviceId);
      setStream(s);
      setPermissionState("granted");
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        try {
          // Ensure metadata is loaded before play() to satisfy iOS Safari
          await new Promise<void>((resolve) => {
            if (!videoRef.current) return resolve();
            const v = videoRef.current;
            if (v.readyState >= 1) return resolve();
            v.onloadedmetadata = () => resolve();
          });
          await videoRef.current.play();
        } catch {}
      }
      // Enumerate cameras now that we have permission
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        const cams = list.filter((d) => d.kind === "videoinput");
        setDevices(cams);
        // Try to set selected to the active stream's deviceId
        const track = s.getVideoTracks()[0];
        const settings = track.getSettings?.();
        if (settings && typeof settings.deviceId === "string") {
          setSelectedDeviceId(settings.deviceId);
        } else if (cams[0]) {
          setSelectedDeviceId(cams[0].deviceId || null);
        }
      } catch {}
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

  const switchCamera = async (deviceId: string) => {
    try {
      setBusy(true);
      // Stop previous stream
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      const s = await getUserMediaSmart(deviceId);
      setStream(s);
      setSelectedDeviceId(deviceId);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        try {
          await videoRef.current.play();
        } catch {}
      }
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: { message: (e as Error).message, type: "error" },
        })
      );
    } finally {
      setBusy(false);
    }
  };

  const pageAspect = useMemo(
    () => (portrait ? 297 / 210 : 210 / 297),
    [portrait]
  ); // A4 aspect (h/w)

  const capture = async () => {
    if (!videoRef.current || !canvasRef.current || !processRef.current) return;
    setBusy(true);
    try {
      const video = videoRef.current;
      // Compute crop to match A4 aspect ratio centered in the frame
      const vw = video.videoWidth || 1280;
      const vh = video.videoHeight || 720;
      let cropW = vw;
      let cropH = Math.round(vw * pageAspect);
      if (cropH > vh) {
        cropH = vh;
        cropW = Math.round(vh / pageAspect);
      }
      const cx = Math.floor((vw - cropW) / 2);
      const cy = Math.floor((vh - cropH) / 2);

      // Draw to base canvas
      const base = canvasRef.current;
      base.width = cropW;
      base.height = cropH;
      const bctx = base.getContext("2d");
      if (!bctx) throw new Error("Canvas context");
      bctx.drawImage(video, cx, cy, cropW, cropH, 0, 0, cropW, cropH);
      const srcDataUrl = base.toDataURL("image/jpeg", 0.95);

      // Prepare target canvas for preview
      const proc = processRef.current;
      // Reasonable size for PDF preview (A4 ~1240x1754 portrait)
      const targetH = portrait ? 1754 : 1240;
      const targetW = portrait ? 1240 : 1754;
      proc.width = targetW;
      proc.height = targetH;

      let previewSet = false;
      if (autoDetect) {
        try {
          const ok = await loadCV();
          if (ok) {
            const cvApi = window.cv as CvApi;
            // Read from base canvas
            const src = cvApi.imread(base);
            const gray = new cvApi.Mat();
            cvApi.cvtColor(src, gray, cvApi.COLOR_RGBA2GRAY);
            const blur = new cvApi.Mat();
            cvApi.GaussianBlur(gray, blur, new cvApi.Size(5, 5), 0);
            const edges = new cvApi.Mat();
            cvApi.Canny(blur, edges, 50, 150);
            const contours = new cvApi.MatVector();
            const hierarchy = new cvApi.Mat();
            cvApi.findContours(
              edges,
              contours,
              hierarchy,
              cvApi.RETR_EXTERNAL,
              cvApi.CHAIN_APPROX_SIMPLE
            );
            let bestQuad: CvMat | null = null;
            let bestArea = 0;
            for (let i = 0; i < contours.size(); i++) {
              const cnt = contours.get(i);
              const peri = cvApi.arcLength(cnt, true);
              const approx = new cvApi.Mat();
              cvApi.approxPolyDP(cnt, approx, 0.02 * peri, true);
              if (approx.rows === 4) {
                const area = cvApi.contourArea(approx);
                if (area > bestArea) {
                  bestArea = area;
                  bestQuad = approx.clone();
                }
              }
              approx.delete();
              cnt.delete();
            }
            if (bestQuad) {
              // Order points (tl,tr,br,bl)
              const pts: Array<{ x: number; y: number }> = [];
              for (let i = 0; i < 4; i++) {
                const p = bestQuad.intPtr(i, 0);
                pts.push({ x: p[0], y: p[1] });
              }
              // Sort by sum/diff to get tl,tr,br,bl
              const sum = (p: { x: number; y: number }) => p.x + p.y;
              const diff = (p: { x: number; y: number }) => p.x - p.y;
              const tl = pts.reduce((a, b) => (sum(a) < sum(b) ? a : b));
              const br = pts.reduce((a, b) => (sum(a) > sum(b) ? a : b));
              const tr = pts.reduce((a, b) => (diff(a) > diff(b) ? a : b));
              const bl = pts.reduce((a, b) => (diff(a) < diff(b) ? a : b));
              const srcTri = cvApi.matFromArray(4, 1, cvApi.CV_32FC2, [
                tl.x,
                tl.y,
                tr.x,
                tr.y,
                br.x,
                br.y,
                bl.x,
                bl.y,
              ]);
              const dstTri = cvApi.matFromArray(4, 1, cvApi.CV_32FC2, [
                0,
                0,
                targetW,
                0,
                targetW,
                targetH,
                0,
                targetH,
              ]);
              const M = cvApi.getPerspectiveTransform(srcTri, dstTri);
              const dst = new cvApi.Mat();
              cvApi.warpPerspective(
                src,
                dst,
                M,
                new cvApi.Size(targetW, targetH)
              );
              cvApi.imshow(proc, dst);
              // Cleanup
              src.delete();
              gray.delete();
              blur.delete();
              edges.delete();
              contours.delete();
              hierarchy.delete();
              bestQuad.delete();
              srcTri.delete();
              dstTri.delete();
              M.delete();
              dst.delete();
              previewSet = true;
            } else {
              // Cleanup
              src.delete();
              gray.delete();
              blur.delete();
              edges.delete();
              contours.delete();
              hierarchy.delete();
            }
          }
        } catch {
          // ignore and fallback
        }
      }

      if (!previewSet) {
        // Fallback: scale and optional enhance
        const pctx = proc.getContext("2d");
        if (!pctx) throw new Error("Canvas ctx");
        pctx.drawImage(base, 0, 0, targetW, targetH);
        if (enhance) {
          const img = pctx.getImageData(0, 0, targetW, targetH);
          const data = img.data;
          const contrast = 1.25;
          const intercept = 20;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            let v = r * 0.299 + g * 0.587 + b * 0.114;
            v = v * contrast + intercept;
            v = v < 0 ? 0 : v > 255 ? 255 : v;
            data[i] = data[i + 1] = data[i + 2] = v;
          }
          pctx.putImageData(img, 0, 0);
        }
      }

      const dataUrl = proc.toDataURL("image/jpeg", 0.9);
      setPages((prev) => [
        ...prev,
        {
          id: `pg_${Date.now()}`,
          srcDataUrl,
          dataUrl,
          w: targetW,
          h: targetH,
          rotation: 0,
          contrast: 1.25,
          threshold: 0,
        },
      ]);
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: { message: "Pagină adăugată", type: "success" },
        })
      );
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: {
            message: (e as Error).message || "Eroare la captură",
            type: "error",
          },
        })
      );
    } finally {
      setBusy(false);
    }
  };

  const removePage = (id: string) =>
    setPages((prev) => prev.filter((p) => p.id !== id));

  const reprocessPage = async (page: Page) => {
    if (!processRef.current) return;
    const proc = processRef.current;
    proc.width = page.w;
    proc.height = page.h;
    const img = document.createElement("img") as HTMLImageElement;
    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.src = page.srcDataUrl;
    });
    const ctx = proc.getContext("2d");
    if (!ctx) return;
    // Apply rotation
    ctx.save();
    ctx.clearRect(0, 0, proc.width, proc.height);
    if (page.rotation === 90) {
      ctx.translate(proc.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, 0, 0, proc.height, proc.width);
    } else if (page.rotation === 180) {
      ctx.translate(proc.width, proc.height);
      ctx.rotate(Math.PI);
      ctx.drawImage(img, 0, 0, proc.width, proc.height);
    } else if (page.rotation === 270) {
      ctx.translate(0, proc.height);
      ctx.rotate((3 * Math.PI) / 2);
      ctx.drawImage(img, 0, 0, proc.height, proc.width);
    } else {
      ctx.drawImage(img, 0, 0, proc.width, proc.height);
    }
    ctx.restore();
    // Contrast/threshold
    const imageData = ctx.getImageData(0, 0, proc.width, proc.height);
    const data = imageData.data;
    const ctr = page.contrast;
    const threshold = page.threshold;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      let v = r * 0.299 + g * 0.587 + b * 0.114;
      v = v * ctr;
      if (threshold > 0) v = v >= threshold ? 255 : 0;
      v = v < 0 ? 0 : v > 255 ? 255 : v;
      data[i] = data[i + 1] = data[i + 2] = v;
    }
    ctx.putImageData(imageData, 0, 0);
    const dataUrl = proc.toDataURL("image/jpeg", 0.9);
    setPages((prev) =>
      prev.map((p) => (p.id === page.id ? { ...p, dataUrl } : p))
    );
  };

  const uploadPdf = async () => {
    if (pages.length === 0) return;
    setBusy(true);
    try {
      // Create PDF A4 pages
      const pdf = await PDFDocument.create();
      for (const p of pages) {
        const imgBytes = await (await fetch(p.dataUrl)).arrayBuffer();
        const jpg = await pdf.embedJpg(new Uint8Array(imgBytes));
        const page = pdf.addPage([595, 842]); // A4 at 72dpi (portrait)
        const dims = jpg.scaleToFit(595, 842);
        page.drawImage(jpg, {
          x: (595 - dims.width) / 2,
          y: (842 - dims.height) / 2,
          width: dims.width,
          height: dims.height,
        });
      }
      const bytes = await pdf.save();
      const ab = bytes.slice().buffer;
      const blob = new Blob([ab], { type: "application/pdf" });
      const file = new File([blob], `${title || "scan"}.pdf`, {
        type: "application/pdf",
      });
      const form = new FormData();
      form.append("files", file);
      form.append("titles", title || "Scan PDF");
      // Use XHR for upload progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/partners/${partnerId}/docs`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          setUploadProgress(null);
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else
            reject(
              new Error(xhr.responseText || `Eroare upload ${xhr.status}`)
            );
        };
        xhr.onerror = () => {
          setUploadProgress(null);
          reject(new Error("Eroare rețea la upload"));
        };
        xhr.send(form);
      });
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: { message: "PDF încărcat", type: "success" },
        })
      );
      setPages([]);
      startTransition(() => router.refresh());
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: {
            message: (e as Error).message || "Eroare la încărcare PDF",
            type: "error",
          },
        })
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-foreground/70">
          Scanează document (PDF)
        </div>
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={enhance}
              onChange={(e) => setEnhance(e.target.checked)}
            />{" "}
            Enhance
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={autoDetect}
              onChange={(e) => setAutoDetect(e.target.checked)}
            />{" "}
            Auto-detect
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={portrait}
              onChange={(e) => setPortrait(e.target.checked)}
            />{" "}
            Portret
          </label>
          {stream && devices.length > 1 ? (
            <div className="flex items-center gap-1">
              <span>Camera:</span>
              <select
                className="rounded border border-foreground/20 bg-transparent px-1.5 py-1"
                value={selectedDeviceId ?? ""}
                onChange={(e) => switchCamera(e.target.value)}
              >
                {devices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 rounded-md border border-foreground/20 overflow-hidden">
        {!stream ? (
          <div className="p-4 text-sm">
            <div className="mb-2 text-foreground/80">
              Pentru a scana documente, permite accesul la cameră.
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
              className="w-full bg-black"
              playsInline
              autoPlay
              muted
            />
            <canvas ref={canvasRef} className="hidden" />
            <canvas ref={processRef} className="hidden" />
          </>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          className="w-full max-w-sm rounded-md border border-foreground/20 bg-transparent px-2 py-1.5 text-sm"
          placeholder="Titlu document"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="button"
          onClick={capture}
          disabled={!stream || busy || isPending}
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60"
        >
          Adaugă pagină
        </button>
        <button
          type="button"
          onClick={uploadPdf}
          disabled={pages.length === 0 || busy || isPending}
          className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold hover:bg-foreground/5 disabled:opacity-60"
        >
          {uploadProgress !== null
            ? `Încărcare… ${uploadProgress}%`
            : `Generează și încarcă PDF (${pages.length})`}
        </button>
      </div>
      {pages.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pages.map((p) => (
            <li
              key={p.id}
              className="rounded-md border border-foreground/15 bg-foreground/5 overflow-hidden"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2">
                <div>
                  <NextImage
                    src={p.dataUrl}
                    alt="Previzualizare pagină"
                    width={Math.round(p.w)}
                    height={Math.round(p.h)}
                    className="w-full h-auto rounded"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
                      onClick={async () => {
                        const rotation = ((p.rotation + 270) % 360) as
                          | 0
                          | 90
                          | 180
                          | 270;
                        const updated = { ...p, rotation } as Page;
                        setPages((prev) =>
                          prev.map((x) => (x.id === p.id ? updated : x))
                        );
                        await reprocessPage(updated);
                      }}
                    >
                      Rotire stânga
                    </button>
                    <button
                      type="button"
                      className="rounded-md border border-foreground/20 px-2 py-1 text-xs font-semibold hover:bg-foreground/5"
                      onClick={async () => {
                        const rotation = ((p.rotation + 90) % 360) as
                          | 0
                          | 90
                          | 180
                          | 270;
                        const updated = { ...p, rotation } as Page;
                        setPages((prev) =>
                          prev.map((x) => (x.id === p.id ? updated : x))
                        );
                        await reprocessPage(updated);
                      }}
                    >
                      Rotire dreapta
                    </button>
                    <button
                      type="button"
                      onClick={() => removePage(p.id)}
                      className="ml-auto text-xs rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 font-semibold text-red-600 hover:bg-red-500/15"
                    >
                      Elimină
                    </button>
                  </div>
                  <div>
                    <label className="block text-xs text-foreground/70">
                      Contrast: {p.contrast.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={2.0}
                      step={0.05}
                      value={p.contrast}
                      onChange={async (e) => {
                        const contrast = Number(e.target.value);
                        const updated = { ...p, contrast } as Page;
                        setPages((prev) =>
                          prev.map((x) => (x.id === p.id ? updated : x))
                        );
                        await reprocessPage(updated);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-foreground/70">
                      Prag alb/negru: {p.threshold}
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={255}
                      step={1}
                      value={p.threshold}
                      onChange={async (e) => {
                        const threshold = Number(e.target.value);
                        const updated = { ...p, threshold } as Page;
                        setPages((prev) =>
                          prev.map((x) => (x.id === p.id ? updated : x))
                        );
                        await reprocessPage(updated);
                      }}
                      className="w-full"
                    />
                  </div>
                  <div className="text-xs text-foreground/60">
                    {Math.round(p.w)}×{Math.round(p.h)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
