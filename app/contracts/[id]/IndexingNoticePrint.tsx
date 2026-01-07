"use client";

import * as React from "react";

export type IndexingNoticePrintable = {
  id?: string;
  at?: string;
  meta?: Record<string, unknown> | null;
  userEmail?: string | null;
  contractName?: string;
};

function escapeHtml(input: unknown) {
  const s = String(input ?? "");
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function fmtDate(dateIso?: string) {
  if (!dateIso) return "";
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${day}.${m}.${y}`;
}

export default function IndexingNoticePrint({
  notice,
}: {
  notice: IndexingNoticePrintable;
}) {
  const buildHtml = React.useCallback(() => {
    const meta = notice.meta || {};
    const fromMonth = (meta.fromMonth as string) || (meta.from as string) || "";
    const toMonth = (meta.toMonth as string) || (meta.to as string) || "";
    const deltaPercent =
      typeof meta.deltaPercent === "number" ? meta.deltaPercent : undefined;
    const deltaAmountEUR =
      typeof meta.deltaAmountEUR === "number" ? meta.deltaAmountEUR : undefined;
    const rentEUR = typeof meta.rentEUR === "number" ? meta.rentEUR : undefined;
    const note = typeof meta.note === "string" ? meta.note : "";
    const validFrom = typeof meta.validFrom === "string" ? meta.validFrom : "";
    const newRentEUR =
      typeof meta.newRentEUR === "number"
        ? meta.newRentEUR
        : typeof rentEUR === "number" && typeof deltaAmountEUR === "number"
        ? rentEUR + deltaAmountEUR
        : typeof rentEUR === "number" && typeof deltaPercent === "number"
        ? rentEUR * (1 + deltaPercent / 100)
        : undefined;
    const src = meta.source as string | undefined;

    const title = "Notificare indexare";
    const issued = fmtDate(notice.at) || "—";
    const contractName = notice.contractName ? String(notice.contractName) : "";
    const issuedBy = notice.userEmail ? String(notice.userEmail) : "";

    const increaseText =
      deltaPercent !== undefined ? `+${deltaPercent.toFixed(2)}%` : "n/a";
    const amountText =
      deltaAmountEUR !== undefined ? `${deltaAmountEUR.toFixed(2)} EUR` : "—";
    const rentText = rentEUR !== undefined ? `${rentEUR.toFixed(2)} EUR` : "—";

    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --ink: #111827;
        --muted: #6b7280;
        --line: #e5e7eb;
        --panel: #f9fafb;
      }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto,
          Arial, sans-serif;
        color: var(--ink);
        background: #ffffff;
        padding: 28px;
      }
      .wrap { max-width: 820px; margin: 0 auto; }
      .header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
      .title { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.01em; }
      .subtitle { margin: 6px 0 0 0; color: var(--muted); font-size: 13px; line-height: 1.45; }
      .badge {
        display: inline-block;
        border: 1px solid var(--line);
        background: var(--panel);
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        color: var(--muted);
        white-space: nowrap;
      }
      .card { margin-top: 16px; border: 1px solid var(--line); border-radius: 12px; overflow: hidden; }
      .card-hd { padding: 14px 16px; background: var(--panel); border-bottom: 1px solid var(--line); }
      .kv { width: 100%; border-collapse: collapse; }
      .kv td { padding: 10px 16px; border-bottom: 1px solid var(--line); vertical-align: top; }
      .kv tr:last-child td { border-bottom: 0; }
      .k { width: 200px; color: var(--muted); font-size: 12px; }
      .v { font-size: 13px; }
      .strong { font-weight: 700; }
      .callout {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-top: 14px;
        padding: 12px 14px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #ffffff;
      }
      .callout .big { font-size: 18px; font-weight: 800; }
      .callout .small { color: var(--muted); font-size: 12px; }
      .note { margin-top: 12px; padding: 12px 14px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; font-size: 13px; }
      .foot { margin-top: 14px; color: var(--muted); font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="header">
        <div>
          <h1 class="title">${escapeHtml(title)}</h1>
          <p class="subtitle">Conform contractului, chiria va fi indexată cu procentul inflației din zona euro aplicabil perioadei de referință.</p>
        </div>
        <div class="badge">Emis: <span class="strong">${escapeHtml(
          issued
        )}</span></div>
      </div>

      <div class="card">
        <div class="card-hd">
          <div style="font-size: 12px; color: var(--muted);">Detalii notificare</div>
        </div>
        <table class="kv">
          <tr>
            <td class="k">Contract</td>
            <td class="v">${escapeHtml(contractName || "—")}</td>
              <tr>
                <td class="k">Chirie după indexare${
                  validFrom
                    ? " (începând cu " +
                      escapeHtml(String(validFrom).slice(0, 10)) +
                      ")"
                    : ""
                }</td>
                <td class="v">$${
                  newRentEUR !== undefined
                    ? newRentEUR.toFixed(2) + " EUR"
                    : "—"
                }</td>
              </tr>
          </tr>
          <tr>
            <td class="k">Perioadă</td>
            <td class="v"><span class="strong">${escapeHtml(
              fromMonth || "?"
            )}</span> → <span class="strong">${escapeHtml(
      toMonth || "?"
    )}</span>${
      src ? ` <span style="color:var(--muted)">(${escapeHtml(src)})</span>` : ""
    }</td>
          </tr>
          <tr>
            <td class="k">Chirie la emitere</td>
            <td class="v">${escapeHtml(rentText)}</td>
          </tr>
                <tr>
                  <td class="k">Chirie după indexare</td>
                  <td class="v">${
                    newRentEUR !== undefined
                      ? newRentEUR.toFixed(2) + " EUR"
                      : "—"
                  }</td>
                </tr>
                <tr>
                  <td class="k">Valabil de la</td>
                  <td class="v">${
                    validFrom ? escapeHtml(String(validFrom).slice(0, 10)) : "—"
                  }</td>
                </tr>
        </table>
      </div>

      <div class="callout">
        <div>
          <div class="big">${escapeHtml(increaseText)}</div>
          <div class="small">Procent indexare</div>
        </div>
        <div style="height: 32px; width: 1px; background: var(--line);"></div>
        <div>
          <div class="big">${escapeHtml(amountText)}</div>
          <div class="small">Creștere în EUR</div>
        </div>
      </div>

      ${
        note
          ? `<div class="note"><span class="strong">Notă:</span> ${escapeHtml(
              note
            )}</div>`
          : ""
      }
      ${notice.id ? `<div class="foot">ID: ${escapeHtml(notice.id)}</div>` : ""}
    </div>
  </body>
</html>`;
  }, [notice]);

  const onPrint = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const html = buildHtml();
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  }, [buildHtml]);

  const onView = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const html = buildHtml();
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  }, [buildHtml]);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onView}
        className="rounded-md border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-foreground/10 hover:text-foreground"
      >
        Vezi
      </button>
      <button
        type="button"
        onClick={onPrint}
        className="rounded-md border border-foreground/20 bg-foreground/5 px-2.5 py-1 text-[11px] font-semibold text-foreground/80 hover:bg-foreground/10 hover:text-foreground"
      >
        Printează
      </button>
    </div>
  );
}
