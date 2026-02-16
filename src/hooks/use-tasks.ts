"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Task {
  id: string;
  assignedToId: string;
  assignedById: string;
  title: string;
  description: string | null;
  deadline: string;
  completedAt: string | null;
  status: string;
  priority: string;
  isOverdue: boolean;
  specialPermission: boolean;
  specialPermNote: string | null;
  backlogWeeks: number;
  speedScore: number | null;
  isWfhTask: boolean;
  createdAt: string;
  assignedTo?: { firstName: string; lastName: string; employeeCode: string };
  assignedBy?: { firstName: string; lastName: string };
  reviews?: Array<{
    id: string;
    accuracyScore: number;
    staffAgreed: boolean;
    staffComments: string | null;
    reviewerNotes: string | null;
    reviewer?: { firstName: string; lastName: string };
  }>;
}

export interface TaskStats {
  total: number;
  assigned: number;
  inProgress: number;
  completed: number;
  overdue: number;
  cancelled: number;
  avgSpeedScore: number | null;
  avgAccuracyScore: number | null;
  backlogCount: number;
}

interface TaskListResponse {
  records: Task[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: { assigned: number; inProgress: number; completed: number; overdue: number };
}

interface CreateTaskData {
  assignedToId: string;
  title: string;
  description?: string;
  deadline: string;
  priority?: string;
}

async function fetchTasks(params: {
  assignedToId?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}): Promise<TaskListResponse> {
  const sp = new URLSearchParams();
  if (params.assignedToId) sp.set("assignedToId", params.assignedToId);
  if (params.status) sp.set("status", params.status);
  if (params.priority) sp.set("priority", params.priority);
  if (params.page) sp.set("page", params.page.toString());
  if (params.limit) sp.set("limit", params.limit.toString());
  const res = await fetch(`/api/tasks?${sp.toString()}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchTaskStats(): Promise<TaskStats> {
  const res = await fetch("/api/tasks/stats");
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function fetchTask(id: string): Promise<Task> {
  const res = await fetch(`/api/tasks/${id}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function createTask(data: CreateTaskData): Promise<Task> {
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function updateTask(params: { id: string; [key: string]: unknown }): Promise<Task> {
  const { id, ...body } = params;
  const res = await fetch(`/api/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
}

async function submitReview(params: { taskId: string; accuracyScore: number; reviewerNotes?: string }): Promise<unknown> {
  const { taskId, ...body } = params;
  const res = await fetch(`/api/tasks/${taskId}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

async function respondToReview(params: { taskId: string; staffAgreed: boolean; staffComments?: string }): Promise<unknown> {
  const { taskId, ...body } = params;
  const res = await fetch(`/api/tasks/${taskId}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error);
  return json.data;
}

export function useTaskList(params: {
  assignedToId?: string;
  status?: string;
  priority?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["tasks", "list", params],
    queryFn: () => fetchTasks(params),
  });
}

export function useTaskStats() {
  return useQuery({
    queryKey: ["tasks", "stats"],
    queryFn: fetchTaskStats,
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: () => fetchTask(id!),
    enabled: !!id,
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: submitReview,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useRespondToReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: respondToReview,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
