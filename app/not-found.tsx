import Link from "next/link";

export default function NotFound() {
  return (
    <main className="relative isolate min-h-screen grid place-items-center overflow-hidden px-4 sm:px-6 py-8 sm:py-12">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {/* Soft glowing blob */}
        <div className="absolute left-1/2 top-1/2 h-[80vmax] w-[80vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-sky-500/20 via-indigo-500/20 to-emerald-500/20 blur-3xl animate-[spin_60s_linear_infinite]" />

        {/* Subtle grid with radial mask */}
        <svg
          className="absolute inset-0 h-full w-full stroke-foreground/10 [mask-image:radial-gradient(100%_100%_at_top,white,transparent)]"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern
              id="grid"
              width="10"
              height="10"
              patternUnits="userSpaceOnUse"
            >
              <path d="M 10 0 L 0 0 0 10" fill="none" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs sm:text-sm tracking-widest uppercase text-foreground/60">
          Error 404
        </p>
        <h1 className="mt-4 text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
            Page not found
          </span>
        </h1>
        <p className="mt-6 text-base sm:text-lg md:text-xl text-foreground/70">
          We couldn’t find the page you’re looking for. It may have been moved,
          deleted, or never existed. Let’s get you back on track.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/"
            className="w-full sm:w-auto text-center rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background shadow-sm transition hover:bg-foreground/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-2"
          >
            Go to Home
          </Link>
          <Link
            href="/about"
            className="w-full sm:w-auto text-center rounded-full px-5 py-3 text-sm font-semibold text-foreground ring-1 ring-foreground/20 transition hover:ring-foreground/40"
          >
            About this site
          </Link>
        </div>
      </div>
    </main>
  );
}
