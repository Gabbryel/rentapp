"use client";

import { useEffect, useState } from "react";
import { fetchMeCached } from "@/lib/client-cache";

export default function FlashHub() {
  const [canConnect, setCanConnect] = useState<boolean | null>(null);

  // Heuristic: resolve session state first; only connect if an authenticated user exists
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetchMeCached();
      if (!cancelled) setCanConnect(Boolean(me?.email));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (canConnect !== true) return; // only connect when authenticated
    let es: EventSource | null = null;
    let stopped = false;
    const connect = () => {
      if (stopped) return;
      try {
        es = new EventSource("/api/stream");
        es.onmessage = (ev) => {
          try {
            const data = JSON.parse(ev.data);
            if (data?.type === "toast" && data?.payload?.message) {
              window.dispatchEvent(
                new CustomEvent("app:toast", {
                  detail: {
                    message: String(data.payload.message),
                    type: data.payload.kind === "error" ? "error" : "success",
                  },
                })
              );
            }
          } catch {
            // ignore bad payload
          }
        };
        es.onerror = () => {
          es?.close();
          // Attempt a basic backoff reconnect
          setTimeout(connect, 1500);
        };
      } catch {
        setTimeout(connect, 2000);
      }
    };
    connect();
    return () => {
      stopped = true;
      es?.close();
    };
  }, [canConnect]);

  return null;
}
