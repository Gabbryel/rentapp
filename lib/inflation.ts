import { getDb } from "@/lib/mongodb";
import { readHicpFallback } from "@/lib/inflation-fallback";

// Minimal types for the ECB SDMX JSON payload we use
type SdmxObservation = Record<string, [number | null, ...unknown[]] | Array<number | null>>;
type SdmxSeries = Record<string, { observations: SdmxObservation }>;
type SdmxJson = {
  dataSets?: Array<{ series?: SdmxSeries }>;
  structure?: {
    dimensions?: {
      observation?: Array<{ id: string; values?: Array<{ id: string }> }>;
    };
  };
};

type HicpDoc = {
  key: "EA_HICP_2015";
  month: string; // YYYY-MM
  index: number; // HICP 2015=100
  fetchedAt: Date;
};

type HicpSource = "db" | "ecb" | "eurostat" | "fallback";

function monthStr(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function fetchEcbHicpSeries(endMonth?: string): Promise<Record<string, number>> {
  const end = endMonth ?? monthStr(new Date());
  // Try multiple ECB hosts; some networks block DNS for sdw-wsrest.
  const hosts = [
    "https://sdw-wsrest.ecb.europa.eu/service/data/ICP/M.U2.N.000000.4.INX",
    "https://data-api.ecb.europa.eu/service/data/ICP/M.U2.N.000000.4.INX",
  ];
  let lastErr: unknown = null;

  for (const base of hosts) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const url = `${base}?startPeriod=2000-01&endPeriod=${end}&detail=dataonly`;
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          Accept: "application/vnd.sdmx.data+json;version=1.0",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        lastErr = new Error(`ECB SDW request failed: ${res.status}`);
        continue;
      }
      const json = (await res.json()) as unknown as SdmxJson;
      const series = json.dataSets?.[0]?.series;
      if (!series || typeof series !== "object") throw new Error("ECB SDW: series missing");
      const firstKey = Object.keys(series)[0];
      const obs = series[firstKey]?.observations;
      const dims = json.structure?.dimensions?.observation;
      const timeDim = Array.isArray(dims)
        ? dims.find((d) => d?.id === "TIME_PERIOD")
        : null;
      const times: Array<{ id: string }> = timeDim?.values ?? [];
      if (!obs || !times.length) throw new Error("ECB SDW: observations/time missing");
      const map: Record<string, number> = {};
      for (let i = 0; i < times.length; i++) {
        const month = times[i]?.id as string;
        const v = (obs as Record<string, Array<number | null> | [number | null, ...unknown[]]>)[
          String(i)
        ]?.[0] as number | null | undefined;
        if (typeof v === "number" && month) map[month] = v;
      }
      return map;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
    }
  }

  // Surface last error after exhausting hosts
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

function eurostatTimeToMonth(input: string): string | null {
  const match = /^([0-9]{4})M([0-9]{2})$/.exec(input);
  if (!match) return null;
  return `${match[1]}-${match[2]}`;
}

async function fetchEurostatHicpSeries(endMonth?: string): Promise<Record<string, number>> {
  const end = endMonth ?? monthStr(new Date());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  const geos = ["EA20", "EA19"];
  const units = ["I15", "I15_AVG", "I15_A_AVG"];
  let lastErr: unknown = null;
  try {
    // Eurostat JSON-stat API; filters keep payload small (EA euro area, all-items, 2015=100).
    for (const geo of geos) {
      for (const unit of units) {
        try {
          const searchParams = new URLSearchParams({
            format: "JSON",
            precision: "1",
            geo,
            coicop: "CP00",
            unit,
          });
          const url = `https://ec.europa.eu/eurostat/api/discover/tables/prc_hicp_midx?${searchParams.toString()}`;
          const res = await fetch(url, {
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
            },
            signal: controller.signal,
          });
          if (!res.ok) {
            lastErr = new Error(`Eurostat request failed: ${res.status}`);
            continue;
          }
          const json = (await res.json()) as {
            value?: Record<string, number>;
            dimension?: {
              time?: { category?: { index?: Record<string, number> } };
            };
          };
          const timeIndex = json.dimension?.time?.category?.index;
          const values = json.value;
          if (!timeIndex || !values) {
            lastErr = new Error("Eurostat JSON-stat missing time/value");
            continue;
          }
          const map: Record<string, number> = {};
          for (const [timeKey, idx] of Object.entries(timeIndex)) {
            const month = eurostatTimeToMonth(timeKey);
            if (!month) continue;
            const val = values[String(idx)] ?? values[idx as unknown as string];
            if (typeof val === "number" && month <= end) {
              map[month] = val;
            }
          }
          if (!Object.keys(map).length) {
            lastErr = new Error("Eurostat returned empty map");
            continue;
          }
          clearTimeout(timer);
          return map;
        } catch (inner) {
          lastErr = inner;
        }
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  } catch (err) {
    clearTimeout(timer);
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHicpSeries(endMonth: string): Promise<{ series: Record<string, number>; source: "ecb" | "eurostat" }> {
  try {
    const series = await fetchEcbHicpSeries(endMonth);
    return { series, source: "ecb" };
  } catch (ecbErr) {
    const eurostat = await fetchEurostatHicpSeries(endMonth);
    return { series: eurostat, source: "eurostat" };
  }
}

async function ensureHicpCache(
  endMonth: string,
  forceRefresh = false
): Promise<{ series: Record<string, number>; source: HicpSource }> {
  // Use DB cache if configured
  if (process.env.MONGODB_URI && !forceRefresh) {
    const db = await getDb();
    const coll = db.collection<HicpDoc>("inflation_euro");
    const docs = await coll
      .find({ key: "EA_HICP_2015" }, { projection: { _id: 0 } })
      .toArray();
    const cachedMap: Record<string, number> = Object.fromEntries(
      docs.map((d) => [d.month, d.index])
    );
    if (cachedMap[endMonth]) return { series: cachedMap, source: "db" };
    const hasCached = Object.keys(cachedMap).length > 0;

    try {
      const { series: fresh, source } = await fetchHicpSeries(endMonth);
      const db2 = await getDb();
      const coll2 = db2.collection<HicpDoc>("inflation_euro");
      for (const [month, index] of Object.entries(fresh)) {
        try {
          await coll2.updateOne(
            { key: "EA_HICP_2015", month },
            { $set: { key: "EA_HICP_2015", month, index, fetchedAt: new Date() } },
            { upsert: true }
          );
        } catch {
          // ignore individual upsert errors
        }
      }
      return { series: fresh, source };
    } catch (err) {
      if (hasCached) return { series: cachedMap, source: "db" }; // fall back to stale cache if available
      const fallback = await readHicpFallback();
      if (Object.keys(fallback).length) return { series: fallback, source: "fallback" };
      throw err;
    }
  }

  // Fetch fresh series and upsert into DB if available
  try {
    const { series, source } = await fetchHicpSeries(endMonth);
    if (process.env.MONGODB_URI) {
      const db = await getDb();
      const coll = db.collection<HicpDoc>("inflation_euro");
      for (const [month, index] of Object.entries(series)) {
        try {
          await coll.updateOne(
            { key: "EA_HICP_2015", month },
            { $set: { key: "EA_HICP_2015", month, index, fetchedAt: new Date() } },
            { upsert: true }
          );
        } catch {
          // ignore individual upsert errors
        }
      }
    }
    return { series, source };
  } catch (err) {
    const fallback = await readHicpFallback();
    if (Object.keys(fallback).length) return { series: fallback, source: "fallback" };
    throw err;
  }
}

export async function getEuroInflationPercent(params: {
  from: string | Date;
  to?: string | Date;
  forceRefresh?: boolean;
}): Promise<{ percent: number; fromMonth: string; toMonth: string; source: HicpSource } | null> {
  const desiredFrom = monthStr(params.from);
  const desiredTo = monthStr(params.to ?? new Date());
  let series: Record<string, number> | null = null;
  let source: HicpSource = process.env.MONGODB_URI ? "db" : "ecb";
  try {
    const res = await ensureHicpCache(desiredTo, params.forceRefresh === true);
    series = res.series;
    source = res.source;
  } catch {
    // Retry with force refresh once if the first attempt failed and caller did not already force it
    if (params.forceRefresh !== true) {
      try {
        const res = await ensureHicpCache(desiredTo, true);
        series = res.series;
        source = res.source;
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  const keys = Object.keys(series || {}).sort();
  if (!keys.length) return null;

  const pickLE = (target: string) => {
    // pick the latest month <= target
    let candidate: string | null = null;
    for (const k of keys) {
      if (k <= target) candidate = k;
      else break;
    }
    return candidate;
  };
  const toMonth = pickLE(desiredTo) ?? keys[keys.length - 1];
  if (!toMonth) return null;

  // If the series looks like percentage values (not indices), compute the average of the last 12 months (or fall back to latest).
  const looksLikePercentSeries = Object.values(series).every(
    (v) => typeof v === "number" && v > -50 && v < 50
  );
  if (looksLikePercentSeries) {
    const available = keys.filter((k) => k <= toMonth).sort();
    const tail = available.slice(-12);
    const values = tail.map((m) => series![m]).filter((v) => typeof v === "number");
    if (values.length === 12) {
      const avg = values.reduce((s, v) => s + Number(v), 0) / 12;
      const fromMonth = tail[0];
      return { percent: avg, fromMonth, toMonth, source };
    }
    const pct = series[toMonth];
    if (typeof pct !== "number") return null;
    return { percent: pct, fromMonth: toMonth, toMonth, source };
  }

  // Year-over-year: compare to same month previous year
  const toDateObj = new Date(`${toMonth}-01T00:00:00Z`);
  const fromDateObj = new Date(
    Date.UTC(toDateObj.getUTCFullYear() - 1, toDateObj.getUTCMonth(), 1)
  );
  const targetFromMonth = monthStr(fromDateObj);
  const fromMonth = pickLE(targetFromMonth) ?? pickLE(desiredFrom) ?? keys[0];
  if (!fromMonth) return null;

  const startIdx = series![fromMonth];
  const endIdx = series![toMonth];
  if (!(typeof startIdx === "number" && typeof endIdx === "number" && startIdx > 0)) return null;

  const percent = (endIdx / startIdx - 1) * 100;
  return { percent, fromMonth, toMonth, source };
}

// Return the HICP index for the latest available month <= the requested month
export async function getHicpIndex(month: string, forceRefresh = false): Promise<number | null> {
  const m = monthStr(month);
  const { series } = await ensureHicpCache(m, forceRefresh);
  const keys = Object.keys(series).sort();
  let candidate: string | null = null;
  for (const k of keys) {
    if (k <= m) candidate = k;
    else break;
  }
  if (!candidate) return null;
  const v = series[candidate];
  return typeof v === "number" ? v : null;
}
