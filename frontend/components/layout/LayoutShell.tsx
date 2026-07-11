"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PublicNavbar } from "./PublicNavbar";
import { AppNavbar } from "./Navbar";
import { getCurrentUser } from "@/lib/api";

const PUBLIC_PATHS = ["/", "/login", "/signup"];
const FULL_BLEED_AUTH = ["/login", "/signup"];

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isAuthPage = FULL_BLEED_AUTH.includes(pathname);
  const isLanding = pathname === "/";
  const isAdminPanel = pathname.startsWith("/admin-panel");

  useEffect(() => {
    if (isAdminPanel || isAuthPage) return;
    let cancelled = false;
    getCurrentUser().then((u) => {
      if (!cancelled && u?.isStaff) {
        router.replace("/admin-panel");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, isAdminPanel, isAuthPage, router]);

  return (
    <ThemeProvider>
      {!isAdminPanel && (isPublic ? <PublicNavbar /> : <AppNavbar />)}
      {isAdminPanel ? (
        children
      ) : isAuthPage ? (
        children
      ) : isLanding ? (
        children
      ) : (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      )}
    </ThemeProvider>
  );
}
