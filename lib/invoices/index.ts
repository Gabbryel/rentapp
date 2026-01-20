/**
 * Invoice Module - Public API
 * 
 * Clean exports for all invoice-related functionality.
 * Use these exports in application code instead of importing from submodules.
 */

// Issuance
export { issueInvoice, deleteInvoice } from "./issue";

// Queries
export {
  findInvoiceById,
  findInvoiceByContractAndDate,
  findInvoiceByContractPartnerAndDate,
  listInvoicesForContract,
  listInvoicesForMonth,
  fetchInvoicesForYear,
  invalidateYearInvoicesCache,
} from "./queries";

// Numbering & Settings
export { allocateInvoiceNumber, getInvoiceSettings, saveInvoiceSettings } from "./numbering";

// PDF
export { renderInvoicePdf } from "./pdf";
