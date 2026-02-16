"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  ListTodo,
  Plus,
  X,
  Loader2,
  Save,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Star,
  ChevronLeft,
  ChevronRight,
  Target,
  Zap,
  Calendar,
  User,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useTaskList,
  useTaskStats,
  useCreateTask,
  useUpdateTask,
  useSubmitReview,
  useRespondToReview,
  type Task,
} from "@/hooks/use-tasks";

function getPriorityBadge(p: string) {
  const map: Record<string, string> = {
    urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", map[p] || map.normal)}>{p.toUpperCase()}</span>;
}

function getStatusBadge(s: string) {
  const map: Record<string, { color: string; icon: React.ReactNode }> = {
    ASSIGNED: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: <Clock size={12} /> },
    IN_PROGRESS: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <Play size={12} /> },
    COMPLETED: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle2 size={12} /> },
    OVERDUE: { color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <AlertTriangle size={12} /> },
    CANCELLED: { color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400", icon: <XCircle size={12} /> },
  };
  const st = map[s] || map.ASSIGNED;
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", st.color)}>{st.icon}{s.replace("_", " ")}</span>;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function daysUntil(d: string) {
  const diff = Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Due today";
  return `${diff}d left`;
}

interface SimpleUser {
  id: string;
  firstName: string;
  lastName: string;
  employeeCode: string;
  role: string;
}

export default function TasksPage() {
  const { data: session } = useSession();
  const isReviewerOrAbove = ["REVIEWER", "ADMIN", "SUPER_ADMIN"].includes(session?.user?.role || "");

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [reviewScore, setReviewScore] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [staffComment, setStaffComment] = useState("");

  const statsQuery = useTaskStats();
  const listQuery = useTaskList({ status: statusFilter || undefined, page, limit: 15 });
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const reviewMutation = useSubmitReview();
  const respondMutation = useRespondToReview();

  const usersQuery = useQuery({
    queryKey: ["users", "staff"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as SimpleUser[];
    },
    enabled: isReviewerOrAbove,
  });

  const [form, setForm] = useState({ assignedToId: "", title: "", description: "", deadline: "", priority: "normal" });
  const [formError, setFormError] = useState("");

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.assignedToId || !form.title || !form.deadline) {
      setFormError("Assignee, title, and deadline are required");
      return;
    }
    createMutation.mutate(form, {
      onSuccess: () => { setShowCreate(false); setForm({ assignedToId: "", title: "", description: "", deadline: "", priority: "normal" }); },
      onError: (err) => setFormError(err.message),
    });
  }

  const stats = statsQuery.data;
  const kanbanCounts = listQuery.data?.counts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
            <ListTodo size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tasks</h1>
            <p className="text-gray-500">Manage and track task assignments</p>
          </div>
        </div>
        {isReviewerOrAbove && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:from-blue-500 hover:to-indigo-500"
          >
            <Plus size={18} /> Assign Task
          </button>
        )}
      </div>

      {/* Kanban Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Assigned", count: kanbanCounts?.assigned ?? stats?.assigned ?? 0, color: "blue", icon: <Clock size={20} /> },
          { label: "In Progress", count: kanbanCounts?.inProgress ?? stats?.inProgress ?? 0, color: "amber", icon: <Play size={20} /> },
          { label: "Completed", count: stats?.completed ?? 0, color: "green", icon: <CheckCircle2 size={20} /> },
          { label: "Overdue", count: kanbanCounts?.overdue ?? stats?.overdue ?? 0, color: "red", icon: <AlertTriangle size={20} /> },
          { label: "Backlog", count: stats?.backlogCount ?? 0, color: "purple", icon: <Target size={20} /> },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{item.count}</p>
              </div>
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg",
                item.color === "blue" ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30" :
                item.color === "amber" ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30" :
                item.color === "green" ? "bg-green-100 text-green-600 dark:bg-green-900/30" :
                item.color === "red" ? "bg-red-100 text-red-600 dark:bg-red-900/30" :
                "bg-purple-100 text-purple-600 dark:bg-purple-900/30"
              )}>
                {item.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Score averages */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <Zap size={20} className="text-blue-500" />
            <div><p className="text-xs text-gray-500">Avg Speed Score</p><p className="text-xl font-bold text-gray-900 dark:text-white">{stats.avgSpeedScore !== null ? `${stats.avgSpeedScore}%` : "—"}</p></div>
          </div>
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <Star size={20} className="text-amber-500" />
            <div><p className="text-xs text-gray-500">Avg Accuracy Score</p><p className="text-xl font-bold text-gray-900 dark:text-white">{stats.avgAccuracyScore !== null ? `${stats.avgAccuracyScore}%` : "—"}</p></div>
          </div>
        </div>
      )}

      {/* Create Task Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign New Task</h3>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
            </div>
            {formError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">{formError}</div>}
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Assign To</label>
                <select value={form.assignedToId} onChange={(e) => setForm((p) => ({ ...p, assignedToId: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <option value="">Select employee...</option>
                  {usersQuery.data?.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.employeeCode}) — {u.role}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Task Title</label>
                <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Enter task title..." className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description (optional)</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} placeholder="Task details..." className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Deadline</label>
                  <input type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Priority</label>
                  <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                  {createMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Assign Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Task Details</h3>
              <button onClick={() => { setSelectedTask(null); setReviewScore(""); setReviewNotes(""); setStaffComment(""); }} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">{selectedTask.title}</h4>
              {selectedTask.description && <p className="text-gray-600 dark:text-gray-400">{selectedTask.description}</p>}
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-gray-500">Status</span><div className="mt-1">{getStatusBadge(selectedTask.status)}</div></div>
                <div><span className="text-gray-500">Priority</span><div className="mt-1">{getPriorityBadge(selectedTask.priority)}</div></div>
                <div><span className="text-gray-500">Deadline</span><p className="mt-1 font-medium text-gray-900 dark:text-white">{formatDate(selectedTask.deadline)}</p></div>
                <div><span className="text-gray-500">Time</span><p className={cn("mt-1 font-medium", selectedTask.status === "COMPLETED" ? "text-green-600" : new Date(selectedTask.deadline) < new Date() ? "text-red-600" : "text-gray-900 dark:text-white")}>{daysUntil(selectedTask.deadline)}</p></div>
              </div>
              {selectedTask.assignedTo && <div className="flex justify-between"><span className="text-gray-500">Assigned To</span><span className="font-medium">{selectedTask.assignedTo.firstName} {selectedTask.assignedTo.lastName}</span></div>}
              {selectedTask.assignedBy && <div className="flex justify-between"><span className="text-gray-500">Assigned By</span><span className="font-medium">{selectedTask.assignedBy.firstName} {selectedTask.assignedBy.lastName}</span></div>}
              {selectedTask.speedScore !== null && <div className="flex justify-between"><span className="text-gray-500">Speed Score</span><span className={cn("font-bold", selectedTask.speedScore >= 80 ? "text-green-600" : selectedTask.speedScore >= 50 ? "text-amber-600" : "text-red-600")}>{selectedTask.speedScore}%</span></div>}
              {selectedTask.backlogWeeks > 0 && <div className="flex justify-between"><span className="text-gray-500">Backlog</span><span className="font-medium text-red-600">{selectedTask.backlogWeeks} week{selectedTask.backlogWeeks !== 1 ? "s" : ""}</span></div>}

              {/* Reviews */}
              {selectedTask.reviews && selectedTask.reviews.length > 0 && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Accuracy Review</p>
                  {selectedTask.reviews.map((r) => (
                    <div key={r.id} className="space-y-2">
                      <div className="flex justify-between"><span className="text-gray-500">Score</span><span className="text-lg font-bold text-blue-600">{r.accuracyScore}%</span></div>
                      {r.reviewerNotes && <p className="text-gray-600 dark:text-gray-400"><MessageSquare size={12} className="mr-1 inline" />{r.reviewerNotes}</p>}
                      <div className="flex justify-between"><span className="text-gray-500">Staff Agreement</span><span className={cn("font-medium", r.staffAgreed ? "text-green-600" : "text-amber-600")}>{r.staffAgreed ? "Agreed" : "Pending"}</span></div>
                      {r.staffComments && <p className="text-gray-600 dark:text-gray-400">Staff: {r.staffComments}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
              {/* Start task */}
              {selectedTask.status === "ASSIGNED" && (
                <button onClick={() => updateMutation.mutate({ id: selectedTask.id, status: "IN_PROGRESS" }, { onSuccess: (d) => setSelectedTask(d) })} disabled={updateMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50">
                  <Play size={16} /> Start Task
                </button>
              )}

              {/* Complete task */}
              {selectedTask.status === "IN_PROGRESS" && (
                <button onClick={() => updateMutation.mutate({ id: selectedTask.id, status: "COMPLETED" }, { onSuccess: (d) => setSelectedTask(d) })} disabled={updateMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50">
                  <CheckCircle2 size={16} /> Mark Complete
                </button>
              )}

              {/* Review (for reviewers, completed tasks without review) */}
              {isReviewerOrAbove && selectedTask.status === "COMPLETED" && (!selectedTask.reviews || selectedTask.reviews.length === 0) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Review Accuracy</p>
                  <div className="flex gap-2">
                    <input type="number" min="0" max="100" value={reviewScore} onChange={(e) => setReviewScore(e.target.value)} placeholder="Score (0-100)" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                    <input type="text" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Notes..." className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                  </div>
                  <button onClick={() => reviewMutation.mutate({ taskId: selectedTask.id, accuracyScore: parseFloat(reviewScore), reviewerNotes: reviewNotes }, { onSuccess: () => { setSelectedTask(null); setReviewScore(""); setReviewNotes(""); } })} disabled={!reviewScore || reviewMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                    <Star size={16} /> Submit Review
                  </button>
                </div>
              )}

              {/* Staff agree/dispute */}
              {selectedTask.status === "COMPLETED" && selectedTask.reviews && selectedTask.reviews.length > 0 && !selectedTask.reviews[0].staffAgreed && selectedTask.assignedToId === session?.user?.id && (
                <div className="space-y-2">
                  <input type="text" value={staffComment} onChange={(e) => setStaffComment(e.target.value)} placeholder="Comments (optional)..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                  <div className="flex gap-2">
                    <button onClick={() => respondMutation.mutate({ taskId: selectedTask.id, staffAgreed: true, staffComments: staffComment }, { onSuccess: () => setSelectedTask(null) })} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-500">
                      <ThumbsUp size={14} /> Agree
                    </button>
                    <button onClick={() => respondMutation.mutate({ taskId: selectedTask.id, staffAgreed: false, staffComments: staffComment }, { onSuccess: () => setSelectedTask(null) })} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-500">
                      <ThumbsDown size={14} /> Dispute
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task List */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="flex flex-col items-start justify-between gap-4 border-b border-gray-200 p-6 dark:border-gray-800 sm:flex-row sm:items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isReviewerOrAbove ? "All Tasks" : "My Tasks"}
          </h3>
          <div className="flex flex-wrap gap-2">
            {["", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "OVERDUE"].map((s) => (
              <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", statusFilter === s ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800")}>
                {s ? s.replace("_", " ") : "All"}
              </button>
            ))}
          </div>
        </div>

        <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
          {listQuery.isLoading ? (
            <div className="px-6 py-12 text-center"><Loader2 size={24} className="mx-auto animate-spin text-gray-400" /></div>
          ) : listQuery.data?.records.length === 0 ? (
            <div className="px-6 py-12 text-center"><ListTodo size={32} className="mx-auto text-gray-300" /><p className="mt-2 text-sm text-gray-500">No tasks found</p></div>
          ) : (
            listQuery.data?.records.map((task) => (
              <div key={task.id} onClick={() => setSelectedTask(task)} className="flex cursor-pointer items-center gap-4 px-6 py-4 transition hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                {/* Status icon */}
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                  task.status === "COMPLETED" ? "bg-green-100 dark:bg-green-900/30" :
                  task.status === "OVERDUE" ? "bg-red-100 dark:bg-red-900/30" :
                  task.status === "IN_PROGRESS" ? "bg-amber-100 dark:bg-amber-900/30" :
                  "bg-blue-100 dark:bg-blue-900/30"
                )}>
                  {task.status === "COMPLETED" ? <CheckCircle2 size={18} className="text-green-600" /> :
                   task.status === "OVERDUE" ? <AlertTriangle size={18} className="text-red-600" /> :
                   task.status === "IN_PROGRESS" ? <Play size={18} className="text-amber-600" /> :
                   <Clock size={18} className="text-blue-600" />}
                </div>

                {/* Task info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-gray-900 dark:text-white">{task.title}</p>
                    {getPriorityBadge(task.priority)}
                  </div>
                  <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                    {task.assignedTo && <span className="flex items-center gap-1"><User size={12} />{task.assignedTo.firstName} {task.assignedTo.lastName}</span>}
                    <span className="flex items-center gap-1"><Calendar size={12} />{formatDate(task.deadline)}</span>
                    <span className={cn(new Date(task.deadline) < new Date() && task.status !== "COMPLETED" ? "text-red-600 font-medium" : "")}>{daysUntil(task.deadline)}</span>
                  </div>
                </div>

                {/* Scores */}
                <div className="hidden items-center gap-4 sm:flex">
                  {task.speedScore !== null && (
                    <div className="text-center"><p className="text-xs text-gray-500">Speed</p><p className={cn("text-sm font-bold", task.speedScore >= 80 ? "text-green-600" : task.speedScore >= 50 ? "text-amber-600" : "text-red-600")}>{task.speedScore}%</p></div>
                  )}
                  {task.reviews && task.reviews.length > 0 && (
                    <div className="text-center"><p className="text-xs text-gray-500">Accuracy</p><p className="text-sm font-bold text-blue-600">{task.reviews[0].accuracyScore}%</p></div>
                  )}
                </div>

                {/* Status badge */}
                <div className="hidden sm:block">{getStatusBadge(task.status)}</div>
              </div>
            ))
          )}
        </div>

        {listQuery.data && listQuery.data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-800">
            <p className="text-sm text-gray-500">Page {listQuery.data.page} of {listQuery.data.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= (listQuery.data?.totalPages ?? 1)} className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
