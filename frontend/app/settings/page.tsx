"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, User, Palette, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { useTheme } from "@/components/ThemeProvider";
import { deleteAccount, fetchSettings, updateSettings } from "@/lib/api";
import type { UserSettings } from "@/lib/types";
import { ExchangeConnections } from "@/components/portfolio/ExchangeConnections";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then(({ settings: s }) => {
        setSettings(s);
        setDisplayName(s.displayName);
        setEmail(s.email);
        if (s.theme === "light" || s.theme === "dark") {
          setTheme(s.theme);
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load settings.");
      })
      .finally(() => setLoading(false));
  }, [setTheme]);

  async function persistSettings() {
    setSaving(true);
    setSaveMessage(null);
    setError(null);
    try {
      const { settings: updated } = await updateSettings({
        displayName,
        email,
        theme,
      });
      setSettings(updated);
      setSaveMessage("Settings saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    await persistSettings();
  }

  function handleThemeChange(next: "dark" | "light") {
    setTheme(next);
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setDeleteLoading(true);
    setError(null);
    try {
      await deleteAccount(password);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
    } finally {
      setDeleteLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl text-foreground-muted py-12 text-center">
        Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-foreground-muted mt-1">
          Customize your experience and manage your account.
        </p>
      </div>

      {saveMessage && (
        <div className="rounded-lg border border-accent-success/30 bg-accent-success/10 px-4 py-3 text-sm text-accent-success">
          {saveMessage}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
          {error}
        </div>
      )}

      <Card>
        <CardContent>
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-foreground">Appearance</h2>
          </div>
          <p className="text-sm text-foreground-muted mb-4">
            Choose how Portfolio Tracker looks on your device.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleThemeChange("dark")}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                theme === "dark"
                  ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                  : "border-border text-foreground-muted hover:border-accent-primary/40"
              }`}
            >
              <Moon className="w-4 h-4" />
              Dark
            </button>
            <button
              type="button"
              onClick={() => handleThemeChange("light")}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-colors ${
                theme === "light"
                  ? "border-accent-primary bg-accent-primary/10 text-accent-primary"
                  : "border-border text-foreground-muted hover:border-accent-primary/40"
              }`}
            >
              <Sun className="w-4 h-4" />
              Light
            </button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-accent-primary" />
              <h2 className="text-lg font-semibold text-foreground">Profile</h2>
            </div>
            <div>
              <label className="block text-sm text-foreground-muted mb-1">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-foreground-muted mb-1">Email</label>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground-muted cursor-not-allowed opacity-70"
              />
              <p className="text-xs text-foreground-muted mt-1">
                Email cannot be changed after account creation.
              </p>
            </div>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent-primary text-background rounded-lg text-sm font-medium hover:bg-accent-primary/90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <h2 className="text-lg font-semibold text-foreground mb-1">Exchange Connections</h2>
          <p className="text-sm text-foreground-muted mb-4">
            Manage connected exchanges. To add a new exchange, visit{" "}
            <a href="/onboarding" className="text-accent-primary hover:underline">
              onboarding
            </a>
            .
          </p>
          <ExchangeConnections />
        </CardContent>
      </Card>

      <Card className="border-red-500/30">
        <CardContent>
          <div className="flex items-center gap-2 mb-1">
            <Trash2 className="w-5 h-5 text-accent-danger" />
            <h2 className="text-lg font-semibold text-accent-danger">Danger Zone</h2>
          </div>
          <p className="text-sm text-foreground-muted mb-4">
            Permanently delete your account and all portfolio data.
          </p>
          <button
            onClick={() => {
              setPassword("");
              setShowModal(true);
            }}
            className="px-4 py-2 bg-accent-danger/10 border border-accent-danger/30 text-accent-danger rounded-lg text-sm font-medium hover:bg-accent-danger/20"
          >
            Delete Account
          </button>
        </CardContent>
      </Card>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-sm bg-background-secondary rounded-xl p-6 border border-border shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-1">Delete Account</h3>
            <p className="text-sm text-foreground-muted mb-4">
              Enter your password to confirm permanent deletion.
            </p>
            <form onSubmit={handleDeleteAccount} className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-accent-danger"
                required
                autoComplete="current-password"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-border text-foreground-muted rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteLoading || !password}
                  className="flex-1 py-2 bg-accent-danger text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {deleteLoading ? "Deleting…" : "Delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {settings && (
        <p className="text-xs text-foreground-muted text-center pb-4">
          Signed in as <span className="text-foreground">{settings.username}</span>
        </p>
      )}
    </div>
  );
}
