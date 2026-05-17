"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Users,
  Pencil,
  X,
  Loader2,
  Save,
  Shield,
  UserCheck,
  UserX,
  Search,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Building2,
  RefreshCw,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  employeeCode: string;
  role: "SUPER_ADMIN" | "ADMIN" | "REVIEWER" | "STAFF";
  designation: string | null;
  department: string | null;
  workMode: string;
  assignedGeoFenceId?: string | null;
  assignedGeoFence?: { id: string; label: string; type: string } | null;
  dateOfJoining: string | null;
  isActive: boolean;
  profilePhoto: string | null;
  portalSynced: boolean;
  portalSource: string | null;
}

type UserFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeCode: string;
  password: string;
  role: User["role"];
  designation: string;
  department: string;
  workMode: string;
  assignedGeoFenceId: string;
  dateOfJoining: string;
};

const emptyForm: UserFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  employeeCode: "",
  password: "",
  role: "STAFF",
  designation: "",
  department: "",
  workMode: "office",
  assignedGeoFenceId: "",
  dateOfJoining: "",
};

interface GeoFenceLite {
  id: string;
  label: string;
  type: string;
}

const ROLE_COLORS: Record<User["role"], string> = {
  STAFF: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  REVIEWER: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  ADMIN: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  SUPER_ADMIN: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const ROLE_LABELS: Record<User["role"], string> = {
  STAFF: "Staff",
  REVIEWER: "Reviewer",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

const FILTER_ROLES = ["ALL", "STAFF", "REVIEWER", "ADMIN"] as const;

interface Company {
  id: string;
  name: string;
  code: string;
}

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isSuperAdmin = session?.user?.role === "SUPER_ADMIN";
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [formError, setFormError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadResult, setUploadResult] = useState<{ created: number; total: number; results: Array<{ email: string; status: string }> } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; skipped: number } | null>(null);
  const [syncError, setSyncError] = useState("");

  const companiesQuery = useQuery({
    queryKey: ["admin", "companies", "lite"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const res = await fetch("/api/admin/companies");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as Company[];
    },
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", selectedCompanyId],
    queryFn: async () => {
      const url = selectedCompanyId
        ? `/api/admin/users?companyId=${selectedCompanyId}`
        : "/api/admin/users";
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as User[];
    },
  });

  const geofencesQuery = useQuery({
    queryKey: ["admin", "geofences", "lite"],
    queryFn: async () => {
      const res = await fetch("/api/admin/geofences");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as GeoFenceLite[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          assignedGeoFenceId: data.assignedGeoFenceId || undefined,
          dateOfJoining: data.dateOfJoining || undefined,
          ...(isSuperAdmin && selectedCompanyId ? { companyId: selectedCompanyId } : {}),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      closeModal();
    },
    onError: (err: Error) => setFormError(err.message),
  });


  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UserFormData }) => {
      const payload: Record<string, unknown> = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || undefined,
        employeeCode: data.employeeCode,
        role: data.role,
        designation: data.designation || undefined,
        department: data.department || undefined,
        workMode: data.workMode,
        assignedGeoFenceId: data.assignedGeoFenceId || null,
        dateOfJoining: data.dateOfJoining || undefined,
      };
      if (data.password) payload.password = data.password;
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      closeModal();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  async function handlePortalSync() {
    setSyncing(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const body = isSuperAdmin && selectedCompanyId ? { companyId: selectedCompanyId } : {};
      const res = await fetch("/api/admin/users/pull-portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setSyncResult(json.data);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) {
      setSyncError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function handleBulkUpload() {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError("");
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      const res = await fetch("/api/admin/users/bulk-upload", { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) {
        setUploadError(json.error || "Upload failed");
      } else {
        setUploadResult(json.data);
        queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      }
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  function openEdit(user: User) {
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone ?? "",
      employeeCode: user.employeeCode,
      password: "",
      role: user.role,
      designation: user.designation ?? "",
      department: user.department ?? "",
      workMode: user.workMode,
      assignedGeoFenceId: user.assignedGeoFence?.id ?? "",
      dateOfJoining: user.dateOfJoining ? user.dateOfJoining.split("T")[0] : "",
    });
    setEditingId(user.id);
    setShowModal(true);
    setFormError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.firstName || !form.lastName || !form.email || !form.employeeCode) {
      setFormError("First name, last name, email, and employee code are required");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    }
  }

  function handleDeactivate(user: User) {
    const action = user.isActive ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${action} ${user.firstName} ${user.lastName}?`)) return;
    toggleActiveMutation.mutate({ id: user.id, isActive: !user.isActive });
  }

  const users = usersQuery.data ?? [];
  const filtered = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.employeeCode.toLowerCase().includes(q);
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.isActive).length;
  const inactiveUsers = totalUsers - activeUsers;
  const roleCounts = users.reduce(
    (acc, u) => {
      if (u.role === "STAFF") acc.staff++;
      else if (u.role === "REVIEWER") acc.reviewer++;
      else acc.admin++;
      return acc;
    },
    { staff: 0, reviewer: 0, admin: 0 }
  );

  const isSaving = updateMutation.isPending;

  function getInitials(first: string, last: string) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <Users size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Management</h1>
            <p className="text-gray-500">Manage employees, roles, and access</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href="/api/admin/users/template"
            className="flex items-center gap-2 rounded-xl border border-blue-300 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950"
          >
            <Download size={16} /> Template
          </a>
          <button
            onClick={() => { setShowUpload(true); setUploadFile(null); setUploadResult(null); setUploadError(""); }}
            className="flex items-center gap-2 rounded-xl border border-green-300 px-4 py-2.5 text-sm font-semibold text-green-700 hover:bg-green-50 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-950"
          >
            <Upload size={16} /> Bulk Upload
          </button>
          <button
            onClick={() => { setShowSyncModal(true); setSyncResult(null); setSyncError(""); }}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-violet-500"
          >
            <RefreshCw size={16} /> Sync from Portal
          </button>
        </div>
      </div>

      {/* Portal Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Link2 size={18} className="text-indigo-600" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Sync from Company Portal</h3>
              </div>
              <button onClick={() => setShowSyncModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
            </div>

            <p className="mb-4 text-sm text-gray-500">Pulls the latest user list from your company portal and upserts them into P&AMS. Existing users are updated; new users are created with STAFF role.</p>

            {syncError && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}

            {syncResult && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 size={18} className="text-green-600" />
                  <span className="font-semibold text-green-800 dark:text-green-300">Sync complete!</span>
                </div>
                <div className="text-sm text-green-700 dark:text-green-400 space-y-1">
                  <p>Created: <strong>{syncResult.created}</strong></p>
                  <p>Updated: <strong>{syncResult.updated}</strong></p>
                  <p>Skipped: <strong>{syncResult.skipped}</strong></p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button onClick={() => setShowSyncModal(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Close</button>
              <button
                onClick={handlePortalSync}
                disabled={syncing}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {syncing ? "Syncing..." : "Pull Now"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Modal */}}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Upload Staff</h3>
              <button onClick={() => setShowUpload(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border-2 border-dashed border-gray-300 p-6 text-center dark:border-gray-700">
                <FileSpreadsheet size={32} className="mx-auto mb-2 text-gray-400" />
                <p className="text-sm text-gray-500">Upload an Excel file (.xlsx) with staff data</p>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="mt-3 text-sm"
                />
              </div>

              {uploadFile && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Selected: <strong>{uploadFile.name}</strong> ({(uploadFile.size / 1024).toFixed(1)} KB)
                </p>
              )}

              {uploadError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <pre className="whitespace-pre-wrap">{uploadError}</pre>
                </div>
              )}

              {uploadResult && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                  <div className="mb-2 flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-green-600" />
                    <span className="font-semibold text-green-800 dark:text-green-300">{uploadResult.created} of {uploadResult.total} users created</span>
                  </div>
                  <p className="mb-2 text-xs text-green-600">Default password: FirstName@123</p>
                  <div className="max-h-40 overflow-y-auto text-xs">
                    {uploadResult.results.map((r, i) => (
                      <div key={i} className={r.status === "created" ? "text-green-700" : "text-red-600"}>
                        {r.email}: {r.status}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <a href="/api/admin/users/template" className="text-sm text-blue-600 hover:underline">
                  <Download size={14} className="mr-1 inline" /> Download Template
                </a>
                <div className="flex gap-3">
                  <button onClick={() => setShowUpload(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                  <button
                    onClick={handleBulkUpload}
                    disabled={!uploadFile || uploading}
                    className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                    {uploading ? "Uploading..." : "Upload & Create Users"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Total Users</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{totalUsers}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <UserCheck size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Active</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{activeUsers}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <UserX size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">Inactive</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{inactiveUsers}</p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Shield size={18} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">By Role</p>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {roleCounts.staff}S / {roleCounts.reviewer}R / {roleCounts.admin}A
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Company selector for SUPER_ADMIN */}
      {isSuperAdmin && (
        <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 dark:border-indigo-900 dark:bg-indigo-950/30">
          <Building2 size={18} className="shrink-0 text-indigo-600" />
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">View company:</span>
          <select
            value={selectedCompanyId}
            onChange={(e) => { setSelectedCompanyId(e.target.value); setRoleFilter("ALL"); setSearchQuery(""); }}
            className="flex-1 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-indigo-700 dark:bg-gray-900 dark:text-white"
          >
            <option value="">All Companies</option>
            {(companiesQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
            ))}
          </select>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or code..."
            className="w-full rounded-xl border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div className="flex gap-2">
          {FILTER_ROLES.map((r) => (
            <button
              key={r}
              onClick={() => setRoleFilter(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                roleFilter === r
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
              )}
            >
              {r === "ALL" ? "All" : ROLE_LABELS[r as User["role"]] ?? r}
            </button>
          ))}
        </div>
      </div>

      {/* User Table */}
      {usersQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-center">
            <Users size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-500">
              {searchQuery || roleFilter !== "ALL" ? "No users match your filters" : "No users yet"}
            </h3>
            <p className="mt-1 text-sm text-gray-400">
              {searchQuery || roleFilter !== "ALL" ? "Try adjusting your search or filters" : "Add your first employee to get started"}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <table className="w-full min-w-[920px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Code</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Work Mode</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Assigned Geo-fence</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr
                  key={user.id}
                  className={cn(
                    "border-b border-gray-100 transition hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-900/50",
                    !user.isActive && "opacity-50"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-xs font-bold text-white">
                        {getInitials(user.firstName, user.lastName)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {user.firstName} {user.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                    {user.employeeCode}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-block rounded-md px-2 py-0.5 text-xs font-semibold", ROLE_COLORS[user.role])}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {user.department || "—"}
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-300">
                    {user.workMode}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {user.assignedGeoFence?.label || "Auto by work mode"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        user.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", user.isActive ? "bg-green-500" : "bg-red-500")} />
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(user)}
                        className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                        title="Edit user"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => handleDeactivate(user)}
                        className={cn(
                          "rounded-lg p-1.5 transition",
                          user.isActive
                            ? "text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                            : "text-gray-400 hover:bg-green-50 hover:text-green-600 dark:hover:bg-green-950"
                        )}
                        title={user.isActive ? "Deactivate" : "Reactivate"}
                      >
                        {user.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit User</h3>
                {editingId && users.find(u => u.id === editingId)?.portalSynced && (
                  <span className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">
                    <Link2 size={12} /> Synced from {users.find(u => u.id === editingId)?.portalSource ?? "company portal"}
                  </span>
                )}
              </div>
              <button onClick={closeModal} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {(() => {
                const editingUser = editingId ? users.find(u => u.id === editingId) : null;
                const isPortalUser = !!editingUser?.portalSynced;
                return (
                  <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">First Name *</label>
                  <input
                    type="text"
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    readOnly={isPortalUser}
                    placeholder="John"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${isPortalUser ? "border-indigo-200 bg-indigo-50 text-gray-500 dark:bg-indigo-950/20" : "border-gray-300"}`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Last Name *</label>
                  <input
                    type="text"
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    readOnly={isPortalUser}
                    placeholder="Doe"
                    className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${isPortalUser ? "border-indigo-200 bg-indigo-50 text-gray-500 dark:bg-indigo-950/20" : "border-gray-300"}`}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Email *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  readOnly={isPortalUser}
                  placeholder="john.doe@company.com"
                  className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white ${isPortalUser ? "border-indigo-200 bg-indigo-50 text-gray-500 dark:bg-indigo-950/20" : "border-gray-300"}`}
                />
                {isPortalUser && <p className="mt-1 text-xs text-indigo-500">Name and email are managed by the company portal</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Employee Code *</label>
                  <input
                    type="text"
                    value={form.employeeCode}
                    onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
                    placeholder="EMP001"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Leave blank to keep unchanged"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as User["role"] }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="STAFF">Staff</option>
                    <option value="REVIEWER">Reviewer</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Work Mode</label>
                  <select
                    value={form.workMode}
                    onChange={(e) => setForm((f) => ({ ...f, workMode: e.target.value, assignedGeoFenceId: "" }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="office">Office</option>
                    <option value="client">Client Site</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Assigned Geo-fence</label>
                  <select
                    value={form.assignedGeoFenceId}
                    onChange={(e) => setForm((f) => ({ ...f, assignedGeoFenceId: e.target.value }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="">Auto by work mode</option>
                    {(geofencesQuery.data || [])
                      .filter((g) => form.workMode === "hybrid" || (form.workMode === "office" ? g.type === "office" : g.type === "client_site"))
                      .map((g) => (
                        <option key={g.id} value={g.id}>{g.label} ({g.type === "office" ? "Office" : "Client"})</option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Designation</label>
                  <input
                    type="text"
                    value={form.designation}
                    onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                    placeholder="Software Engineer"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Department</label>
                  <input
                    type="text"
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    placeholder="Engineering"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Date of Joining</label>
                <input
                  type="date"
                  value={form.dateOfJoining}
                  onChange={(e) => setForm((f) => ({ ...f, dateOfJoining: e.target.value }))}
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Update
                </button>
              </div>
                  </>
                );
              })()} 
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
