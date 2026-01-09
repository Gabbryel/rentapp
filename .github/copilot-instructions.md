# Copilot: how to work in this repo

This is a Next.js 15 app-router project for managing rental contracts and invoices. MongoDB is optional; in dev it falls back to local JSON files and public uploads.

## Big picture

- Structure: `app/**` (server-first pages, server actions), `app/api/**` (route handlers), `lib/**` (domain logic), `components/**` (client UI).
- Data flow: UI → server actions/route handlers → `lib/**` → MongoDB or `.data/*.json`. PDFs/uploads → GridFS if Mongo is on, else `public/uploads/*`.
- Auth: simple email+password (sha256+salt) with session cookie `session`. Admin = `user.isAdmin` or `ADMIN_EMAILS` env.
- Invoices are implemented inside `lib/contracts.ts`; `lib/invoices.ts` only re-exports.

## Storage & env

- Mongo: set `MONGODB_URI` (and optionally `MONGODB_DB`). DB name is derived from URI if missing (`lib/mongodb.ts`).
- Local dev fallback files (via `lib/local-store.ts`): `.data/contracts.json`, `.data/invoices.json`, `.data/invoice_settings.json`, `.data/deposits.json`.
- Uploads: `lib/storage.ts` uses GridFS bucket `uploads` when Mongo exists, else writes to `public/uploads/`.
- Exchange rates: `lib/exchange.ts` stores daily BNR EUR/RON in `exchange_rates` (doc: `{ key:"EURRON", date:"YYYY-MM-DD", rate }`). Cron: `/api/cron/exchange-refresh` (guard with `CRON_SECRET`).

## Domain conventions that matter

- Contract schema: see `lib/schemas/contract.ts`. Monthly vs yearly billing; `invoiceMonthMode` ('current' | 'next'); `monthlyInvoiceDay`; `yearlyInvoices`.
- Advance billing rules: `lib/advance-billing.ts::computeNextMonthProration` for `invoiceMonthMode = "next"`:
  - Exclude if no overlap with next month, or if the contract ends on day 1–2 of next month.
  - Prorate if it ends mid–next month; full if covers the whole next month.
- Invoice flow: `computeInvoiceFromContract` → `issueInvoiceAndGeneratePdf` → PDF via `saveBufferAsUpload` → `invalidateYearInvoicesCache`.
  - Invoice `id` equals the invoice number; allocate via `allocateInvoiceNumberForOwner` (`lib/invoice-settings.ts`).
- Yearly invoice aggregation uses a simple in-memory TTL cache in `lib/contracts.ts`; invalidate after issue/delete.
- Legacy “indexing notifications” are deprecated; ignore old fields where present.

## Routing, auth, access

- `middleware.ts` protects all paths except public assets and `/login`, `/register`, `/api/me`, `/api/logout`.
- It calls `/api/me` to resolve session and admin; non-admins are rewritten to `/unauthorized`.
- `/api/me` also refreshes rolling session expiry (14 days) and cookie maxAge on access.

## UI + server actions patterns

- Prefer server actions inside server components (see `app/page.tsx`). Avoid `dynamic(..., { ssr:false })` in server components.
- `components/action-button.tsx` is the standard submitter: shows toast, emits optional optimistic stats via `data-delta-*`, then `router.refresh()`.
- Home `app/page.tsx` shows issuing/deleting invoices with server actions and proration handling.

## Developer workflows

- Dev: `npm run dev` (Turbopack). Build: `npm run build`. Start: `npm start`.
- Seed/sample: `npm run db:seed:mongo`, `npm run db:count`, `npm run db:sample`.
- Utilities/migrations (TS via tsx): e.g. `npm run partners:backfill`, `npm run migrate:contracts:rename-fields`.
- Tests are lightweight TS scripts in `__tests__/` (no Jest config checked in). Examples:
  - `tsx __tests__/fetch-contracts-by-assetid.test.ts`
  - `tsx __tests__/deposits.test.ts`
  - `node --loader tsx/esm __tests__/invoice-month-mode-runner.ts`

## Integration snippets

- DB: `const db = await getDb()` (`lib/mongodb.ts` derives name and pings admin).
- Contracts: `await upsertContract(contract)` recomputes schedule metadata and rent history.
- Exchange: `const { rate } = await getDailyEurRon({ forceRefresh: true })` (cached in Mongo when available).
- Tests: many `lib/**` functions accept an injected DB (e.g., `fetchContractsByAssetId(assetId, injectedDb)`).

Questions or gaps (e.g., invoice numbering nuances, new API routes, or edge-cases around advance billing)? Ask and we’ll expand these notes.

## Copilot instructions for this repo

Ask yourself if you understand the task! If not, ask for clarification.