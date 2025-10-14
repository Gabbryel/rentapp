"use client";

import * as React from "react";
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type CommonProps = {
  ariaLabel: string;
  title?: string;
  variant?: "default" | "danger";
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode; // the SVG icon
};

type AnchorProps = CommonProps & {
  href: string;
  target?: string;
  download?: boolean | string;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  disabled?: never;
};

type ButtonProps = CommonProps & {
  href?: undefined;
  target?: never;
  download?: never;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
};

type IconButtonProps = AnchorProps | ButtonProps;

export default function IconButton(props: IconButtonProps) {
  const isAnchor = (p: IconButtonProps): p is AnchorProps =>
    (p as AnchorProps).href !== undefined;

  const {
    ariaLabel,
    title,
    variant = "default",
    size = "sm",
    className,
    children,
  } = props;
  let isDisabled = false;
  if (!isAnchor(props)) {
    isDisabled = Boolean(props.disabled);
  }
  const base = cx(
    "rounded-md inline-flex items-center justify-center border transition-colors",
    size === "sm" ? "p-1.5" : "p-2",
    variant === "default"
      ? "border-foreground/20 text-foreground/80 hover:bg-foreground/5"
      : "",
    variant === "danger"
      ? "border-red-500/30 bg-red-500/10 text-red-600 hover:bg-red-500/15"
      : "",
    isDisabled ? "opacity-60 cursor-not-allowed" : "",
    className || ""
  );

  if (isAnchor(props)) {
    const anchorProps = props;
    return (
      <a
        href={anchorProps.href}
        target={anchorProps.target}
        download={anchorProps.download}
        className={base}
        aria-label={ariaLabel}
        title={title || ariaLabel}
        onClick={anchorProps.onClick}
        rel={anchorProps.target === "_blank" ? "noreferrer" : undefined}
      >
        <span className="sr-only">{ariaLabel}</span>
        {children}
      </a>
    );
  }

  const buttonProps = props as ButtonProps;
  return (
    <button
      type="button"
      className={base}
      aria-label={ariaLabel}
      title={title || ariaLabel}
      onClick={buttonProps.onClick}
      disabled={buttonProps.disabled}
    >
      <span className="sr-only">{ariaLabel}</span>
      {children}
    </button>
  );
}
