"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { GitBranch, Plus, Pencil, Trash2, Check, X } from "lucide-react";

interface Branch {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  companyId: string;
  createdAt: string;
  _count: { users: number };
  company: { name: string; code: string };
}

export default function BranchesPage() {
  const { data: session } = useSession();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");

  async function fetchBranches() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/branches");
      const json = await res.json();
      if (json.success) setBranches(json.data);
      else setError(json.error || "Failed to load branches");
    } catch {
      setError("Failed to load branches");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBranches();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/branches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName, code: formCode }),
      });
      const json = await res.json();
      if (json.success) {
        setFormName("");
        setFormCode("");
        setShowForm(false);
        fetchBranches();
      } else {
        setFormError(json.error || "Failed to create branch");
      }
    } catch {
      setFormError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/branches/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, code: editCode }),
      });
      const json = await res.json();
      if (json.success) {
        setEditId(null);
        fetchBranches();
      }
    } catch {
      /* swallow */
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(branch: Branch) {
    await fetch(`/api/admin/branches/${branch.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !branch.isActive }),
    });
    fetchBranches();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this branch? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/branches/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) fetchBranches();
    else alert(json.error || "Cannot delete branch");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950">
            <GitBranch className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Branch Management
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage branches within your company
            </p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setFormError(null); }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Branch
        </button>
      </div>

      {/* Add Branch Form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
        >
          <h3 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
            New Branch
          </h3>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Branch Name
              </label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Mumbai Office"
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="w-36">
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                Code
              </label>
              <input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                placeholder="e.g. MUM"
                required
                maxLength={10}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus size={14} />
                {saving ? "Saving..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
          {formError && (
            <p className="mt-2 text-xs text-red-600">{formError}</p>
          )}
        </form>
      )}

      {/* Branches Table */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
          {error}
        </div>
      ) : branches.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 py-16 dark:border-gray-700 dark:bg-gray-900">
          <GitBranch className="mb-3 h-10 w-10 text-gray-400" />
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            No branches yet
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Create a branch to start assigning staff
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/60">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Branch
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Users
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Created
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
              {branches.map((branch) => (
                <tr key={branch.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3">
                    {editId === branch.id ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    ) : (
                      <span className="font-medium text-gray-900 dark:text-white">
                        {branch.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editId === branch.id ? (
                      <input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value.toUpperCase())}
                        maxLength={10}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      />
                    ) : (
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {branch.code}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                    {branch._count.users} users
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggleActive(branch)}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        branch.isActive
                          ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {branch.isActive ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {new Date(branch.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {editId === branch.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(branch.id)}
                            disabled={saving}
                            className="rounded p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditId(branch.id);
                              setEditName(branch.name);
                              setEditCode(branch.code);
                            }}
                            className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            onClick={() => handleDelete(branch.id)}
                            className="rounded p-1 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                          >
                            <Trash2 size={15} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
