"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkOutLat: number | null;
  checkOutLng: number | null;
  locationType: string;
  geoFenceId: string | null;
  geoExitCount: number;
  status: string;
  totalHours: number | null;
  overtimeHours: number | null;
  isWfh: boolean;
  isLate: boolean;
  lateByMinutes: number;
  isHalfDay: boolean;
  notes: string | null;
  geoFence?: { id: string; label: string; latitude: number; longitude: number; radiusM: number } | null;
  geoExitLogs?: Array<{ id: string; exitTime: string; returnTime: string | null; distanceFromFence: number }>;
}

interface AttendanceListResponse {
  records: Array<AttendanceRecord & { user?: { firstName: string; lastName: string; employeeCode: string } }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

async function fetchToday(): Promise<AttendanceRecord | null> {
  const res = await fetch("/api/attendance/today");
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch today's attendance");
  return json.data;
}

async function fetchAttendanceList(params: {
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}): Promise<AttendanceListResponse> {
  const searchParams = new URLSearchParams();
  if (params.userId) searchParams.set("userId", params.userId);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());

  const res = await fetch(`/api/attendance?${searchParams.toString()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Failed to fetch attendance");
  return json.data;
}

async function checkIn(coords: { latitude: number; longitude: number }): Promise<AttendanceRecord> {
  const res = await fetch("/api/attendance/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(coords),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Check-in failed");
  return json.data;
}

async function checkOut(coords: { latitude: number; longitude: number }): Promise<AttendanceRecord> {
  const res = await fetch("/api/attendance/check-out", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(coords),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Check-out failed");
  return json.data;
}

async function locationPing(coords: { latitude: number; longitude: number }) {
  const res = await fetch("/api/attendance/location-ping", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(coords),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || "Location ping failed");
  return json.data;
}

/**
 * Hook for today's attendance status
 */
export function useTodayAttendance() {
  return useQuery({
    queryKey: ["attendance", "today"],
    queryFn: fetchToday,
    refetchInterval: 60000, // Refresh every minute
  });
}

/**
 * Hook for attendance list with pagination
 */
export function useAttendanceList(params: {
  userId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["attendance", "list", params],
    queryFn: () => fetchAttendanceList(params),
  });
}

/**
 * Hook for check-in mutation
 */
export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

/**
 * Hook for check-out mutation
 */
export function useCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkOut,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
    },
  });
}

/**
 * Hook for location ping
 */
export function useLocationPing() {
  return useMutation({
    mutationFn: locationPing,
  });
}
