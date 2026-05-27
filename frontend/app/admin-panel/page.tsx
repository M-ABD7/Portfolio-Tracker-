"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Users, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui";
import { fetchAdminUsers, getCurrentUser, updateAdminUser } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

export default function AdminPanelPage() {
  const router = useRouter();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const current = await getCurrentUser();
      if (!current?.isStaff) {
        router.replace("/dashboard");
        return;
      }
      const data = await fetchAdminUsers();
      setUsers(data.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [router]);

  async function toggleField(
    userId: number,
    field: "isActive" | "isStaff",
    value: boolean
  ) {
    setUpdatingId(userId);
    setError(null);
    try {
      const { user } = await updateAdminUser(userId, { [field]: value });
      setUsers((prev) => prev.map((u) => (u.id === userId ? user : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-primary/10 text-accent-primary text-xs font-medium mb-3">
            <Shield className="w-3.5 h-3.5" />
            Administrator
          </div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-foreground-muted mt-1">
            Manage registered accounts, access levels, and account status.
          </p>
        </div>
        <button
          onClick={loadUsers}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground-muted hover:text-foreground hover:border-accent-primary/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-accent-danger/30 bg-accent-danger/10 px-4 py-3 text-sm text-accent-danger">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center gap-2">
            <Users className="w-5 h-5 text-accent-primary" />
            <h2 className="text-lg font-semibold text-foreground">All Users</h2>
            <span className="text-sm text-foreground-muted ml-auto">{users.length} total</span>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-foreground-muted">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="px-6 py-12 text-center text-foreground-muted">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background-secondary/50 text-left text-foreground-muted">
                    <th className="px-6 py-3 font-medium">User</th>
                    <th className="px-6 py-3 font-medium">Email</th>
                    <th className="px-6 py-3 font-medium">Joined</th>
                    <th className="px-6 py-3 font-medium">Active</th>
                    <th className="px-6 py-3 font-medium">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-border last:border-0">
                      <td className="px-6 py-4">
                        <div className="font-medium text-foreground">{user.username}</div>
                        <div className="text-xs text-foreground-muted">
                          {user.displayName ?? "-"}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground-muted">{user.email || "-"}</td>
                      <td className="px-6 py-4 text-foreground-muted whitespace-nowrap">
                        {new Date(user.dateJoined).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={user.isActive !== false}
                            disabled={updatingId === user.id}
                            onChange={(e) =>
                              toggleField(user.id, "isActive", e.target.checked)
                            }
                            className="rounded border-border text-accent-primary focus:ring-accent-primary/30"
                          />
                          <span className="text-foreground-muted">
                            {user.isActive !== false ? "Active" : "Inactive"}
                          </span>
                        </label>
                      </td>
                      <td className="px-6 py-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={Boolean(user.isStaff)}
                            disabled={updatingId === user.id}
                            onChange={(e) =>
                              toggleField(user.id, "isStaff", e.target.checked)
                            }
                            className="rounded border-border text-accent-primary focus:ring-accent-primary/30"
                          />
                          <span className="text-foreground-muted">
                            {user.isStaff ? "Admin" : "User"}
                          </span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
