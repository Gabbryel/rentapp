"use client";

import Link from "next/link";
import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { useFormStatus } from "react-dom";
import { saveWrittenContractAction, type FormState } from "./actions";
import type { WrittenContract } from "@/lib/schemas/written-contract";
import PdfModal from "@/app/components/pdf-modal";

const PREFILL_STORAGE_KEY = "written-contract-prefill";
const DOT_DATE_FORMATTER = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const UPDATED_AT_FORMATTER = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

type ContractLike = Record<string, unknown> | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ensureRecord(value: ContractLike): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

type OwnerOption = {
  id: string;
  name: string;
  vatNumber: string;
  orcNumber: string;
  headquarters: string;
  administrators?: string[];
  bankAccount?: string | null;
  emails?: string[];
  phoneNumbers?: string[];
};

type PartnerRepresentativeOption = {
  fullname?: string | null;
  email?: string | null;
  phone?: string | null;
  primary?: boolean | null;
};

type PartnerOption = {
  id: string;
  name: string;
  vatNumber: string;
  orcNumber: string;
  headquarters: string;
  representatives?: PartnerRepresentativeOption[];
};

type AssetOption = {
  id: string;
  name: string;
  address: string;
  areaSqm?: number | null;
  ownerId?: string | null;
  owner?: string | null;
};

type EditorState = {
  id?: string;
  contractId?: string;
  ownerId?: string;
  assetId?: string;
  partnerId?: string;
  contractSignedAt?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  signed: boolean;
  assetName?: string;
  assetAddress?: string;
  spaceSurface: string;
  intendedUse: string;
  title: string;
  subtitle: string;
  documentNumber: string;
  documentDate: string;
  ownerName: string;
  ownerAddress: string;
  ownerContactEmails: string;
  ownerContactPhones: string;
  ownerRegistration: string;
  ownerTaxId: string;
  ownerHeadOffice: string;
  ownerRepresentative: string;
  ownerRepresentativeTitle: string;
  partnerName: string;
  partnerAddress: string;
  partnerEmail: string;
  partnerPhone: string;
  partnerRegistration: string;
  partnerTaxId: string;
  partnerHeadOffice: string;
  partnerRepresentative: string;
  partnerRepresentativeTitle: string;
  rentAmount: string;
  rentAmountText: string;
  tvaPercent: string;
  tvaType: string;
  invoiceIssueDay: string;
  monthlyInvoiceDay: string;
  invoiceMonthMode: string;
  monthOfRent: string;
  paymentDueDays: string;
  invoiceSendChannels: string;
  indexingMonth: string;
  bankAccount: string;
  bankName: string;
  guaranteeMultiplier: string;
  guaranteeDueDate: string;
  guaranteeForms: string;
  guaranteeBoMultiplier: string;
  utilityPaymentTerm: string;
  latePaymentPenaltyPercent: string;
  latePaymentNotificationFee: string;
  evacuationFee: string;
  storageFee: string;
  nonPaymentTerminationDays: string;
  dailyPenaltyAfterTermination: string;
  denunciationNoticeDays: string;
  denunciationLockMonths: string;
  denunciationPenaltyMonths: string;
  denunciationPenaltyFixed: string;
  abandonPenaltyDescription: string;
  overstayPenaltyPerDay: string;
  confidentialityPenalty: string;
  forceMajeureNoticeDays: string;
  signatureLocation: string;
  body: string;
  notes: string;
  correctionPercent: string;
};

type EditorStateKey = keyof EditorState;

const EDITOR_STATE_KEYS = [
  "id",
  "contractId",
  "ownerId",
  "assetId",
  "partnerId",
  "contractSignedAt",
  "contractStartDate",
  "contractEndDate",
  "signed",
  "assetName",
  "assetAddress",
  "spaceSurface",
  "intendedUse",
  "title",
  "subtitle",
  "documentNumber",
  "documentDate",
  "ownerName",
  "ownerAddress",
  "ownerContactEmails",
  "ownerContactPhones",
  "ownerRegistration",
  "ownerTaxId",
  "ownerHeadOffice",
  "ownerRepresentative",
  "ownerRepresentativeTitle",
  "partnerName",
  "partnerAddress",
  "partnerEmail",
  "partnerPhone",
  "partnerRegistration",
  "partnerTaxId",
  "partnerHeadOffice",
  "partnerRepresentative",
  "partnerRepresentativeTitle",
  "rentAmount",
  "rentAmountText",
  "tvaPercent",
  "tvaType",
  "invoiceIssueDay",
  "monthlyInvoiceDay",
  "invoiceMonthMode",
  "monthOfRent",
  "paymentDueDays",
  "invoiceSendChannels",
  "indexingMonth",
  "bankAccount",
  "bankName",
  "guaranteeMultiplier",
  "guaranteeDueDate",
  "guaranteeForms",
  "guaranteeBoMultiplier",
  "utilityPaymentTerm",
  "latePaymentPenaltyPercent",
  "latePaymentNotificationFee",
  "evacuationFee",
  "storageFee",
  "nonPaymentTerminationDays",
  "dailyPenaltyAfterTermination",
  "denunciationNoticeDays",
  "denunciationLockMonths",
  "denunciationPenaltyMonths",
  "denunciationPenaltyFixed",
  "abandonPenaltyDescription",
  "overstayPenaltyPerDay",
  "confidentialityPenalty",
  "forceMajeureNoticeDays",
  "signatureLocation",
  "body",
  "notes",
  "correctionPercent",
] as const;

function getString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatDateInput(value?: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return trimmed.slice(0, 10);
}

function formatDateDot(value?: string): string {
  if (!value) return "——";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DOT_DATE_FORMATTER.format(date);
}

function formatUpdatedAt(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return UPDATED_AT_FORMATTER.format(date);
}

function formatSurfaceMp(value: number): string {
  const isInteger = Number.isInteger(value);
  return `${value.toLocaleString("ro-RO", {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: isInteger ? 0 : 2,
  })} mp`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeHtml(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim();
}

const MONTH_NAMES_RO = [
  "ianuarie",
  "februarie",
  "martie",
  "aprilie",
  "mai",
  "iunie",
  "iulie",
  "august",
  "septembrie",
  "octombrie",
  "noiembrie",
  "decembrie",
];

const DEFAULT_GUARANTEE_FORMS = "CEC, transfer bancar";
const DEFAULT_GUARANTEE_MULTIPLIER = "3";
const DEFAULT_GUARANTEE_BO_MULTIPLIER = "6";
const DEFAULT_LATE_PAYMENT_NOTIFICATION_FEE = "300";
const DEFAULT_LATE_PAYMENT_PENALTY_PERCENT = "2";
const DEFAULT_NON_PAYMENT_TERMINATION_DAYS = "15";
const DEFAULT_EVACUATION_FEE = "1000 euro";
const DEFAULT_STORAGE_FEE = "minim 1000 euro";
const DEFAULT_DENUNCIATION_NOTICE_DAYS = "180";
const DEFAULT_BANK_NAME = "Banca Transilvania";

function formatMonthName(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return MONTH_NAMES_RO[date.getMonth()] ?? "";
}

function addMonths(value?: string, months = 0): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next.toISOString().slice(0, 10);
}

function parseAmount(input: string): number | null {
  const normalized = input.replace(/[^0-9,.-]/g, "").replace(/,/g, ".");
  if (!normalized.trim()) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function extractSurfaceValue(value?: string): string {
  if (!value) return "";
  const parsed = parseAmount(value);
  if (parsed === null) return value;
  const isInteger = Number.isInteger(parsed);
  return `${parsed.toLocaleString("ro-RO", {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: isInteger ? 0 : 2,
  })}`;
}

function formatNumberRo(value: number): string {
  const isInteger = Number.isInteger(value);
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: isInteger ? 0 : 2,
    maximumFractionDigits: isInteger ? 0 : 2,
  });
}

function stripEurSuffix(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.replace(/\s*eur$/i, "").trim();
}

function formatPercent(value?: string, placeholder = "________"): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return placeholder;
  const withSymbol = /%$/.test(trimmed) ? trimmed : `${trimmed}%`;
  return escapeHtml(withSymbol);
}

type TvaDisplay = {
  display: string;
  isPlaceholder: boolean;
};

function resolveTvaPercentDisplay(value?: string | null): TvaDisplay {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return { display: "{tvaPercentage}", isPlaceholder: true };
  }
  const withSymbol = /%$/.test(trimmed) ? trimmed : `${trimmed}%`;
  return { display: withSymbol, isPlaceholder: false };
}

function resolveTvaTypeDisplay(value?: string | null): TvaDisplay {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return { display: "{tvaType}", isPlaceholder: true };
  }
  return { display: trimmed, isPlaceholder: false };
}

function normalizeUtilityPaymentTerm(value?: string): string {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "________";
  const withoutSuffix = trimmed
    .replace(/zile\s+de\s+la\s+data\s+emiterii/gi, "")
    .replace(/de\s+la\s+data\s+emiterii/gi, "")
    .replace(/zile/gi, "")
    .trim();
  const finalValue = withoutSuffix || trimmed;
  return escapeHtml(finalValue);
}

type TemplateValue = {
  text: string;
  isPlaceholder: boolean;
};

function makeTemplateValue(
  raw: string | null | undefined,
  placeholder: string
): TemplateValue {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { text: placeholder, isPlaceholder: true };
  }
  return { text: escapeHtml(trimmed), isPlaceholder: false };
}

function makeDotDateTemplateValue(
  raw: string | null | undefined,
  placeholder: string
): TemplateValue {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { text: placeholder, isPlaceholder: true };
  }
  const formatted = formatDateDot(trimmed);
  if (!formatted || formatted === "——") {
    return { text: placeholder, isPlaceholder: true };
  }
  return { text: escapeHtml(formatted), isPlaceholder: false };
}

function boldTemplateValue(value: TemplateValue): string {
  return value.isPlaceholder ? value.text : `<strong>${value.text}</strong>`;
}

function makeSubtitle(ownerName: string, partnerName: string): string {
  const ownerLabel = ownerName || "Proprietar";
  const partnerLabel = partnerName || "Chiriaș";
  return `${ownerLabel} · ${partnerLabel}`;
}

function pickFirstFilled(...values: unknown[]): string {
  for (const value of values) {
    const str = getString(value).trim();
    if (str) return str;
  }
  return "";
}

function formatInvoiceMonthModeLabel(
  mode: string | undefined,
  fallback: string
): string {
  const normalized = (mode ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "current") return "curentă";
  if (normalized === "next") return "următoare";
  return mode ?? fallback;
}

function buildOwnerPatchFromOption(
  owner: OwnerOption,
  prev: EditorState
): Partial<EditorState> {
  const administrators = Array.isArray(owner.administrators)
    ? owner.administrators
    : [];
  const representative = administrators[0]?.trim();
  const patch: Partial<EditorState> = {
    ownerId: owner.id,
    ownerName: owner.name,
    ownerRegistration: owner.orcNumber,
    ownerTaxId: owner.vatNumber,
    ownerHeadOffice: owner.headquarters,
    ownerAddress: owner.headquarters,
  };

  const ownerBankAccount = (owner.bankAccount ?? "").trim();
  if (ownerBankAccount) {
    patch.bankAccount = ownerBankAccount;
  }

  if (representative) {
    patch.ownerRepresentative = representative;
    if (
      !prev.ownerRepresentativeTitle ||
      prev.ownerRepresentativeTitle === "Administrator"
    ) {
      patch.ownerRepresentativeTitle = "Administrator";
    }
  }

  if (owner.emails && owner.emails.length > 0) {
    patch.ownerContactEmails = owner.emails.join(", ");
  }

  if (owner.phoneNumbers && owner.phoneNumbers.length > 0) {
    patch.ownerContactPhones = owner.phoneNumbers.join(", ");
  }

  const currentSubtitle = prev.subtitle;
  if (
    !currentSubtitle ||
    currentSubtitle ===
      makeSubtitle(prev.ownerName || "", prev.partnerName || "")
  ) {
    patch.subtitle = makeSubtitle(owner.name, prev.partnerName || "");
  }

  return patch;
}

function buildPartnerPatchFromOption(
  partner: PartnerOption,
  prev: EditorState
): Partial<EditorState> {
  const representatives = Array.isArray(partner.representatives)
    ? partner.representatives
    : [];
  const primaryRepresentative =
    representatives.find((item) => item?.primary) ?? representatives[0];

  const patch: Partial<EditorState> = {
    partnerId: partner.id,
    partnerName: partner.name,
    partnerRegistration: partner.orcNumber,
    partnerTaxId: partner.vatNumber,
    partnerHeadOffice: partner.headquarters,
    partnerAddress: partner.headquarters,
  };

  const representativeName = primaryRepresentative?.fullname?.trim();
  if (representativeName) {
    patch.partnerRepresentative = representativeName;
    if (
      !prev.partnerRepresentativeTitle ||
      prev.partnerRepresentativeTitle === "Administrator"
    ) {
      patch.partnerRepresentativeTitle = "Administrator";
    }
  }

  const representativeEmail = primaryRepresentative?.email?.trim();
  if (representativeEmail) {
    patch.partnerEmail = representativeEmail;
  }

  const representativePhone = primaryRepresentative?.phone?.trim();
  if (representativePhone) {
    patch.partnerPhone = representativePhone;
  }

  const currentSubtitle = prev.subtitle;
  if (
    !currentSubtitle ||
    currentSubtitle ===
      makeSubtitle(prev.ownerName || "", prev.partnerName || "")
  ) {
    patch.subtitle = makeSubtitle(prev.ownerName || "", partner.name);
  }

  return patch;
}

function buildAssetPatchFromOption(asset: AssetOption): Partial<EditorState> {
  const patch: Partial<EditorState> = {
    assetId: asset.id,
    assetName: asset.name,
    assetAddress: asset.address,
  };

  if (typeof asset.areaSqm === "number" && Number.isFinite(asset.areaSqm)) {
    patch.spaceSurface = formatSurfaceMp(asset.areaSqm);
  }

  return patch;
}

function calculateGuaranteeDueDate(startDate?: string): string {
  if (!startDate) return "";
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return "";
  date.setMonth(date.getMonth() + 1);
  return DOT_DATE_FORMATTER.format(date);
}

function createTemplateBody(state: EditorState): string {
  const ownerNameTemplate = makeTemplateValue(state.ownerName, "________");
  const ownerEmailsTemplate = makeTemplateValue(
    state.ownerContactEmails,
    "________"
  );
  const ownerPhonesTemplate = makeTemplateValue(
    state.ownerContactPhones,
    "________"
  );
  const ownerHeadOfficeTemplate = makeTemplateValue(
    state.ownerHeadOffice,
    "________"
  );
  const ownerAddressTemplate = makeTemplateValue(
    state.ownerAddress,
    "________"
  );
  const ownerRegistrationTemplate = makeTemplateValue(
    state.ownerRegistration,
    "________"
  );
  const ownerTaxIdTemplate = makeTemplateValue(state.ownerTaxId, "________");
  const ownerAdministratorsTemplate = makeTemplateValue(
    state.ownerRepresentative,
    "________"
  );
  const ownerRepresentativeTitleTemplate = makeTemplateValue(
    state.ownerRepresentativeTitle,
    "________"
  );

  const partnerNameTemplate = makeTemplateValue(state.partnerName, "________");
  const partnerEmailTemplate = makeTemplateValue(
    state.partnerEmail,
    "________"
  );
  const partnerPhoneTemplate = makeTemplateValue(
    state.partnerPhone,
    "________"
  );
  const partnerHeadOfficeTemplate = makeTemplateValue(
    state.partnerHeadOffice,
    "________"
  );
  const partnerRegistrationTemplate = makeTemplateValue(
    state.partnerRegistration,
    "________"
  );
  const partnerTaxIdTemplate = makeTemplateValue(
    state.partnerTaxId,
    "________"
  );
  const partnerRepresentativesTemplate = makeTemplateValue(
    state.partnerRepresentative,
    "________"
  );
  const partnerRepresentativeTitleTemplate = makeTemplateValue(
    state.partnerRepresentativeTitle,
    "________"
  );

  const assetNameTemplate = makeTemplateValue(state.assetName, "________");
  const assetSurfaceTemplate = makeTemplateValue(
    extractSurfaceValue(state.spaceSurface),
    "________"
  );
  const assetAddressTemplate = makeTemplateValue(
    state.assetAddress,
    "________"
  );
  const intendedUseTemplate = makeTemplateValue(state.intendedUse, "________");

  const contractStartTemplate = makeDotDateTemplateValue(
    state.contractStartDate,
    "——"
  );
  const contractEndTemplate = makeDotDateTemplateValue(
    state.contractEndDate,
    "——"
  );
  const contractSignedAtTemplate = makeDotDateTemplateValue(
    state.contractSignedAt,
    "________"
  );

  const invoiceIssueDayTemplate = makeTemplateValue(
    state.monthlyInvoiceDay || state.invoiceIssueDay,
    "________"
  );
  const invoiceMonthModeLabel = formatInvoiceMonthModeLabel(
    state.invoiceMonthMode,
    state.monthOfRent
  );
  const invoiceMonthModeTemplate = makeTemplateValue(
    invoiceMonthModeLabel,
    "________"
  );
  const paymentDueDaysTemplate = makeTemplateValue(
    state.paymentDueDays,
    "________"
  );
  const bankAccountTemplate = makeTemplateValue(state.bankAccount, "________");

  const indexingMonthRaw =
    state.indexingMonth || formatMonthName(state.contractStartDate) || "";
  const indexingMonthValue = boldTemplateValue(
    makeTemplateValue(indexingMonthRaw, "________")
  );

  const guaranteeMultiplierTemplate = makeTemplateValue(
    state.guaranteeMultiplier,
    "________"
  );
  const guaranteeFormsTemplate = makeTemplateValue(
    state.guaranteeForms,
    "________"
  );
  const guaranteeBoMultiplierTemplate = makeTemplateValue(
    state.guaranteeBoMultiplier,
    "________"
  );
  const latePaymentNotificationFeeTemplate = makeTemplateValue(
    state.latePaymentNotificationFee,
    "________"
  );
  const evacuationFeeTemplate = makeTemplateValue(
    state.evacuationFee,
    "________"
  );
  const storageFeeTemplate = makeTemplateValue(state.storageFee, "________");
  const nonPaymentTerminationDaysTemplate = makeTemplateValue(
    state.nonPaymentTerminationDays,
    "________"
  );
  const denunciationNoticeDaysTemplate = makeTemplateValue(
    state.denunciationNoticeDays,
    "________"
  );
  const denunciationLockMonthsTemplate = makeTemplateValue(
    state.denunciationLockMonths,
    "________"
  );
  const denunciationPenaltyMonthsTemplate = makeTemplateValue(
    state.denunciationPenaltyMonths,
    "________"
  );
  const denunciationPenaltyFixedTemplate = makeTemplateValue(
    state.denunciationPenaltyFixed,
    "________"
  );
  const abandonPenaltyTemplate = makeTemplateValue(
    state.abandonPenaltyDescription,
    "________"
  );
  const confidentialityPenaltyTemplate = makeTemplateValue(
    state.confidentialityPenalty,
    "________"
  );
  const signatureLocationTemplate = makeTemplateValue(
    state.signatureLocation,
    "________"
  );
  const forceMajeureNoticeDaysTemplate = makeTemplateValue(
    state.forceMajeureNoticeDays,
    "________"
  );

  const ownerName = boldTemplateValue(ownerNameTemplate);
  const ownerEmails = boldTemplateValue(ownerEmailsTemplate);
  const ownerPhones = boldTemplateValue(ownerPhonesTemplate);
  const ownerHeadOffice = boldTemplateValue(ownerHeadOfficeTemplate);
  const ownerAddress = boldTemplateValue(ownerAddressTemplate);
  const ownerRegistration = boldTemplateValue(ownerRegistrationTemplate);
  const ownerTaxId = boldTemplateValue(ownerTaxIdTemplate);
  const ownerAdministrators = boldTemplateValue(ownerAdministratorsTemplate);
  const ownerRepresentativeTitleValue = boldTemplateValue(
    ownerRepresentativeTitleTemplate
  );

  const partnerName = boldTemplateValue(partnerNameTemplate);
  const partnerEmail = boldTemplateValue(partnerEmailTemplate);
  const partnerPhone = boldTemplateValue(partnerPhoneTemplate);
  const partnerHeadOffice = boldTemplateValue(partnerHeadOfficeTemplate);
  const partnerRegistration = boldTemplateValue(partnerRegistrationTemplate);
  const partnerTaxId = boldTemplateValue(partnerTaxIdTemplate);
  const partnerRepresentatives = boldTemplateValue(
    partnerRepresentativesTemplate
  );
  const partnerRepresentativeTitleValue = boldTemplateValue(
    partnerRepresentativeTitleTemplate
  );

  const assetName = boldTemplateValue(assetNameTemplate);
  const assetSurfaceValue = boldTemplateValue(assetSurfaceTemplate);
  const assetAddress = boldTemplateValue(assetAddressTemplate);
  const intendedUseValue = boldTemplateValue(intendedUseTemplate);

  const contractStart = boldTemplateValue(contractStartTemplate);
  const contractEnd = boldTemplateValue(contractEndTemplate);
  const contractSignedAtValue = boldTemplateValue(contractSignedAtTemplate);

  const invoiceIssueDayValue = boldTemplateValue(invoiceIssueDayTemplate);
  const invoiceMonthModeValue = boldTemplateValue(invoiceMonthModeTemplate);
  const paymentDueDaysValue = boldTemplateValue(paymentDueDaysTemplate);
  const bankAccountValue = boldTemplateValue(bankAccountTemplate);

  const bankNameTrimmed = (state.bankName ?? "").trim();
  const bankNameValue = bankNameTrimmed
    ? `<strong>${escapeHtml(bankNameTrimmed)}</strong>`
    : "";
  const bankDetailsValue = bankNameValue
    ? `${bankAccountValue} (${bankNameValue})`
    : bankAccountValue;

  const guaranteeMultiplierValue = boldTemplateValue(
    guaranteeMultiplierTemplate
  );
  const guaranteeFormsValue = boldTemplateValue(guaranteeFormsTemplate);
  const guaranteeBoMultiplierValue = boldTemplateValue(
    guaranteeBoMultiplierTemplate
  );
  const latePaymentNotificationFeeValue = boldTemplateValue(
    latePaymentNotificationFeeTemplate
  );
  const evacuationFeeValue = boldTemplateValue(evacuationFeeTemplate);
  const storageFeeValue = boldTemplateValue(storageFeeTemplate);
  const nonPaymentTerminationDaysValue = boldTemplateValue(
    nonPaymentTerminationDaysTemplate
  );
  const denunciationNoticeDaysValue = boldTemplateValue(
    denunciationNoticeDaysTemplate
  );
  const denunciationLockMonthsValue = boldTemplateValue(
    denunciationLockMonthsTemplate
  );
  const denunciationPenaltyMonthsValue = boldTemplateValue(
    denunciationPenaltyMonthsTemplate
  );
  const denunciationPenaltyFixedValue = boldTemplateValue(
    denunciationPenaltyFixedTemplate
  );
  const abandonmentPenaltyValue = boldTemplateValue(abandonPenaltyTemplate);
  const confidentialityPenaltyValue = boldTemplateValue(
    confidentialityPenaltyTemplate
  );
  const signatureLocationValue = boldTemplateValue(signatureLocationTemplate);
  const forceMajeureNoticeDaysValue = boldTemplateValue(
    forceMajeureNoticeDaysTemplate
  );

  const rentNumber = (() => {
    const candidates = [state.rentAmount, state.rentAmountText];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) {
        const parsed = parseAmount(candidate);
        if (parsed !== null) {
          return parsed;
        }
      }
    }
    return null;
  })();

  const rentAmountValue =
    rentNumber !== null
      ? `<strong>${escapeHtml(formatNumberRo(rentNumber))}</strong>`
      : boldTemplateValue(
          makeTemplateValue(stripEurSuffix(state.rentAmount), "_____")
        );

  const tvaPercentDisplay = resolveTvaPercentDisplay(state.tvaPercent);
  const tvaPercentValue = tvaPercentDisplay.isPlaceholder
    ? tvaPercentDisplay.display
    : `<strong>${escapeHtml(tvaPercentDisplay.display)}</strong>`;
  const tvaTypeDisplay = resolveTvaTypeDisplay(state.tvaType);
  const tvaTypeValue = tvaTypeDisplay.isPlaceholder
    ? tvaTypeDisplay.display
    : `<strong>${escapeHtml(tvaTypeDisplay.display)}</strong>`;

  const correctionPercentNumber = parseAmount(state.correctionPercent ?? "");
  const correctionPercentSnippet =
    correctionPercentNumber !== null && correctionPercentNumber > 0
      ? ` + <strong>${escapeHtml(
          formatNumberRo(correctionPercentNumber)
        )}%</strong>`
      : "";

  const guaranteeDueDateValue = (() => {
    const trimmed = (state.guaranteeDueDate ?? "").trim();
    if (trimmed) {
      const formatted = formatDateDot(state.guaranteeDueDate);
      if (formatted && formatted !== "——") {
        return `<strong>${escapeHtml(formatted)}</strong>`;
      }
    }
    const computed = calculateGuaranteeDueDate(state.contractStartDate);
    if (!computed) return "________";
    return `<strong>${escapeHtml(computed)}</strong>`;
  })();

  const utilityPaymentTermRaw = (state.utilityPaymentTerm ?? "").trim();
  const resolvedPaymentDueDaysValue =
    paymentDueDaysTemplate.isPlaceholder && utilityPaymentTermRaw
      ? `<strong>${normalizeUtilityPaymentTerm(
          state.utilityPaymentTerm
        )}</strong>`
      : paymentDueDaysValue;

  const latePaymentPenaltyPercentTrimmed = (
    state.latePaymentPenaltyPercent ?? ""
  ).trim();
  const latePaymentPenaltyPercentValue = latePaymentPenaltyPercentTrimmed
    ? `<strong>${formatPercent(state.latePaymentPenaltyPercent)}</strong>`
    : "________";

  const overstayPenaltyValue = (() => {
    const overstayRaw = state.overstayPenaltyPerDay ?? "";
    const dailyPenaltyRaw = state.dailyPenaltyAfterTermination ?? "";
    const fallbackFromOverstay = parseAmount(overstayRaw);
    if (fallbackFromOverstay !== null) {
      return `<strong>${escapeHtml(
        formatNumberRo(fallbackFromOverstay)
      )}</strong>`;
    }
    const fallbackFromDaily = parseAmount(dailyPenaltyRaw);
    if (fallbackFromDaily !== null) {
      return `<strong>${escapeHtml(
        formatNumberRo(fallbackFromDaily)
      )}</strong>`;
    }
    if (overstayRaw.trim()) {
      return `<strong>${escapeHtml(overstayRaw.trim())}</strong>`;
    }
    if (dailyPenaltyRaw.trim()) {
      return `<strong>${escapeHtml(dailyPenaltyRaw.trim())}</strong>`;
    }
    if (rentNumber !== null) {
      const computed = rentNumber * 0.05;
      return `<strong>${escapeHtml(formatNumberRo(computed))}</strong>`;
    }
    return "________";
  })();

  const invoiceSendChannelsValue = (() => {
    const trimmed = (state.invoiceSendChannels ?? "").trim();
    if (trimmed) {
      return `<strong>${escapeHtml(trimmed)}</strong>`;
    }
    return `prin sistemul SPV e-Factura, SmartBill sau pe e-mail la adresa: ${partnerEmail} și/sau prin mesaj WhatsApp la numărul de telefon: ${partnerPhone}`;
  })();

  const lines: string[] = [];

  // const ownerBlockParts = [
  //   ownerName,
  //   `Email: ${ownerEmails}`,
  //   `Telefon: ${ownerPhones}`,
  //   `Sediu: ${ownerHeadOffice}`,
  //   `Adresă corespondență: ${ownerAddress}`,
  //   `ORC: ${ownerRegistration}`,
  //   `CIF: ${ownerTaxId}`,
  //   `Reprezentant: ${ownerAdministrators}`,
  // ];
  // lines.push(`<p>${ownerBlockParts.join("<br />")}</p>`);

  lines.push(`<p>Cap. I Părțile contractante</p>`);
  lines.push(
    `<p>${ownerName}, societate constituită și care funcționează în conformitate cu legile române, cu sediul în ${ownerHeadOffice} înregistrată la ORC Bacău sub numărul ${ownerRegistration}, CIF ${ownerTaxId}, reprezentată legal prin ${ownerAdministrators}, în calitate de ${ownerRepresentativeTitleValue}, denumită în continuare LOCATOR și</p>`
  );
  lines.push(
    `<p>${partnerName}, cu sediul în ${partnerHeadOffice}, ${partnerRegistration}, CUI ${partnerTaxId}, reprezentată prin ${partnerRepresentatives}, în calitate de ${partnerRepresentativeTitleValue}, denumită în continuare LOCATAR.</p>`
  );
  lines.push(
    `<p>LOCATORUL și LOCATARUL vor fi denumite în continuare PĂRȚI ale prezentului contract.</p>`
  );

  lines.push(`<p>Cap. II Scopul contractului</p>`);
  lines.push(
    `<p>Art. 2.1. Scopul acestui contract de închiriere (denumit în continuare „Contractul”) este pentru Locator de a pune în valoare activele Locatorului iar pentru Locatar de a dobândi folosința unui spațiu pentru stabilirea sediului social și pentru desfășurarea activității sale comerciale.</p>`
  );
  lines.push(
    `<p>Art. 2.2. Drepturile şi obligațiile părților contractante decurg din prevederile Codului Civil Roman și din prezentul Contract.</p>`
  );

  lines.push(`<p>Cap. III Obiectul contractului</p>`);
  lines.push(
    `<p>Art. 3.1. LOCATORUL închiriază LOCATARULUI spațiul (${assetName}) situat în ${assetAddress} cu suprafața de ${assetSurfaceValue} mp denumit în continuare „SPAȚIUL” in schimbul CHIRIEI prevăzute la art. 5.1 de mai jos. SPAȚIUL va fi desemnat ca sediu social și/sau punct de lucru al LOCATARULUI și va fi utilizat de acesta exclusiv, pentru activități cuprinse în codurile CAEN cuprinse în obiectul de activitate al LOCATARULUI (activitate declarată ${intendedUseValue}), cu respectarea tuturor condițiilor pentru desfășurarea în deplină legalitate a acestora.
    </p>`
  );

  lines.push(`<p>Cap. IV Durata contractului</p>`);
  lines.push(
    `<p>Art. 4.1. Prezentul CONTRACT intră în vigoare la data de ${contractStart} și este valabil și produce efecte până la data de ${contractEnd}.</p>`
  );
  lines.push(
    `<p>Art. 4.2. CONTRACTUL poate fi prelungit prin act adițional.</p>`
  );

  lines.push(
    `<p>Cap. V Chiria. Modalitatea de plată a chiriei. Prețul prestațiilor efectuate de locator.</p>`
  );
  lines.push(
    `<p>Art. 5.1. LOCATARUL va plăti Locatorului o chirie lunară în valoare de ${rentAmountValue} de euro + ${tvaPercentValue} ${tvaTypeValue} (sau oricare alt regim de T.V.A. va fi aplicabil LOCATARULUI în viitor), în lei la cursul B.N.R., denumită în continuare „chiria”${correctionPercentSnippet}. Chiria se va factura pe data de ${invoiceIssueDayValue} ale lunii pentru luna ${invoiceMonthModeValue}, iar plata trebuie efectuată de către LOCATAR în următoarele ${resolvedPaymentDueDaysValue} zile calendaristice în contul bancar al Locatorului: ${bankDetailsValue}</p>`
  );
  lines.push(`<p>Factura se va transmite ${invoiceSendChannelsValue}.</p>`);
  lines.push(
    `<p>Părțile stabilesc ca aceste mijloace de comunicare să fie folosite și recunoscute prin prezentul contract. Chiria se va indexa în luna ${indexingMonthValue} a fiecărui an cu inflația la euro înregistrată în anul precedent, modificarea chiriei urmând a se aplica de la data de 1 a lunii următoare.</p>`
  );
  lines.push(
    `<p>Art. 5.2. LOCATARUL va constitui o garanție de bună execuție a obligațiilor ce îi revin cu valoarea egală cu ${guaranteeMultiplierValue} chirii (chiria lunară x ${guaranteeMultiplierValue}) la data de ${guaranteeDueDateValue}. Forma de garanție poate fi: ${guaranteeFormsValue}.</p>`
  );
  lines.push(`<p>Art. 5.3.  Utilitățile. </p>`);
  lines.push(
    `<p>1. Suplimentar față de chirie, LOCATARUL va achita lunar toate cheltuielile legate de utilitățile și întreținerea aferente Spațiului și a părților comune ale imobilului de care aparține acesta.</p>`
  );
  lines.push(
    `<p>2. Cheltuielile cu utilitățile se vor factura de îndată ce Locatorul primește facturile de la furnizori. Locatorul îl va înștiința telefonic pe LOCATAR de primirea facturilor și îi va transmite în cel mai scurt timp prin sistemul SmartBill sau e-mail și/sau mesaj electronic (message, whatsapp) facturile cu sumele pe care LOCATARUL trebuie să le achite în termen de ${resolvedPaymentDueDaysValue} zile de la data emiterii.</p>`
  );
  lines.push(
    `<p>Art. 5.4. Responsabilitatea ridicării facturilor emise de către LOCATOR revine LOCATARULUI, acesta neputând justifica neplata facturilor sau întârzierile la plata acestora prin faptul că nu i s-a adus la cunoștință emiterea acestora. Chiar și în cazul, puțin probabil, în care LOCATOR nu ar factura la data stabilită prin contract, LOCATARUL este obligat să achite în contul LOCATORULUI suma aferentă chiriei în contravaloare lei raportat la cursul leu-euro din data de ${invoiceIssueDayValue} a fiecărei luni.</p>`
  );
  lines.push(
    `<p>Art. 5.5. În cazul în care LOCATARUL nu achită în termen facturile emise de către LOCATOR, începând cu pria zi următoare scadenței, Locatarul poate fi notificat de Locator, după cum va considera rezonabil, prin email sau prin executor judecătoresc, ceea ce pe lângă alte penalități va aduce în plus pentru locatar o sancțiune în valoare de ${latePaymentNotificationFeeValue} de lei/notificare, ce va fi facturată ca atare de către Locator și constituie obligație de plată a Locatarului.
    </p>`
  );
  lines.push(
    `<p>Art. 5.6. De asemenea, începând cu ziua următoare datei de scadență, LOCATARUL va fi nevoit să plătească LOCATORULUI, de drept, fără intervenția vreunei autorități sau instanțe judecătorești, fără punere în întârziere și fără îndeplinirea vreunei alte formalități prealabile, penalități de ${latePaymentPenaltyPercentValue} pe zi (zi de întârziere) din suma datorată, cu prevederea expresă că valoarea penalităților va putea depăși valoarea sumei la care se aplică.</p>`
  );
  lines.push(
    `<p>Art. 5.7. Locatarul nu va putea cere ca suma constituită drept „garanție” să fie considerată plată în avans și astfel să considere că nu a fost în întârziere la plata facturilor emise de către locator.</p>`
  );
  lines.push(
    `<p>Art. 5.8. (1)  În cazul în care Locatarul din orice motiv întârzie cu mai mult de 15 zile calendaristice constituirea garanției, efectuarea plății chiriei și/sau a cheltuielilor cu utilitățile sau întreținere integral sau parțial, Locatorul poate să considere contractul încetat de plin drept fără intervenția vreunei autorități sau instanțe judecătorești, fără punere în întârziere și fără îndeplinirea vreunei alte formalități. În plus Locatarul va achita o penalitate în valoare de numărul de luni rămase din perioada contractuală x chiria lunară iar Locatorul va avea dreptul să rețină garanția cu titlu de clauză penală, fiind agreat că aceasta nu va fi folosită pentru acoperirea facturilor restante. În cazul în care motivul rezilierii a fost neconstituirea garanției, penalitatea va fi în valoare a 5 (cinci) chirii și este scadentă imediat simultan cu încetarea prezentului CONTRACT, în baza notificării rezilierii de drept transmisă de Locator, fără nicio altă formalitate ori procedură prealabilă. Toate sumele sunt exigibile imediat, fără nicio altă notifcare prealabilă sau intervenția instanțelor de judecată.
    </p>`
  );
  lines.push(
    `<p>(2)  Fără a aduce atingere prevederilor de mai sus, în cazul în care LOCATARUL din orice motiv întârzie efectuarea integrală sau parțială a plății facturilor de chirie și/sau cheltuielile cu utilitățile sau întreținere, în termen de 24 de ore de la data primirii notificării LOCATORULUI privind rezilierea CONTRACTULUI, pe lângă celelalte remedii prevăzute de prezentul contract, LOCATARUL recunoaște că LOCATORUL va avea următoarele drepturi fără a fi necesară vreo autorizație prealabilă din partea unei instanțe sau îndeplinirea vreunei alte formalități:</p>`
  );
  lines.push(
    `<p>a) să înceteze furnizarea de utilități (apă, energie electrică, energie termică) cu preaviz de 24 de ore transmis prin orice mijloc electronic: sms, WhatsApp, email;</p>`
  );
  lines.push(
    `<p>b) să folosească orice modalitate să intre în spațiu, inclusiv prin demontarea încuietorilor. Pentru evitarea oricărui dubiu, Locatarul și Locatorul convin prin prezentul contract că ușile Spațiului și încuietorile acestora sunt proprietatea Locatorului de la data la care sunt montate sau incorporate și vor rămâne în cadrul Spațiului;</p>`
  );
  lines.push(
    `<p>c) să efectueze inventarul bunurilor aflate în spațiu în prezența unui terț independent;</p>`
  );
  lines.push(
    `<p>d) să îndepărteze și să depoziteze bunurile Locatarului aflate în spațiu, LOCATARUL suportând toate costurile cu privire la respectivele operațiuni (inclusiv costurile cu privire la transportare și depozitare). Pentru eliminarea oricărui dubiu, Locatarul se angajează prin prezentul contract că va achita o taxă fixă de ${evacuationFeeValue} + TVA în cazul în care din culpa sa (neplata chiriei și/sau a cheltuielilor cu utilități integral sau parțial în termenul stabilit prin prezentul contract) LOCATORUL va fi nevoit să elibereze SPAȚIUL de bunurile LOCATARULUI. De asemenea, tot prin acest contract părțile stabilesc o taxă de depozitare de ${storageFeeValue} + T.V.A. indiferent de cantitatea sau volumul bunurilor și fără a lua în seamă valoarea CHIRIEI conform contractului;</p>`
  );
  lines.push(
    `<p>e) Prin acest contract, Locatarul recunoaște dreptul absolut, necondiționat, nelimitat și inalienabil al Locatorului de a intra în spațiu în orice situație va considera de cuviință.</p>`
  );
  lines.push(
    `<p>(3) În cazul încetării contractului din culpa Locatarului, toate datoriile devin scadente și până la data achitării acestora, Locatorul are dreptul să rețină toate bunurile și echipamentele Locatarului, acestea făcând obiectul gajului constituit în favoarea Locatorului.</p>`
  );
  lines.push(
    `<p>Pentru claritate, părțile convin expres și irevocabil că încetarea contractului din orice cauză echivalează cu încetarea posesiei asupra Spațiului iar, în caz de refuz de evacuare, Locatorul este îndreptățit să intre în Spațiu, fără ca Locatarul să aibă dreptul să invoce un prejudiciu, daună sau pierdere de orice fel. Încălcarea obligației de predare a Spațiului în termen de 24 de ore la încetarea Contractului, îndreptățește Locatorul să rețină Garanția, cu titlu de penalitate, fără ca acest drept să limiteze sau să condiționeze celelalte remedii recunoscute prin prezentul Contract.</p>`
  );

  lines.push(`<p>Cap. VI Obligațiile părților</p>`);
  lines.push(`<p>Art. 6.1. Locatorul se obligă la următoarele:</p>`);
  lines.push(
    `<p>Să pună la dispoziția Locatarului Spațiul în starea de folosință în care se află la data încheierii prezentului contract, prin încheierea unui proces verbal de predare-primire.</p>`
  );
  lines.push(
    `<p>Locatorul va asigura Locatarului folosința netulburată și posesia Spațiului pe toată durata prezentului contract garantându-l contra evicțiunii terților, cu condiția respectării de către locatar a tuturor obligațiilor asumate, în termenii și condițiile agreate.</p>`
  );
  lines.push(`<p>Art. 6.2. LOCATARUL se obligă la următoarele:</p>`);
  lines.push(
    `<p>1. Locatarul are obligația de a menține Spațiul în stare de funcționare și să respecte toate prevederile legale în vigoare. </p>`
  );
  lines.push(
    `<p>2. Să permită accesul Locatorului în programul de lucru al Locatarului pentru a controla starea Spaţiului în baza unei notificări prealabile de 2 zile.</p>`
  );
  lines.push(
    `<p>3. Locatarul înțelege că suspendarea activității de către organele statului nu constituie o situație care îl exonerează de plata chiriei.</p>`
  );
  lines.push(
    `<p>4. Să permită Locatorului să realizeze lucrările interioare și/sau exterioare necesare pentru întreținerea corespunzătoare a Spațiului și/sau repararea acestuia, fără să poată solicita reducerea Chiriei ori să ceară denunțarea Contractului, câtă vreme poate utiliza spațiul în proporție de minim 70%. În cazul în care lucrările necesare a fi efectuate la interior impun suspendarea activității, timpul alocat lucrărilor va fi scăzut din chirie dacă depașește 2 zile lucrătoare. Orice astfel de lucrări trebuie să fie efectuate într-un termen maxim de 30 de zile</p>`
  );
  lines.push(
    `<p>5. Să nu facă modificări cu caracter permanent care ar influența structura de rezistență.</p>`
  );
  lines.push(
    `<p>6. Să nu facă modificări la instalaţiile clădirii (apă, canalizarea, energie electrică, etc), fără avizul și aprobarea Locatorului și a organelor abilitate.</p>`
  );
  lines.push(
    `<p>7. Să nu obtureze calea de acces în spaţiul ce rămane în folosinţa Locatorului, a altor proprietari și/sau utilizatori de orice fel.</p>`
  );
  lines.push(
    `<p>8. Să suporte toate cheltuielile pentru orice modificări în Spațiul necesare desfășurării activității, fără ca Locatorul să fie obligat la despăgubiri.</p>`
  );
  // lines.push(
  //   `<p>9. La expirarea CONTRACTULUI, LOCATARUL trebuie să predea LOCATORULUI SPAŢIUL închiriat în starea în care a fost predat, cu excepția uzurii normale a SPAȚIULUI, în temeiul unui 'Proces verbal de predare-primire la încetarea Contractului, fiind ținut să execute reparații pereți interiori, lavabil, reparații și/sau înlocuire mobilier deteriorat, aparate de ar condiționat ori centrală termică, dacă sunt nefuncționate total ori parțial, pentru alte motive decât cele rezultate din uzura normală.</p>`
  // );
  lines.push(
    `<p>9. Să obțină toate autorizațiile și avizele necesare funcționării activităților ce urmează a le desfășura, inclusiv montarea sistemelor de pază-alarmare și de prevenire și combatere a incendiilor.</p>`
  );
  lines.push(
    `<p>10. Să asigure marfa și echipamentele din Spațiu, siguranța și protecția acestora fiind în responsabilitatea sa exclusivă. În acest sens, Locatarul va încheia o răspundere civilă pentru terți și o asigurare totală a proprietății închiriate.</p>`
  );
  lines.push(
    `<p>11. Să suporte exclusiv orice amendă stabilită de organele competente pentru încălcarea/nerespectarea/omisiune prevederilor legale fiscale, contabile, de muncă, sanitare, etc. În acest sens, părțile stabilesc că Locatorul este exonerat de orice răspundere legată de acoperirea oricăror costuri, cheltuieli, taxe, amenzi, prejudicii, pagube provenite din sau în legătură cu activitatea din spațiu a Locatarului, Locatarul fiind unicul responsabil în relația cu autoritățile, personalul său, colaboratorii, clienții serviți în spațiu și orice altă persoană care ar putea invoca o pretenție de orice natură de la locatar.</p>`
  );
  lines.push(
    `<p>12. Să suporte cheltuielile aferente Spațiului, energia electrică, energia termică, cheltuieli cu utilitățile sau întreținerea.</p>`
  );
  lines.push(
    `<p>13. Să realizeze orice reparații necesare înainte de predarea Spațiului, din orice cauza de terminarea a contractului, care să asigure returnarea Spațiului în condiții de estetică și funcționare optimă (reparații echipamente/instalații, reparații pereți, lavabil). În cazul în care nu le realizează Locatarul, Locatorul face aceste reparații și le reține din garanție, urmând a restitui acestuia doar partea rămasă. În cazul în care garanția este reținută cu titlu de clauză penală, suma aferentă reparațiilor va fi facturată Locatarului si trebuie achitată de acesta în maxim 5 (cinci) zile de la transmiterea facturii. Obligația de plată este certă, lichidă și exigibilă, fără intervenția instanțelor și fără nicio altă formalitate. Locatarul are dreptul să primească facturile emise de terți pentru realizarea reparațiilor și intervențiilor necesare.</p>`
  );
  lines.push(
    `<p>14. Să plătească chiria la termenul și in condițiile prevăzute in contract.</p>`
  );
  lines.push(
    `<p>15. Să efectueze toate reparaţiile pentru stricăciunile cauzate Spațiului de salariaţii proprii, clienții, partenerii sau oricare altă persoană terță, care nu aparține Locatorului.</p>`
  );
  // lines.push(
  //   `<p>17. Să execute pe propria cheltuială lucrările de amenajare necesare desfășurării activităților sale fără ca Locatorul să poată fi obligat la despăgubiri indiferent de situație, de costul acestora ori de momentul și cauza încetării Contractului.</p>`
  // );
  lines.push(
    `<p>16. La expirarea contractului, Locatarul trebuie să predea Locatorului Spațiul cu proces verbal de predare-primire.</p>`
  );
  lines.push(
    `<p>17. Să folosească Spațiul conform destinației prevăzute în contract ca un bun utilizator.</p>`
  );
  lines.push(
    `<p>18. Să respecte obligațiile pe linie PSI și protecția muncii ce îi revin conform cu legislația în vigoare, iar în cazul nerespectării acestora Locatarul va răspunde singur atât material cât și legal, Locatorul neputând fi tras la răspundere indiferent de situație.</p>`
  );
  lines.push(
    `<p>19.  LOCATARUL se obligă să nu cesioneze, să nu transfere sau să greveze direct sau indirect drepturile care îi revin în baza prezentului CONTRACT și să nu subînchirieze sau să permită folosința sau ocuparea de către alte persoane a SPAȚIULUI în integralitatea lui sau doar în parte. Cu titlu de excepție, acesta va putea subînchiria parțial Spațiul doar cu acordul Locatorului. Chiar și în caz de subînchiriere, Locatarul rămâne pe deplin responsabil de toate obligațiile financiare stabilite de prezentul Contract, fapta sublocatarului fiind considerată ca faptă proprie.Cu toate acestea, Locatarul este îndrituit să cedeze folosința spațiului societăților afiliate în care acesta sau oricare dintre asociații săi deține cel puțin 25% din capitalul social, cu notificarea prealabila a Locatorului, rămânând singurul pe deplin responsabil de toate obligațiile asumate și stabilite de prezentul Contract, fapta oricărei persoane fizice sau juridice fiind ca fapta proprie a Locatarului.</p>`
  );
  lines.push(
    `<p>20. La încetarea contractului, oricare ar fi motivul (denunțare unilaterală, reziliere, expirarea duratei), Locatarul va elibera în termen de 24 de ore Spațiul pe cheltuiala sa punându-l în exclusivitate la dispoziția Locatorului, liber de orice ocupanți și materiale sau alte articole aparținând Locatarului, acesta fiind pus de drept în întârziere, cu excepția cazului în care Locatorul îl notifică că își exercită dreptul de retenție privind bunurile și echipamentele Locatarului care constituie obiect al gajului pentru acoperirea datoriilor scadente. Părțile convin în mod irevocabil ca toate investițiile realizate în Spațiu rămân câștigate Spațiului și devin proprietatea Locatorului fără ca acesta să datoreze contravaloarea acestora.</p>`
  );
  lines.push(
    `<p>21. Prin prezentul Contract, Părțile stabilesc că tacita relocațiune nu va produce efecte în situația în care Locatarul nu eliberează spațiul în termen de maximum 24 de ore de la încetarea contractului, indiferent de motivul încetării acestuia, fie prin reziliere, fie prin ajungerea la termen. În asemenea caz, chiria datorată va fi de ${overstayPenaltyValue} euro/zi.</p>`
  );
  lines.push(
    `<p>22. (1) Locatarul are dreptul să denunțe unilateral acest contract cu un preaviz de ${denunciationNoticeDaysValue} de zile, dar nu are dreptul să abandoneze Spațiul pe parcursul valabilității acestuia, activitatea urmând a se desfășura normal. Dreptul de denunțare nu operează în primele ${denunciationLockMonthsValue} luni ale perioadei contractuale; în cazul în care Locatarul exercită dreptul de denunțare în perioada permisă, acesta datorează Locatorului o penalitate fixă egală cu ${denunciationPenaltyMonthsValue} luni X chiria lunară. În caz de abandon în această perioadă, penalitatea Locatarului va fi în valoare de ${abandonmentPenaltyValue}, plus valoarea Garanției.</p>`
  );
  lines.push(
    `<p>23. Locatarul se obligă ca o dată pe an să depună la sediul Locatorului un certificat constatator eliberat de Oficiul Registrului Comerțului din care să reiasă faptul că societatea este în funcțiune și că structura asociaților nu s-a schimbat.</p>`
  );
  lines.push(
    `<p>24. LOCATARUL va efectua toate demersurile la ONRC pentru radierea punctului de lucru ori ori schimbarea sediului social din Spațiu în termen de maxim 30 de zile de la data încetării Contractului, sub sancțiunea plății a 50 euro pe fiecare zi de întârziere peste acest termen.</p>`
  );

  lines.push(`<p>CAP. 7. ÎNCETAREA CONTRACTULUI</p>`);
  lines.push(
    `<p>Art. 7.1. Părțile pot înceta prezentul contract de comun acord prin semnarea unui act adițional.</p>`
  );
  lines.push(
    `<p>Art. 7.2. Locatarul poate solicita încetarea prezentului contract în cazul în care Locatorul nu își execută obligația de predare a Spaţiului.</p>`
  );
  lines.push(
    `<p>Art. 7.3. Locatorul poate considera prezentul contract reziliat de plin drept fără nicio notificare prealabilă și/sau punere în întârziere și/sau intervenția instanțelor judecătorești sau a altei autorități în cazul în care Locatarul nu își execută oricare dintre obligațiile asumate prin prezentul CONTRACT. În caz de reziliere, Locatarul este ținut să achite o penalitate în valoare de ${abandonmentPenaltyValue}. Penalitatea este exigibilă imediat, fără intervenția instanțelor de judecată ori proceduri prealabile. Art. 5.5. și 5.8. sunt aplicabilw în mod corespunzător.
    </p>`
  );
  lines.push(
    `<p>Art. 7.4. Locatorul poate denunța unilateral contractul oricând pe durata de valabilitate a acestuia fără a fi obligat să motiveze hotărârea, fără a fi obligat la despăgubiri către locatar fără nicio altă formalitate și/sau punere în întârziere și/sau intervenția instanțelor judecătorești și/sau a altor autorități. Locatorul este obligat să notifice Locatarului intenția sa cu 60 zile înainte de termenul la care Locatarul trebuie să elibereze Spațiul.</p>`
  );

  lines.push(`<p>CAP. 8. ALTE CLAUZE</p>`);
  lines.push(
    `<p>Art. 8.1. Prezentul contract poate fi modificat și/sau completat numai cu acordul ambelor părți prin încheierea unui act adițional.</p>`
  );
  lines.push(
    `<p>Art. 8.2. Forța majoră exonerează de răspundere partea care o invocă în condițiile legii cu condiția notificării existenței cazului de forță majoră în termen de ${forceMajeureNoticeDaysValue} zile de la apariția acestuia și a prezentării unui certificat eliberat de o instituție cu competență în acest domeniu.</p>`
  );
  lines.push(
    `<p>Art. 8.3. Orice modificare cu privire la sediul părților va fi notificată în scris celeilalte părți în termen de cel mult 5 zile calendaristice.</p>`
  );
  lines.push(
    `<p>Art. 8.4. Dacă orice termen, angajament sau condiție din prezentul contract sau aplicarea acestora este în orice măsură nulă sau inaplicabilă, restul acestui contract nu va fi afectat, iar fiecare termen, angajament sau condiție va fi valabil(ă) și aplicabil(ă) în totalitate în măsura maxim permisă de lege.</p>`
  );
  lines.push(
    `<p>Art. 8.5. Părțile vor păstra confidențialitatea asupra conținutului prezentului contract precum și asupra oricărei informații la care ar fi putut avea acces sau pe care ar fi putut să o obțină de la cealaltă parte și nu o va dezvălui niciunui terț în afară de cei care au legal dreptul să cunoască clauzele contractului sau atunci când situația impune acest lucru. Orice încălcare a caracterului secret, dezvăluirea unor informații privind contractul sau discreditarea Locatorului ori a reprezentanților acestuia este considerată încălcare gravă și este sancționată cu ${confidentialityPenaltyValue}, independent dacă aceasta s-a produs în timpul contractului ori după încetarea acestuia.</p>`
  );
  lines.push(
    `<p>Art. 8.6. Părțile vor lua măsuri tehnice și organizatorice adecvate în vederea asigurării unui nivel corespunzător de securitate a datelor cu caracter personal, în acord cu prevederile Regulamentului 697/2016, în scopul și temeiul legal pentru care s-a perfectat prezentul Contract.</p>`
  );
  lines.push(
    `<p>Art. 8.7. Litigiile care se pot naște între părți cu privire la executarea prezentului contract vor fi soluționate pe cale amiabilă, iar în cazul în care acest lucru nu este posibil instanța competentă este cea de pe raza sectorului 2 al municipiului București.</p>`
  );
  lines.push(
    `<p>Art. 8.8. Orice notificare comunicată cu privire la acest contract va fi transmisă în limba română prin scrisoare recomandată cu confirmare de primire (atât notificările cât și confirmarea de primire trebuie semnate de reprezentanții părților și să poarte ștampila societății) sau prin executor judecătoresc.</p>`
  );
  lines.push(
    `<p>Art. 8.9. Pentru evitarea oricărui dubiu, Părțile recunosc si convin ca încheierea prezentului Contract ori a actelor adiționale la acesta se consideră efectuată prin semnătura reprezentanților lor legal autorizați în original ori pe email (recunoscând ca semnăturile scanate sau electronice sunt considerate suficiente) și va angaja Părțile și vor produce efecte juridice depline (inclusiv sub aspect procedural), Părțile renunțând la orice drept de a contesta acest tratament.</p>`
  );

  lines.push(
    `<p>Prezentul CONTRACT s-a încheiat la ${signatureLocationValue}, astăzi ${contractSignedAtValue} în două exemplare, câte unul pentru fiecare parte contractantă.</p>`
  );

  lines.push(`<p>${ownerName} - LOCATOR<br /> prin ${ownerAdministrators}</p>`);
  lines.push(
    `<p>${partnerName} - LOCATAR<br /> prin ${partnerRepresentatives}</p>`
  );

  return lines.join("\n");
}

function buildPrintableDocument(state: EditorState): string {
  const title = (state.title ?? "").trim() || "Contract scris";
  const subtitle = (state.subtitle ?? "").trim();
  const documentNumber = (state.documentNumber ?? "").trim();
  const documentDate = (state.documentDate ?? "").trim();
  const formattedDate = documentDate ? formatDateDot(documentDate) : "";
  const bodyHtml =
    state.body && state.body.trim() ? state.body : createTemplateBody(state);
  const notes = (state.notes ?? "").trim();

  const docInfoParts: string[] = [];
  if (documentNumber) {
    docInfoParts.push(`Nr. ${escapeHtml(documentNumber)}`);
  }
  if (formattedDate && formattedDate !== "——") {
    docInfoParts.push(`Data ${escapeHtml(formattedDate)}`);
  } else if (documentDate) {
    docInfoParts.push(`Data ${escapeHtml(documentDate)}`);
  }

  const notesHtml = notes
    ? `<div class="document-notes"><h3>Note interne</h3><p>${escapeHtml(
        notes
      ).replace(/\n+/g, "<br />")}</p></div>`
    : "";

  const formatHeaderField = (value?: string | null) => {
    const trimmed = (value ?? "").trim();
    return trimmed ? escapeHtml(trimmed) : "—";
  };

  const representativeLabel = (() => {
    const name = (state.ownerRepresentative ?? "").trim();
    const title = (state.ownerRepresentativeTitle ?? "").trim();
    if (name && title) return `${escapeHtml(name)} · ${escapeHtml(title)}`;
    if (name) return escapeHtml(name);
    if (title) return escapeHtml(title);
    return "—";
  })();

  const bankDetailsHeader = (() => {
    const account = (state.bankAccount ?? "").trim();
    const bank = (state.bankName ?? "").trim();
    if (account && bank) return `${escapeHtml(account)} · ${escapeHtml(bank)}`;
    if (account) return escapeHtml(account);
    if (bank) return escapeHtml(bank);
    return "—";
  })();

  const ownerHeaderHtml = `
    <div class="owner-header">
      <div class="owner-header__name">${formatHeaderField(
        state.ownerName
      )}</div>
      <div class="owner-header__grid">
        <div><span class="label">ORC</span><span>${formatHeaderField(
          state.ownerRegistration
        )}</span></div>
        <div><span class="label">CIF</span><span>${formatHeaderField(
          state.ownerTaxId
        )}</span></div>
        <div><span class="label">Reprezentant</span><span>${representativeLabel}</span></div>
        <div><span class="label">Email</span><span>${formatHeaderField(
          state.ownerContactEmails
        )}</span></div>
        <div><span class="label">Telefon</span><span>${formatHeaderField(
          state.ownerContactPhones
        )}</span></div>
        <div><span class="label">IBAN / Bancă</span><span>${bankDetailsHeader}</span></div>
        <div><span class="label">Sediu social</span><span>${formatHeaderField(
          state.ownerHeadOffice
        )}</span></div>
        <div><span class="label">Adresă corespondență</span><span>${formatHeaderField(
          state.ownerAddress
        )}</span></div>
      </div>
    </div>
  `;

  return `<!doctype html>
<html lang="ro">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      @font-face {
        font-family: "Roboto Condensed";
        src: url("/fonts/RobotoCondensed-Regular.ttf") format("truetype");
        font-weight: 400;
        font-style: normal;
      }
      :root {
        color-scheme: light;
      }
      body {
        margin: 0;
        font-family: "Roboto Condensed", "Helvetica Neue", Arial, sans-serif;
        color: #111;
        background: white;
      }
      main.sheet {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 22mm 25mm;
        box-sizing: border-box;
      }
      h1 {
        margin: 0;
        font-size: 22px;
        line-height: 1.4;
        text-transform: uppercase;
        text-align: center;
        letter-spacing: 0.04em;
      }
      h2 {
        margin: 4mm 0 8mm;
        font-size: 14px;
        font-weight: 400;
        text-align: center;
        color: #555;
      }
      .document-meta {
        margin: 0 0 10mm;
        font-size: 12px;
        text-align: center;
        color: #666;
      }
      .document-body {
        font-size: 13px;
        line-height: 1.55;
        text-align: justify;
        text-justify: inter-word;
      }
      .document-body p {
        margin: 0 0 5mm;
        text-align: justify;
        text-justify: inter-word;
      }
      /* Hide the first paragraph in the printable contract body (requested) */
      .document-body p:first-of-type {
        display: none;
      }
      .document-body ul,
      .document-body ol {
        padding-left: 18mm;
        margin: 0 0 5mm;
      }
      .document-body li {
        margin-bottom: 2mm;
      }
      strong {
        font-weight: 400;
      }
      .owner-header {
        margin: 10mm 0 8mm;
        padding: 8mm;
        border: 1px solid #d4d4d8;
        border-radius: 8px;
        background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
      }
      .owner-header__name {
        font-size: 16px;
        font-weight: 600;
        letter-spacing: 0.02em;
        margin: 0 0 5mm;
      }
      .owner-header__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 4mm 6mm;
        font-size: 12px;
        line-height: 1.45;
      }
      .owner-header__grid .label {
        display: block;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: #6b7280;
        margin-bottom: 1mm;
      }
      .document-notes {
        margin-top: 14mm;
        padding-top: 8mm;
        border-top: 1px solid #d4d4d8;
        font-size: 12px;
        line-height: 1.5;
      }
      .document-notes h3 {
        margin: 0 0 4mm;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      @media print {
        body {
          background: none;
        }
        main.sheet {
          margin: 0;
          width: auto;
          min-height: auto;
          padding: 18mm 20mm;
        }
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <h1>${escapeHtml(title)}</h1>
      ${subtitle ? `<h2>${escapeHtml(subtitle)}</h2>` : ""}
      ${
        docInfoParts.length > 0
          ? `<div class="document-meta">${docInfoParts.join(" &bull; ")}</div>`
          : ""
      }
      ${ownerHeaderHtml}
      <div class="document-body">${bodyHtml}</div>
      ${notesHtml}
    </main>
  </body>
</html>`;
}

function mapPrefillToState(
  data: Record<string, unknown>
): Partial<EditorState> {
  const mapped: Partial<EditorState> = {};
  const flag = data["__writtenContract"];
  if (flag === true) {
    for (const key of EDITOR_STATE_KEYS) {
      const k = key as EditorStateKey;
      const raw = data[k];
      if (key === "signed") {
        if (typeof raw === "boolean") {
          mapped.signed = raw;
          continue;
        }
        if (typeof raw === "string") {
          const normalized = raw.trim().toLowerCase();
          mapped.signed = normalized === "true";
          continue;
        }
      }
      if (key !== "signed" && typeof raw === "string") {
        mapped[key as Exclude<EditorStateKey, "signed">] = raw;
      }
    }
    if (!mapped.intendedUse) {
      const legacy = data["spaceUsage"];
      if (typeof legacy === "string" && legacy.trim()) {
        mapped.intendedUse = legacy.trim();
      }
    }
    return mapped;
  }

  const copyIfString = (
    source: string,
    target: Exclude<EditorStateKey, "signed">
  ) => {
    const raw = data[source];
    if (typeof raw === "string" && raw.trim()) {
      mapped[target] = raw.trim();
    }
  };

  copyIfString("owner", "ownerName");
  copyIfString("ownerAddress", "ownerAddress");
  copyIfString("ownerId", "ownerId");
  copyIfString("partner", "partnerName");
  copyIfString("partnerId", "partnerId");
  copyIfString("partnerAddress", "partnerAddress");
  copyIfString("partnerEmail", "partnerEmail");
  copyIfString("asset", "assetName");
  copyIfString("assetName", "assetName");
  copyIfString("assetId", "assetId");
  copyIfString("assetAddress", "assetAddress");
  copyIfString("tvaType", "tvaType");
  copyIfString("monthOfRent", "monthOfRent");
  copyIfString("indexingMonth", "indexingMonth");
  copyIfString("correctionPercent", "correctionPercent");
  copyIfString("surface", "spaceSurface");
  copyIfString("intendedUse", "intendedUse");
  copyIfString("usage", "intendedUse");
  copyIfString("spaceUsage", "intendedUse");
  copyIfString("signedAt", "contractSignedAt");
  copyIfString("startDate", "contractStartDate");
  copyIfString("endDate", "contractEndDate");
  copyIfString("name", "title");
  copyIfString("contractNumber", "documentNumber");
  copyIfString("documentDate", "documentDate");
  copyIfString("tvaPercent", "tvaPercent");

  const contractId = data["id"];
  if (typeof contractId === "string" && contractId.trim()) {
    mapped.contractId = contractId.trim();
  }

  const rentRaw = data["rentAmountEuro"] ?? data["amountEUR"];
  const tvaRaw = (() => {
    if (typeof mapped.tvaPercent === "string" && mapped.tvaPercent.trim()) {
      return mapped.tvaPercent.trim();
    }
    const fromData = data["tvaPercent"];
    if (typeof fromData === "number" && Number.isFinite(fromData)) {
      return String(fromData);
    }
    if (typeof fromData === "string" && fromData.trim()) {
      return fromData.trim();
    }
    return "";
  })();

  if (typeof rentRaw === "number" && Number.isFinite(rentRaw)) {
    mapped.rentAmount = `${rentRaw.toLocaleString("ro-RO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} EUR`;
    const tvaPercentForText = resolveTvaPercentDisplay(tvaRaw).display;
    const tvaTypeForText = resolveTvaTypeDisplay(mapped.tvaType).display;
    mapped.rentAmountText = `${rentRaw.toLocaleString(
      "ro-RO"
    )} de euro + TVA ${tvaPercentForText} ${tvaTypeForText}`;
  } else if (typeof rentRaw === "string" && rentRaw.trim()) {
    mapped.rentAmount = rentRaw.trim();
  }

  const signedRaw = data["signed"];
  if (typeof signedRaw === "boolean") {
    mapped.signed = signedRaw;
  } else if (typeof signedRaw === "string" && signedRaw.trim()) {
    mapped.signed = signedRaw.trim().toLowerCase() === "true";
  }

  return mapped;
}

function deriveBaseState(
  contract: ContractLike,
  document: WrittenContract | null,
  owners: OwnerOption[],
  partners: PartnerOption[],
  assets: AssetOption[]
): EditorState {
  const raw = ensureRecord(contract);

  const ownerIdFromDocument = document?.ownerId ?? getString(raw["ownerId"]);
  const ownerNameFromData = document?.ownerName ?? getString(raw["owner"]);
  const partnerIdFromDocument =
    document?.partnerId ?? getString(raw["partnerId"]);
  const partnerNameFromData =
    document?.partnerName ?? getString(raw["partner"]);
  const assetIdFromDocument = document?.assetId ?? getString(raw["assetId"]);
  const assetNameFromData = document?.assetName ?? getString(raw["asset"]);

  const normalizedOwnerId = ownerIdFromDocument?.trim()
    ? ownerIdFromDocument.trim()
    : undefined;
  const ownerById = normalizedOwnerId
    ? owners.find((item) => item.id === normalizedOwnerId)
    : undefined;
  const ownerByName =
    !ownerById && ownerNameFromData
      ? owners.find(
          (item) => item.name.toLowerCase() === ownerNameFromData.toLowerCase()
        )
      : undefined;
  const resolvedOwner = ownerById ?? ownerByName;

  const ownerName = resolvedOwner?.name ?? ownerNameFromData ?? "";
  const contractIdRaw = document?.contractId ?? getString(raw["id"]);

  const normalizedPartnerId = partnerIdFromDocument?.trim()
    ? partnerIdFromDocument.trim()
    : undefined;
  const partnerById = normalizedPartnerId
    ? partners.find((item) => item.id === normalizedPartnerId)
    : undefined;
  const partnerByName =
    !partnerById && partnerNameFromData
      ? partners.find(
          (item) =>
            item.name.trim().toLowerCase() ===
            partnerNameFromData.trim().toLowerCase()
        )
      : undefined;
  const resolvedPartner = partnerById ?? partnerByName;

  const partnerName = resolvedPartner?.name ?? partnerNameFromData ?? "";

  const normalizedAssetId = assetIdFromDocument?.trim()
    ? assetIdFromDocument.trim()
    : undefined;
  const assetById = normalizedAssetId
    ? assets.find((item) => item.id === normalizedAssetId)
    : undefined;
  const assetByName =
    !assetById && assetNameFromData
      ? assets.find(
          (item) =>
            item.name.trim().toLowerCase() ===
            assetNameFromData.trim().toLowerCase()
        )
      : undefined;
  const resolvedAsset = assetById ?? assetByName;

  const assetSurfaceFromAsset =
    resolvedAsset &&
    typeof resolvedAsset.areaSqm === "number" &&
    Number.isFinite(resolvedAsset.areaSqm)
      ? formatSurfaceMp(resolvedAsset.areaSqm)
      : undefined;

  const contractSignedAtDefault =
    document?.contractSignedAt ?? getString(raw["signedAt"]);
  const contractStartDateDefault =
    document?.contractStartDate ?? getString(raw["startDate"]);
  const contractEndDateDefault =
    document?.contractEndDate ?? getString(raw["endDate"]);

  const signed = (() => {
    if (typeof document?.signed === "boolean") {
      return document.signed;
    }
    const rawSigned = raw["signed"];
    if (typeof rawSigned === "boolean") {
      return rawSigned;
    }
    if (typeof rawSigned === "string" && rawSigned.trim()) {
      const normalized = rawSigned.trim().toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    return Boolean(contractSignedAtDefault);
  })();

  const startMonthName = formatMonthName(contractStartDateDefault);
  const invoiceMonthModeRaw = getString(raw["invoiceMonthMode"]);
  const rentMonthDate =
    invoiceMonthModeRaw && invoiceMonthModeRaw.toLowerCase() === "next"
      ? addMonths(contractStartDateDefault, 1)
      : contractStartDateDefault;
  const inferredMonthOfRent = formatMonthName(rentMonthDate) || startMonthName;
  const inferredIndexingMonth = startMonthName;

  const tvaType = (() => {
    const source = document?.tvaType ?? getString(raw["tvaType"]);
    return typeof source === "string" ? source.trim() : "";
  })();

  const correctionPercent = (() => {
    if (typeof document?.correctionPercent === "string") {
      return document.correctionPercent;
    }
    const rawCorr = raw["correctionPercent"];
    if (typeof rawCorr === "number" && Number.isFinite(rawCorr)) {
      return String(rawCorr);
    }
    if (typeof rawCorr === "string" && rawCorr.trim()) {
      return rawCorr.trim();
    }
    return "";
  })();

  const rentAmountEuro = raw["rentAmountEuro"] ?? raw["amountEUR"];
  const rentNumber =
    typeof rentAmountEuro === "number" && Number.isFinite(rentAmountEuro)
      ? rentAmountEuro
      : undefined;
  const rentAmount =
    document?.rentAmount ??
    (rentNumber
      ? `${rentNumber.toLocaleString("ro-RO", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} EUR`
      : "");
  const tvaPercentSource = document?.tvaPercent ?? getString(raw["tvaPercent"]);
  const tvaPercent = (tvaPercentSource ?? "").trim();
  const tvaPercentText = resolveTvaPercentDisplay(tvaPercent).display;
  const tvaTypeText = resolveTvaTypeDisplay(tvaType).display;
  const rentAmountText =
    document?.rentAmountText ??
    (rentNumber
      ? `${rentNumber.toLocaleString(
          "ro-RO"
        )} de euro + TVA ${tvaPercentText} ${tvaTypeText}`
      : "");

  const defaultGuaranteeDueDate =
    document?.guaranteeDueDate ??
    calculateGuaranteeDueDate(contractStartDateDefault) ??
    "";

  const invoiceIssueDayValueRaw =
    document?.invoiceIssueDay ??
    pickFirstFilled(raw["invoiceIssueDay"], raw["monthlyInvoiceDay"]);
  const monthlyInvoiceDay =
    document?.monthlyInvoiceDay ??
    pickFirstFilled(raw["monthlyInvoiceDay"], invoiceIssueDayValueRaw);
  const invoiceMonthMode = (
    document?.invoiceMonthMode ??
    invoiceMonthModeRaw ??
    ""
  ).trim();

  const bankName = (() => {
    const value = document?.bankName ?? pickFirstFilled(raw["bankName"]);
    return value && value.trim() ? value : DEFAULT_BANK_NAME;
  })();

  const guaranteeForms = (() => {
    const fromDocument = document?.guaranteeForms;
    const fromData = pickFirstFilled(raw["guaranteeForms"]);
    const value = fromDocument ?? fromData;
    return value && value.trim() ? value : DEFAULT_GUARANTEE_FORMS;
  })();

  const guaranteeMultiplier = (() => {
    const value =
      document?.guaranteeMultiplier ??
      pickFirstFilled(raw["guaranteeMultiplier"]);
    return value && value.trim() ? value : DEFAULT_GUARANTEE_MULTIPLIER;
  })();

  const guaranteeBoMultiplier = (() => {
    const value =
      document?.guaranteeBoMultiplier ??
      pickFirstFilled(raw["guaranteeBoMultiplier"]);
    return value && value.trim() ? value : DEFAULT_GUARANTEE_BO_MULTIPLIER;
  })();

  const latePaymentNotificationFee = (() => {
    const value =
      document?.latePaymentNotificationFee ??
      pickFirstFilled(raw["latePaymentNotificationFee"]);
    return value && value.trim()
      ? value
      : DEFAULT_LATE_PAYMENT_NOTIFICATION_FEE;
  })();

  const latePaymentPenaltyPercent = (() => {
    const value =
      document?.latePaymentPenaltyPercent ??
      pickFirstFilled(raw["latePaymentPenaltyPercent"]);
    return value && value.trim() ? value : DEFAULT_LATE_PAYMENT_PENALTY_PERCENT;
  })();

  const nonPaymentTerminationDays = (() => {
    const value =
      document?.nonPaymentTerminationDays ??
      pickFirstFilled(raw["nonPaymentTerminationDays"]);
    return value && value.trim() ? value : DEFAULT_NON_PAYMENT_TERMINATION_DAYS;
  })();

  const evacuationFee = (() => {
    const value =
      document?.evacuationFee ?? pickFirstFilled(raw["evacuationFee"]);
    return value && value.trim() ? value : DEFAULT_EVACUATION_FEE;
  })();

  const storageFee = (() => {
    const value = document?.storageFee ?? pickFirstFilled(raw["storageFee"]);
    return value && value.trim() ? value : DEFAULT_STORAGE_FEE;
  })();

  const denunciationNoticeDays = (() => {
    const value =
      document?.denunciationNoticeDays ??
      pickFirstFilled(raw["denunciationNoticeDays"]);
    return value && value.trim() ? value : DEFAULT_DENUNCIATION_NOTICE_DAYS;
  })();

  const state: EditorState = {
    id: document?.id,
    contractId: contractIdRaw ? contractIdRaw : undefined,
    ownerId: resolvedOwner?.id ?? normalizedOwnerId,
    assetId: resolvedAsset?.id ?? normalizedAssetId,
    partnerId: resolvedPartner?.id ?? normalizedPartnerId,
    contractSignedAt: contractSignedAtDefault,
    contractStartDate: contractStartDateDefault,
    contractEndDate: contractEndDateDefault,
    signed,
    assetName:
      document?.assetName ?? resolvedAsset?.name ?? getString(raw["asset"]),
    assetAddress:
      document?.assetAddress ??
      pickFirstFilled(
        resolvedAsset?.address,
        raw["assetAddress"],
        raw["address"]
      ),
    spaceSurface:
      document?.spaceSurface ??
      assetSurfaceFromAsset ??
      pickFirstFilled(raw["spaceSurface"], raw["surface"]),
    intendedUse:
      document?.intendedUse ??
      document?.spaceUsage ??
      pickFirstFilled(raw["intendedUse"], raw["spaceUsage"], raw["usage"]),
    title:
      (document?.title ?? getString(raw["name"]) ?? "") ||
      "CONTRACT DE ÎNCHIRIERE",
    subtitle:
      document?.subtitle ??
      (ownerName || partnerName ? makeSubtitle(ownerName, partnerName) : ""),
    documentNumber:
      document?.documentNumber ??
      pickFirstFilled(raw["contractNumber"], raw["id"]),
    documentDate:
      document?.documentDate ??
      pickFirstFilled(raw["documentDate"], raw["signedAt"]),
    ownerName,
    ownerAddress:
      document?.ownerAddress ??
      pickFirstFilled(
        raw["ownerAddress"],
        raw["address"],
        resolvedOwner?.headquarters
      ),
    ownerContactEmails:
      document?.ownerContactEmails ??
      pickFirstFilled(raw["ownerContactEmails"]),
    ownerContactPhones:
      document?.ownerContactPhones ??
      pickFirstFilled(raw["ownerContactPhones"]),
    ownerRegistration:
      document?.ownerRegistration ?? pickFirstFilled(raw["ownerRegistration"]),
    ownerTaxId: document?.ownerTaxId ?? pickFirstFilled(raw["ownerTaxId"]),
    ownerHeadOffice:
      document?.ownerHeadOffice ??
      pickFirstFilled(raw["ownerHeadOffice"], resolvedOwner?.headquarters),
    ownerRepresentative:
      document?.ownerRepresentative ??
      pickFirstFilled(raw["ownerRepresentative"]),
    ownerRepresentativeTitle:
      document?.ownerRepresentativeTitle ??
      pickFirstFilled(raw["ownerRepresentativeTitle"]),
    partnerName,
    partnerAddress:
      document?.partnerAddress ??
      pickFirstFilled(raw["partnerAddress"], resolvedPartner?.headquarters),
    partnerEmail:
      document?.partnerEmail ?? pickFirstFilled(raw["partnerEmail"]),
    partnerPhone:
      document?.partnerPhone ?? pickFirstFilled(raw["partnerPhone"]),
    partnerRegistration:
      document?.partnerRegistration ??
      pickFirstFilled(raw["partnerRegistration"]),
    partnerTaxId:
      document?.partnerTaxId ?? pickFirstFilled(raw["partnerTaxId"]),
    partnerHeadOffice:
      document?.partnerHeadOffice ??
      pickFirstFilled(raw["partnerHeadOffice"], resolvedPartner?.headquarters),
    partnerRepresentative:
      document?.partnerRepresentative ??
      pickFirstFilled(raw["partnerRepresentative"]),
    partnerRepresentativeTitle:
      document?.partnerRepresentativeTitle ??
      pickFirstFilled(raw["partnerRepresentativeTitle"]),
    rentAmount,
    rentAmountText,
    tvaPercent,
    tvaType,
    invoiceIssueDay: invoiceIssueDayValueRaw,
    monthlyInvoiceDay,
    invoiceMonthMode,
    monthOfRent: document?.monthOfRent ?? inferredMonthOfRent ?? "",
    paymentDueDays:
      document?.paymentDueDays ?? pickFirstFilled(raw["paymentDueDays"]),
    invoiceSendChannels:
      document?.invoiceSendChannels ??
      pickFirstFilled(raw["invoiceSendChannels"]),
    indexingMonth: document?.indexingMonth ?? inferredIndexingMonth ?? "",
    bankAccount:
      document?.bankAccount ??
      pickFirstFilled(raw["bankAccount"], resolvedOwner?.bankAccount),
    bankName,
    guaranteeMultiplier,
    guaranteeDueDate: defaultGuaranteeDueDate,
    guaranteeForms,
    guaranteeBoMultiplier,
    utilityPaymentTerm:
      document?.utilityPaymentTerm ??
      pickFirstFilled(raw["utilityPaymentTerm"]),
    latePaymentPenaltyPercent,
    latePaymentNotificationFee,
    evacuationFee,
    storageFee,
    nonPaymentTerminationDays,
    dailyPenaltyAfterTermination:
      document?.dailyPenaltyAfterTermination ??
      pickFirstFilled(raw["dailyPenaltyAfterTermination"]),
    denunciationNoticeDays,
    denunciationLockMonths:
      document?.denunciationLockMonths ??
      pickFirstFilled(raw["denunciationLockMonths"]),
    denunciationPenaltyMonths:
      document?.denunciationPenaltyMonths ??
      pickFirstFilled(raw["denunciationPenaltyMonths"]),
    denunciationPenaltyFixed:
      document?.denunciationPenaltyFixed ??
      pickFirstFilled(raw["denunciationPenaltyFixed"]),
    abandonPenaltyDescription:
      document?.abandonPenaltyDescription ??
      pickFirstFilled(raw["abandonPenaltyDescription"]),
    overstayPenaltyPerDay:
      document?.overstayPenaltyPerDay ??
      pickFirstFilled(raw["overstayPenaltyPerDay"]),
    confidentialityPenalty:
      document?.confidentialityPenalty ??
      pickFirstFilled(raw["confidentialityPenalty"]),
    forceMajeureNoticeDays:
      document?.forceMajeureNoticeDays ??
      pickFirstFilled(raw["forceMajeureNoticeDays"]),
    signatureLocation:
      document?.signatureLocation ?? pickFirstFilled(raw["signatureLocation"]),
    body: document?.body ?? "",
    notes: document?.notes ?? pickFirstFilled(raw["notes"]),
    correctionPercent,
  };

  if (!document?.body) {
    state.body = createTemplateBody(state);
  }

  if (resolvedOwner) {
    Object.assign(state, buildOwnerPatchFromOption(resolvedOwner, state));
  }

  if (resolvedPartner) {
    Object.assign(state, buildPartnerPatchFromOption(resolvedPartner, state));
  }

  if (resolvedAsset) {
    Object.assign(state, buildAssetPatchFromOption(resolvedAsset));
  }

  return state;
}

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Se salvează..." : label}
    </button>
  );
}

type Props = {
  initialContract: ContractLike;
  initialDocument: WrittenContract | null;
  owners: OwnerOption[];
  partners: PartnerOption[];
  assets: AssetOption[];
};

export default function WrittenContractForm({
  initialContract,
  initialDocument,
  owners,
  partners,
  assets,
}: Props) {
  const baseState = useMemo(
    () =>
      deriveBaseState(
        initialContract,
        initialDocument,
        owners,
        partners,
        assets
      ),
    [initialContract, initialDocument, owners, partners, assets]
  );
  const generatedTemplate = useMemo(
    () => createTemplateBody(baseState),
    [baseState]
  );
  const initialBodyDirty = useMemo(() => {
    if (!initialDocument?.body) return false;
    return (
      normalizeHtml(initialDocument.body) !== normalizeHtml(generatedTemplate)
    );
  }, [initialDocument?.body, generatedTemplate]);
  const initialState = useMemo<EditorState>(() => {
    if (initialBodyDirty) return baseState;
    return { ...baseState, body: generatedTemplate };
  }, [baseState, generatedTemplate, initialBodyDirty]);
  const [state, setState] = useState<EditorState>(() => initialState);
  const [bodyDirty, setBodyDirty] = useState(initialBodyDirty);
  const bodyDirtyRef = useRef(bodyDirty);
  const [loadedDraft, setLoadedDraft] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const lastUpdateFromEditor = useRef(false);
  const ownersById = useMemo(() => {
    const map = new Map<string, OwnerOption>();
    for (const owner of owners) {
      map.set(owner.id, owner);
    }
    return map;
  }, [owners]);
  const lastAppliedOwnerRef = useRef<string | null>(baseState.ownerId ?? null);
  const partnersById = useMemo(() => {
    const map = new Map<string, PartnerOption>();
    for (const partner of partners) {
      map.set(partner.id, partner);
    }
    return map;
  }, [partners]);
  const lastAppliedPartnerRef = useRef<string | null>(
    baseState.partnerId ?? null
  );
  const assetsById = useMemo(() => {
    const map = new Map<string, AssetOption>();
    for (const asset of assets) {
      map.set(asset.id, asset);
    }
    return map;
  }, [assets]);
  const lastAppliedAssetRef = useRef<string | null>(baseState.assetId ?? null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const storageKey = useMemo(() => {
    return initialDocument?.id
      ? `written-contract-draft-${initialDocument.id}`
      : PREFILL_STORAGE_KEY;
  }, [initialDocument?.id]);

  useEffect(() => {
    const matchesTemplate =
      !initialDocument?.body ||
      normalizeHtml(initialDocument.body) === normalizeHtml(generatedTemplate);
    setState(
      matchesTemplate ? { ...baseState, body: generatedTemplate } : baseState
    );
    const nextDirty = !matchesTemplate;
    setBodyDirty(nextDirty);
    bodyDirtyRef.current = nextDirty;
    lastAppliedOwnerRef.current = baseState.ownerId ?? null;
    lastAppliedPartnerRef.current = baseState.partnerId ?? null;
    lastAppliedAssetRef.current = baseState.assetId ?? null;
  }, [baseState, generatedTemplate, initialDocument?.body]);

  useEffect(() => {
    bodyDirtyRef.current = bodyDirty;
  }, [bodyDirty]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) {
        setLoadedDraft(true);
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const mapped = mapPrefillToState(parsed);
      const manual = parsed.__bodyDirty === true;
      if (Object.keys(mapped).length > 0 || manual) {
        setState((prev) => {
          const next = { ...prev, ...mapped } as EditorState;
          if (!manual) {
            next.body = createTemplateBody(next);
          }
          return next;
        });
        bodyDirtyRef.current = manual;
        setBodyDirty(manual);
      }
    } catch (error) {
      console.warn("Nu am putut încărca draftul contractului scris", error);
    } finally {
      setLoadedDraft(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!state.ownerId) {
      lastAppliedOwnerRef.current = null;
      return;
    }
    const owner = ownersById.get(state.ownerId);
    if (!owner) return;
    if (lastAppliedOwnerRef.current === owner.id) return;
    setState((prev) => {
      if (prev.ownerId !== owner.id) {
        return prev;
      }
      const patchEntries = Object.entries(
        buildOwnerPatchFromOption(owner, prev)
      ) as Array<[keyof EditorState, unknown]>;
      let changed = false;
      const next = { ...prev } as EditorState;
      for (const [key, value] of patchEntries) {
        if (prev[key] !== value) {
          (next as Record<string, unknown>)[key] = value;
          changed = true;
        }
      }
      if (!changed) {
        lastAppliedOwnerRef.current = owner.id;
        return prev;
      }
      if (!bodyDirtyRef.current) {
        next.body = createTemplateBody(next);
      }
      lastAppliedOwnerRef.current = owner.id;
      return next;
    });
  }, [state.ownerId, ownersById]);

  useEffect(() => {
    if (!state.partnerId) {
      lastAppliedPartnerRef.current = null;
      return;
    }
    const partner = partnersById.get(state.partnerId);
    if (!partner) return;
    if (lastAppliedPartnerRef.current === partner.id) return;
    setState((prev) => {
      if (prev.partnerId !== partner.id) {
        return prev;
      }
      const patchEntries = Object.entries(
        buildPartnerPatchFromOption(partner, prev)
      ) as Array<[keyof EditorState, unknown]>;
      let changed = false;
      const next = { ...prev } as EditorState;
      for (const [key, value] of patchEntries) {
        if (prev[key] !== value) {
          (next as Record<string, unknown>)[key] = value;
          changed = true;
        }
      }
      if (!changed) {
        lastAppliedPartnerRef.current = partner.id;
        return prev;
      }
      if (!bodyDirtyRef.current) {
        next.body = createTemplateBody(next);
      }
      lastAppliedPartnerRef.current = partner.id;
      return next;
    });
  }, [state.partnerId, partnersById]);

  useEffect(() => {
    if (!state.assetId) {
      lastAppliedAssetRef.current = null;
      return;
    }
    const asset = assetsById.get(state.assetId);
    if (!asset) return;
    if (lastAppliedAssetRef.current === asset.id) return;
    setState((prev) => {
      if (prev.assetId !== asset.id) {
        return prev;
      }
      const patchEntries = Object.entries(
        buildAssetPatchFromOption(asset)
      ) as Array<[keyof EditorState, unknown]>;
      let changed = false;
      const next = { ...prev } as EditorState;
      for (const [key, value] of patchEntries) {
        if (prev[key] !== value) {
          (next as Record<string, unknown>)[key] = value;
          changed = true;
        }
      }
      if (!changed) {
        lastAppliedAssetRef.current = asset.id;
        return prev;
      }
      if (!bodyDirtyRef.current) {
        next.body = createTemplateBody(next);
      }
      lastAppliedAssetRef.current = asset.id;
      return next;
    });
  }, [state.assetId, assetsById]);

  useEffect(() => {
    if (!loadedDraft) return;
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(
        storageKey,
        JSON.stringify({
          __writtenContract: true,
          __bodyDirty: bodyDirtyRef.current,
          ...state,
        })
      );
    } catch (error) {
      console.warn("Nu am putut salva draftul contractului scris", error);
    }
  }, [state, storageKey, loadedDraft]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (lastUpdateFromEditor.current) {
      lastUpdateFromEditor.current = false;
      return;
    }
    editorRef.current.innerHTML = state.body;
  }, [state.body]);

  const handleEditorInput = (event: FormEvent<HTMLDivElement>) => {
    lastUpdateFromEditor.current = true;
    const html = event.currentTarget.innerHTML;
    setState((prev) => ({ ...prev, body: html }));
    if (!bodyDirtyRef.current) {
      bodyDirtyRef.current = true;
    }
    setBodyDirty(true);
  };

  const [formState, formAction] = useActionState<FormState, FormData>(
    saveWrittenContractAction,
    { ok: false }
  );

  useEffect(() => {
    if (!formState?.ok) return;
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.removeItem(PREFILL_STORAGE_KEY);
        if (formState.id) {
          window.sessionStorage.removeItem(
            `written-contract-draft-${formState.id}`
          );
        }
      } catch (error) {
        console.warn("Nu am putut curăța draftul contractului scris", error);
      }
    }
    if (formState.redirectTo) {
      window.location.href = formState.redirectTo;
    }
  }, [formState]);

  const onFieldChange =
    <K extends EditorStateKey>(key: K) =>
    (
      event: ChangeEvent<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >
    ) => {
      const rawValue = event.target.value;
      const isRelationField =
        key === "ownerId" || key === "partnerId" || key === "assetId";
      const value = isRelationField ? rawValue.trim() : rawValue;
      setState((prev) => {
        const nextValue = isRelationField && value === "" ? undefined : value;
        const next = { ...prev, [key]: nextValue } as EditorState;
        if (!bodyDirtyRef.current) {
          next.body = createTemplateBody(next);
        }
        return next;
      });
      if (key === "ownerId") {
        lastAppliedOwnerRef.current = null;
      }
      if (key === "partnerId") {
        lastAppliedPartnerRef.current = null;
      }
      if (key === "assetId") {
        lastAppliedAssetRef.current = null;
      }
    };

  const onCheckboxChange =
    (key: "signed") => (event: ChangeEvent<HTMLInputElement>) => {
      const checked = event.target.checked;
      setState((prev) => {
        const next = { ...prev, [key]: checked } as EditorState;
        if (!bodyDirtyRef.current) {
          next.body = createTemplateBody(next);
        }
        return next;
      });
    };

  const payload = useMemo(
    () => ({
      id: state.id,
      contractId: state.contractId,
      ownerId: state.ownerId,
      assetId: state.assetId,
      partnerId: state.partnerId,
      contractSignedAt: state.contractSignedAt,
      contractStartDate: state.contractStartDate,
      contractEndDate: state.contractEndDate,
      signed: state.signed,
      assetName: state.assetName,
      assetAddress: state.assetAddress,
      spaceSurface: state.spaceSurface,
      intendedUse: state.intendedUse,
      spaceUsage: state.intendedUse,
      title: state.title,
      subtitle: state.subtitle,
      documentNumber: state.documentNumber,
      documentDate: state.documentDate,
      ownerName: state.ownerName,
      ownerAddress: state.ownerAddress,
      ownerContactEmails: state.ownerContactEmails,
      ownerContactPhones: state.ownerContactPhones,
      ownerRegistration: state.ownerRegistration,
      ownerTaxId: state.ownerTaxId,
      ownerHeadOffice: state.ownerHeadOffice,
      ownerRepresentative: state.ownerRepresentative,
      ownerRepresentativeTitle: state.ownerRepresentativeTitle,
      partnerName: state.partnerName,
      partnerAddress: state.partnerAddress,
      partnerEmail: state.partnerEmail,
      partnerPhone: state.partnerPhone,
      partnerRegistration: state.partnerRegistration,
      partnerTaxId: state.partnerTaxId,
      partnerHeadOffice: state.partnerHeadOffice,
      partnerRepresentative: state.partnerRepresentative,
      partnerRepresentativeTitle: state.partnerRepresentativeTitle,
      rentAmount: state.rentAmount,
      rentAmountText: state.rentAmountText,
      tvaPercent: state.tvaPercent,
      tvaType: state.tvaType,
      invoiceIssueDay: state.invoiceIssueDay,
      monthlyInvoiceDay: state.monthlyInvoiceDay,
      invoiceMonthMode: state.invoiceMonthMode,
      monthOfRent: state.monthOfRent,
      paymentDueDays: state.paymentDueDays,
      invoiceSendChannels: state.invoiceSendChannels,
      indexingMonth: state.indexingMonth,
      bankAccount: state.bankAccount,
      bankName: state.bankName,
      guaranteeMultiplier: state.guaranteeMultiplier,
      guaranteeDueDate: state.guaranteeDueDate,
      guaranteeForms: state.guaranteeForms,
      guaranteeBoMultiplier: state.guaranteeBoMultiplier,
      utilityPaymentTerm: state.utilityPaymentTerm,
      latePaymentPenaltyPercent: state.latePaymentPenaltyPercent,
      latePaymentNotificationFee: state.latePaymentNotificationFee,
      evacuationFee: state.evacuationFee,
      storageFee: state.storageFee,
      nonPaymentTerminationDays: state.nonPaymentTerminationDays,
      dailyPenaltyAfterTermination: state.dailyPenaltyAfterTermination,
      denunciationNoticeDays: state.denunciationNoticeDays,
      denunciationLockMonths: state.denunciationLockMonths,
      denunciationPenaltyMonths: state.denunciationPenaltyMonths,
      denunciationPenaltyFixed: state.denunciationPenaltyFixed,
      abandonPenaltyDescription: state.abandonPenaltyDescription,
      overstayPenaltyPerDay: state.overstayPenaltyPerDay,
      confidentialityPenalty: state.confidentialityPenalty,
      forceMajeureNoticeDays: state.forceMajeureNoticeDays,
      signatureLocation: state.signatureLocation,
      body: state.body,
      notes: state.notes,
      correctionPercent: state.correctionPercent,
    }),
    [state]
  );

  const payloadJson = useMemo(() => JSON.stringify(payload), [payload]);

  const resolvePdfPreview = useCallback(async () => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
    const response = await fetch("/api/written-contract/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ document: payload }),
    });
    if (!response.ok) {
      let message = "Nu am putut genera PDF-ul contractului.";
      try {
        const data = await response.json();
        if (data && typeof data.error === "string") {
          message = data.error;
        }
      } catch {
        // Ignorăm erorile de parsare.
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    previewObjectUrlRef.current = objectUrl;
    return objectUrl;
  }, [payload]);

  const handlePreviewClose = useCallback(() => {
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
      previewObjectUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => handlePreviewClose(), [handlePreviewClose]);

  const handlePrint = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const printableHtml = buildPrintableDocument(state);

    const runPrintWorkflow = (
      targetWindow: Window,
      onAfterPrint?: () => void,
      onSetupError?: () => void
    ) => {
      const { document: targetDocument } = targetWindow;
      targetDocument.open();
      targetDocument.write(printableHtml);
      targetDocument.close();

      const doPrint = () => {
        try {
          targetWindow.focus();
          targetWindow.print();
        } catch (error) {
          console.error(
            "Nu am putut porni imprimarea contractului scris",
            error
          );
          onSetupError?.();
        }
      };

      const schedulePrint = () => {
        const finalize = () => {
          if (typeof targetWindow.requestAnimationFrame === "function") {
            targetWindow.requestAnimationFrame(() =>
              targetWindow.requestAnimationFrame(doPrint)
            );
          } else {
            targetWindow.setTimeout(doPrint, 50);
          }
        };

        const fonts = (
          targetDocument as Document & {
            fonts?: FontFaceSet & {
              ready?: Promise<unknown>;
            };
          }
        ).fonts;

        if (fonts && typeof fonts.ready?.then === "function") {
          fonts.ready.then(finalize).catch(finalize);
        } else {
          finalize();
        }
      };

      if (onAfterPrint) {
        targetWindow.addEventListener("afterprint", onAfterPrint, {
          once: true,
        });
      }

      let hasPrinted = false;
      const triggerOnce = () => {
        if (hasPrinted) return;
        hasPrinted = true;
        schedulePrint();
      };

      const readyState = targetDocument.readyState;
      if (readyState === "complete" || readyState === "interactive") {
        triggerOnce();
        return;
      }

      targetDocument.addEventListener("DOMContentLoaded", triggerOnce, {
        once: true,
      });
      targetWindow.addEventListener("load", triggerOnce, { once: true });
      targetWindow.setTimeout(triggerOnce, 300);
    };

    const printWindow = window.open(
      "",
      "_blank",
      "noopener=yes,width=900,height=640"
    );
    if (printWindow) {
      runPrintWorkflow(printWindow, () => {
        try {
          printWindow.close();
        } catch {
          /* noop */
        }
      });
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.top = "0";
    iframe.style.left = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const cleanup = () => {
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    };

    const iframeWindow = iframe.contentWindow;
    if (!iframeWindow) {
      cleanup();
      console.error("Nu am putut pregăti documentul pentru tipărire.");
      return;
    }

    runPrintWorkflow(
      iframeWindow,
      () => cleanup(),
      () => cleanup()
    );
  }, [state]);

  const formattedUpdatedAt = formatUpdatedAt(initialDocument?.updatedAt);
  const ownerLocked = Boolean(state.ownerId);
  const assetLocked = Boolean(state.assetId);
  const partnerLocked = Boolean(state.partnerId);

  return (
    <form action={formAction} className="space-y-6" autoComplete="off">
      <input type="hidden" name="payload" value={payloadJson} />

      {formState.message && !formState.ok ? (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700">
          {formState.message}
        </div>
      ) : null}

      <div className="flex flex-col gap-6 xl:h-[calc(100vh-12rem)] xl:flex-row-reverse xl:items-stretch xl:overflow-hidden">
        <aside className="space-y-4 xl:basis-2/5 xl:max-w-[40%] xl:overflow-y-auto xl:pr-2 xl:[scrollbar-gutter:stable]">
          {initialDocument ? (
            <div className="rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-xs text-foreground/70">
              {formattedUpdatedAt
                ? `Ultima actualizare: ${formattedUpdatedAt}`
                : "Document existent"}
            </div>
          ) : (
            <div className="rounded-md border border-foreground/10 bg-foreground/5 px-3 py-2 text-xs text-foreground/70">
              Completează câmpurile și apasă „Salvează documentul” pentru a
              păstra această versiune în arhivă.
            </div>
          )}

          {state.contractId ? (
            <Link
              href={`/contracts/${encodeURIComponent(state.contractId)}`}
              className="block rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/5"
            >
              Vezi contractul asociat
            </Link>
          ) : null}

          <section className="space-y-3 rounded-lg border border-foreground/10 bg-background/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Proprietar
            </h3>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Selectează proprietarul
              </label>
              <select
                value={state.ownerId ?? ""}
                onChange={onFieldChange("ownerId")}
                disabled={owners.length === 0}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {owners.length === 0
                    ? "Nu există proprietari disponibili"
                    : "Alege un proprietar"}
                </option>
                {owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-foreground/60">
                {owners.length === 0
                  ? "Nu există proprietari salvați în baza de date. Adaugă unul din Admin → Proprietari."
                  : "Câmpurile de mai jos se completează automat din datele proprietarului selectat."}
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Denumire legală
              </label>
              <input
                value={state.ownerName}
                onChange={onFieldChange("ownerName")}
                readOnly={ownerLocked}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Reprezentant
              </label>
              <input
                value={state.ownerRepresentative}
                onChange={onFieldChange("ownerRepresentative")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Titlu reprezentant
              </label>
              <input
                value={state.ownerRepresentativeTitle}
                onChange={onFieldChange("ownerRepresentativeTitle")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Nr. ORC
              </label>
              <input
                value={state.ownerRegistration}
                onChange={onFieldChange("ownerRegistration")}
                readOnly={ownerLocked}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                CIF
              </label>
              <input
                value={state.ownerTaxId}
                onChange={onFieldChange("ownerTaxId")}
                readOnly={ownerLocked}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Sediu
              </label>
              <textarea
                rows={2}
                value={state.ownerHeadOffice}
                onChange={onFieldChange("ownerHeadOffice")}
                readOnly={ownerLocked}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Email-uri
              </label>
              <input
                value={state.ownerContactEmails}
                onChange={onFieldChange("ownerContactEmails")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Telefoane
              </label>
              <input
                value={state.ownerContactPhones}
                onChange={onFieldChange("ownerContactPhones")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Adresă corespondență
              </label>
              <textarea
                rows={2}
                value={state.ownerAddress}
                onChange={onFieldChange("ownerAddress")}
                readOnly={ownerLocked}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-foreground/10 bg-background/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Chiriaș
            </h3>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Selectează chiriașul
              </label>
              <select
                value={state.partnerId ?? ""}
                onChange={onFieldChange("partnerId")}
                disabled={partners.length === 0}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {partners.length === 0
                    ? "Nu există chiriași disponibili"
                    : "Alege un chiriaș"}
                </option>
                {partners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-foreground/60">
                {partners.length === 0
                  ? "Nu există chiriași salvați în baza de date. Adaugă unul din Admin → Parteneri."
                  : "Câmpurile de mai jos se completează automat din datele chiriașului selectat."}
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Denumire legală
              </label>
              <input
                value={state.partnerName}
                onChange={onFieldChange("partnerName")}
                readOnly={partnerLocked}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Reprezentant
              </label>
              <input
                value={state.partnerRepresentative}
                onChange={onFieldChange("partnerRepresentative")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Titlu reprezentant
              </label>
              <input
                value={state.partnerRepresentativeTitle}
                onChange={onFieldChange("partnerRepresentativeTitle")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  J / ORC
                </label>
                <input
                  value={state.partnerRegistration}
                  onChange={onFieldChange("partnerRegistration")}
                  readOnly={partnerLocked}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  CUI
                </label>
                <input
                  value={state.partnerTaxId}
                  onChange={onFieldChange("partnerTaxId")}
                  readOnly={partnerLocked}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Email
              </label>
              <input
                value={state.partnerEmail}
                onChange={onFieldChange("partnerEmail")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Telefon
              </label>
              <input
                value={state.partnerPhone}
                onChange={onFieldChange("partnerPhone")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Sediu
              </label>
              <textarea
                rows={2}
                value={state.partnerHeadOffice}
                onChange={onFieldChange("partnerHeadOffice")}
                readOnly={partnerLocked}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Adresă corespondență
              </label>
              <textarea
                rows={2}
                value={state.partnerAddress}
                onChange={onFieldChange("partnerAddress")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </section>
          <section className="space-y-3 rounded-lg border border-foreground/10 bg-background/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Spațiu
            </h3>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Selectează spațiul
              </label>
              <select
                value={state.assetId ?? ""}
                onChange={onFieldChange("assetId")}
                disabled={assets.length === 0}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <option value="">
                  {assets.length === 0
                    ? "Nu există spații disponibile"
                    : "Alege un spațiu"}
                </option>
                {assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-foreground/60">
                {assets.length === 0
                  ? "Nu există spații salvate în baza de date. Adaugă unul din Admin → Assets."
                  : "Câmpurile de mai jos se completează automat din datele spațiului selectat."}
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Denumire spațiu
              </label>
              <input
                value={state.assetName ?? ""}
                onChange={onFieldChange("assetName")}
                readOnly={assetLocked}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Suprafață
                </label>
                <input
                  value={state.spaceSurface}
                  onChange={onFieldChange("spaceSurface")}
                  readOnly={assetLocked}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Destinație spațiu
                </label>
                <input
                  value={state.intendedUse}
                  onChange={onFieldChange("intendedUse")}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Adresă spațiu
              </label>
              <textarea
                rows={2}
                value={state.assetAddress ?? ""}
                onChange={onFieldChange("assetAddress")}
                readOnly={assetLocked}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </section>
          <section className="space-y-3 rounded-lg border border-foreground/10 bg-background/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Contract
            </h3>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                ID contract
              </label>
              <input
                value={state.contractId ?? ""}
                onChange={onFieldChange("contractId")}
                placeholder="c-1234"
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Data semnării
              </label>
              <input
                type="date"
                value={formatDateInput(state.contractSignedAt)}
                onChange={onFieldChange("contractSignedAt")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-foreground/70">
                <input
                  type="checkbox"
                  checked={state.signed}
                  onChange={onCheckboxChange("signed")}
                  className="h-4 w-4 rounded border border-foreground/30 bg-transparent"
                />
                Contract semnat
              </label>
              <p className="text-[11px] text-foreground/60">
                Marchează dacă documentul are toate semnăturile necesare.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Data început
                </label>
                <input
                  type="date"
                  value={formatDateInput(state.contractStartDate)}
                  onChange={onFieldChange("contractStartDate")}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Data sfârșit
                </label>
                <input
                  type="date"
                  value={formatDateInput(state.contractEndDate)}
                  onChange={onFieldChange("contractEndDate")}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Număr document
              </label>
              <input
                value={state.documentNumber}
                onChange={onFieldChange("documentNumber")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Data document
              </label>
              <input
                type="date"
                value={formatDateInput(state.documentDate)}
                onChange={onFieldChange("documentDate")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-foreground/10 bg-background/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Chirie & facturare
            </h3>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Suma chirie (afișare)
              </label>
              <input
                value={state.rentAmountText}
                onChange={onFieldChange("rentAmountText")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  TVA (%)
                </label>
                <input
                  value={state.tvaPercent}
                  onChange={onFieldChange("tvaPercent")}
                  placeholder="ex: 19"
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Tip TVA
                </label>
                <input
                  value={state.tvaType}
                  onChange={onFieldChange("tvaType")}
                  placeholder="ex: fără drept de deducere (f.d.d.)"
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Zi emitere factură
                </label>
                <input
                  value={state.invoiceIssueDay}
                  onChange={onFieldChange("invoiceIssueDay")}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Termen plată (zile)
                </label>
                <input
                  value={state.paymentDueDays}
                  onChange={onFieldChange("paymentDueDays")}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Luna facturată
              </label>
              <select
                value={state.invoiceMonthMode}
                onChange={onFieldChange("invoiceMonthMode")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              >
                <option value="">Selectează</option>
                <option value="current">Luna curentă</option>
                <option value="next">Luna următoare</option>
              </select>
              <p className="text-[11px] text-foreground/60">
                „Luna curentă” = luna în curs; „Luna următoare” = facturare în
                avans.
              </p>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                IBAN proprietar
              </label>
              <input
                value={state.bankAccount}
                onChange={onFieldChange("bankAccount")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Bancă proprietar
              </label>
              <input
                value={state.bankName}
                onChange={onFieldChange("bankName")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-foreground/10 bg-background/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Garanții & penalități
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Garanție (x chirie)
                </label>
                <input
                  value={state.guaranteeMultiplier}
                  defaultValue={3}
                  onChange={onFieldChange("guaranteeMultiplier")}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Bilete la ordin (x chirie)
                </label>
                <input
                  value={state.guaranteeBoMultiplier}
                  onChange={onFieldChange("guaranteeBoMultiplier")}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Termen constituire garanție
              </label>
              <input
                value={state.guaranteeDueDate}
                onChange={onFieldChange("guaranteeDueDate")}
                placeholder="01.02.2026"
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Forme garanție
              </label>
              <input
                value={state.guaranteeForms}
                onChange={onFieldChange("guaranteeForms")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Penalizare notificare
                </label>
                <input
                  value={state.latePaymentNotificationFee}
                  onChange={onFieldChange("latePaymentNotificationFee")}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground/60">
                  Penalizare zilnică (%)
                </label>
                <input
                  value={state.latePaymentPenaltyPercent}
                  onChange={onFieldChange("latePaymentPenaltyPercent")}
                  className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Zile până la reziliere automată
              </label>
              <input
                value={state.nonPaymentTerminationDays}
                onChange={onFieldChange("nonPaymentTerminationDays")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Taxă eliberare spațiu
              </label>
              <input
                value={state.evacuationFee}
                onChange={onFieldChange("evacuationFee")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Taxă depozitare
              </label>
              <input
                value={state.storageFee}
                onChange={onFieldChange("storageFee")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Penalizare post-încetare (refuz părăsire după termenul
                contractual)
              </label>
              <input
                value={state.dailyPenaltyAfterTermination}
                onChange={onFieldChange("dailyPenaltyAfterTermination")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Notificare denunțare unilaterală (zile)
              </label>
              <input
                value={state.denunciationNoticeDays}
                onChange={onFieldChange("denunciationNoticeDays")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Blocaj luni
              </label>
              <input
                value={state.denunciationLockMonths}
                onChange={onFieldChange("denunciationLockMonths")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Penalitate denunțare (luni)
              </label>
              <input
                value={state.denunciationPenaltyMonths}
                onChange={onFieldChange("denunciationPenaltyMonths")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Descriere penalitate abandon
              </label>
              <textarea
                rows={2}
                value={state.abandonPenaltyDescription}
                onChange={onFieldChange("abandonPenaltyDescription")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Penalitate fixă denunțare
              </label>
              <input
                value={state.denunciationPenaltyFixed}
                onChange={onFieldChange("denunciationPenaltyFixed")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Penalizare confidențialitate
              </label>
              <input
                value={state.confidentialityPenalty}
                onChange={onFieldChange("confidentialityPenalty")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-foreground/10 bg-background/60 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground/60">
              Note & diverse
            </h3>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Semnare în (locație)
              </label>
              <input
                value={state.signatureLocation}
                onChange={onFieldChange("signatureLocation")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Termen notificare forță majoră (zile)
              </label>
              <input
                value={state.forceMajeureNoticeDays}
                onChange={onFieldChange("forceMajeureNoticeDays")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-foreground/60">
                Note interne
              </label>
              <textarea
                rows={4}
                value={state.notes}
                onChange={onFieldChange("notes")}
                className="w-full rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
              />
            </div>
          </section>
        </aside>

        <section className="flex-1 space-y-4 xl:basis-3/5 xl:max-w-[60%] xl:overflow-y-auto xl:pl-2 xl:[scrollbar-gutter:stable]">
          <div className="rounded-xl border border-foreground/10 bg-white text-zinc-900 shadow-md">
            <div className="space-y-3 border-b border-foreground/10 bg-foreground/5 px-6 py-5">
              <div className="rounded-md border border-foreground/10 bg-white/75 px-4 py-3 text-xs text-foreground/70 shadow-sm backdrop-blur">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-[180px] flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/45">
                      Locator
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground/90">
                      {state.ownerName || "—"}
                    </p>
                    {state.ownerRepresentative ||
                    state.ownerRepresentativeTitle ? (
                      <p className="mt-1 text-[11px] text-foreground/60">
                        {state.ownerRepresentative || "—"}
                        {state.ownerRepresentativeTitle ? (
                          <span className="text-foreground/50">
                            {state.ownerRepresentative ? " · " : ""}
                            {state.ownerRepresentativeTitle}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-foreground/55">
                      {state.ownerRegistration ? (
                        <span className="whitespace-nowrap">
                          ORC{" "}
                          <span className="font-medium text-foreground/75">
                            {state.ownerRegistration}
                          </span>
                        </span>
                      ) : null}
                      {state.ownerTaxId ? (
                        <span className="whitespace-nowrap">
                          CIF{" "}
                          <span className="font-medium text-foreground/75">
                            {state.ownerTaxId}
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 text-[12px] text-foreground/75 sm:grid-cols-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/45">
                      Sediu social
                    </p>
                    <p className="mt-1 leading-snug">
                      {state.ownerHeadOffice || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/45">
                      Adresă corespondență
                    </p>
                    <p className="mt-1 leading-snug">
                      {state.ownerAddress || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/45">
                      Contact
                    </p>
                    <div className="mt-1 space-y-1 leading-snug">
                      {state.ownerContactEmails ? (
                        <p
                          className="truncate"
                          title={state.ownerContactEmails}
                        >
                          {state.ownerContactEmails}
                        </p>
                      ) : null}
                      {state.ownerContactPhones ? (
                        <p
                          className="truncate"
                          title={state.ownerContactPhones}
                        >
                          {state.ownerContactPhones}
                        </p>
                      ) : null}
                      {!state.ownerContactEmails &&
                      !state.ownerContactPhones ? (
                        <p>—</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
              <input
                value={state.title}
                onChange={onFieldChange("title")}
                placeholder="CONTRACT DE ÎNCHIRIERE"
                className="w-full rounded-md border border-transparent bg-transparent text-lg font-semibold outline-none focus:border-foreground/30 focus:bg-white/40"
              />
              <input
                value={state.subtitle}
                onChange={onFieldChange("subtitle")}
                placeholder="Proprietar · Chiriaș"
                className="w-full rounded-md border border-transparent bg-transparent text-sm text-foreground/60 outline-none focus:border-foreground/30 focus:bg-white/40"
              />
              <div className="flex flex-wrap gap-4">
                <label className="flex min-w-[180px] flex-1 flex-col text-xs font-medium text-foreground/60">
                  Număr document
                  <input
                    value={state.documentNumber}
                    onChange={onFieldChange("documentNumber")}
                    className="mt-1 rounded-md border border-foreground/20 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex min-w-[160px] flex-col text-xs font-medium text-foreground/60">
                  Data documentului
                  <input
                    type="date"
                    value={formatDateInput(state.documentDate)}
                    onChange={onFieldChange("documentDate")}
                    className="mt-1 rounded-md border border-foreground/20 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
            <div className="px-6 py-6 md:px-8 md:py-8">
              <div
                ref={editorRef}
                className="min-h-[520px] whitespace-pre-wrap leading-7 text-[15px] outline-none"
                contentEditable
                suppressContentEditableWarning
                onInput={handleEditorInput}
                aria-label="Conținut contract scris"
              />
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-foreground/10 pt-4">
        <p className="text-sm text-foreground/60">
          {formState.ok
            ? "Contractul scris a fost salvat."
            : "Modificările sunt păstrate doar după ce apeși „Salvează documentul”."}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
            title="Printează contractul scris"
          >
            Printează
          </button>
          <PdfModal
            resolveUrl={resolvePdfPreview}
            onClose={handlePreviewClose}
            buttonLabel="Previzualizează PDF"
            buttonTitle="Previzualizează contractul scris"
            title="Contract scris"
            resolveErrorMessage="Nu am putut genera PDF-ul contractului."
          />
          <Link
            href="/admin/written-contracts"
            className="rounded-md border border-foreground/20 px-3 py-2 text-sm font-medium text-foreground hover:bg-foreground/5"
          >
            Arhiva contracte scrise
          </Link>
          <SaveButton label="Salvează documentul" />
        </div>
      </div>
    </form>
  );
}
