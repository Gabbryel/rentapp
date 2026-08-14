import { describe, it, expect, vi, afterEach } from "vitest";
import { normalizeCui, lookupCompanyByCui } from "@/lib/anaf";

describe("normalizeCui", () => {
  it("strips the RO prefix, separators and leading zeros", () => {
    expect(normalizeCui("RO14399840")).toBe("14399840");
    expect(normalizeCui(" ro 14.399.840 ")).toBe("14399840");
    expect(normalizeCui("0014399840")).toBe("14399840");
  });

  it("rejects values that are not plausible CUIs", () => {
    expect(normalizeCui("")).toBeNull();
    expect(normalizeCui("abc")).toBeNull();
    expect(normalizeCui("1")).toBeNull();
    expect(normalizeCui("12345678901")).toBeNull();
  });
});

function anafResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

const entry = {
  date_generale: {
    cui: 14399840,
    denumire: "DANTE INTERNATIONAL SA",
    adresa: "MUNICIPIUL BUCUREŞTI, SECTOR 2, STR. GARA HERĂSTRĂU, NR.6",
    nrRegCom: "J2002000372404",
    stare_inregistrare: "INREGISTRAT din data 29.08.2006",
    statusRO_e_Factura: false,
    telefon: "",
    cod_CAEN: "4754",
  },
  inregistrare_scop_Tva: { scpTVA: true },
  stare_inactiv: { statusInactivi: false },
  adresa_sediu_social: {
    sdenumire_Strada: "Şos. Virtuţii",
    snumar_Strada: "148",
    sdetalii_Adresa: "spatiul E47",
    sdenumire_Localitate: "Sector 6 Mun. Bucureşti",
    sdenumire_Judet: "MUNICIPIUL BUCUREŞTI",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("lookupCompanyByCui", () => {
  it("maps an ANAF hit onto partner fields, preferring the registered office", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => anafResponse({ found: [entry], notFound: [] }))
    );
    const company = await lookupCompanyByCui("RO14399840");
    expect(company).toMatchObject({
      cui: "14399840",
      name: "DANTE INTERNATIONAL SA",
      orcNumber: "J2002000372404",
      isVatPayer: true,
      isInactive: false,
      caenCode: "4754",
    });
    expect(company?.headquarters).toBe(
      "Şos. Virtuţii nr. 148, spatiul E47, Sector 6 Mun. Bucureşti, MUNICIPIUL BUCUREŞTI"
    );
  });

  // ANAF answers an unknown CUI with HTTP 404 *and* a well-formed body.
  it("returns null when ANAF does not know the CUI", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        anafResponse({ found: [], notFound: [99999998] }, 404)
      )
    );
    expect(await lookupCompanyByCui("99999998")).toBeNull();
  });

  it("throws on an invalid CUI without calling ANAF", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(lookupCompanyByCui("nope")).rejects.toThrow("CUI invalid");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when ANAF returns an error page instead of a result body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          ({
            ok: false,
            status: 503,
            json: async () => {
              throw new SyntaxError("Unexpected token < in JSON");
            },
          }) as unknown as Response
      )
    );
    await expect(lookupCompanyByCui("99999997")).rejects.toThrow("503");
  });
});
