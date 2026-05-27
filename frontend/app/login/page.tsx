"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submitCredentials(u: string, p: string) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u, password: p }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? "Login failed. Please try again.");
        return;
      }

      router.push(data.user?.isStaff ? "/admin-panel" : redirect);
      router.refresh();
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitCredentials(username, password);
  }

  async function handleDemoLogin() {
    setUsername("demo");
    setPassword("demo1234");
    await submitCredentials("demo", "demo1234");
  }

  return (
    <div className="w-full max-w-sm bg-background-secondary rounded-xl p-8 border border-border">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Welcome Back</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Sign in to your account
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-foreground-muted mb-1">
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-accent-primary transition-colors"
            required
            autoComplete="username"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm text-foreground-muted mb-1">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-accent-primary transition-colors"
            required
            autoComplete="current-password"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-accent-primary text-white rounded-lg font-medium hover:bg-accent-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <div className="mt-4">
        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <span className="relative bg-background-secondary px-2 text-xs text-foreground-muted">
            or
          </span>
        </div>
        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={loading}
          className="w-full py-2 border border-border text-foreground-muted rounded-lg text-sm font-medium hover:border-accent-primary hover:text-foreground disabled:opacity-50 transition-colors"
        >
          Try Demo Account
        </button>
      </div>

      <p className="mt-4 text-sm text-center text-foreground-muted">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-accent-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
