"use client";

type Props = {
  action: () => Promise<void> | void;
  label?: string;
  className?: string;
  confirmMessage?: string;
};

export default function DeleteButton({
  action,
  label = "Șterge",
  className = "",
  confirmMessage = "Sigur vrei să ștergi acest contract? Această acțiune este permanentă.",
}: Props) {
  const onClick = async () => {
    if (!confirm(confirmMessage)) return;
    await action();
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        className ||
        "rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/15"
      }
      aria-label={label}
      title={label}
    >
      {label}
    </button>
  );
}
