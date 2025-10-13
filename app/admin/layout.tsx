import type { ReactNode } from "react";
import AdminSidebar from "./sidebar";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid md:grid-cols-[240px_1fr]">
      <AdminSidebar />
      <div className="min-h-screen">
        <div className="max-w-screen-2xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
