"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Shield, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutUser } from "@/lib/api";

const adminNavItems = [
  { href: "/admin-panel", label: "Users", icon: Users },
];

export function AdminNavbar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await logoutUser();
    } catch {
      // proceed regardless
    }
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 border border-accent-primary/20">
              <Shield className="w-4 h-4 text-accent-primary" />
              <span className="text-sm font-semibold text-accent-primary">Admin Portal</span>
            </div>

            <nav className="flex items-center gap-1 ml-4">
              {adminNavItems.map((item) => {
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
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-foreground-muted hover:text-foreground transition-colors"
            >
              Back to Portfolio
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
