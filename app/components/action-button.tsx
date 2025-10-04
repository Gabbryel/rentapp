"use client";

import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import React, {
  useCallback,
  ButtonHTMLAttributes,
  forwardRef,
  useState,
  useEffect,
} from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  successMessage: string;
  disabled?: boolean;
  triggerStatsRefresh?: boolean;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "disabled">;

function ActionButtonBase({
  children,
  className,
  title,
  successMessage,
  disabled,
  triggerStatsRefresh,
  _ref,
  ...buttonProps
}: Props & { _ref?: React.ForwardedRef<HTMLButtonElement> }) {
  const { pending } = useFormStatus();
  const router = useRouter();
  const [clicked, setClicked] = useState(false);
  useEffect(() => {
    if (!pending && clicked) {
      // Form submission finished. Trigger a single stats refresh and re-render page to update invoice list.
      if (triggerStatsRefresh) {
        window.dispatchEvent(new Event("app:stats:refresh"));
      }
      try {
        router.refresh(); // ensure server components (invoice list) reflect new state
      } catch {}
      setClicked(false); // reset guard
    } else if (!pending) {
      setClicked(false);
    }
  }, [pending, clicked, triggerStatsRefresh]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (clicked) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      setClicked(true);
      // Let the server action run; when the navigation settles, Next will re-render the page.
      // We optimistically show a toast to confirm the click succeeded.
      // Consumers can add error handling later by returning a response flag.
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("app:toast", { detail: { message: successMessage } })
        );
        if (triggerStatsRefresh) {
          const target = e.currentTarget as HTMLElement;
          const ds = target.dataset;
          const num = (v?: string) => (v ? Number(v) : 0);
          if (ds.deltaMode) {
            try {
              const detail = {
                mode: ds.deltaMode as string,
                monthRON: num(ds.deltaMonthRon),
                monthEUR: num(ds.deltaMonthEur),
                annualRON: num(ds.deltaAnnualRon),
                annualEUR: num(ds.deltaAnnualEur),
                // Optional future extensions (net without VAT)
                monthNetRON: num((ds as any).deltaMonthNetRon),
                annualNetRON: num((ds as any).deltaAnnualNetRon),
              };
              (window as any).__statsOptimisticQueue = [
                ...(((window as any).__statsOptimisticQueue as any[]) || []),
                detail,
              ];
              window.dispatchEvent(
                new CustomEvent("app:stats:optimistic", { detail })
              );
            } catch {
              // fallback to original event path
              window.dispatchEvent(
                new CustomEvent("app:stats:optimistic", {
                  detail: {
                    mode: ds.deltaMode,
                    monthRON: num(ds.deltaMonthRon),
                    monthEUR: num(ds.deltaMonthEur),
                    annualRON: num(ds.deltaAnnualRon),
                    annualEUR: num(ds.deltaAnnualEur),
                  },
                })
              );
            }
          }
          // We no longer schedule timers; a single refresh will be dispatched
          // after the form submission settles (see useEffect above).
        }
      }
    },
    [successMessage, triggerStatsRefresh, clicked]
  );

  return (
    <button
      type="submit"
      title={title}
      onClick={handleClick}
      className={className}
      disabled={pending || disabled || clicked}
      ref={_ref as any}
      {...buttonProps}
    >
      {pending ? "Se procesează…" : children}
    </button>
  );
}

const ActionButton = forwardRef<HTMLButtonElement, Props>((props, ref) => {
  return <ActionButtonBase {...props} _ref={ref} />;
});

export default ActionButton;
