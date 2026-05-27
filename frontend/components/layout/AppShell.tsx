"use client";

import { usePathname } from "next/navigation";
import { Navbar } from "./Navbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login" || pathname === "/login/";

  return (
    <>
      {!isLoginPage && <Navbar />}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </>
  );
}