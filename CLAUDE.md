# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (Next.js + Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Vitest (runs __tests__/**/*.test.ts, excludes legacy runners)
npm run test:watch   # Vitest in watch mode

# Legacy test scripts (not yet migrated to vitest — run directly with tsx):
tsx __tests__/custom-period-invoice.test.ts
tsx __tests__/effective-end-date.test.ts
tsx __tests__/fetch-contracts-by-assetid.test.ts
tsx __tests__/invoice-numbering.test.ts
node --loader tsx/esm __tests__/invoice-month-mode-runner.ts

# DB utilities (require .env.local with MONGODB_URI):
npm run db:seed:mongo      # Seed MongoDB with sample contracts
npm run db:count           # Print collection counts
npm run db:sample          # Print sample docs per collection

# One-off migration scripts (tsx):
npm run migrate:contracts:rename-fields
npm run migrate:contracts:normalize-history
npm run migrate:contracts:extensions
```

## Architecture

### Storage layer

`MONGODB_URI` in `.env.local` switches every lib module between MongoDB and local JSON:
- **MongoDB** (`lib/mongodb.ts`): single `getDb()` export, connection pooled in `global._mongoDb`. DB name derived from URI path or `MONGODB_DB` env, defaults to `rentapp`.
- **Local fallback** (`lib/local-store.ts`): reads/writes `.data/*.json`. Throws in `NODE_ENV=production`.
- **Uploads** (`lib/storage.ts`): GridFS bucket `uploads` when Mongo is set, else `public/uploads/`.
- **Collection names** use underscores: `written_contracts`, `exchange_rates`, `audit_logs`, etc.

### Domain model

All schemas are in `lib/schemas/` (Zod). The most important is `lib/schemas/contract.ts`:
- `rentType`: `"monthly"` or `"yearly"`
- `invoiceMonthMode`: `"current"` (default) or `"next"` — `"next"` means the invoice is issued in month M to cover month M+1 (advance billing)
- `indexingDates[]`: array of `{ forecastDate, actualDate?, newRentAmount?, done }` — **this is how rent amounts are stored**. `rentAmountAtDate(contract, iso)` finds the applicable entry by date. An empty `indexingDates` means no rent amount is configured.
- `monthlyInvoiceDay`: day of month the invoice is issued
- `correctionPercent`: markup applied before TVA
- `mementos[]`: reminders to bill additional items (utilities, etc.)
- Contract extensions tracked in `contractExtensions[]`; `effectiveEndDate(contract)` resolves the true end date accounting for extensions and early termination.

### Invoice flow

1. `prepareInvoicePreview()` (`lib/invoice-custom-period.ts`) — builds an `Invoice` object and computes proration. **Throws** if `rentAmountAtDate` returns `undefined`. Always wrap in try/catch at call sites.
2. `issueInvoiceAndGeneratePdf()` (`lib/contracts.ts`) — persists the invoice and generates a PDF via `pdf-lib`.
3. Invoice ID = invoice number; allocated by `allocateInvoiceNumberForOwner()` (`lib/invoice-settings.ts`).
4. After issue/delete, call `invalidateYearInvoicesCache()` to clear the in-memory TTL cache.

Advance billing rules live in `lib/advance-billing.ts::computeNextMonthProration`. For `invoiceMonthMode = "next"`, the monthly page (`app/invoices/monthly/page.tsx`) checks next-month overlap (not current-month) when deciding whether to show the contract.

### Written contracts → Contracts

Written contracts (legal document store) live in `written_contracts` collection. The `generateContractFromWrittenContractAction` (`app/admin/written-contracts/actions.ts`) generates a linked `Contract` from a `WrittenContract`. Rent amount is read from `wc.rentAmount` with fallback to `wc.rentAmountText` (the schema stores them separately).

### Auth

`lib/auth.ts` uses `bcryptjs` (cost 12). Legacy sha256 hashes are detected by absence of `$2` prefix and migrated to bcrypt on first successful login. Admin access = `user.isAdmin` flag or `ADMIN_EMAILS` env var. Session cookie `session` is a random token; rolling 14-day expiry refreshed by `/api/me`.

`middleware.ts` protects all routes except public assets, `/login`, `/register`, `/api/me`, `/api/logout`. Non-admins hitting admin routes are rewritten to `/unauthorized`.

### Real-time toasts

`lib/sse.ts` provides an in-process pub/sub hub. `publishToast(message, kind)` broadcasts to all connected clients via SSE at `/api/stream`. This is single-instance only — not suitable for multi-replica deployments without a shared broker.

### UI patterns

- Server components with inline `"use server"` action functions (one file per page). Client toggle/editor components (e.g. `InvoiceDayEditor`, `StartDateEditor`) receive server actions as props.
- `app/components/action-button.tsx` — standard submit button: fires toast on complete, optionally emits `data-delta-*` attributes for optimistic stats updates, then calls `router.refresh()`.
- `app/components/confirm-submit.tsx` — same as above but shows a confirmation dialog first.
- Exchange rates shown via `getDailyEurRon()` (`lib/exchange.ts`); BNR rate refreshed by cron at `/api/cron/exchange-refresh` (guarded by `CRON_SECRET` env).

## Key env vars

| Var | Purpose |
|-----|---------|
| `MONGODB_URI` | MongoDB connection string (required in production) |
| `MONGODB_DB` | DB name override (derived from URI if absent) |
| `ADMIN_EMAILS` | Comma-separated emails with admin access |
| `CRON_SECRET` | Auth header for cron endpoints |
| `SMTP_*` | Nodemailer config for email |
| `BILLING_TIMEZONE` | Timezone for billing date calculation (default: `Europe/Bucharest`) |
