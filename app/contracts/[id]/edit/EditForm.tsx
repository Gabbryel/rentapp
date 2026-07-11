"use client";
import { useActionState, useRef } from "react";
import Link from "next/link";
import { updateContractAction, type EditFormState } from "./actions";
import PartnerMultiSelect from "@/app/components/partner-multi-select";
import AssetSelect from "@/app/components/asset-select";
import OwnerSelect from "@/app/components/owner-select";
import ExtensionsField from "@/app/components/extensions-field";
import { useRouter } from "next/navigation";

import type { Contract } from "@/lib/schemas/contract";

const MONTH_OPTIONS = [
  { value: 1, label: "Ianuarie" },
  { value: 2, label: "Februarie" },
  { value: 3, label: "Martie" },
  { value: 4, label: "Aprilie" },
  { value: 5, label: "Mai" },
  { value: 6, label: "Iunie" },
  { value: 7, label: "Iulie" },
  { value: 8, label: "August" },
  { value: 9, label: "Septembrie" },
  { value: 10, label: "Octombrie" },
  { value: 11, label: "Noiembrie" },
  { value: 12, label: "Decembrie" },
] as const;

const inputCls =
  "mt-1 w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20";
const labelCls = "block text-sm font-medium";
const hintCls = "mt-1 text-[11px] text-foreground/50";

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-foreground/10 bg-background p-6 shadow-sm">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-xs text-foreground/50">{description}</p>
      ) : null}
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

type Props = {
  contract: Contract;
  mongoConfigured: boolean;
};

export default function EditForm({ contract, mongoConfigured }: Props) {
  const [state, formAction] = useActionState<EditFormState, FormData>(
    updateContractAction,
    { ok: false, values: {} }
  );
  const formRef = useRef<HTMLFormElement | null>(null);
  const router = useRouter();
  const rentTypeRaw = String(
    (state.values.rentType as string) ?? contract.rentType ?? "monthly"
  );
  const rentType: "monthly" | "custom" =
    rentTypeRaw === "custom" || rentTypeRaw === "yearly" ? "custom" : "monthly";
  const customInvoices = Array.isArray(contract.customInvoices)
    ? contract.customInvoices
    : [];
  const indexingDayValue = String(
    (state.values as any).indexingDay ?? contract.indexingDay ?? ""
  );
  const indexingMonthValue = String(
    (state.values as any).indexingMonth ?? contract.indexingMonth ?? ""
  );
  const indexingFreqValue = String(
    (state.values as any).howOftenIsIndexing ??
      contract.howOftenIsIndexing ??
      ""
  );
  const currentAmountEUR = (() => {
    const fromState = (state.values as any).amountEUR;
    if (typeof fromState === "string" && fromState.trim() !== "")
      return fromState;
    const arr = Array.isArray(contract.indexingDates)
      ? contract.indexingDates
      : [];
    const sorted = arr
      .slice()
      .map((r) => ({
        eff: String(r.actualDate || r.forecastDate || ""),
        val: r.newRentAmount,
      }))
      .filter((r) => r.eff)
      .sort((a, b) => a.eff.localeCompare(b.eff));
    const first = sorted[0];
    return typeof first?.val === "number"
      ? String(first.val)
      : String((contract as any).amountEUR ?? "");
  })();

  const handleGenerateWrittenContract = () => {
    if (typeof window === "undefined") return;
    const formEl = formRef.current;
    if (!formEl) return;
    const fd = new FormData(formEl);
    const payload: Record<string, unknown> = { contractId: contract.id };
    fd.forEach((value, key) => {
      if (value instanceof File) return;
      const textValue = typeof value === "string" ? value : String(value ?? "");
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        const current = payload[key];
        if (Array.isArray(current)) {
          current.push(textValue);
        } else {
          payload[key] = [current, textValue];
        }
      } else {
        payload[key] = textValue;
      }
    });
    try {
      window.sessionStorage.setItem(
        "written-contract-prefill",
        JSON.stringify(payload)
      );
    } catch (error) {
      console.warn("Nu am putut salva draftul pentru contract scris", error);
    }
    router.push(
      `/contracts/written-contract?contractId=${encodeURIComponent(
        contract.id
      )}`
    );
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-5 mt-6">
      <input type="hidden" name="id" value={contract.id} readOnly />
      <input
        type="hidden"
        name="name"
        value={String(state.values.name ?? contract.name)}
        readOnly
      />
      {state.message && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {state.message}
        </div>
      )}

      <SectionCard
        title="Părți"
        description="Numele contractului este generat automat din asset și parteneri."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Asset</label>
            <AssetSelect
              idName="assetId"
              nameName="asset"
              required
              defaultId={String(
                (state.values.assetId as string) ?? contract.assetId ?? ""
              )}
              defaultName={String(
                (state.values.asset as string) ?? contract.asset ?? ""
              )}
            />
          </div>
          <div>
            <label className={labelCls}>Proprietar</label>
            <OwnerSelect
              idName="ownerId"
              nameName="owner"
              required
              defaultId={String(
                (state.values.ownerId as string) ?? contract.ownerId ?? ""
              )}
              defaultName={String(
                (state.values.owner as string) ?? contract.owner ?? ""
              )}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Parteneri</label>
          <p className={hintCls}>
            Primul partener din listă este considerat partener principal.
          </p>
          <div className="mt-2">
            <PartnerMultiSelect
              defaultPartners={(() => {
                const arr = contract.partners as
                  | { id?: string; name: string }[]
                  | undefined;
                if (Array.isArray(arr) && arr.length > 0) return arr;
                return [{ id: contract.partnerId, name: contract.partner }];
              })()}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Perioadă & prelungiri">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className={labelCls}>Semnat</label>
            <input
              type="date"
              name="signedAt"
              required
              defaultValue={String(state.values.signedAt ?? contract.signedAt)}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Început</label>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={String(
                state.values.startDate ?? contract.startDate
              )}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Expiră</label>
            <input
              type="date"
              name="endDate"
              required
              defaultValue={String(state.values.endDate ?? contract.endDate)}
              className={inputCls}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Prelungiri (acte adiționale)</label>
          <div className="mt-2">
            <ExtensionsField
              name="contractExtensions"
              initial={
                Array.isArray(contract.contractExtensions)
                  ? contract.contractExtensions.map((r) => ({
                      docDate: String(r.docDate || ""),
                      document: String(r.document || ""),
                      extendedUntil: String(r.extendedUntil || ""),
                    }))
                  : []
              }
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Chirie & facturare">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div>
            <label className={labelCls}>Tip chirie</label>
            <select
              name="rentType"
              defaultValue={rentType}
              className={inputCls}
            >
              <option value="monthly">Lunar</option>
              <option value="custom">Facturi custom (date fixe)</option>
            </select>
          </div>
          {rentType === "monthly" && (
            <>
              <div>
                <label className={labelCls}>Zi facturare (1-31)</label>
                <input
                  name="monthlyInvoiceDay"
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  defaultValue={String(
                    (state.values.monthlyInvoiceDay as string) ??
                      contract.monthlyInvoiceDay ??
                      ""
                  )}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Luna facturată</label>
                <select
                  name="invoiceMonthMode"
                  defaultValue={String(
                    (state.values as any).invoiceMonthMode ??
                      contract.invoiceMonthMode ??
                      "current"
                  )}
                  className={inputCls}
                >
                  <option value="current">Luna curentă</option>
                  <option value="next">Luna următoare (în avans)</option>
                </select>
              </div>
            </>
          )}
          {rentType === "custom" && (
            <div className="sm:col-span-2 space-y-2">
              <label className={labelCls}>Grafic facturi</label>
              {customInvoices.length === 0 ? (
                <p className="text-xs text-foreground/60">
                  Nu există facturi custom definite.
                </p>
              ) : (
                <ul className="space-y-1">
                  {customInvoices.map((ci, i) => (
                    <li
                      key={ci.date}
                      className="flex items-center justify-between rounded-md bg-foreground/5 px-3 py-1.5 text-sm"
                    >
                      <span className="text-foreground/70">{ci.date}</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat("ro-RO", {
                          style: "currency",
                          currency: "EUR",
                        }).format(ci.amountEUR)}
                      </span>
                      <input
                        type="hidden"
                        name={`customInvoices[${i}][date]`}
                        value={ci.date}
                        readOnly
                      />
                      <input
                        type="hidden"
                        name={`customInvoices[${i}][amountEUR]`}
                        value={String(ci.amountEUR)}
                        readOnly
                      />
                    </li>
                  ))}
                </ul>
              )}
              <p className={hintCls}>
                Datele și sumele se editează din pagina contractului, secțiunea
                „Facturi custom”.
              </p>
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="sm:col-span-2">
            <label className={labelCls}>Suma EUR</label>
            <div className="mt-1 flex gap-2">
              <input
                name="amountEUR"
                type="number"
                step="0.01"
                min={0}
                inputMode="decimal"
                defaultValue={currentAmountEUR}
                className="w-full min-w-0 rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
                placeholder="ex: 1000"
              />
              <select
                name="amountVatMode"
                defaultValue="net"
                title="Cum este exprimată suma introdusă"
                className="shrink-0 rounded-md border border-foreground/20 bg-transparent px-2 py-2 text-sm"
              >
                <option value="net">fără TVA</option>
                <option value="gross">cu TVA inclus</option>
              </select>
            </div>
            <p className={hintCls}>
              Suma „cu TVA inclus” este convertită la net la salvare, pe baza
              câmpului TVA.
            </p>
          </div>
          <div>
            <label className={labelCls}>Curs RON</label>
            <input
              name="exchangeRateRON"
              type="number"
              step="0.0001"
              min={0}
              inputMode="decimal"
              defaultValue={String(
                state.values.exchangeRateRON ?? contract.exchangeRateRON ?? ""
              )}
              className={inputCls}
              placeholder="ex: 4.97"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div>
            <label className={labelCls}>TVA (%)</label>
            <input
              name="tvaPercent"
              type="number"
              step="1"
              min={0}
              max={100}
              inputMode="numeric"
              defaultValue={String(
                state.values.tvaPercent ?? contract.tvaPercent ?? ""
              )}
              placeholder="ex: 19"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>Tip TVA</label>
            <input
              name="tvaType"
              defaultValue={String(
                state.values.tvaType ?? contract.tvaType ?? ""
              )}
              placeholder="ex: fără drept de deducere (f.d.d.)"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Corecție (%)</label>
            <input
              name="correctionPercent"
              type="number"
              step="0.01"
              min={0}
              max={100}
              inputMode="decimal"
              defaultValue={String(
                state.values.correctionPercent ??
                  contract.correctionPercent ??
                  ""
              )}
              placeholder="ex: 10.5"
              className={inputCls}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
          <div>
            <label className={labelCls}>Zile până la scadență</label>
            <input
              type="number"
              name="paymentDueDays"
              min={0}
              max={120}
              inputMode="numeric"
              placeholder="ex: 15"
              defaultValue={String(
                (state.values.paymentDueDays as string) ??
                  contract.paymentDueDays ??
                  ""
              )}
              className={inputCls}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Indexare"
        description="Luna, ziua și frecvența la care se aplică indexarea. Datele exacte sunt generate automat la salvare, până la expirarea contractului, și pot fi marcate drept aplicate din pagina contractului."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Zi (1-31)</label>
            <input
              name="indexingDay"
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              defaultValue={indexingDayValue}
              className={inputCls}
              placeholder="ex: 10"
            />
          </div>
          <div>
            <label className={labelCls}>Luna</label>
            <select
              name="indexingMonth"
              defaultValue={indexingMonthValue}
              className={inputCls}
            >
              <option value="">Selectează luna</option>
              {MONTH_OPTIONS.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Frecvență (luni)</label>
            <input
              name="howOftenIsIndexing"
              type="number"
              min={1}
              max={12}
              inputMode="numeric"
              defaultValue={indexingFreqValue}
              className={inputCls}
              placeholder="ex: 12"
            />
          </div>
        </div>
      </SectionCard>

      <div className="sticky bottom-0 -mx-1 rounded-xl border border-foreground/10 bg-background/95 px-4 py-3 shadow-lg backdrop-blur flex flex-wrap items-center justify-end gap-3">
        <Link
          href={`/contracts/${contract.id}`}
          className="text-sm text-foreground/70 hover:underline mr-auto"
        >
          Anulează
        </Link>
        <button
          type="button"
          onClick={handleGenerateWrittenContract}
          className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/5"
        >
          Generează contract scris
        </button>
        <button
          disabled={!mongoConfigured}
          className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:opacity-50"
        >
          Salvează modificările
        </button>
      </div>
    </form>
  );
}
