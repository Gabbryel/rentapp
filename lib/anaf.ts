/**
 * ANAF (Romanian tax authority) public company lookup by CUI.
 *
 * Endpoint moved from /PlatitorTvaRest/api/v{n}/ws/tva to the path below;
 * only v9 responds — older versions return 404.
 */

const ANAF_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60 * 60 * 1000;

export type AnafCompany = {
  cui: string;
  name: string;
  headquarters: string;
  orcNumber: string;
  isVatPayer: boolean;
  /** Free-text registration status, e.g. "INREGISTRAT din data 29.08.2006" */
  registrationStatus: string;
  /** Declared inactive by ANAF — a contract with such a company is risky */
  isInactive: boolean;
  /** Registered in the RO e-Factura system */
  eInvoicing: boolean;
  phone: string;
  caenCode: string;
};

type AnafAddress = Record<string, unknown>;

type AnafRawEntry = {
  date_generale?: Record<string, unknown>;
  inregistrare_scop_Tva?: { scpTVA?: boolean };
  stare_inactiv?: { statusInactivi?: boolean };
  adresa_sediu_social?: AnafAddress;
  adresa_domiciliu_fiscal?: AnafAddress;
};

const cache = new Map<string, { at: number; value: AnafCompany | null }>();

/** Strips the "RO" prefix, separators and leading zeros. Returns null if not a plausible CUI. */
export function normalizeCui(input: string): string | null {
  const digits = String(input ?? "")
    .trim()
    .replace(/^ro/i, "")
    .replace(/[\s.\-_]/g, "");
  if (!/^\d{2,10}$/.test(digits)) return null;
  const stripped = digits.replace(/^0+/, "");
  return stripped.length >= 2 ? stripped : null;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Composes "Str. X nr. Y, detalii, Localitate, Judet" from ANAF's split address fields. */
function composeAddress(addr: AnafAddress | undefined, prefix: "s" | "d"): string {
  if (!addr) return "";
  const get = (field: string) => str(addr[`${prefix}${field}`]);
  const street = get("denumire_Strada");
  const number = get("numar_Strada");
  const details = get("detalii_Adresa");
  const locality = get("denumire_Localitate");
  const county = get("denumire_Judet");
  const streetLine = [street, number ? `nr. ${number}` : ""]
    .filter(Boolean)
    .join(" ");
  return [streetLine, details, locality, county].filter(Boolean).join(", ");
}

function toCompany(entry: AnafRawEntry): AnafCompany | null {
  const general = entry.date_generale ?? {};
  const cui = str(general.cui) || String(general.cui ?? "");
  const name = str(general.denumire);
  if (!name) return null;
  // Registered office is the contractual address; fall back to fiscal domicile,
  // then to the pre-formatted string ANAF returns.
  const headquarters =
    composeAddress(entry.adresa_sediu_social, "s") ||
    composeAddress(entry.adresa_domiciliu_fiscal, "d") ||
    str(general.adresa);
  return {
    cui,
    name,
    headquarters,
    orcNumber: str(general.nrRegCom),
    isVatPayer: entry.inregistrare_scop_Tva?.scpTVA === true,
    registrationStatus: str(general.stare_inregistrare),
    isInactive: entry.stare_inactiv?.statusInactivi === true,
    eInvoicing: general.statusRO_e_Factura === true,
    phone: str(general.telefon),
    caenCode: str(general.cod_CAEN),
  };
}

/**
 * Looks a company up at ANAF. Returns null when the CUI is not in their registry.
 * Throws on network/parse failure so callers can distinguish "not found" from "lookup broken".
 */
export async function lookupCompanyByCui(
  rawCui: string
): Promise<AnafCompany | null> {
  const cui = normalizeCui(rawCui);
  if (!cui) throw new Error("CUI invalid");

  const hit = cache.get(cui);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const res = await fetch(ANAF_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([
      { cui: Number(cui), data: new Date().toISOString().slice(0, 10) },
    ]),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  // An unknown CUI comes back as HTTP 404 with a well-formed {found:[],notFound:[…]}
  // body, so the status alone can't distinguish "not registered" from "lookup broken".
  const json = await res
    .json()
    .then((j) => j as { found?: AnafRawEntry[] })
    .catch(() => null);
  if (!json || !Array.isArray(json.found)) {
    throw new Error(`ANAF a răspuns cu status ${res.status}`);
  }

  const entry = json.found[0];
  const value = entry ? toCompany(entry) : null;
  cache.set(cui, { at: Date.now(), value });
  return value;
}
