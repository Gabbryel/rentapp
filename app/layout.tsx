import type { Metadata, Viewport } from "next";
import { Roboto_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/app/components/navbar";
import Toaster from "@/app/components/toaster";
import FlashHub from "@/app/components/flash-hub";

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RentApp",
  description: "Application to manage rental properties",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      // iOS ignores webmanifest icons; ensure at least one apple-touch-icon
      { url: "/icons/icon-192.png" },
      { url: "/icons/icon-512.png" },
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
    <html lang="en">
      {/* PWA installability: metadata above injects manifest + apple meta/icons */}
      <body className={`${robotoMono.variable} antialiased`}>
        <Navbar />
        <div id="app-root" className="w-full app-root-for-blur">
          {children}
        </div>
        <Toaster />
        <FlashHub />
      </body>
    </html>
  );
}
