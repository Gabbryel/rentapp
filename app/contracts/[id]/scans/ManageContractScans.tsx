"use client";

import * as React from "react";
import { useActionState, useRef } from "react";
import {
  addScanAction,
  updateScanTitleAction,
  deleteScanAction,
  updateVatPercentAction,
  issueIndexingNoticeAction,
  type ScanActionState,
  type IndexingNoticeState,
} from "./actions";
import IndexingNoticePrint from "../IndexingNoticePrint";
import {
  createDepositAction,
  editDepositAction,
  deleteDepositAction,
  toggleDepositAction,
  updateCorrectionPercentAction,
  addExtensionAction,
  deleteExtensionAction,
} from "../manage/actions";

function fmtDate(dateIso?: string) {
  if (!dateIso) return "";
  const d = new Date(`${dateIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = String(d.getUTCFullYear());
  return `${dd}.${mm}.${yy}`;
}

function generateDefaultNotificationContent(
  meta: Record<string, unknown>,
  contractName?: string
): string {
  const fromMonth = String(meta.fromMonth || meta.from || "?");
  const toMonth = String(meta.toMonth || meta.to || "?");
  const deltaPercent =
    typeof meta.deltaPercent === "number" ? meta.deltaPercent : undefined;
  const rentEUR = typeof meta.rentEUR === "number" ? meta.rentEUR : undefined;

  const contractNumber =
    (typeof meta.contractNumber === "string" && meta.contractNumber.trim()) ||
    "{contract number}";
  const contractSignedAtIso =
    typeof meta.contractSignedAt === "string"
      ? String(meta.contractSignedAt).slice(0, 10)
      : "";
  const contractSignedAtText = contractSignedAtIso
    ? fmtDate(contractSignedAtIso)
    : "{contract begining date}";

  const metaValidFrom =
    typeof meta.validFrom === "string" ? String(meta.validFrom) : "";
  const effectiveValidFromIso = metaValidFrom.slice(0, 10) || "";

  const partnerName =
    (typeof meta.partnerName === "string" && meta.partnerName.trim()) ||
    "{partner name}";
  const partnerAddress =
    (typeof meta.partnerAddress === "string" && meta.partnerAddress.trim()) ||
    "{partner address}";
  const partnerCui =
    (typeof meta.partnerCui === "string" && meta.partnerCui.trim()) ||
    "{partner CUI}";
  const ownerName =
    (typeof meta.ownerName === "string" && meta.ownerName.trim()) || "{owner}";
  const representative =
    (typeof meta.partnerRepresentative === "string" &&
      meta.partnerRepresentative.trim()) ||
    "{representative}";

  const assetAddress =
    (typeof meta.assetAddress === "string" && meta.assetAddress.trim()) ||
    "[adresa imobilului]";

  const note = typeof meta.note === "string" ? meta.note.trim() : "";

  const indexedRentEUR =
    typeof meta.newRentEUR === "number"
      ? Math.ceil(meta.newRentEUR as number)
      : typeof rentEUR === "number" && typeof deltaPercent === "number"
      ? Math.ceil(rentEUR * (1 + deltaPercent / 100))
      : undefined;

  const validFromText = effectiveValidFromIso
    ? fmtDate(effectiveValidFromIso)
    : "[data de aplicare]";

  const nextMonthText = (() => {
    if (!effectiveValidFromIso) return "{next month}";
    const d = new Date(`${effectiveValidFromIso}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return "{next month}";
    try {
      return new Intl.DateTimeFormat("ro-RO", {
        month: "long",
        year: "numeric",
      }).format(d);
    } catch {
      return "{next month}";
    }
  })();

  return `Către: ${partnerName}
Adresa: ${partnerAddress}
CNP/CUI: ${partnerCui}

De la: ${ownerName}


Subiect: Indexarea chiriei în funcție de rata inflației în euro aferentă ultimului an calendaristic

Stimate/Stimată ${representative},

Subscrisa ${ownerName}, prin prezenta, vă aducem la cunoștință faptul că, în conformitate cu prevederile art. 5.1. din Contractul de închiriere nr. ${contractNumber} din data de ${contractSignedAtText} (în continuare „Contractul”), chiria stabilită pentru imobilul situat în ${assetAddress} urmează să fie indexată cu rata inflației în euro aferentă ultimului an calendaristic, potrivit mecanismului de ajustare convenit de părți.

În consecință, începând cu data de ${validFromText}, chiria lunară se va ajusta după cum urmează:
    •   Chirie actuală: ${
      typeof rentEUR === "number" ? rentEUR.toFixed(2) : "{current rent amount}"
    } EUR/lună
    •   Rata inflației (EUR) pentru ultimul an calendaristic: ${
      typeof deltaPercent === "number"
        ? deltaPercent.toFixed(2)
        : "{inflation rate}"
    }%${note ? ` (${note})` : ""}
    •   Chirie indexată: ${
      typeof indexedRentEUR === "number"
        ? indexedRentEUR
        : "{rent amount indexed}"
    } EUR/lună + T.V.A. aplicabil + procent corecție curs B.N.R.

Plata chiriei indexate se va efectua în aceleași condiții, termene și în același cont prevăzute în Contract, în lipsa unei notificări contrare scrise din partea noastră.

Prezenta notificare este transmisă cu respectarea dispozițiilor Contractului privind comunicările între părți și produce efecte de la data indicată mai sus.

Cu stimă,
${ownerName}`;
}

type Props = {
  id: string;
  scans: { url: string; title?: string; fileSize?: number | null }[];
  mongoConfigured: boolean;
  rentType?: "monthly" | "yearly";
  irregularInvoices?: { month: number; day: number; amountEUR: number }[];
  children?: React.ReactNode;
  wrapChildrenInCard?: boolean;
  currentVatPercent?: number | null;
  correctionPercent?: number | null;
  deposits?: Array<{
    id: string;
    type: string;
    amountEUR?: number | null;
    note?: string | null;
    isDeposited?: boolean;
    returned?: boolean;
    createdAt?: string;
    updatedAt?: string;
    [k: string]: unknown;
  }>;
  contractExtensions?: Array<{
    docDate?: string;
    document?: string;
    extendedUntil?: string;
  }>;
  contractSignedAt?: string;
  contractEnd?: string;
  indexingInflation?: {
    percent: number;
    fromMonth: string;
    toMonth: string;
    deltaAmount?: number | null;
  } | null;
  currentRent?: number | null;
  defaultIndexingContractNumber?: string;
  defaultIndexingContractSignedAt?: string;
  indexingNotices?: Array<{
    id?: string;
    _id?: unknown;
    at?: string;
    meta?: Record<string, unknown>;
    userEmail?: string | null;
    [k: string]: unknown;
  }>;
  updateIndexingNoticeAction?: (formData: FormData) => Promise<void>;
  deleteIndexingNoticeAction?: (formData: FormData) => Promise<void>;
  sendIndexingNoticeEmailAction?: (formData: FormData) => Promise<void>;
  sendIndexingNoticeToAdminsAction?: (formData: FormData) => Promise<void>;
  applyIndexingNoticeAction?: (formData: FormData) => Promise<void>;
  updateNextIndexingDateAction?: (formData: FormData) => Promise<void>;
  saveEditedNotificationAction?: (formData: FormData) => Promise<void>;
  nextIndexingDate?: string;
  partnerEmail?: string;
  contractName?: string;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-xl border border-white/12 bg-white/[0.04] p-4">
      <summary className="cursor-pointer list-none select-none text-[11px] font-semibold uppercase tracking-wide text-white/60">
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export default function ManageContractScans({
  id,
  scans,
  mongoConfigured,
  rentType,
  irregularInvoices,
  currentVatPercent,
  correctionPercent,
  deposits,
  contractExtensions,
  contractSignedAt,
  contractEnd,
  indexingInflation,
  currentRent,
  defaultIndexingContractNumber,
  defaultIndexingContractSignedAt,
  indexingNotices,
  updateIndexingNoticeAction,
  deleteIndexingNoticeAction,
  sendIndexingNoticeEmailAction,
  sendIndexingNoticeToAdminsAction,
  applyIndexingNoticeAction,
  updateNextIndexingDateAction,
  saveEditedNotificationAction,
  nextIndexingDate,
  partnerEmail,
  contractName,
}: Props) {
  const [editingNoticeId, setEditingNoticeId] = React.useState<string | null>(
    null
  );
  const [editedContent, setEditedContent] = React.useState("");
  const [deletingNoticeId, setDeletingNoticeId] = React.useState<string | null>(
    null
  );
  const [viewingScan, setViewingScan] = React.useState<{
    url: string;
    title?: string;
  } | null>(null);
  const [addState, addAction] = useActionState<ScanActionState, FormData>(
    addScanAction,
    { ok: false }
  );
  const [, updateAction] = useActionState<ScanActionState, FormData>(
    updateScanTitleAction,
    { ok: false }
  );
  const [, removeAction] = useActionState<ScanActionState, FormData>(
    deleteScanAction,
    { ok: false }
  );
  const [vatState, updateVatAction] = useActionState<ScanActionState, FormData>(
    updateVatPercentAction,
    { ok: false }
  );
  const [indexingState, issueIndexingAction] = useActionState<
    IndexingNoticeState,
    FormData
  >(issueIndexingNoticeAction, { ok: false });
  const [msg, setMsg] = React.useState<string | null>(null);
  const [viewingNoticeId, setViewingNoticeId] = React.useState<string | null>(
    null
  );
  const printRef = useRef<{ triggerPrint: () => void }>(null);

  React.useEffect(() => {
    if (addState.message) setMsg(addState.message);
  }, [addState.message]);

  React.useEffect(() => {
    if (vatState.message) setMsg(vatState.message);
  }, [vatState.message]);

  React.useEffect(() => {
    if (indexingState.message) setMsg(indexingState.message);
  }, [indexingState.message]);

  const [open, setOpen] = React.useState(false);
  return (
    <div
      id="manage-contract-edits"
      className="mt-6 rounded-xl border border-white/10 bg-gradient-to-br from-[#1f3a4b] to-[#0f222a] text-[#E8F1F2] shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-md"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold hover:bg-white/5 rounded-t-xl"
        aria-expanded={open}
        aria-controls="manage-contract-section"
      >
        <span className="inline-flex items-center gap-2">
          <svg
            className={`h-4 w-4 transition-transform ${
              open ? "rotate-90" : "rotate-0"
            }`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M7 5l6 5-6 5V5z" />
          </svg>
          Gestionează contract
        </span>
        <span className="text-[11px] opacity-80">
          {open ? "Ascunde" : "Afișează"}
        </span>
      </button>
      {!open ? null : (
        <>
          {msg ? (
            <div className="mx-4 mt-3 rounded border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              {msg}
            </div>
          ) : null}
          <div
            id="manage-contract-section"
            className="px-5 pb-6 pt-3 space-y-6"
          >
            <div
              id="contract-indexing-notice"
              className="rounded-xl border border-white/12 bg-white/[0.04] p-4"
            >
              <details className="w-full">
                <summary className="cursor-pointer list-none select-none text-[11px] font-semibold uppercase tracking-wide text-white/60">
                  Notificare indexare
                </summary>
                <div className="mt-3 space-y-3">
                  {typeof currentRent === "number" ? (
                    <div className="text-xs text-white/70">
                      Chirie curentă: {currentRent.toFixed(2)} EUR
                    </div>
                  ) : null}
                  {indexingInflation ? (
                    <div className="text-xs text-white/70">
                      Estimare inflație (ultimele 12 luni):
                      <span className="ml-1 font-semibold text-white">
                        +{indexingInflation.percent.toFixed(2)}%
                      </span>
                      <span className="ml-1">
                        ({indexingInflation.fromMonth} →{" "}
                        {indexingInflation.toMonth})
                      </span>
                    </div>
                  ) : null}

                  <form
                    action={issueIndexingAction}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-6"
                  >
                    <input type="hidden" name="contractId" value={id} />
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium">
                        Nr. contract
                      </label>
                      <input
                        name="contractNumber"
                        defaultValue={defaultIndexingContractNumber || ""}
                        className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-sm"
                        required
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium">
                        Data contract
                      </label>
                      <input
                        name="contractSignedAt"
                        type="date"
                        defaultValue={(
                          defaultIndexingContractSignedAt || ""
                        ).slice(0, 10)}
                        className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-sm"
                        required
                      />
                    </div>

                    <div className="sm:col-span-6">
                      <label className="block text-xs font-medium">
                        Notițe indexare (opțional)
                      </label>
                      <textarea
                        name="note"
                        rows={3}
                        placeholder="ex: detalii/observații pentru notificare"
                        className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-6 flex items-center gap-3">
                      <button
                        type="submit"
                        disabled={!mongoConfigured}
                        className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
                      >
                        Emite notificare
                      </button>
                      {!mongoConfigured ? (
                        <div className="text-xs text-white/70">
                          Necesită MongoDB (audit logs).
                        </div>
                      ) : null}
                    </div>
                  </form>
                </div>
              </details>
            </div>

            <Section title="Notificări indexare">
              {Array.isArray(indexingNotices) && indexingNotices.length > 0 ? (
                <div className="space-y-3">
                  {indexingNotices.map((notice) => {
                    const meta = (notice.meta || {}) as Record<string, unknown>;
                    const noticeId = notice.id ?? String(notice._id ?? "");
                    const issuedAt = notice.at
                      ? new Date(notice.at).toISOString().slice(0, 10)
                      : "";
                    const fromMonth = String(meta.fromMonth || meta.from || "");
                    const toMonth = String(meta.toMonth || meta.to || "");
                    const validFrom = String(meta.validFrom || "");
                    const deltaPercent =
                      typeof meta.deltaPercent === "number"
                        ? meta.deltaPercent
                        : undefined;
                    const deltaAmountEUR =
                      typeof meta.deltaAmountEUR === "number"
                        ? meta.deltaAmountEUR
                        : undefined;
                    const rentEUR =
                      typeof meta.rentEUR === "number"
                        ? meta.rentEUR
                        : undefined;
                    const note = typeof meta.note === "string" ? meta.note : "";

                    return (
                      <div
                        key={noticeId}
                        className="rounded-lg border border-white/10 bg-white/5 p-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                                {issuedAt || "—"}
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                {deltaPercent !== undefined ? (
                                  <span className="font-semibold text-emerald-400">
                                    +{deltaPercent.toFixed(2)}%
                                  </span>
                                ) : null}
                                {deltaAmountEUR !== undefined ? (
                                  <span className="text-white/70">
                                    {deltaAmountEUR.toFixed(2)} EUR
                                  </span>
                                ) : null}
                                {note ? (
                                  <span className="text-xs text-white/50 italic">
                                    — {note}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-white/60">
                                {fromMonth || "?"} → {toMonth || "?"}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setViewingNoticeId(
                                    viewingNoticeId === noticeId
                                      ? null
                                      : noticeId
                                  )
                                }
                                className="text-xs text-blue-300 underline-offset-2 hover:underline"
                              >
                                {viewingNoticeId === noticeId
                                  ? "Ascunde"
                                  : "Vizualizează"}
                              </button>
                              {saveEditedNotificationAction && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    // Get current content from meta or generate default
                                    const existingContent =
                                      typeof meta.editedContent === "string"
                                        ? meta.editedContent
                                        : generateDefaultNotificationContent(
                                            meta,
                                            contractName
                                          );
                                    setEditedContent(existingContent);
                                    setEditingNoticeId(noticeId);
                                  }}
                                  className="text-xs text-amber-300 underline-offset-2 hover:underline"
                                >
                                  Editează
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingNoticeId(noticeId);
                                  setTimeout(
                                    () => printRef.current?.triggerPrint(),
                                    100
                                  );
                                }}
                                className="text-xs text-green-300 underline-offset-2 hover:underline"
                              >
                                Print
                              </button>
                              {applyIndexingNoticeAction &&
                                !meta.appliedManually &&
                                !meta.appliedIndexing && (
                                  <form
                                    action={applyIndexingNoticeAction}
                                    style={{ display: "inline" }}
                                  >
                                    <input
                                      type="hidden"
                                      name="noticeId"
                                      value={noticeId}
                                    />
                                    <input
                                      type="hidden"
                                      name="contractId"
                                      value={id}
                                    />
                                    <input
                                      type="hidden"
                                      name="validFrom"
                                      value={validFrom}
                                    />
                                    <button
                                      type="submit"
                                      className="text-xs text-blue-300 underline-offset-2 hover:underline"
                                    >
                                      Validează
                                    </button>
                                  </form>
                                )}
                              {meta.appliedManually || meta.appliedIndexing ? (
                                <span className="text-xs text-green-400">
                                  ✓ Aplicat
                                </span>
                              ) : null}
                              {deleteIndexingNoticeAction && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingNoticeId(noticeId)}
                                  className="text-xs text-red-300 underline-offset-2 hover:underline"
                                >
                                  Șterge
                                </button>
                              )}
                            </div>
                          </div>

                          {note ? (
                            <div className="rounded border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white/80">
                              {note}
                            </div>
                          ) : null}

                          {/* Send History */}
                          {Array.isArray((notice as any).sendHistory) &&
                            (notice as any).sendHistory.length > 0 && (
                              <details className="mt-2 rounded border border-white/10 bg-white/5 px-2 py-2">
                                <summary className="text-[10px] font-semibold uppercase tracking-wide text-white/40 mb-1.5 cursor-pointer hover:text-white/60">
                                  Istoric trimiteri (
                                  {(notice as any).sendHistory.length})
                                </summary>
                                <div className="space-y-2 mt-1.5">
                                  {(notice as any).sendHistory.map(
                                    (send: any, idx: number) => (
                                      <div
                                        key={idx}
                                        className="rounded border border-white/5 bg-white/[0.02] p-2 space-y-1.5"
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-medium text-white/80 truncate">
                                                {send.to}
                                              </span>
                                              <span className="text-[10px] text-white/40 shrink-0">
                                                {send.sentAt
                                                  ? new Date(
                                                      send.sentAt
                                                    ).toLocaleString("ro-RO", {
                                                      year: "numeric",
                                                      month: "2-digit",
                                                      day: "2-digit",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                    })
                                                  : "—"}
                                              </span>
                                            </div>
                                            {send.subject && (
                                              <div className="text-[11px] text-white/60 truncate">
                                                {send.subject}
                                              </div>
                                            )}
                                            {(send.validFrom ||
                                              send.newRentEUR ||
                                              send.deltaPercent) && (
                                              <div className="flex flex-wrap gap-2 text-[10px] text-white/50">
                                                {send.validFrom && (
                                                  <span>
                                                    Valabil: {send.validFrom}
                                                  </span>
                                                )}
                                                {send.newRentEUR && (
                                                  <span>
                                                    Chirie: {send.newRentEUR}{" "}
                                                    EUR
                                                  </span>
                                                )}
                                                {send.deltaPercent && (
                                                  <span>
                                                    +
                                                    {send.deltaPercent.toFixed(
                                                      2
                                                    )}
                                                    %
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                            {/* Server delivery information */}
                                            {(send.smtpServer ||
                                              send.messageId ||
                                              send.serverResponse) && (
                                              <details className="text-[10px] text-white/40 mt-1">
                                                <summary className="cursor-pointer hover:text-white/60">
                                                  Detalii server
                                                </summary>
                                                <div className="mt-1 space-y-0.5 pl-2 border-l border-white/10">
                                                  {send.smtpServer && (
                                                    <div>
                                                      <span className="text-white/30">
                                                        Server:{" "}
                                                      </span>
                                                      <span className="font-mono">
                                                        {send.smtpServer}:
                                                        {send.smtpPort}
                                                      </span>
                                                      {send.smtpSecure && (
                                                        <span className="text-emerald-400 ml-1">
                                                          (SSL)
                                                        </span>
                                                      )}
                                                    </div>
                                                  )}
                                                  {send.smtpUser && (
                                                    <div>
                                                      <span className="text-white/30">
                                                        User:{" "}
                                                      </span>
                                                      <span className="font-mono">
                                                        {send.smtpUser}
                                                      </span>
                                                    </div>
                                                  )}
                                                  {send.messageId && (
                                                    <div>
                                                      <span className="text-white/30">
                                                        Message ID:{" "}
                                                      </span>
                                                      <span className="font-mono text-[9px] break-all">
                                                        {send.messageId}
                                                      </span>
                                                    </div>
                                                  )}
                                                  {send.accepted &&
                                                    send.accepted.length >
                                                      0 && (
                                                      <div>
                                                        <span className="text-emerald-400">
                                                          ✓ Acceptat:{" "}
                                                        </span>
                                                        <span className="font-mono">
                                                          {send.accepted.join(
                                                            ", "
                                                          )}
                                                        </span>
                                                      </div>
                                                    )}
                                                  {send.rejected &&
                                                    send.rejected.length >
                                                      0 && (
                                                      <div>
                                                        <span className="text-red-400">
                                                          ✗ Respins:{" "}
                                                        </span>
                                                        <span className="font-mono">
                                                          {send.rejected.join(
                                                            ", "
                                                          )}
                                                        </span>
                                                      </div>
                                                    )}
                                                  {(send as any)
                                                    .preValidationFailures &&
                                                    (send as any)
                                                      .preValidationFailures
                                                      .length > 0 && (
                                                      <div className="mt-1 p-1 bg-red-500/10 rounded border border-red-500/20">
                                                        <div className="text-red-400 text-[9px] font-semibold mb-0.5">
                                                          ⚠ Validare DNS eșuată:
                                                        </div>
                                                        {(
                                                          (send as any)
                                                            .preValidationFailures as string[]
                                                        ).map(
                                                          (
                                                            failure: string,
                                                            idx: number
                                                          ) => (
                                                            <div
                                                              key={idx}
                                                              className="text-red-300 text-[9px] font-mono"
                                                            >
                                                              {failure}
                                                            </div>
                                                          )
                                                        )}
                                                      </div>
                                                    )}
                                                  {send.serverResponse && (
                                                    <div>
                                                      <span className="text-white/30">
                                                        Răspuns:{" "}
                                                      </span>
                                                      <span className="font-mono text-[9px]">
                                                        {send.serverResponse}
                                                      </span>
                                                    </div>
                                                  )}
                                                </div>
                                              </details>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setViewingNoticeId(noticeId);
                                              }}
                                              className="rounded px-2 py-1 text-[10px] text-blue-300 hover:bg-blue-500/10"
                                              title="Vizualizează"
                                            >
                                              Vizualizează
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setViewingNoticeId(noticeId);
                                                setTimeout(
                                                  () =>
                                                    printRef.current?.triggerPrint(),
                                                  100
                                                );
                                              }}
                                              className="rounded px-2 py-1 text-[10px] text-green-300 hover:bg-green-500/10"
                                              title="Print"
                                            >
                                              Print
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </details>
                            )}

                          {viewingNoticeId === noticeId && (
                            <div className="mt-3 rounded border border-white/10 bg-white/5 p-3">
                              <IndexingNoticePrint
                                ref={printRef}
                                notice={{
                                  id: noticeId,
                                  at: issuedAt,
                                  meta: meta,
                                  userEmail: notice.userEmail || undefined,
                                  contractName: contractName,
                                  sendHistory: (notice as any).sendHistory,
                                }}
                              />
                            </div>
                          )}

                          {editingNoticeId === noticeId &&
                            saveEditedNotificationAction && (
                              <div className="mt-3 rounded border border-amber-500/30 bg-amber-500/5 p-4">
                                <div className="mb-3 flex items-center justify-between">
                                  <h4 className="text-sm font-semibold text-amber-300">
                                    Editează notificarea
                                  </h4>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoticeId(null)}
                                    className="text-xs text-white/60 hover:text-white"
                                  >
                                    ✕ Închide
                                  </button>
                                </div>
                                <form
                                  action={async (formData) => {
                                    await saveEditedNotificationAction(
                                      formData
                                    );
                                    setEditingNoticeId(null);
                                  }}
                                  className="space-y-3"
                                >
                                  <input
                                    type="hidden"
                                    name="noticeId"
                                    value={noticeId}
                                  />
                                  <div>
                                    <textarea
                                      name="editedContent"
                                      value={editedContent}
                                      onChange={(e) =>
                                        setEditedContent(e.target.value)
                                      }
                                      rows={20}
                                      className="w-full rounded-md border border-white/20 bg-black/20 px-3 py-2 text-sm font-mono leading-relaxed text-white/90 focus:border-amber-400/50 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                                      placeholder="Conținutul notificării..."
                                      required
                                    />
                                    <div className="mt-1 text-xs text-white/50">
                                      Textul va fi salvat și folosit la
                                      generarea PDF-ului și la printare.
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      type="submit"
                                      className="rounded-md bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/30"
                                    >
                                      Salvează
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setEditingNoticeId(null)}
                                      className="rounded-md border border-white/20 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
                                    >
                                      Anulează
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}

                          {updateIndexingNoticeAction && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-white/70">
                                Editează
                              </summary>
                              <form
                                action={updateIndexingNoticeAction}
                                className="mt-2 space-y-2"
                              >
                                <input
                                  type="hidden"
                                  name="noticeId"
                                  value={noticeId}
                                />
                                <input
                                  type="hidden"
                                  name="contractId"
                                  value={id}
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    name="fromMonth"
                                    placeholder="ex: 2024-01"
                                    defaultValue={fromMonth}
                                    className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                                  />
                                  <input
                                    name="toMonth"
                                    placeholder="ex: 2024-12"
                                    defaultValue={toMonth}
                                    className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                                  />
                                </div>
                                <input
                                  name="deltaPercent"
                                  type="number"
                                  step="any"
                                  placeholder="%"
                                  defaultValue={deltaPercent ?? ""}
                                  className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                                />
                                <textarea
                                  name="note"
                                  rows={2}
                                  placeholder="Notițe"
                                  defaultValue={note}
                                  className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                                />
                                <button
                                  type="submit"
                                  className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                                >
                                  Salvează
                                </button>
                              </form>
                            </details>
                          )}

                          {sendIndexingNoticeEmailAction && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-white/70">
                                Trimite email
                              </summary>
                              <form
                                action={sendIndexingNoticeEmailAction}
                                className="mt-2 space-y-2"
                              >
                                <input
                                  type="hidden"
                                  name="contractId"
                                  value={id}
                                />
                                <input
                                  type="hidden"
                                  name="noticeId"
                                  value={noticeId}
                                />
                                <input
                                  name="to"
                                  type="email"
                                  placeholder="email@partener.ro"
                                  defaultValue={partnerEmail || ""}
                                  className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                                  required
                                />
                                <input
                                  name="subject"
                                  placeholder="Subiect"
                                  defaultValue={`Notificare indexare – ${
                                    contractName || id
                                  }`}
                                  className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                                />
                                <button
                                  type="submit"
                                  className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                                >
                                  Trimite
                                </button>
                              </form>
                            </details>
                          )}

                          {sendIndexingNoticeToAdminsAction && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-white/70">
                                Trimite email către admini
                              </summary>
                              <form
                                action={sendIndexingNoticeToAdminsAction}
                                className="mt-2 space-y-2"
                              >
                                <input
                                  type="hidden"
                                  name="contractId"
                                  value={id}
                                />
                                <input
                                  type="hidden"
                                  name="noticeId"
                                  value={noticeId}
                                />
                                <input
                                  name="subject"
                                  placeholder="Subiect (opțional)"
                                  defaultValue={`[Admin] Notificare indexare – ${
                                    contractName || id
                                  }`}
                                  className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                                />
                                <textarea
                                  name="message"
                                  rows={2}
                                  placeholder="Mesaj (opțional)"
                                  className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                                />
                                <button
                                  type="submit"
                                  className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                                >
                                  Trimite către admini
                                </button>
                              </form>
                            </details>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-white/70">
                  Nicio notificare emisă.
                </div>
              )}
            </Section>

            {updateNextIndexingDateAction && (
              <Section title="Data următoarei indexări">
                <form
                  action={updateNextIndexingDateAction}
                  className="space-y-3"
                >
                  <input type="hidden" name="contractId" value={id} />
                  <div>
                    <label className="block text-xs font-medium text-white/80 mb-1">
                      Următoarea indexare programată
                    </label>
                    <input
                      type="date"
                      name="nextIndexingDate"
                      defaultValue={nextIndexingDate || ""}
                      className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1.5 text-sm"
                      required
                    />
                    <div className="mt-1 text-xs text-white/60">
                      Data va fi actualizată automat la +1 an când se trimite
                      notificarea.
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="rounded-md border border-white/20 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
                  >
                    Actualizează data
                  </button>
                </form>
              </Section>
            )}

            <Section title="Depozite">
              {Array.isArray(deposits) && deposits.length > 0 ? (
                <div className="flex flex-col gap-2 text-[11px]">
                  {deposits.map((d) => (
                    <div
                      key={`${d.id}-${String(d.updatedAt ?? "")}`}
                      className="rounded bg-white/5 px-2 py-2"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">
                            {String((d as any).type || "").replace("_", " ")}
                            <span
                              className={`ml-2 align-middle rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                (d as any).returned
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : "bg-white/10 text-white/70"
                              }`}
                            >
                              {(d as any).returned ? "returnat" : "custodie"}
                            </span>
                          </div>
                          <div className="text-white/70 text-xs">
                            {(() => {
                              const parts: string[] = [];
                              if (
                                typeof (d as any).amountEUR === "number" &&
                                (d as any).amountEUR > 0
                              )
                                parts.push(
                                  `${(d as any).amountEUR.toFixed(2)} EUR`
                                );
                              if (
                                typeof (d as any).amountRON === "number" &&
                                (d as any).amountRON > 0
                              )
                                parts.push(
                                  `${(d as any).amountRON.toFixed(2)} RON`
                                );
                              const amountStr =
                                parts.length > 0 ? parts.join(" · ") : "";
                              const withNote = (d as any).note
                                ? amountStr
                                  ? `${amountStr} • ${(d as any).note}`
                                  : String((d as any).note)
                                : amountStr || "—";
                              return withNote;
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <form action={toggleDepositAction}>
                            <input
                              type="hidden"
                              name="depositId"
                              value={d.id}
                            />
                            <input type="hidden" name="contractId" value={id} />
                            <button
                              type="submit"
                              className={`rounded px-2 py-1 text-xs ${
                                (d as any).isDeposited
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : "bg-white/10 text-white/70"
                              }`}
                            >
                              {(d as any).isDeposited
                                ? "Depus"
                                : "Marchează ca depus"}
                            </button>
                          </form>
                          <details className="relative">
                            <summary className="cursor-pointer text-xs text-white/70">
                              Editează
                            </summary>
                            <form
                              action={editDepositAction}
                              className="mt-2 flex flex-wrap items-end gap-2"
                            >
                              <input
                                type="hidden"
                                name="depositId"
                                value={d.id}
                              />
                              <input
                                type="hidden"
                                name="contractId"
                                value={id}
                              />
                              <select
                                name="type"
                                defaultValue={String((d as any).type || "")}
                                className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                              >
                                <option value="bank_transfer">
                                  Transfer bancar
                                </option>
                                <option value="check">Cec</option>
                                <option value="promissory_note">Cambie</option>
                              </select>
                              <input
                                name="amountEUR"
                                type="number"
                                step="0.01"
                                defaultValue={
                                  typeof (d as any).amountEUR === "number"
                                    ? (d as any).amountEUR
                                    : ("" as any)
                                }
                                className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs w-28"
                              />
                              <input
                                name="amountRON"
                                type="number"
                                step="0.01"
                                defaultValue={
                                  typeof (d as any).amountRON === "number"
                                    ? (d as any).amountRON
                                    : ("" as any)
                                }
                                className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs w-28"
                              />
                              <input
                                name="note"
                                defaultValue={String((d as any).note ?? "")}
                                className="rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs"
                              />
                              <label className="text-xs flex items-center gap-2 text-white/80">
                                <input
                                  type="checkbox"
                                  name="isDeposited"
                                  defaultChecked={Boolean(
                                    (d as any).isDeposited
                                  )}
                                />
                                Depus
                              </label>
                              <label className="text-xs flex items-center gap-2 text-white/80">
                                <input
                                  type="checkbox"
                                  name="returned"
                                  defaultChecked={Boolean((d as any).returned)}
                                />
                                Returnat
                              </label>
                              <button
                                type="submit"
                                className="rounded-md border border-white/20 px-2 py-1 text-xs hover:bg-white/10"
                              >
                                Salvează
                              </button>
                            </form>
                          </details>
                          <form action={deleteDepositAction}>
                            <input
                              type="hidden"
                              name="depositId"
                              value={d.id}
                            />
                            <input type="hidden" name="contractId" value={id} />
                            <button
                              type="submit"
                              className="text-xs text-red-300 underline-offset-2 hover:underline"
                            >
                              Șterge
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white/70 text-xs">Niciun depozit.</div>
              )}

              <div className="mt-4 rounded-md border border-white/12 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">
                  Adaugă depozit
                </div>
                <form
                  action={createDepositAction}
                  className="flex flex-wrap items-end gap-3 text-[11px]"
                >
                  <input type="hidden" name="contractId" value={id} />
                  <div>
                    <label className="block text-white/60 mb-1">Tip</label>
                    <select
                      name="type"
                      className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                      required
                    >
                      <option value="bank_transfer">Transfer bancar</option>
                      <option value="check">Cec</option>
                      <option value="promissory_note">Cambie</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">
                      Sumă (EUR)
                    </label>
                    <input
                      name="amountEUR"
                      type="number"
                      step="0.01"
                      min={0}
                      className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">
                      Sumă (RON)
                    </label>
                    <input
                      name="amountRON"
                      type="number"
                      step="0.01"
                      min={0}
                      className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Notă</label>
                    <input
                      name="note"
                      className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                    />
                  </div>
                  <label className="text-xs flex items-center gap-2 mb-2 text-white/80">
                    <input type="checkbox" name="returned" /> Returnat
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-2 font-semibold hover:bg-white/10"
                  >
                    Adaugă
                  </button>
                </form>
              </div>
            </Section>

            <Section title="Corecție">
              <form
                action={updateCorrectionPercentAction}
                className="flex flex-wrap items-end gap-3 text-[11px]"
              >
                <input type="hidden" name="contractId" value={id} />
                <div>
                  <label className="block text-white/60 mb-1">Corecție %</label>
                  <input
                    name="correctionPercent"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    defaultValue={
                      typeof correctionPercent === "number"
                        ? correctionPercent
                        : ("" as any)
                    }
                    className="rounded-md border border-white/20 bg-transparent px-2 py-1"
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-md border border-white/20 px-3 py-2 font-semibold hover:bg-white/10"
                >
                  Salvează corecția
                </button>
              </form>
            </Section>

            <Section title="TVA contract">
              <p className="text-xs text-white/70">
                Actualizează procentul TVA folosit pentru calcule și facturi.
              </p>
              {vatState.message ? (
                <div
                  className={`mt-2 rounded border px-3 py-2 text-xs ${
                    vatState.ok
                      ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
                      : "border-amber-400/40 bg-amber-400/10 text-amber-100"
                  }`}
                >
                  {vatState.message}
                </div>
              ) : null}
              <form
                action={updateVatAction}
                className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
              >
                <input type="hidden" name="id" value={id} />
                <div className="flex-1 min-w-0">
                  <label
                    htmlFor="tvaPercent"
                    className="block text-xs font-medium text-white/70"
                  >
                    Procent TVA (0 – 100)
                  </label>
                  <input
                    id="tvaPercent"
                    name="tvaPercent"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    defaultValue={
                      typeof currentVatPercent === "number"
                        ? currentVatPercent
                        : ""
                    }
                    placeholder="ex: 19"
                    className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10"
                    type="submit"
                  >
                    Salvează
                  </button>
                </div>
              </form>
            </Section>

            <Section title={`Fișiere existente (${scans.length})`}>
              {scans.length > 0 ? (
                <ul className="space-y-2">
                  {scans.map((s, idx) => (
                    <li
                      key={s.url + idx}
                      className="rounded border border-white/10 bg-white/5 p-3"
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {s.title || "Fără titlu"}
                          </div>
                          <div
                            className="text-xs text-white/50 truncate mt-0.5"
                            title={s.url}
                          >
                            {s.url}
                          </div>
                          {s.fileSize !== null && s.fileSize !== undefined && (
                            <div className="text-[10px] text-white/40 mt-0.5">
                              {s.fileSize < 1024
                                ? `${s.fileSize} B`
                                : s.fileSize < 1024 * 1024
                                ? `${(s.fileSize / 1024).toFixed(1)} KB`
                                : `${(s.fileSize / (1024 * 1024)).toFixed(
                                    2
                                  )} MB`}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setViewingScan({ url: s.url, title: s.title })
                            }
                            className="rounded-md p-1.5 hover:bg-white/10 text-white/70 hover:text-white"
                            title="Vizualizează"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const form = document.getElementById(
                                `edit-scan-form-${idx}`
                              ) as HTMLFormElement;
                              if (form) form.classList.toggle("hidden");
                            }}
                            className="rounded-md p-1.5 hover:bg-white/10 text-white/70 hover:text-white"
                            title="Editează titlul"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <form action={removeAction} className="inline">
                            <input type="hidden" name="id" value={id} />
                            <input
                              type="hidden"
                              name="index"
                              value={String(idx)}
                            />
                            <button
                              type="submit"
                              className="rounded-md p-1.5 hover:bg-white/10 text-red-400 hover:text-red-300"
                              title="Șterge"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                          </form>
                        </div>
                      </div>
                      <form
                        id={`edit-scan-form-${idx}`}
                        action={updateAction}
                        className="hidden flex items-end gap-2 pt-2 border-t border-white/10"
                      >
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="index" value={String(idx)} />
                        <input
                          name="scanTitle"
                          defaultValue={s.title || ""}
                          placeholder="Titlu nou"
                          className="flex-1 rounded-md border border-white/20 bg-transparent px-2 py-1.5 text-xs"
                        />
                        <button
                          type="submit"
                          className="rounded-md bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20"
                        >
                          Salvează
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-sm text-white/70">
                  Niciun fișier existent.
                </div>
              )}
            </Section>

            <Section title="Adaugă Scan">
              <form
                action={addAction}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
              >
                <input type="hidden" name="id" value={id} />
                <div className="sm:col-span-2">
                  <input
                    type="file"
                    name="scanFile"
                    accept="application/pdf,image/*"
                    className="mt-1 block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs hover:file:bg-white/20"
                  />
                </div>
                <div>
                  <input
                    name="scanUrl"
                    placeholder="/uploads/contract.pdf"
                    className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                </div>
                <div>
                  <input
                    name="scanTitle"
                    placeholder="ex: Anexă 1"
                    className="mt-1 w-full rounded-md border border-white/20 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400/40"
                  />
                </div>
                <div className="sm:col-span-4">
                  <button
                    type="submit"
                    className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10"
                  >
                    Adaugă
                  </button>
                </div>
              </form>
            </Section>

            <Section title="Prelungire">
              {Array.isArray(contractExtensions) &&
              contractExtensions.length > 0 ? (
                <details className="w-full rounded-md border border-white/12 p-3">
                  <summary className="cursor-pointer text-[11px] uppercase tracking-wide text-white/70">
                    Afișează toate prelungirile
                  </summary>
                  <ul className="mt-2 space-y-2">
                    {contractExtensions
                      .slice()
                      .sort((a, b) =>
                        String(a.extendedUntil || "").localeCompare(
                          String(b.extendedUntil || "")
                        )
                      )
                      .map((r, i) => {
                        const docDate = String(r.docDate || "");
                        const documentLabel = String(r.document || "");
                        const extendedUntil = String(r.extendedUntil || "");
                        const confirmMessage = `Sigur dorești să ștergi această prelungire?`;
                        return (
                          <li
                            key={`${docDate}-${extendedUntil}-${documentLabel}-${i}`}
                            className="flex flex-col gap-2 rounded bg-foreground/5 px-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="space-y-1">
                              <div className="font-medium">
                                Până la: {extendedUntil || "—"}
                              </div>
                              <div className="text-white/70 text-xs">
                                Doc: {docDate || "—"}
                                {documentLabel ? ` • ${documentLabel}` : ""}
                              </div>
                            </div>
                            <form
                              action={deleteExtensionAction}
                              className="flex items-center gap-2 self-start sm:self-auto"
                            >
                              <input
                                type="hidden"
                                name="contractId"
                                value={id}
                              />
                              <input
                                type="hidden"
                                name="docDate"
                                value={docDate}
                              />
                              <input
                                type="hidden"
                                name="extendedUntil"
                                value={extendedUntil}
                              />
                              <input
                                type="hidden"
                                name="document"
                                value={documentLabel}
                              />
                              <button
                                type="submit"
                                className="rounded-md border border-red-500/30 px-2 py-1 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                                title={confirmMessage}
                              >
                                Șterge
                              </button>
                            </form>
                          </li>
                        );
                      })}
                  </ul>
                </details>
              ) : (
                <div className="text-white/70 text-xs">Nicio prelungire.</div>
              )}

              <div className="mt-4 rounded-md border border-white/12 bg-white/[0.03] p-3">
                <div className="text-[11px] uppercase tracking-wide text-white/60 mb-2">
                  Adaugă prelungire
                </div>
                <form
                  action={addExtensionAction}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:items-end text-sm"
                >
                  <input type="hidden" name="contractId" value={id} />
                  <div>
                    <label className="block text-white/60 mb-1">
                      Data document
                    </label>
                    <input
                      name="docDate"
                      type="date"
                      min={contractSignedAt || undefined}
                      max={contractEnd || undefined}
                      className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">Document</label>
                    <input
                      name="document"
                      type="text"
                      placeholder="Act adițional"
                      className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1"
                    />
                  </div>
                  <div>
                    <label className="block text-white/60 mb-1">
                      Prelungire până la
                    </label>
                    <input
                      name="extendedUntil"
                      type="date"
                      min={contractEnd || undefined}
                      className="w-full rounded-md border border-white/20 bg-transparent px-2 py-1"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
                  >
                    Adaugă prelungire
                  </button>
                </form>
              </div>
            </Section>
          </div>
        </>
      )}

      {/* Delete Indexing Notice Confirmation Modal */}
      {deletingNoticeId && deleteIndexingNoticeAction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setDeletingNoticeId(null)}
        >
          <div
            className="relative w-full max-w-md rounded-lg border border-white/20 bg-[#0a0a0a] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-4 text-lg font-semibold text-white">
              Confirmare ștergere
            </h3>
            <p className="mb-6 text-sm text-white/80">
              Ești sigur că dorești să ștergi această notificare de indexare?
              Această acțiune nu poate fi anulată.
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingNoticeId(null)}
                className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Anulează
              </button>
              <form
                action={async (formData) => {
                  await deleteIndexingNoticeAction(formData);
                  setDeletingNoticeId(null);
                }}
              >
                <input type="hidden" name="noticeId" value={deletingNoticeId} />
                <input type="hidden" name="contractId" value={id} />
                <button
                  type="submit"
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Șterge
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Scan Viewer Modal */}
      {viewingScan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setViewingScan(null)}
        >
          <div
            className="relative w-full max-w-6xl h-[90vh] rounded-lg border border-white/20 bg-[#0a0a0a] shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/20 px-4 py-3">
              <h3 className="text-base font-semibold text-white truncate flex-1 pr-4">
                {viewingScan.title || "Fișier"}
              </h3>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={viewingScan.url}
                  download
                  className="rounded-md p-2 hover:bg-white/10 text-white/70 hover:text-white"
                  title="Descarcă"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const iframe = document.getElementById(
                      "scan-viewer-iframe"
                    ) as HTMLIFrameElement;
                    if (iframe?.requestFullscreen) {
                      iframe.requestFullscreen();
                    } else {
                      window.open(viewingScan.url, "_blank");
                    }
                  }}
                  className="rounded-md p-2 hover:bg-white/10 text-white/70 hover:text-white"
                  title="Ecran complet"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingScan(null)}
                  className="rounded-md p-2 hover:bg-white/10 text-white/70 hover:text-white"
                  title="Închide"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden bg-white/5">
              {viewingScan.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ? (
                <img
                  src={viewingScan.url}
                  alt={viewingScan.title || "Scan"}
                  className="w-full h-full object-contain"
                />
              ) : (
                <iframe
                  id="scan-viewer-iframe"
                  src={viewingScan.url}
                  className="w-full h-full border-0"
                  title={viewingScan.title || "Scan"}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
