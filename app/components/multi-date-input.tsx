"use client";

import { useState } from "react";

type Props = {
  name: string;
  initial?: string[];
  label?: string;
};

export default function MultiDateInput({ name, initial = [], label = "Indexări chirie" }: Props) {
  const [dates, setDates] = useState<string[]>(initial.length ? initial : [""]);

  const add = () => setDates((prev) => [...prev, ""]);
  const remove = (i: number) => setDates((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      <div className="mt-2 space-y-2">
        {dates.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="date"
              name={`${name}`}
              defaultValue={d}
              className="flex-1 rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
              aria-label="Elimină data"
            >
              -
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-foreground/20 px-2 py-1 text-xs hover:bg-foreground/5"
        >
          Adaugă dată
        </button>
      </div>
    </div>
  );
}
