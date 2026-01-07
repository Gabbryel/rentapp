"use client";

import * as React from "react";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  noticeId: string;
  contractId: string;
  initialFromMonth?: string;
  initialToMonth?: string;
  initialPercent?: number;
  initialAmount?: number;
  rentEUR?: number;
  initialNote?: string;
};

export default function IndexingNoticeEditor(props: Props) {
  const [fromMonth, setFromMonth] = React.useState(
    props.initialFromMonth || ""
  );
  const [toMonth, setToMonth] = React.useState(props.initialToMonth || "");
  const [percent, setPercent] = React.useState(
    props.initialPercent !== undefined ? String(props.initialPercent) : ""
  );
  const [amount, setAmount] = React.useState(
    props.initialAmount !== undefined ? String(props.initialAmount) : ""
  );
  const [note, setNote] = React.useState(props.initialNote || "");

  const autoCalc = React.useCallback(
    (nextPercent: string) => {
      if (!props.rentEUR || Number.isNaN(props.rentEUR)) return;
      const numeric = Number(nextPercent.replace(",", "."));
      if (!Number.isFinite(numeric)) return;
      const delta = (props.rentEUR * numeric) / 100;
      setAmount(delta.toFixed(2));
    },
    [props.rentEUR]
  );

  React.useEffect(() => {
    if (amount || !percent) return;
    autoCalc(percent);
  }, [amount, percent, autoCalc]);

  return (
    <form
      action={props.action}
      className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5"
    >
      <input type="hidden" name="noticeId" value={props.noticeId} />
      <input type="hidden" name="contractId" value={props.contractId} />
      <div className="space-y-1">
        <label className="block text-foreground/60 text-[11px]">
          De la (YYYY-MM)
        </label>
        <input
          name="fromMonth"
          type="month"
          value={fromMonth}
          onChange={(e) => setFromMonth(e.target.value)}
          className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-[11px]"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-foreground/60 text-[11px]">
          Până la (YYYY-MM)
        </label>
        <input
          name="toMonth"
          type="month"
          value={toMonth}
          onChange={(e) => setToMonth(e.target.value)}
          className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-[11px]"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-foreground/60 text-[11px]">%</label>
        <input
          name="deltaPercent"
          type="number"
          step="0.01"
          value={percent}
          onChange={(e) => {
            const next = e.target.value;
            setPercent(next);
            autoCalc(next);
          }}
          className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-[11px]"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-foreground/60 text-[11px]">
          Delta EUR
        </label>
        <input
          name="deltaAmountEUR"
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-[11px]"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-foreground/60 text-[11px]">Notă</label>
        <input
          name="note"
          type="text"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="observații"
          className="w-full rounded-md border border-foreground/20 bg-background px-2 py-1 text-[11px]"
        />
      </div>
      <div className="sm:col-span-5 flex justify-end">
        <button className="rounded-md border border-foreground/20 px-3 py-1.5 text-[11px] font-semibold hover:bg-foreground/5">
          Salvează modificările
        </button>
      </div>
    </form>
  );
}
