"use client";
import { usePathname } from "next/navigation";
import FlashHub from "@/app/components/flash-hub";

function isAuthPath(pathname: string | null | undefined) {
  if (!pathname) return false;
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/verify"
  );
}

export default function FlashGate() {
  const pathname = usePathname();
  if (isAuthPath(pathname)) return null;
  return <FlashHub />;
}
