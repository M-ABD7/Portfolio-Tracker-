"use client";

import { usePathname } from "next/navigation";
import { AppNavbar } from "./Navbar";

export function ConditionalNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin-panel")) return null;
  return <AppNavbar />;
}
