import { useEffect, useState } from "react";

const LAST_UPDATE_KEY = "lumyf-pwa-last-update";

export type SwState = "active" | "registered" | "inactive" | "unsupported";

export interface PwaStatus {
  swState: SwState;
  precachePopulated: boolean;
  precacheCount: number;
  lastUpdate: number | null; // epoch ms
  online: boolean;
}

/**
 * Tracks Service Worker, precache, last cache update, and online status.
 * Polls every 30s + listens to relevant browser events. Lightweight.
 */
export function usePwaStatus(): PwaStatus {
  const [status, setStatus] = useState<PwaStatus>(() => ({
    swState: "unsupported",
    precachePopulated: false,
    precacheCount: 0,
    lastUpdate: readLastUpdate(),
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
  }));

  useEffect(() => {
    let cancelled = false;

    async function inspect() {
      const next: PwaStatus = {
        swState: "unsupported",
        precachePopulated: false,
        precacheCount: 0,
        lastUpdate: readLastUpdate(),
        online: navigator.onLine,
      };

      if ("serviceWorker" in navigator) {
        try {
          const reg = await navigator.serviceWorker.getRegistration();
          if (!reg) {
            next.swState = "inactive";
          } else if (navigator.serviceWorker.controller) {
            next.swState = "active";
          } else {
            next.swState = "registered";
          }
        } catch {
          next.swState = "inactive";
        }
      }

      if ("caches" in window) {
        try {
          const keys = await caches.keys();
          const precacheKey = keys.find((k) => k.includes("precache"));
          if (precacheKey) {
            const cache = await caches.open(precacheKey);
            const entries = await cache.keys();
            next.precacheCount = entries.length;
            next.precachePopulated = entries.length > 0;
          }
        } catch {
          // ignore
        }
      }

      if (!cancelled) setStatus(next);
    }

    inspect();
    const interval = setInterval(inspect, 30_000);

    function handleOnline() {
      setStatus((s) => ({ ...s, online: true }));
    }
    function handleOffline() {
      setStatus((s) => ({ ...s, online: false }));
    }
    function handleControllerChange() {
      const now = Date.now();
      try {
        localStorage.setItem(LAST_UPDATE_KEY, String(now));
      } catch {
        // ignore
      }
      setStatus((s) => ({ ...s, lastUpdate: now, swState: "active" }));
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange
      );
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange
        );
      }
    };
  }, []);

  return status;
}

function readLastUpdate(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LAST_UPDATE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function formatRelativeTime(ts: number | null): string {
  if (!ts) return "nunca";
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "agora";
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `há ${day}d`;
  return new Date(ts).toLocaleDateString("pt-BR");
}
