"use client";

import { useState } from "react";
import MementoForm from "./memento-form";

type MementoEditButtonProps = {
  contractId: string;
  memento: {
    type: string;
    message?: string;
    endDate: string;
  };
  index: number;
  editMementoAction: (formData: FormData) => Promise<void>;
};

export default function MementoEditButton({
  contractId,
  memento,
  index,
  editMementoAction,
}: MementoEditButtonProps) {
  const [showEdit, setShowEdit] = useState(false);

  // Close the form after action completes
  const handleEdit = async (formData: FormData) => {
    await editMementoAction(formData);
  };

  if (showEdit) {
    return (
      <MementoForm
        contractId={contractId}
        addMementoAction={async () => {}}
        editMementoAction={handleEdit}
        editData={{
          type: memento.type,
          message: memento.message,
          endDate: memento.endDate,
          index,
        }}
        onClose={() => setShowEdit(false)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowEdit(true)}
      className="rounded-md p-1 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400"
      title="Editează memento"
    >
      <svg
        className="h-3.5 w-3.5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
      </svg>
    </button>
  );
}
