import type { Metadata, Viewport } from "next";
import { Roboto_Condensed } from "next/font/google";
import "./globals.css";
import NavbarGate from "@/app/components/navbar-gate";
import Toaster from "@/app/components/toaster";
import FlashGate from "@/app/components/flash-gate";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
      <body className={`${robotoCondensed.variable} antialiased`}>
        <NavbarGate />
        <div id="app-root" className="w-full app-root-for-blur">
          {children}
        </div>
        <Toaster />
        <FlashGate />
      </body>
    </html>
  );
}
