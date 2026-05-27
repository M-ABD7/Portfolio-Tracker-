"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#stats", label: "Why Us" },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-accent-primary" />
            </div>
            <span className="font-bold text-lg text-foreground">Portfolio Tracker</span>
          </Link>

          {isLanding && (
            <nav className="hidden md:flex items-center gap-6">
              {navLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
                >
                  {item.label}
                </a>
              ))}
            </nav>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/login"
              className={cn(
                "px-3 sm:px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                pathname === "/login"
                  ? "text-accent-primary bg-accent-primary/10"
                  : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
              )}
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="px-3 sm:px-5 py-2 text-sm font-semibold rounded-lg bg-accent-primary text-background hover:bg-accent-primary/90 transition-colors shadow-sm shadow-accent-primary/20"
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
