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

export type StatsOptimisticDetail = {
  mode: string;
  monthRON: number;
  monthEUR: number;
  annualRON: number;
  annualEUR: number;
  monthNetRON: number;
  annualNetRON: number;
};

declare global {
  interface Window {
    __statsOptimisticQueue?: StatsOptimisticDetail[];
  }
}

type Props = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  successMessage: string;
  disabled?: boolean;
  triggerStatsRefresh?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled" | "onClick">;

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
      window.dispatchEvent(
        new CustomEvent<{ message: string }>("app:toast", {
          detail: { message: successMessage },
        })
      );
      if (triggerStatsRefresh) {
        const { dataset } = event.currentTarget;
        if (dataset.deltaMode) {
          const detail: StatsOptimisticDetail = {
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
            new CustomEvent<StatsOptimisticDetail>("app:stats:optimistic", {
              detail,
            })
          );
        }
      }
    },
    [clicked, successMessage, triggerStatsRefresh]
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
