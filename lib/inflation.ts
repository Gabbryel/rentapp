import { getDb } from "@/lib/mongodb";

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

function monthStr(input: Date | string): string {
  const d = typeof input === "string" ? new Date(input) : input;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function fetchEcbHicpSeries(endMonth?: string): Promise<Record<string, number>> {
  const end = endMonth ?? monthStr(new Date());
  const url = `https://sdw-wsrest.ecb.europa.eu/service/data/ICP/M.U2.N.000000.4.INX?startPeriod=2000-01&endPeriod=${end}&detail=dataonly`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/vnd.sdmx.data+json;version=1.0",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
    },
  });
  if (!res.ok) {
    // Surface a distinct error so caller can degrade gracefully
    throw new Error(`ECB SDW request failed: ${res.status}`);
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
}

async function ensureHicpCache(endMonth: string, forceRefresh = false): Promise<Record<string, number>> {
  // Use DB cache if configured
  if (process.env.MONGODB_URI && !forceRefresh) {
    const db = await getDb();
    const coll = db.collection<HicpDoc>("inflation_euro");
    const docs = await coll
      .find({ key: "EA_HICP_2015" }, { projection: { _id: 0 } })
      .toArray();
    const map: Record<string, number> = Object.fromEntries(
      docs.map((d) => [d.month, d.index])
    );
    // If we have the target month, use cache
    if (map[endMonth]) return map;
  }

  // Fetch fresh series and upsert into DB if available
  const series = await fetchEcbHicpSeries(endMonth);
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
  return series;
}

export async function getEuroInflationPercent(params: {
  from: string | Date;
  to?: string | Date;
  forceRefresh?: boolean;
}): Promise<{ percent: number; fromMonth: string; toMonth: string; source: "db" | "ecb" } | null> {
  const desiredFrom = monthStr(params.from);
  const desiredTo = monthStr(params.to ?? new Date());
  let series: Record<string, number> | null = null;
  try {
    series = await ensureHicpCache(desiredTo, params.forceRefresh === true);
  } catch (err) {
    // Likely network / 503; degrade gracefully (caller shows 'Indisponibil')
    return null;
  }

  const keys = Object.keys(series).sort();
  const pickLE = (target: string) => {
    // pick the latest month <= target
    let candidate: string | null = null;
    for (const k of keys) {
      if (k <= target) candidate = k;
      else break;
    }
    return candidate;
  };
  const fromMonth = pickLE(desiredFrom) ?? keys[0];
  const toMonth = pickLE(desiredTo) ?? keys[keys.length - 1];

  const startIdx = series[fromMonth];
  const endIdx = series[toMonth];
  if (typeof startIdx !== "number" || typeof endIdx !== "number") {
    throw new Error("Indicele HICP lipsă pentru una dintre luni");
  }
  const percent = ((endIdx / startIdx) - 1) * 100;
  // We don't track precise source per point; infer source from env
  return { percent, fromMonth, toMonth, source: process.env.MONGODB_URI ? "db" : "ecb" };
}

// Return the HICP index for the latest available month <= the requested month
export async function getHicpIndex(month: string, forceRefresh = false): Promise<number | null> {
  const m = monthStr(month);
  const series = await ensureHicpCache(m, forceRefresh);
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
