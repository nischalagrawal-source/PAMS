"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Save, Loader2, User, Check, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURES } from "@/lib/constants";

type Permission = {
  feature: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
};

type UserWithPermissions = {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  role: string;
  featurePermissions: Permission[];
};

const PERMISSION_COLS = ["canView", "canCreate", "canEdit", "canDelete", "canApprove"] as const;
const COL_LABELS: Record<(typeof PERMISSION_COLS)[number], string> = {
  canView: "View",
  canCreate: "Create",
  canEdit: "Edit",
  canDelete: "Delete",
  canApprove: "Approve",
};

function getDefaultPermissions(): Record<string, Permission> {
  const map: Record<string, Permission> = {};
  for (const f of FEATURES) {
    map[f.key] = {
      feature: f.key,
      canView: false,
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canApprove: false,
    };
  }
  return map;
}

function getRoleDefaults(role: string): Record<string, Permission> {
  const map = getDefaultPermissions();
  if (role === "SUPER_ADMIN") {
    for (const key of Object.keys(map)) {
      map[key] = { ...map[key], canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true };
    }
  } else if (role === "ADMIN" || role === "REVIEWER") {
    const viewAll = ["dashboard", "attendance", "leaves", "tasks", "performance", "salary", "reports", "notifications"];
    for (const k of viewAll) if (map[k]) map[k] = { ...map[k], canView: true };
    if (role === "ADMIN") {
      for (const k of Object.keys(map)) map[k] = { ...map[k], canView: true, canCreate: true, canEdit: true };
    }
    if (role === "REVIEWER") {
      for (const k of ["tasks", "performance", "leaves"]) {
        if (map[k]) map[k] = { ...map[k], canCreate: true, canEdit: true, canApprove: true };
      }
    }
  } else {
    for (const k of ["dashboard", "attendance", "leaves", "tasks", "performance", "salary"]) {
      if (map[k]) map[k] = { ...map[k], canView: true };
    }
    for (const k of ["attendance", "leaves", "tasks"]) {
      if (map[k]) map[k] = { ...map[k], canCreate: true };
    }
  }
  return map;
}

export default function RightsManagementPage() {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, Permission>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const usersQuery = useQuery({
    queryKey: ["admin", "users", "rights"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      return json.data as UserWithPermissions[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { userId: string; permissions: Permission[] }) => {
      const res = await fetch("/api/admin/rights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users", "rights"] });
      setMessage({ type: "success", text: "Permissions saved successfully" });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: Error) => {
      setMessage({ type: "error", text: err.message || "Failed to save permissions" });
    },
  });

  const users = usersQuery.data ?? [];
  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;
  const isSuperAdmin = selectedUser?.role === "SUPER_ADMIN";

  function handleSelectUser(userId: string) {
    setSelectedUserId(userId);
    setMessage(null);
    const user = users.find((u) => u.id === userId);
    if (!user) return;
    const base = getDefaultPermissions();
    for (const fp of user.featurePermissions) {
      if (base[fp.feature]) {
        base[fp.feature] = { ...fp };
      }
    }
    setPermissions(base);
  }

  function togglePermission(feature: string, col: (typeof PERMISSION_COLS)[number]) {
    if (isSuperAdmin) return;
    setPermissions((prev) => ({
      ...prev,
      [feature]: { ...prev[feature], [col]: !prev[feature][col] },
    }));
  }

  function grantAll() {
    if (isSuperAdmin) return;
    const updated: Record<string, Permission> = {};
    for (const f of FEATURES) {
      updated[f.key] = {
        feature: f.key,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
      };
    }
    setPermissions(updated);
  }

  function revokeAll() {
    if (isSuperAdmin) return;
    setPermissions(getDefaultPermissions());
  }

  function resetToRoleDefaults() {
    if (!selectedUser || isSuperAdmin) return;
    setPermissions(getRoleDefaults(selectedUser.role));
  }

  function handleSave() {
    if (!selectedUserId) return;
    saveMutation.mutate({
      userId: selectedUserId,
      permissions: Object.values(permissions),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg shadow-purple-500/25">
          <Shield size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rights Management</h1>
          <p className="text-gray-500">Configure feature-level permissions for each user</p>
        </div>
      </div>

      {/* User Selector */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Select User
        </label>
        {usersQuery.isLoading ? (
          <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin" /> Loading users...
          </div>
        ) : (
          <div className="relative">
            <User size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <select
              value={selectedUserId ?? ""}
              onChange={(e) => handleSelectUser(e.target.value)}
              className="w-full appearance-none rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">-- Choose a user --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} ({u.employeeCode}) — {u.role}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
            message.type === "success" &&
              "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400",
            message.type === "error" &&
              "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
          )}
        >
          {message.type === "success" ? <Check size={16} /> : <XIcon size={16} />}
          {message.text}
        </div>
      )}

      {/* Permissions Matrix */}
      {selectedUser && (
        <>
          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Quick Actions:</span>
            <button
              onClick={grantAll}
              disabled={isSuperAdmin}
              className="rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400 dark:hover:bg-green-950/50"
            >
              Grant All
            </button>
            <button
              onClick={revokeAll}
              disabled={isSuperAdmin}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-950/50"
            >
              Revoke All
            </button>
            <button
              onClick={resetToRoleDefaults}
              disabled={isSuperAdmin}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Reset to Role Defaults
            </button>
            {isSuperAdmin && (
              <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                Super Admin — all permissions granted
              </span>
            )}
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">
                    Feature
                  </th>
                  {PERMISSION_COLS.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-3 text-center font-semibold text-gray-700 dark:text-gray-300"
                    >
                      {COL_LABELS[col]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((feature, idx) => {
                  const perm = permissions[feature.key];
                  if (!perm) return null;
                  return (
                    <tr
                      key={feature.key}
                      className={cn(
                        "border-b border-gray-100 transition hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-900/50",
                        idx % 2 === 0 && "bg-white dark:bg-gray-950",
                        idx % 2 === 1 && "bg-gray-50/50 dark:bg-gray-900/30"
                      )}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {feature.label}
                        </div>
                        <div className="text-xs text-gray-400">{feature.description}</div>
                      </td>
                      {PERMISSION_COLS.map((col) => (
                        <td key={col} className="px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => togglePermission(feature.key, col)}
                            disabled={isSuperAdmin}
                            className={cn(
                              "mx-auto flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all",
                              (isSuperAdmin || perm[col])
                                ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/25"
                                : "border-gray-300 bg-white hover:border-blue-400 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-blue-500",
                              isSuperAdmin && "cursor-not-allowed opacity-70"
                            )}
                          >
                            {(isSuperAdmin || perm[col]) && <Check size={14} strokeWidth={3} />}
                          </button>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending || isSuperAdmin}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-500/25 transition hover:from-purple-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Permissions
            </button>
          </div>
        </>
      )}

      {/* Empty State */}
      {!selectedUser && !usersQuery.isLoading && (
        <div className="flex min-h-[300px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-center">
            <Shield size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-500">Select a user above</h3>
            <p className="mt-1 text-sm text-gray-400">
              Choose a user to view and configure their feature permissions
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
