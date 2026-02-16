"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface PerfScoreDetail {
  parameterId: string;
  parameterName: string;
  weight: number;
  rawValue: number;
  normalizedScore: number;
  weightedScore: number;
}

export interface UserPerformance {
  userId: string;
  userName: string;
  employeeCode: string;
  totalScore: number;
  bonusPercentage: number;
  tier: string;
  tierColor: string;
  scores: PerfScoreDetail[];
}

export interface UserPerformanceDetail extends UserPerformance {
  period: string;
  history: Array<{
    period: string;
    totalScore: number;
    bonusPercentage: number;
    tier: string;
  }>;
}

export interface PerfParameter {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  formula: string;
  dataSource: string | null;
  isActive: boolean;
  sortOrder: number;
}

async function fetchRankings(period?: string): Promise<UserPerformance[]> {
  const sp = new URLSearchParams();
  if (period) sp.set("period", period);
  const res = await fetch(`/api/performance?${sp.toString()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchUserPerformance(userId: string, period?: string): Promise<UserPerformanceDetail> {
  const sp = new URLSearchParams();
  if (period) sp.set("period", period);
  const res = await fetch(`/api/performance/${userId}?${sp.toString()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function triggerCalculation(period: string): Promise<{ calculated: number; period: string }> {
  const res = await fetch(`/api/performance?period=${period}`, {
    method: "POST",
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchParameters(): Promise<PerfParameter[]> {
  const res = await fetch("/api/admin/parameters");
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function createParameter(data: Partial<PerfParameter>): Promise<PerfParameter> {
  const res = await fetch("/api/admin/parameters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function updateParameter(params: { id: string; [key: string]: unknown }): Promise<PerfParameter> {
  const { id, ...body } = params;
  const res = await fetch(`/api/admin/parameters/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function deleteParameter(id: string): Promise<void> {
  const res = await fetch(`/api/admin/parameters/${id}`, { method: "DELETE" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
}

export function useRankings(period?: string) {
  return useQuery({
    queryKey: ["performance", "rankings", period],
    queryFn: () => fetchRankings(period),
  });
}

export function useUserPerformance(userId: string | null, period?: string) {
  return useQuery({
    queryKey: ["performance", "user", userId, period],
    queryFn: () => fetchUserPerformance(userId!, period),
    enabled: !!userId,
  });
}

export function useTriggerCalculation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: triggerCalculation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["performance"] }),
  });
}

export function useParameters() {
  return useQuery({
    queryKey: ["parameters"],
    queryFn: fetchParameters,
  });
}

export function useCreateParameter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createParameter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parameters"] }),
  });
}

export function useUpdateParameter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateParameter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parameters"] }),
  });
}

export function useDeleteParameter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteParameter,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parameters"] }),
  });
}
