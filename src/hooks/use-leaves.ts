"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface LeaveRequest {
  id: string;
  userId: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  appliedOn: string;
  isAdvance: boolean;
  isEmergency: boolean;
  durationDays: number;
  proofUrl: string | null;
  proofStatus: string;
  status: string;
  approvedById: string | null;
  approvalNotes: string | null;
  scoringImpact: number;
  user?: { firstName: string; lastName: string; employeeCode: string };
  approvedBy?: { firstName: string; lastName: string } | null;
}

export interface LeaveBalance {
  leaveType: string;
  maxDays: number;
  usedDays: number;
  remainingDays: number;
}

interface LeaveListResponse {
  records: LeaveRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ApplyLeaveData {
  leaveType: "SICK" | "PERSONAL" | "EMERGENCY";
  startDate: string;
  endDate: string;
  reason?: string;
}

async function fetchLeaves(params: {
  userId?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<LeaveListResponse> {
  const sp = new URLSearchParams();
  if (params.userId) sp.set("userId", params.userId);
  if (params.status) sp.set("status", params.status);
  if (params.type) sp.set("type", params.type);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.page) sp.set("page", params.page.toString());
  if (params.limit) sp.set("limit", params.limit.toString());
  const res = await fetch(`/api/leaves?${sp.toString()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchBalance(): Promise<LeaveBalance[]> {
  const res = await fetch("/api/leaves/balance");
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function applyLeave(data: ApplyLeaveData): Promise<LeaveRequest> {
  const res = await fetch("/api/leaves", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function updateLeave(params: {
  id: string;
  status?: string;
  approvalNotes?: string;
  proofStatus?: string;
}): Promise<LeaveRequest> {
  const { id, ...body } = params;
  const res = await fetch(`/api/leaves/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function uploadProof(params: { id: string; proofUrl: string }): Promise<LeaveRequest> {
  const res = await fetch(`/api/leaves/${params.id}/proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proofUrl: params.proofUrl }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export function useLeaveList(params: {
  userId?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["leaves", "list", params],
    queryFn: () => fetchLeaves(params),
  });
}

export function useLeaveBalance() {
  return useQuery({
    queryKey: ["leaves", "balance"],
    queryFn: fetchBalance,
  });
}

export function useApplyLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: applyLeave,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}

export function useUpdateLeave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateLeave,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}

export function useUploadProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadProof,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leaves"] });
    },
  });
}
