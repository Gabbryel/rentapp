type Props = {
  name: string;
  label?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  defaultValue?: string;
  leftIcon?: boolean;
};

export default function EmailField({
  name,
  label = "Email",
  required,
  placeholder,
  autoComplete = "email",
  defaultValue,
  leftIcon = true,
}: Props) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-foreground/70">{label}</span>
      <div className="relative">
        <input
          name={name}
          type="email"
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          defaultValue={defaultValue}
          className={`w-full ${leftIcon ? "!pl-9" : ""}`}
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
                d="M3 7a2 2 0 012-2h14a2 2 0 012 2v.217a2 2 0 01-.894 1.664l-7 4.667a2 2 0 01-2.212 0l-7-4.667A2 2 0 013 7.217V7z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8v9a2 2 0 01-2 2H5a2 2 0 01-2-2V8"
              />
            </svg>
          </span>
        )}
      </div>
    </label>
  );
}
