"use client";

// Lightweight in-memory caches for per-tab client fetches

type Me = { email: string | null; isAdmin: boolean } | null;
let meCache: Me | undefined; // undefined => never fetched
let mePromise: Promise<Me> | null = null;
let meFetchedAt = 0;
const ME_TTL_MS = 30_000; // 30s staleness window

export async function fetchMeCached(opts?: { force?: boolean }): Promise<Me> {
  const now = Date.now();
  const fresh = now - meFetchedAt < ME_TTL_MS;
  if (!opts?.force && meCache !== undefined && fresh) return meCache;
  if (!opts?.force && mePromise) return mePromise;
  mePromise = fetch("/api/me", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((data) => {
      meCache = data && typeof data === "object"
        ? { email: data.email ?? null, isAdmin: !!data.isAdmin }
        : null;
      meFetchedAt = Date.now();
      const p = mePromise; // allow GC
      mePromise = null;
      return meCache;
    });
  return mePromise;
}

export function primeMe(value: Me) {
  meCache = value;
  meFetchedAt = Date.now();
}

type Version = { version: string; commit?: string; env?: string } | null;
let versionCache: Version | undefined;
let versionPromise: Promise<Version> | null = null;
let versionFetchedAt = 0;
const VERSION_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function fetchVersionCached(opts?: { force?: boolean }): Promise<Version> {
  const now = Date.now();
  const fresh = now - versionFetchedAt < VERSION_TTL_MS;
  if (!opts?.force && versionCache !== undefined && fresh) return versionCache;
  if (!opts?.force && versionPromise) return versionPromise;
  versionPromise = fetch("/api/version", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((v) => {
      versionCache = v && typeof v === "object"
        ? { version: String(v.version ?? ""), commit: v.commit ?? undefined, env: v.env ?? undefined }
        : null;
      versionFetchedAt = Date.now();
      versionPromise = null;
      return versionCache;
    });
  return versionPromise;
}

export function primeVersion(value: Version) {
  versionCache = value;
  versionFetchedAt = Date.now();
}
