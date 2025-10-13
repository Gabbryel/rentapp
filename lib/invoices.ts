// This module is now a thin shim that re-exports invoice functionality
// from the contracts module. This keeps existing imports working while
// consolidating implementation under the contract model.
export {
  createInvoice,
  fetchInvoicesByContract,
  fetchInvoicesByPartner,
  fetchInvoiceById,
  updateInvoiceNumber,
  deleteInvoiceById,
  computeInvoiceFromContract,
  renderInvoicePdf,
  issueInvoiceAndGeneratePdf,
  listInvoicesForContract,
  findInvoiceByContractAndDate,
  listInvoicesForMonth,
  fetchInvoicesForYear,
  invalidateYearInvoicesCache,
  fetchInvoicesForYearFresh,
} from "@/lib/contracts";
