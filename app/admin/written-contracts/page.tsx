import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { listWrittenContracts } from "@/lib/written-contracts";
import type { WrittenContract } from "@/lib/schemas/written-contract";
import { DeleteWrittenContractButton } from "./delete-button";
import { WrittenContractPreviewButton } from "./preview-button";

export const dynamic = "force-dynamic";

type DocumentStatus = "draft" | "upcoming" | "active" | "ended";

type StatusMeta = {
  label: string;
  badgeClass: string;
};

const STATUS_META: Record<DocumentStatus, StatusMeta> = {
  draft: {
    label: "Fără perioadă",
    badgeClass:
      "border border-foreground/15 bg-foreground/5 text-foreground/60",
  },
  upcoming: {
    label: "Urmează",
    badgeClass:
      "border border-foreground/20 bg-foreground/5 text-foreground/70",
  },
  active: {
    label: "Activ",
    badgeClass:
      "border border-emerald-500/30 bg-emerald-500/15 text-emerald-700",
  },
  ended: {
    label: "Încheiat",
    badgeClass:
      "border border-foreground/15 bg-foreground/5 text-foreground/60",
  },
};

const DATE_FORMATTER = new Intl.DateTimeFormat("ro-RO", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ro-RO", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function resolveStatus(document: WrittenContract, now: Date): DocumentStatus {
  const start = document.contractStartDate
    ? new Date(document.contractStartDate)
    : null;
  const end = document.contractEndDate
    ? new Date(document.contractEndDate)
    : null;
  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  ) {
    return "draft";
  }
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "active";
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return DATE_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return DATE_TIME_FORMATTER.format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatPeriod(document: WrittenContract): string {
  const hasStart = Boolean(document.contractStartDate);
  const hasEnd = Boolean(document.contractEndDate);
  if (hasStart && hasEnd) {
    return `${formatDate(document.contractStartDate)} → ${formatDate(
      document.contractEndDate
    )}`;
  }
  if (hasStart) return formatDate(document.contractStartDate);
  if (hasEnd) return formatDate(document.contractEndDate);
  return "—";
}

function isSameMonth(iso: string | undefined, reference: Date): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth()
  );
}

export default async function AdminWrittenContractsPage() {
  noStore();
  const documents = await listWrittenContracts();
  const now = new Date();

  const enriched = documents
    .map((document) => ({
      document,
      status: resolveStatus(document, now),
      updatedAtMs: (() => {
        const date = new Date(document.updatedAt);
        const time = date.getTime();
        return Number.isNaN(time) ? 0 : time;
      })(),
    }))
    .sort((a, b) => {
      return b.updatedAtMs - a.updatedAtMs;
    });

  const stats = documents.reduce(
    (acc, doc) => {
      acc.total += 1;
      if (doc.contractId) acc.linked += 1;
      else acc.standalone += 1;
      if (isSameMonth(doc.updatedAt, now)) acc.updatedThisMonth += 1;
      return acc;
    },
    { total: 0, linked: 0, standalone: 0, updatedThisMonth: 0 }
  );

  const statusCounts = enriched.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { draft: 0, upcoming: 0, active: 0, ended: 0 } as Record<
      DocumentStatus,
      number
    >
  );

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold tracking-tight">
            Contracte scrise
          </h1>
          <p className="mt-1 text-sm text-foreground/60 max-w-2xl">
            Documente scrise generate și salvate în aplicație. Folosește
            editorul pentru a actualiza conținutul și a păstra istoricul
            fiecărui contract.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href="/contracts/written-contract"
            className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs sm:text-sm font-semibold text-foreground hover:bg-foreground/5"
          >
            Deschide generatorul gol
          </Link>
          <Link
            href="/contracts"
            className="rounded-md bg-foreground px-3 py-1.5 text-xs sm:text-sm font-semibold text-background hover:bg-foreground/90"
          >
            Vezi lista de contracte
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-foreground/15 bg-background/60 p-4">
          <p className="text-xs text-foreground/60">Total documente</p>
          <p className="mt-2 text-2xl font-semibold">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-foreground/15 bg-background/60 p-4">
          <p className="text-xs text-foreground/60">Cu contract asociat</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-600">
            {stats.linked}
          </p>
        </div>
        <div className="rounded-lg border border-foreground/15 bg-background/60 p-4">
          <p className="text-xs text-foreground/60">Standalone</p>
          <p className="mt-2 text-2xl font-semibold text-blue-600">
            {stats.standalone}
          </p>
        </div>
        <div className="rounded-lg border border-foreground/15 bg-background/60 p-4">
          <p className="text-xs text-foreground/60">Active acum</p>
          <p className="mt-2 text-2xl font-semibold text-foreground/70">
            {statusCounts.active}
          </p>
        </div>
      </div>

      {enriched.length === 0 ? (
        <div className="mt-8 rounded-xl border border-foreground/15 p-8 text-center text-sm text-foreground/60">
          Nu există documente scrise salvate momentan.
        </div>
      ) : (
        <>
          <div className="mt-8 space-y-4 sm:hidden">
            {enriched.map(({ document, status }) => {
              const meta = STATUS_META[status];
              const period = formatPeriod(document);
              return (
                <div
                  key={document.id}
                  className="rounded-xl border border-foreground/15 bg-background/60 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/contracts/written-contract?writtenContractId=${encodeURIComponent(
                          document.id
                        )}`}
                        className="font-semibold text-foreground/90 hover:underline"
                      >
                        {document.title}
                      </Link>
                      {document.documentNumber ? (
                        <div className="text-xs text-foreground/60">
                          {document.documentNumber}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <dl className="mt-4 space-y-2 text-sm text-foreground/70">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground/60">Partener</dt>
                      <dd className="text-right text-foreground/80">
                        {document.partnerName || "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground/60">Proprietar</dt>
                      <dd className="text-right text-foreground/80">
                        {document.ownerName || "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground/60">Perioadă</dt>
                      <dd className="text-right text-foreground/80">
                        {period}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-foreground/60">Actualizat</dt>
                      <dd className="text-right text-foreground/80">
                        {formatDateTime(document.updatedAt)}
                      </dd>
                    </div>
                  </dl>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <WrittenContractPreviewButton
                      document={document}
                      buttonLabel="Previzualizează"
                      buttonTitle={
                        document.title
                          ? `Previzualizează ${document.title}`
                          : "Previzualizează contractul scris"
                      }
                      className="rounded-md border border-foreground/20 px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-foreground/5"
                    />
                    <Link
                      href={`/contracts/written-contract?writtenContractId=${encodeURIComponent(
                        document.id
                      )}`}
                      className="rounded bg-foreground px-3 py-1.5 text-sm font-semibold text-background hover:bg-foreground/90"
                    >
                      Editează
                    </Link>
                    {document.contractId ? (
                      <Link
                        href={`/contracts/${encodeURIComponent(
                          document.contractId
                        )}`}
                        className="rounded border border-foreground/25 px-3 py-1.5 text-sm text-foreground/80 hover:bg-foreground/5"
                      >
                        Contract
                      </Link>
                    ) : null}
                    <DeleteWrittenContractButton
                      id={document.id}
                      title={document.title}
                      wrapperClassName="flex flex-col gap-1"
                      buttonClassName="inline-flex items-center justify-center rounded border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-700 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 hidden overflow-x-auto rounded-xl border border-foreground/15 bg-background/60 sm:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-foreground/5 text-foreground/60">
                <tr>
                  <th className="px-4 py-3 font-medium">Document</th>
                  <th className="px-4 py-3 font-medium">Partener</th>
                  <th className="px-4 py-3 font-medium">Proprietar</th>
                  <th className="px-4 py-3 font-medium">Perioadă</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Actualizat</th>
                  <th className="px-4 py-3 font-medium text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map(({ document, status }) => {
                  const meta = STATUS_META[status];
                  const period = formatPeriod(document);
                  return (
                    <tr
                      key={document.id}
                      className="border-t border-foreground/10 text-foreground/80"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/contracts/written-contract?writtenContractId=${encodeURIComponent(
                            document.id
                          )}`}
                          className="font-medium hover:underline"
                        >
                          {document.title}
                        </Link>
                        {document.documentNumber ? (
                          <div className="text-xs text-foreground/60">
                            {document.documentNumber}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {document.partnerName || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {document.ownerName || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{period}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${meta.badgeClass}`}
                        >
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {formatDateTime(document.updatedAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <WrittenContractPreviewButton
                            document={document}
                            buttonLabel="Previzualizează"
                            buttonTitle={
                              document.title
                                ? `Previzualizează ${document.title}`
                                : "Previzualizează contractul scris"
                            }
                            className="!px-2 !py-1 text-xs"
                          />
                          <Link
                            href={`/contracts/written-contract?writtenContractId=${encodeURIComponent(
                              document.id
                            )}`}
                            className="rounded bg-foreground px-2 py-1 text-xs font-semibold text-background hover:bg-foreground/90"
                          >
                            Editează
                          </Link>
                          {document.contractId ? (
                            <Link
                              href={`/contracts/${encodeURIComponent(
                                document.contractId
                              )}`}
                              className="rounded border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
                            >
                              Contract
                            </Link>
                          ) : null}
                          <DeleteWrittenContractButton
                            id={document.id}
                            title={document.title}
                            buttonClassName="inline-flex items-center justify-center rounded border border-red-500/40 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
