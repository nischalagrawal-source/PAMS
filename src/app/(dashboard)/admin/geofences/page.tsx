"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Radar,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Building2,
  Navigation,
  X,
  Loader2,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GeoFence {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  type: string;
  isActive: boolean;
  createdAt: string;
}

type GeoFenceFormData = {
  label: string;
  latitude: string;
  longitude: string;
  radiusM: string;
  type: "office" | "client_site";
};

const emptyForm: GeoFenceFormData = {
  label: "",
  latitude: "",
  longitude: "",
  radiusM: "200",
  type: "office",
};

async function fetchGeoFences(): Promise<GeoFence[]> {
  const res = await fetch("/api/admin/geofences");
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export default function GeoFencesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GeoFenceFormData>(emptyForm);
  const [formError, setFormError] = useState("");

  const fencesQuery = useQuery({
    queryKey: ["geofences"],
    queryFn: fetchGeoFences,
  });

  const createMutation = useMutation({
    mutationFn: async (data: GeoFenceFormData) => {
      const res = await fetch("/api/admin/geofences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: data.label,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          radiusM: parseInt(data.radiusM),
          type: data.type,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofences"] });
      closeForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: GeoFenceFormData }) => {
      const res = await fetch(`/api/admin/geofences/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: data.label,
          latitude: parseFloat(data.latitude),
          longitude: parseFloat(data.longitude),
          radiusM: parseInt(data.radiusM),
          type: data.type,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geofences"] });
      closeForm();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/geofences/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["geofences"] }),
  });

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  }

  function openEdit(fence: GeoFence) {
    setForm({
      label: fence.label,
      latitude: fence.latitude.toString(),
      longitude: fence.longitude.toString(),
      radiusM: fence.radiusM.toString(),
      type: fence.type as "office" | "client_site",
    });
    setEditingId(fence.id);
    setShowForm(true);
    setFormError("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.label || !form.latitude || !form.longitude || !form.radiusM) {
      setFormError("All fields are required");
      return;
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setFormError("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
      },
      () => setFormError("Could not get location")
    );
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/25">
            <Radar size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Geo-fences</h1>
            <p className="text-gray-500">Manage office and client site geo-fences for attendance</p>
          </div>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm); }}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-green-500/25 transition hover:from-green-500 hover:to-emerald-500"
        >
          <Plus size={18} />
          Add Geo-fence
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingId ? "Edit Geo-fence" : "New Geo-fence"}
              </h3>
              <button onClick={closeForm} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Label</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                  placeholder="e.g., Main Office - Mumbai"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                    placeholder="19.076"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                    placeholder="72.877"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleGetCurrentLocation}
                className="flex items-center gap-2 text-sm font-medium text-green-600 hover:text-green-700"
              >
                <MapPin size={14} />
                Use my current location
              </button>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Radius (meters)</label>
                  <input
                    type="number"
                    value={form.radiusM}
                    onChange={(e) => setForm((p) => ({ ...p, radiusM: e.target.value }))}
                    placeholder="200"
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as "office" | "client_site" }))}
                    className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="office">Office</option>
                    <option value="client_site">Client Site</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {editingId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Geo-fence cards */}
      {fencesQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : fencesQuery.data?.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
          <div className="text-center">
            <Radar size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-500">No geo-fences yet</h3>
            <p className="mt-1 text-sm text-gray-400">Add your first office or client site geo-fence</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fencesQuery.data?.map((fence) => (
            <div
              key={fence.id}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-950"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    fence.type === "office"
                      ? "bg-blue-100 dark:bg-blue-900/30"
                      : "bg-purple-100 dark:bg-purple-900/30"
                  )}>
                    {fence.type === "office" ? (
                      <Building2 size={20} className="text-blue-600" />
                    ) : (
                      <Navigation size={20} className="text-purple-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 dark:text-white">{fence.label}</h4>
                    <span className={cn(
                      "text-xs font-medium",
                      fence.type === "office" ? "text-blue-600" : "text-purple-600"
                    )}>
                      {fence.type === "office" ? "Office" : "Client Site"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(fence)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-800"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => { if (confirm("Delete this geo-fence?")) deleteMutation.mutate(fence.id); }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Coordinates</span>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                    {fence.latitude.toFixed(4)}, {fence.longitude.toFixed(4)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Radius</span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">{fence.radiusM}m</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Status</span>
                  <span className={cn("font-medium", fence.isActive ? "text-green-600" : "text-red-600")}>
                    {fence.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
