"use client";

import { useFormStatus } from "react-dom";
import { useCallback } from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  successMessage: string;
};

export default function ActionButton({
  children,
  className,
  title,
  successMessage,
}: Props) {
  const { pending } = useFormStatus();

  const handleClick = useCallback(() => {
    // Let the server action run; when the navigation settles, Next will re-render the page.
    // We optimistically show a toast to confirm the click succeeded.
    // Consumers can add error handling later by returning a response flag.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("app:toast", { detail: { message: successMessage } })
      );
    }
  }, [successMessage]);

  return (
    <button
      type="submit"
      title={title}
      onClick={handleClick}
      className={className}
      disabled={pending}
    >
      {pending ? "Se procesează…" : children}
    </button>
  );
}
