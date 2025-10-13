"use client";
import { usePathname } from "next/navigation";
import Navbar from "@/app/components/navbar";

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

export default function NavbarGate() {
  const pathname = usePathname();
  if (isAuthPath(pathname)) return null;
  return <Navbar />;
}
