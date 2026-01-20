/**
 * @deprecated Legacy module - delegates to @/lib/invoices/numbering
 * Import from @/lib/invoices instead
 */
import {
  allocateInvoiceNumber,
  getInvoiceSettings,
  saveInvoiceSettings,
} from "@/lib/invoices/numbering";

/** @deprecated Use allocateInvoiceNumber from @/lib/invoices */
export async function allocateInvoiceNumberForOwner(
  ownerId?: string | null,
  ownerName?: string | null
): Promise<string> {
  return allocateInvoiceNumber(ownerId, ownerName);
}

/** @deprecated Use getInvoiceSettings from @/lib/invoices */
export async function getInvoiceSettingsForOwner(
  ownerId?: string | null,
  ownerName?: string | null
) {
  return getInvoiceSettings(ownerId, ownerName);
}

/** @deprecated Use saveInvoiceSettings from @/lib/invoices */
export async function saveInvoiceSettingsForOwner(
  ownerId: string | undefined | null,
  ownerName: string | undefined | null,
  input: any
) {
  return saveInvoiceSettings(ownerId, ownerName, input);
}
