"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface SalaryStructure {
  id: string;
  userId: string;
  basic: number;
  hra: number;
  da: number;
  ta: number;
  specialAllow: number;
  pf: number;
  esi: number;
  tax: number;
  otherDeduct: number;
  netSalary: number;
  currency: string;
  effectiveFrom: string;
  user?: { firstName: string; lastName: string; employeeCode: string };
}

export interface SalarySlip {
  id: string;
  userId: string;
  companyId: string;
  month: string;
  systemGross: number | null;
  systemDeductions: number | null;
  systemNet: number | null;
  systemBreakdown: Record<string, number> | null;
  employeeGross: number | null;
  employeeDeductions: number | null;
  employeeNet: number | null;
  employeeBreakdown: Record<string, number> | null;
  discrepancy: number | null;
  discrepancyNotes: string | null;
  bonusPercentage: number | null;
  bonusAmount: number | null;
  status: string;
  pdfUrl: string | null;
  user?: { firstName: string; lastName: string; employeeCode: string };
}

export interface OfferLetterTemplate {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
}

export interface OfferLetter {
  id: string;
  userId: string;
  content: string;
  pdfUrl: string | null;
  generatedAt: string;
  user?: { firstName: string; lastName: string };
}

interface SlipListResponse {
  records: SalarySlip[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Salary Structure
export function useSalaryStructure(userId?: string) {
  return useQuery({
    queryKey: ["salary", "structure", userId],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (userId) sp.set("userId", userId);
      const res = await fetch(`/api/salary/structure?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as SalaryStructure | null;
    },
  });
}

export function useUpsertStructure() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<SalaryStructure> & { userId: string; effectiveFrom: string }) => {
      const res = await fetch("/api/salary/structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as SalaryStructure;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salary"] }),
  });
}

// Salary Slips
export function useSalarySlips(params: { userId?: string; month?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["salary", "slips", params],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (params.userId) sp.set("userId", params.userId);
      if (params.month) sp.set("month", params.month);
      if (params.page) sp.set("page", params.page.toString());
      if (params.limit) sp.set("limit", params.limit.toString());
      const res = await fetch(`/api/salary/slips?${sp}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as SlipListResponse;
    },
  });
}

export function useGenerateSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; month: string }) => {
      const res = await fetch("/api/salary/slips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as SalarySlip;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salary"] }),
  });
}

export function useUpdateSlip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; [key: string]: unknown }) => {
      const { id, ...body } = params;
      const res = await fetch(`/api/salary/slips/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as SalarySlip;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salary"] }),
  });
}

// Offer Letters
export function useOfferTemplates() {
  return useQuery({
    queryKey: ["salary", "offer-templates"],
    queryFn: async () => {
      const res = await fetch("/api/salary/offer-letters");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as OfferLetterTemplate[];
    },
  });
}

export function useCreateOfferTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; content: string }) => {
      const res = await fetch("/api/salary/offer-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salary", "offer-templates"] }),
  });
}

export function useGenerateOfferLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { userId: string; templateId: string }) => {
      const res = await fetch("/api/salary/offer-letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as OfferLetter;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salary"] }),
  });
}
