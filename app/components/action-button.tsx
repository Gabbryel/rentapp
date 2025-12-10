"use client";

import React, {
  useCallback,
  useEffect,
  useState,
  forwardRef,
  type ButtonHTMLAttributes,
} from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import type { OptimisticDelta } from "@/types/stats";

declare global {
  interface Window {
    __statsOptimisticQueue?: OptimisticDelta[];
  }
}

type Props = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  successMessage: string;
  disabled?: boolean;
  triggerStatsRefresh?: boolean;
  optimisticToast?: boolean;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "disabled" | "onClick"
>;

function toNumber(value: string | undefined): number {
  const numeric = value ? Number(value) : 0;
  return Number.isFinite(numeric) ? numeric : 0;
}

const ActionButton = forwardRef<HTMLButtonElement, Props>(function ActionButton(
  {
    children,
    className,
    title,
    successMessage,
    disabled,
    triggerStatsRefresh,
    optimisticToast = true,
    ...buttonProps
  },
  ref
) {
  const { pending } = useFormStatus();
  const router = useRouter();
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    if (!pending && clicked) {
      if (triggerStatsRefresh) {
        window.dispatchEvent(new Event("app:stats:refresh"));
      }
      try {
        router.refresh();
      } catch {
        // ignore navigation refresh errors
      }
      setClicked(false);
    } else if (!pending) {
      setClicked(false);
    }
  }, [pending, clicked, triggerStatsRefresh, router]);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (clicked) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      setClicked(true);
      if (optimisticToast) {
        window.dispatchEvent(
          new CustomEvent<{ message: string }>("app:toast", {
            detail: { message: successMessage },
          })
        );
      }
      if (triggerStatsRefresh) {
        const { dataset } = event.currentTarget;
        if (dataset.deltaMode) {
          const detail: OptimisticDelta = {
            mode: dataset.deltaMode,
            monthRON: toNumber(dataset.deltaMonthRon),
            monthEUR: toNumber(dataset.deltaMonthEur),
            annualRON: toNumber(dataset.deltaAnnualRon),
            annualEUR: toNumber(dataset.deltaAnnualEur),
            monthNetRON: toNumber(dataset.deltaMonthNetRon),
            annualNetRON: toNumber(dataset.deltaAnnualNetRon),
          };
          window.__statsOptimisticQueue = [
            ...(window.__statsOptimisticQueue ?? []),
            detail,
          ];
          window.dispatchEvent(
            new CustomEvent<OptimisticDelta>("app:stats:optimistic", {
              detail,
            })
          );
        }
      }

      const form = event.currentTarget.form;
      if (form) {
        if (typeof form.requestSubmit === "function") {
          event.preventDefault();
          try {
            form.requestSubmit(event.currentTarget);
          } catch {
            form.submit();
          }
          return;
        }
        // Legacy fallback
        form.submit();
        return;
      }
    },
    [clicked, successMessage, triggerStatsRefresh, optimisticToast]
  );

  return (
    <button
      type="submit"
      title={title}
      onClick={handleClick}
      className={className}
      disabled={pending || disabled || clicked}
      ref={ref}
      {...buttonProps}
    >
      {pending ? "Se procesează…" : children}
    </button>
  );
});

export default ActionButton;
