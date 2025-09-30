"use client";

import { useEffect, useState } from "react";

type ToastItem = {
  id: number;
  message: string;
  type?: "success" | "error";
};

export default function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    let idCounter = 1;
    const onToast = (e: Event) => {
      const detail = (
        e as CustomEvent<{ message: string; type?: "success" | "error" }>
      ).detail;
      if (!detail?.message) return;
      const id = idCounter++;
      setToasts((prev) => [
        ...prev,
        { id, message: detail.message, type: detail.type },
      ]);
      // Auto-dismiss after 2.5s
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    };
    window.addEventListener("app:toast", onToast as EventListener);
    return () =>
      window.removeEventListener("app:toast", onToast as EventListener);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-end p-4 sm:p-6">
      <div className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto rounded-lg border border-foreground/15 bg-background/80 backdrop-blur px-4 py-3 text-sm shadow-md"
            role="status"
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                  t.type === "error" ? "bg-red-500" : "bg-emerald-500"
                }`}
              />
              <div className="text-foreground/90">{t.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
