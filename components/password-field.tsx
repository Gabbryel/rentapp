"use client";
import { useState } from "react";

type Props = {
  name: string;
  label?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
  defaultValue?: string;
  leftIcon?: boolean;
};

export default function PasswordField({
  name,
  label = "Parolă",
  required,
  minLength,
  placeholder,
  autoComplete,
  defaultValue,
  leftIcon = true,
}: Props) {
  const [show, setShow] = useState(false);
  return (
    <label className="grid gap-1">
      <span className="text-sm text-foreground/70">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          className={`w-full pr-10 ${leftIcon ? "pl-9" : ""}`}
        />
        {leftIcon && (
          <span
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-foreground/60"
            aria-hidden
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 11V7a4 4 0 10-8 0v4"
              />
              <rect x="5" y="11" width="14" height="10" rx="2" />
            </svg>
          </span>
        )}
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? "Ascunde parola" : "Afișează parola"}
          title={show ? "Ascunde parola" : "Afișează parola"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-foreground/60 hover:text-foreground/90 focus:outline-none"
        >
          {show ? (
            // Eye-off icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 15.338 6.423 18 12 18c1.64 0 3.06-.254 4.265-.7M6.228 6.228C7.79 5.12 9.71 4.5 12 4.5c5.577 0 8.774 2.662 10.066 6-.498 1.25-1.27 2.39-2.27 3.336M3 3l18 18"
              />
            </svg>
          ) : (
            // Eye icon
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-5 w-5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 010-.644C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.01 9.964 7.178.07.214.07.43 0 .644C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.01-9.964-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          )}
        </button>
      </div>
    </label>
  );
}
