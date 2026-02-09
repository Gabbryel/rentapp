"use client";

import { useState } from "react";

type MementoData = {
  type: string;
  message?: string;
  endDate: string;
  index: number;
};

type MementoFormProps = {
  contractId: string;
  addMementoAction: (formData: FormData) => Promise<void>;
  editMementoAction?: (formData: FormData) => Promise<void>;
  editData?: MementoData;
  onClose?: () => void;
};

export default function MementoForm({
  contractId,
  addMementoAction,
  editMementoAction,
  editData,
  onClose,
}: MementoFormProps) {
  const [open, setOpen] = useState(!!editData);
  const isEditMode = !!editData;

  const handleClose = () => {
    setOpen(false);
    onClose?.();
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const form = e.currentTarget;

    if (isEditMode && editMementoAction) {
      await editMementoAction(formData);
    } else {
      await addMementoAction(formData);
    }

    form.reset();
    handleClose();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-foreground/20 px-2.5 py-1.5 text-sm font-medium flex items-center justify-center hover:bg-foreground/5"
        title="Adaugă memento"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      </button>
    );
  }

  return (
    <dialog
      open
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-background text-foreground rounded-lg border border-foreground/20 p-6 max-w-md w-full mx-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {isEditMode ? "Editează memento" : "Adaugă memento"}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 hover:bg-foreground/10"
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="contractId" value={contractId} />
          {isEditMode && editData && (
            <input type="hidden" name="index" value={editData.index} />
          )}

          <div className="space-y-2">
            <label
              htmlFor="type"
              className="block text-sm font-medium text-foreground"
            >
              Tip
            </label>
            <select
              id="type"
              name="type"
              required
              defaultValue={editData?.type}
              className="w-full rounded-md border border-foreground/20 bg-background text-foreground px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            >
              <option value="Water">Apă</option>
              <option value="Electricity">Electricitate</option>
              <option value="Gas">Gaz</option>
              <option value="Heating">Încălzire</option>
              <option value="Internet">Internet</option>
              <option value="TV">TV</option>
              <option value="Maintenance">Întreținere</option>
              <option value="Other">Altele</option>
            </select>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="endDate"
              className="block text-sm font-medium text-foreground"
            >
              Valabil până la
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              required
              defaultValue={editData?.endDate}
              className="w-full rounded-md border border-foreground/20 bg-background text-foreground px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="message"
              className="block text-sm font-medium text-foreground"
            >
              Mesaj (opțional)
            </label>
            <textarea
              id="message"
              name="message"
              rows={3}
              maxLength={500}
              defaultValue={editData?.message}
              placeholder="Adaugă un mesaj personalizat..."
              className="w-full rounded-md border border-foreground/20 bg-background text-foreground placeholder:text-foreground/50 px-3 py-2 text-sm focus:border-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/20 resize-none"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-foreground/20 text-foreground px-4 py-2 text-sm font-medium hover:bg-foreground/5"
            >
              Anulează
            </button>
            <button
              type="submit"
              className="rounded-md border border-foreground/20 bg-foreground text-background px-4 py-2 text-sm font-medium hover:bg-foreground/90"
            >
              {isEditMode ? "Salvează" : "Adaugă"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
