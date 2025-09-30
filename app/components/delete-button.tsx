"use client";

type Props = {
  action: () => Promise<void> | void;
  label?: string;
  className?: string;
  confirmMessage?: string;
  iconOnly?: boolean;
};

export default function DeleteButton({
  action,
  label = "Șterge",
  className = "",
  confirmMessage = "Sigur vrei să ștergi acest contract? Această acțiune este permanentă.",
  iconOnly = false,
}: Props) {
  const onClick = async () => {
    if (!confirm(confirmMessage)) return;
    await action();
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("app:toast", {
          detail: { message: label || "Acțiune finalizată", type: "success" },
        })
      );
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ||
        (iconOnly
          ? "rounded-md border border-red-500/30 bg-red-500/10 p-1.5 text-red-600 hover:bg-red-500/15"
          : "rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/15")
      }
      aria-label={label}
      title={label}
    >
      {iconOnly ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M3 6h18" />
          <path d="M8 6v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      ) : (
        label
      )}
    </button>
  );
}
