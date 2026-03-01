# Custom-Period Invoice Mode — Implementation Prompt

Implement an optional **custom-period mode** in the existing invoice issuing flow for this Next.js rental app, without replacing the current default flow.

## Goal

Add a way to issue rent invoices for a custom period (`from_date`, `to_date`) while preserving current scheduling behavior and numbering.

## Functional requirements

1. Extend the existing issue flow with an **Edit/Customize** action that opens a modal.
2. Modal supports:
   - `from_date` (required)
   - `to_date` (required, **inclusive**)
   - `amount` (auto-computed but editable override)
   - preview trigger (mandatory before final issue)
3. Keep the current issue flow available unchanged for normal usage.
4. Custom invoice period uses **calendar-day proration**.
5. **No overlapping invoice periods** for the same contract and charge type (rent). Block issuance with clear errors.
6. Custom invoices do not change future schedule metadata directly, but default issuing must account for already invoiced days:
   - Example: invoice issued on Feb 26 for Mar 15–Apr 15.
   - On Mar 20 default issue for April cycle, issue only the **remaining uninvoiced part** of April (Apr 16–Apr 30).
7. Scope is **rent only** for now.
8. Taxes/VAT rules are inherited from contract/owner exactly as existing invoice logic does.
9. Exchange rate date is `from_date` (no manual override).
10. Continue using current invoice numbering and identity rules (`id === invoice number`).
11. Add a flag to identify invoice type, e.g. `kind: "standard" | "custom_period"` (or equivalent).
12. Keep notifications behavior same as current issuing flow.
13. PDF format does not need visual changes, but must include correct period and totals.
14. Add strong validation + user-facing error messages for:
    - missing/invalid dates
    - `from_date > to_date`
    - overlap conflicts
    - duplicate submission/idempotency
15. Preview is required: final issue action disabled until preview succeeds.

## Data model & auditing

1. Add additive fields for custom period metadata on invoice records (backward compatible).
2. Record full audit trail for custom issuance:
   - who issued
   - when
   - computed amount
   - manual overridden amount (if changed)
   - reason/source (custom-period modal)
3. Ensure idempotency protection for repeated submit/retry.

## Computation rules

1. `to_date` is inclusive in day count.
2. Auto amount = rent prorated by number of billable days in selected period using calendar dates.
3. For default issuing, compute billable coverage for target period minus days already invoiced by prior custom/standard invoices, then invoice only remainder.
4. Do not allow negative remainder; if fully covered, show "nothing left to invoice".

## API/UX behavior

1. Use modal in the existing issuing UI (no extra page unless absolutely required by architecture).
2. Preview response should include:
   - effective covered dates
   - days billed
   - computed amount
   - VAT/tax breakdown
   - exchange rate used and date
3. Final issue uses previewed values with server-side revalidation before persist.

## Non-functional constraints

1. Minimal, additive changes aligned with current architecture and coding style.
2. Keep backward compatibility with existing invoices and issuance paths.
3. Avoid introducing unrelated refactors.

## Deliverables

1. UI modal + server action/API support.
2. Domain logic updates for overlap detection and remainder computation.
3. Data persistence updates for custom-period metadata and audit trail.
4. Validation and idempotency safeguards.
5. Focused tests for:
   - inclusive end date math
   - overlap rejection
   - partial pre-billed month remainder issuance
   - full coverage -> zero remainder
   - manual amount override audit capture

## Acceptance examples

1. Given no prior invoices, custom Mar 10–Mar 20 issues correctly with inclusive 11 days.
2. Given prior invoice covering Apr 1–Apr 15, default April issue bills only Apr 16–Apr 30.
3. Given attempted overlap with existing Apr 10–Apr 25 invoice, issuance is blocked with explicit overlap error.
4. Given preview not run, final issue is blocked.
5. Given double submit, only one invoice is persisted.
