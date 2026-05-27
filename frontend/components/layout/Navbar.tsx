"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Briefcase,
  LayoutDashboard,
  TrendingUp,
  Sparkles,
  History,
  PlusCircle,
  LogOut,
  User,
  Settings,
  Shield,
} from "lucide-react";
import { getCurrentUser, logoutUser } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portfolio", label: "Portfolio", icon: Briefcase },
  { href: "/add-assets", label: "Add Assets", icon: PlusCircle },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/signal-allocation", label: "Signals", icon: Sparkles },
  { href: "/transactions", label: "Transactions", icon: History },
];

export function AppNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null));
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleLogout() {
    setShowMenu(false);
    try {
      await logoutUser();
    } catch {
      // Cookie cleared by proxy regardless
    }
    router.push("/");
    router.refresh();
  }

  const initials = user?.username ? user.username.slice(0, 2).toUpperCase() : "?";

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-accent-primary" />
            </div>
            <span className="font-bold text-lg text-foreground">Portfolio Tracker</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "text-accent-primary bg-accent-primary/10"
                      : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              );
            })}
            {user?.isStaff && (
              <Link
                href="/admin-panel"
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname.startsWith("/admin-panel")
                    ? "text-accent-primary bg-accent-primary/10"
                    : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                )}
              >
                <Shield className="w-4 h-4" />
                Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu((v) => !v)}
                className="w-8 h-8 rounded-full bg-accent-secondary flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-primary/50"
                aria-label="User menu"
                aria-expanded={showMenu}
              >
                <span className="text-sm font-medium text-white">{initials}</span>
              </button>

              {showMenu && (
                <div className="absolute right-0 mt-2 w-52 bg-background-secondary border border-border rounded-xl shadow-lg py-1 z-50">
                  {user && (
                    <div className="px-4 py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-foreground-muted shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">
                          {user.displayName ?? user.username}
                        </span>
                      </div>
                      {user.isStaff && (
                        <span className="text-xs text-accent-primary mt-0.5 block">Administrator</span>
                      )}
                    </div>
                  )}
                  {user?.isStaff && (
                    <Link
                      href="/admin-panel"
                      onClick={() => setShowMenu(false)}
                      className="md:hidden w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground-muted hover:text-foreground hover:bg-background transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Admin Panel
                    </Link>
                  )}
                  <Link
                    href="/settings"
                    onClick={() => setShowMenu(false)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground-muted hover:text-foreground hover:bg-background transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-foreground-muted hover:text-foreground hover:bg-background transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <nav className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                isActive
                  ? "text-accent-primary bg-accent-primary/10"
                  : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

/** @deprecated Use AppNavbar */
export const Navbar = AppNavbar;
