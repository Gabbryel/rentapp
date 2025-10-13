type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export default function AuthCard({ title, subtitle, children, footer }: Props) {
  return (
    <main className="min-h-dvh grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-3 py-1 text-xs font-semibold text-foreground/80">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground/50" />
            RentApp
          </div>
        </div>
        <div className="rounded-2xl border border-foreground/10 bg-background/80 backdrop-blur p-6 shadow-lg">
          <h1 className="text-2xl font-bold tracking-tight mb-1">{title}</h1>
          {subtitle ? (
            <p className="text-sm text-foreground/70 mb-4">{subtitle}</p>
          ) : null}
          <div className="grid gap-3">{children}</div>
          {footer ? (
            <div className="mt-4 border-t border-foreground/10 pt-3 text-sm text-foreground/80">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
