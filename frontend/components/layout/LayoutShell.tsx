"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PublicNavbar } from "./PublicNavbar";
import { AppNavbar } from "./Navbar";

const PUBLIC_PATHS = ["/", "/login", "/signup"];
const FULL_BLEED_AUTH = ["/login", "/signup"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthPage = FULL_BLEED_AUTH.includes(pathname);
  const isLanding = pathname === "/";

  return (
    <ThemeProvider>
      {isPublic ? <PublicNavbar /> : <AppNavbar />}
      {isAuthPage ? (
        children
      ) : isLanding ? (
        children
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      )}
    </ThemeProvider>
  );
}
