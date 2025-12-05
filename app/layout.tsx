import type { Metadata, Viewport } from "next";
import { Roboto_Condensed } from "next/font/google";
import "./globals.css";
import NavbarGate from "@/app/components/navbar-gate";
import Toaster from "@/app/components/toaster";
import FlashGate from "@/app/components/flash-gate";
import { getAppVersion } from "@/lib/version";

const robotoCondensed = Roboto_Condensed({
  variable: "--font-roboto-condensed",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "RentApp",
  description: "Application to manage rental properties",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        url: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        rel: "icon",
      },
    ],
    apple: [
      // iOS ignores webmanifest icons; ensure at least one apple-touch-icon
      { url: "/icons/icon-192.png" },
      { url: "/icons/icon-512.png" },
      { url: "/icons/maskable-512.png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RentApp",
  },
};

export const viewport: Viewport = {
  themeColor: "#051932",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const version = await getAppVersion();
  const builtAtIso = version.builtAt ?? new Date().toISOString();
  let builtAtReadable = builtAtIso;
  try {
    const date = new Date(builtAtIso);
    if (!Number.isNaN(date.getTime())) {
      builtAtReadable = new Intl.DateTimeFormat("ro-RO", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    }
  } catch {}

  const badgeLabelParts = [
    `v${version.version}`,
    builtAtReadable,
    version.commit ? `commit ${version.commit}` : null,
  ].filter(Boolean);

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/* Inline theme setter to avoid flash of incorrect theme */}
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{
            __html: `
  try {
    const storageKey = 'rentapp:theme';
    const saved = localStorage.getItem(storageKey);
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = saved === 'light' || saved === 'dark' ? saved : (prefersLight ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  } catch {}
          `.trim(),
          }}
        />
      </head>
      {/* PWA installability: metadata above injects manifest + apple meta/icons */}
      <body className={`${robotoCondensed.variable} antialiased bg-sci-fi`}>
        <NavbarGate />
        <div id="app-root" className="w-full app-root-for-blur">
          {children}
        </div>
        <div className="fixed bottom-4 left-4 z-[1000] pointer-events-none select-none text-[11px] font-medium text-foreground/70">
          <span className="inline-flex items-center gap-1 rounded-md border border-foreground/10 bg-background/80 px-3 py-1 shadow-sm backdrop-blur">
            <span className="uppercase tracking-wide text-foreground/50">
              RentApp
            </span>
            <span>{badgeLabelParts.join(" • ")}</span>
          </span>
        </div>
        <Toaster />
        <FlashGate />
      </body>
    </html>
  );
}
