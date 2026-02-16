"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface AnomalyItem {
  type: string;
  severity: string;
  title: string;
  description: string;
  affectedUsers: string[];
  data?: Record<string, unknown>;
}

export interface AnomalyReport {
  id: string;
  companyId: string;
  date: string;
  summary: string;
  details: AnomalyItem[];
  sentTo: string[];
  sentAt: string | null;
}

export interface AnomalyRule {
  id: string;
  name: string;
  condition: string;
  severity: string;
  isActive: boolean;
  recipients: Array<{ id: string; firstName: string; lastName: string; email: string }>;
}

export interface NotificationItem {
  id: string;
  channel: string;
  type: string;
  subject: string | null;
  message: string;
  status: string;
  sentAt: string | null;
  createdAt: string;
}

interface ReportListResponse {
  records: AnomalyReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface NotificationListResponse {
  records: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
}

export function useNotifications(params: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["notifications", params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params.page) sp.set("page", params.page.toString());
      if (params.limit) sp.set("limit", params.limit.toString());
      const res = await fetch(`/api/notifications?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as NotificationListResponse;
    },
  });
}

export function useDetectAnomalies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/anomalies/detect", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as { summary: string; anomalies: AnomalyItem[]; reportId: string };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["anomalies"] }),
  });
}

export function useAnomalyReports(params: { from?: string; to?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["anomalies", "reports", params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params.from) sp.set("from", params.from);
      if (params.to) sp.set("to", params.to);
      if (params.page) sp.set("page", params.page.toString());
      if (params.limit) sp.set("limit", params.limit.toString());
      const res = await fetch(`/api/anomalies/reports?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as ReportListResponse;
    },
  });
}

export function useAnomalyRules() {
  return useQuery({
    queryKey: ["anomalies", "rules"],
    queryFn: async () => {
      const res = await fetch("/api/admin/anomalies");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as AnomalyRule[];
    },
  });
}

export function useCreateAnomalyRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; condition: string; severity: string; recipientIds?: string[] }) => {
      const res = await fetch("/api/admin/anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["anomalies", "rules"] }),
  });
}

export function useUpdateAnomalyRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; [key: string]: unknown }) => {
      const { id, ...body } = params;
      const res = await fetch(`/api/admin/anomalies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["anomalies", "rules"] }),
  });
}

export function useDeleteAnomalyRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/anomalies/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["anomalies", "rules"] }),
  });
}
