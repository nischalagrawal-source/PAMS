"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Search,
  User,
  Upload,
  Eye,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Loader2,
  ChevronRight,
  Briefcase,
  FileBadge,
  CreditCard,
  Camera,
  Landmark,
  GraduationCap,
  Award,
  Banknote,
  RefreshCw,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  designation: string | null;
  role: string;
  isActive: boolean;
}

interface OnboardingDoc {
  id: string;
  userId: string;
  type: string;
  fileUrl: string;
  fileName: string;
  fileSizeKb: number;
  mimeType: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  notes: string | null;
  uploadedAt: string;
}

interface OfferLetterRecord {
  id: string;
  content: string;
  generatedAt: string;
  user: { firstName: string; lastName: string; designation: string | null };
  template: { name: string };
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DOC_TYPES: {
  key: string;
  label: string;
  icon: React.ReactNode;
  multi?: boolean;
}[] = [
  { key: "AADHAAR", label: "Aadhaar Card", icon: <FileBadge size={20} /> },
  { key: "PAN", label: "PAN Card", icon: <CreditCard size={20} /> },
  { key: "PASSPORT_PHOTO", label: "Passport Photo", icon: <Camera size={20} /> },
  { key: "BANK_DETAILS", label: "Bank Details / Cheque", icon: <Landmark size={20} /> },
  { key: "EDUCATION_CERT", label: "Education Certificate", icon: <GraduationCap size={20} /> },
  { key: "EXPERIENCE_CERT", label: "Experience / Relieving Letter", icon: <Award size={20} /> },
  { key: "PREV_SALARY_SLIP", label: "Previous Salary Slips", icon: <Banknote size={20} />, multi: true },
];

const STATUS_CONFIG = {
  PENDING: { label: "Pending", color: "text-yellow-600 bg-yellow-50 border-yellow-200", icon: <Clock size={13} /> },
  VERIFIED: { label: "Verified", color: "text-green-700 bg-green-50 border-green-200", icon: <CheckCircle2 size={13} /> },
  REJECTED: { label: "Rejected", color: "text-red-600 bg-red-50 border-red-200", icon: <XCircle size={13} /> },
};

const DEFAULT_RESPONSIBILITIES = `Managing, executing, and ensuring timely completion of all types of audits and tax compliance for NR Agrawal & Co
Compliance with regards to direct & indirect taxation
Bank & PSU audits & assurance
Any other audits/compliance/appeals under various statutes
Engaging in any activity ancillary to the core functions of the partnership firm or its branches`;

const DEFAULT_KYC_DOCS = `PAN Card copy
Aadhaar Card copy
Educational qualification certificates
Experience certificates (if applicable)
Passport size photographs (2 copies)
Bank account details with cancelled cheque
Address proof`;

// ─── Offer letter print wrapper ─────────────────────────────────────────────

function printOfferLetter(content: string, name: string) {
  const win = window.open("", "_blank");
  if (!win) {
    alert("Please allow popups to preview the offer letter.");
    return;
  }
  win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Offer Letter — ${name}</title>
  <style>
    @media print {
      @page { size: A4 portrait; margin: 18mm 22mm 20mm 22mm; }
      .print-btn { display: none !important; }
    }
    body { max-width: 820px; margin: 0 auto; padding: 24px; background: #fff; }
    .print-btn {
      position: fixed; top: 16px; right: 16px; z-index: 99;
      padding: 10px 20px; background: #1a237e; color: #fff;
      border: none; border-radius: 8px; font-size: 14px;
      cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .print-btn:hover { background: #283593; }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
  ${content}
</body>
</html>`);
  win.document.close();
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const queryClient = useQueryClient();

  // Employee selection
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState<"docs" | "offer">("docs");

  // KYC upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);

  // Offer letter form
  const [offerForm, setOfferForm] = useState({
    positionTitle: "",
    monthlyGross: "",
    revisedSalary: "",
    revisedSalaryEffectiveFrom: "",
    probationPeriodMonths: "6",
    securityDeposit: "1000",
    joiningDate: "",
    issueDate: new Date().toISOString().slice(0, 10),
    minCommitmentUntil: "",
    noticePeriodMonths: "1",
    leaveEntitlementAnnual: "12",
    festivalLeavesPerYear: "13",
    workingDays: "Monday to Friday and every 1st, 3rd & 5th Saturday",
    workingHours: "9:30 AM to 5:30 PM",
    lateArrivalGraceCount: "3",
    lateArrivalCutoff: "9:45 AM",
    hrEmail: "nischal@nragroup.in",
    emergencyWhatsapp: "9930007074",
    responsibilitiesText: DEFAULT_RESPONSIBILITIES,
    kycDocumentsText: DEFAULT_KYC_DOCS,
  });
  const [generatingOffer, setGeneratingOffer] = useState(false);
  const [seedingTemplates, setSeedingTemplates] = useState(false);

  // ── Data queries ──────────────────────────────────────────

  const employeesQuery = useQuery({
    queryKey: ["admin", "users", ""],
    queryFn: async () => {
      const res = await fetch("/api/admin/users");
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as Employee[];
    },
  });

  const docsQuery = useQuery({
    queryKey: ["onboarding", "docs", selectedEmp?.id],
    enabled: !!selectedEmp,
    queryFn: async () => {
      const res = await fetch(`/api/admin/onboarding/documents?userId=${selectedEmp!.id}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as OnboardingDoc[];
    },
  });

  // ── Mutations ──────────────────────────────────────────────

  const verifyMutation = useMutation({
    mutationFn: async ({ docId, status, notes }: { docId: string; status: string; notes?: string }) => {
      const res = await fetch(`/api/admin/onboarding/documents/${docId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding", "docs", selectedEmp?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/admin/onboarding/documents/${docId}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["onboarding", "docs", selectedEmp?.id] }),
  });

  // ── Handlers ──────────────────────────────────────────────

  async function handleUpload(docType: string, file: File) {
    if (!selectedEmp) return;
    setUploadingType(docType);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("userId", selectedEmp.id);
      fd.append("docType", docType);
      const res = await fetch("/api/admin/onboarding/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      queryClient.invalidateQueries({ queryKey: ["onboarding", "docs", selectedEmp.id] });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploadingType(null);
    }
  }

  function triggerUpload(docType: string) {
    if (!fileInputRef.current) return;
    fileInputRef.current.setAttribute("data-dtype", docType);
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const dtype = e.target.getAttribute("data-dtype");
    if (!file || !dtype) return;
    handleUpload(dtype, file);
  }

  async function handleGenerateOffer() {
    if (!selectedEmp) return;
    setGeneratingOffer(true);
    try {
      const res = await fetch("/api/salary/offer-letters/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedEmp.id,
          offerData: {
            positionTitle: offerForm.positionTitle || selectedEmp.designation,
            monthlyGross: offerForm.monthlyGross ? parseFloat(offerForm.monthlyGross) : undefined,
            revisedSalary: offerForm.revisedSalary ? parseFloat(offerForm.revisedSalary) : undefined,
            revisedSalaryEffectiveFrom: offerForm.revisedSalaryEffectiveFrom || undefined,
            probationPeriodMonths: parseInt(offerForm.probationPeriodMonths) || 6,
            securityDeposit: offerForm.securityDeposit ? parseFloat(offerForm.securityDeposit) : undefined,
            joiningDate: offerForm.joiningDate || undefined,
            issueDate: offerForm.issueDate || undefined,
            minCommitmentUntil: offerForm.minCommitmentUntil || undefined,
            noticePeriodMonths: parseInt(offerForm.noticePeriodMonths) || 1,
            leaveEntitlementAnnual: parseInt(offerForm.leaveEntitlementAnnual) || 12,
            festivalLeavesPerYear: parseInt(offerForm.festivalLeavesPerYear) || 13,
            workingDays: offerForm.workingDays,
            workingHours: offerForm.workingHours,
            lateArrivalGraceCount: parseInt(offerForm.lateArrivalGraceCount) || 3,
            lateArrivalCutoff: offerForm.lateArrivalCutoff,
            hrEmail: offerForm.hrEmail,
            emergencyWhatsapp: offerForm.emergencyWhatsapp,
            responsibilitiesText: offerForm.responsibilitiesText,
            kycDocumentsText: offerForm.kycDocumentsText,
          },
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      const letter = json.data as OfferLetterRecord;
      printOfferLetter(
        letter.content,
        `${selectedEmp.firstName} ${selectedEmp.lastName}`
      );
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setGeneratingOffer(false);
    }
  }

  async function handleSeedTemplates() {
    setSeedingTemplates(true);
    try {
      const res = await fetch("/api/salary/offer-letters/seed-defaults", { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      alert("Templates seeded successfully! The professional NR Agrawal & Co template is now active.");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSeedingTemplates(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────

  const allEmployees = employeesQuery.data ?? [];
  const filteredEmployees = allEmployees.filter((e) => {
    const q = search.toLowerCase();
    return (
      !q ||
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.employeeCode.toLowerCase().includes(q)
    );
  });

  const docs = docsQuery.data ?? [];

  function docsForType(type: string) {
    return docs.filter((d) => d.type === type);
  }

  function latestDocForType(type: string) {
    const list = docsForType(type);
    return list.length ? list[list.length - 1] : null;
  }

  function selectEmployee(emp: Employee) {
    setSelectedEmp(emp);
    setActiveTab("docs");
    setOfferForm((f) => ({
      ...f,
      positionTitle: emp.designation ?? "",
      joiningDate: "",
      issueDate: new Date().toISOString().slice(0, 10),
    }));
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-4">
      {/* hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={onFileChange}
      />

      {/* ── Left: Employee List ─────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 p-4 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
              <ClipboardList size={16} className="text-white" />
            </div>
            <h2 className="font-bold text-gray-900 dark:text-white">Onboarding</h2>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employees..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {employeesQuery.isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">No employees found</p>
          ) : (
            filteredEmployees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => selectEmployee(emp)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition",
                  selectedEmp?.id === emp.id
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                    : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                )}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{emp.firstName} {emp.lastName}</p>
                  <p className="truncate text-xs text-gray-500">{emp.employeeCode} · {emp.designation ?? emp.role}</p>
                </div>
                {selectedEmp?.id === emp.id && <ChevronRight size={14} />}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Main Panel ───────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0">
        {!selectedEmp ? (
          <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
            <div className="text-center">
              <User size={48} className="mx-auto mb-3 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-500">Select an employee</h3>
              <p className="mt-1 text-sm text-gray-400">Choose from the list to manage KYC & offer letters</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col gap-4 min-h-0">
            {/* Employee header */}
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/25">
                    {selectedEmp.firstName.charAt(0)}{selectedEmp.lastName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {selectedEmp.firstName} {selectedEmp.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedEmp.employeeCode} · {selectedEmp.designation ?? selectedEmp.role} · {selectedEmp.email}
                    </p>
                  </div>
                </div>
                <span className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  selectedEmp.isActive
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                )}>
                  {selectedEmp.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800/60">
              {(["docs", "offer"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition",
                    activeTab === tab
                      ? "bg-white text-indigo-700 shadow dark:bg-gray-900 dark:text-indigo-300"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                  )}
                >
                  {tab === "docs" ? <><Briefcase size={15} /> KYC Documents</> : <><FileText size={15} /> Offer Letter</>}
                </button>
              ))}
            </div>

            {/* ── KYC Documents Tab ─────────────────────────── */}
            {activeTab === "docs" && (
              <div className="flex-1 overflow-y-auto">
                {docsQuery.isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 size={24} className="animate-spin text-gray-400" />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {DOC_TYPES.map(({ key, label, icon, multi }) => {
                      const typeDocs = docsForType(key);
                      const latest = multi ? null : latestDocForType(key);
                      const statusCfg = latest ? STATUS_CONFIG[latest.status] : null;

                      return (
                        <div
                          key={key}
                          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950"
                        >
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-indigo-600">
                              {icon}
                              <span className="text-sm font-semibold text-gray-800 dark:text-white">{label}</span>
                            </div>
                            {!multi && statusCfg && (
                              <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold", statusCfg.color)}>
                                {statusCfg.icon} {statusCfg.label}
                              </span>
                            )}
                          </div>

                          {/* Single-type doc */}
                          {!multi && latest && (
                            <div className="mb-3 rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-900">
                              <p className="truncate font-medium text-gray-700 dark:text-gray-300">{latest.fileName}</p>
                              <p className="text-gray-400">{latest.fileSizeKb} KB · {new Date(latest.uploadedAt).toLocaleDateString()}</p>
                            </div>
                          )}

                          {/* Multi-type (prev salary slips) */}
                          {multi && typeDocs.length > 0 && (
                            <div className="mb-3 space-y-1">
                              {typeDocs.map((d) => (
                                <div key={d.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs dark:bg-gray-900">
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-gray-700 dark:text-gray-300">{d.fileName}</p>
                                    <p className="text-gray-400">{d.fileSizeKb} KB</p>
                                  </div>
                                  <div className="flex items-center gap-1 ml-2">
                                    <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold", STATUS_CONFIG[d.status].color)}>
                                      {STATUS_CONFIG[d.status].label}
                                    </span>
                                    <a
                                      href={`/api/admin/onboarding/file?path=${encodeURIComponent(d.fileUrl)}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded p-0.5 text-gray-400 hover:text-indigo-600"
                                      title="View"
                                    >
                                      <Eye size={13} />
                                    </a>
                                    <button
                                      onClick={() => { if (confirm("Delete this slip?")) deleteMutation.mutate(d.id); }}
                                      className="rounded p-0.5 text-gray-400 hover:text-red-600"
                                      title="Delete"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Actions */}
                          <div className="flex flex-wrap gap-2">
                            {/* Upload / Re-upload */}
                            <button
                              onClick={() => triggerUpload(key)}
                              disabled={uploadingType === key}
                              className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
                            >
                              {uploadingType === key ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                              {latest || (multi && typeDocs.length > 0) ? "Add / Replace" : "Upload"}
                            </button>

                            {/* View (single) */}
                            {!multi && latest && (
                              <a
                                href={`/api/admin/onboarding/file?path=${encodeURIComponent(latest.fileUrl)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400"
                              >
                                <Eye size={12} /> View
                              </a>
                            )}

                            {/* Verify / Reject (single) */}
                            {!multi && latest && latest.status !== "VERIFIED" && (
                              <button
                                onClick={() => verifyMutation.mutate({ docId: latest.id, status: "VERIFIED" })}
                                disabled={verifyMutation.isPending}
                                className="flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-950/30 dark:text-green-300"
                              >
                                <CheckCircle2 size={12} /> Verify
                              </button>
                            )}
                            {!multi && latest && latest.status !== "REJECTED" && (
                              <button
                                onClick={() => verifyMutation.mutate({ docId: latest.id, status: "REJECTED" })}
                                disabled={verifyMutation.isPending}
                                className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            )}

                            {/* Delete (single) */}
                            {!multi && latest && (
                              <button
                                onClick={() => { if (confirm("Delete this document?")) deleteMutation.mutate(latest.id); }}
                                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 dark:border-gray-700"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Offer Letter Tab ──────────────────────────── */}
            {activeTab === "offer" && (
              <div className="flex-1 overflow-y-auto">
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Left: Form */}
                  <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                    <div className="mb-4 flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900 dark:text-white">Offer Letter Details</h4>
                      <button
                        onClick={handleSeedTemplates}
                        disabled={seedingTemplates}
                        title="Seed the professional NR Agrawal & Co template into the database"
                        className="flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300"
                      >
                        {seedingTemplates ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Sync Templates
                      </button>
                    </div>

                    <div className="space-y-3">
                      {[
                        { label: "Position Title *", key: "positionTitle", type: "text", placeholder: "Semi-Qualified Assistant" },
                        { label: "Probation Salary (₹/month)", key: "monthlyGross", type: "number", placeholder: "29000" },
                        { label: "Post-Probation Salary (₹/month)", key: "revisedSalary", type: "number", placeholder: "32000" },
                        { label: "Post-Probation Effective From", key: "revisedSalaryEffectiveFrom", type: "date", placeholder: "" },
                        { label: "Probation Duration (months)", key: "probationPeriodMonths", type: "number", placeholder: "6" },
                        { label: "Security Deposit (₹/month)", key: "securityDeposit", type: "number", placeholder: "1000" },
                        { label: "Date of Joining", key: "joiningDate", type: "date", placeholder: "" },
                        { label: "Letter Issue Date", key: "issueDate", type: "date", placeholder: "" },
                        { label: "Minimum Commitment Until", key: "minCommitmentUntil", type: "text", placeholder: "January 2026" },
                        { label: "Notice Period (months)", key: "noticePeriodMonths", type: "number", placeholder: "1" },
                        { label: "Paid Leaves Per Year", key: "leaveEntitlementAnnual", type: "number", placeholder: "12" },
                        { label: "Festival Leaves Per Year", key: "festivalLeavesPerYear", type: "number", placeholder: "13" },
                        { label: "Working Days", key: "workingDays", type: "text", placeholder: "" },
                        { label: "Working Hours", key: "workingHours", type: "text", placeholder: "" },
                        { label: "Grace Late Arrivals (count)", key: "lateArrivalGraceCount", type: "number", placeholder: "3" },
                        { label: "Late Arrival Cutoff", key: "lateArrivalCutoff", type: "text", placeholder: "9:45 AM" },
                        { label: "HR Email", key: "hrEmail", type: "email", placeholder: "" },
                        { label: "Emergency WhatsApp", key: "emergencyWhatsapp", type: "text", placeholder: "" },
                      ].map(({ label, key, type, placeholder }) => (
                        <div key={key}>
                          <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>
                          <input
                            type={type}
                            value={offerForm[key as keyof typeof offerForm]}
                            onChange={(e) => setOfferForm((f) => ({ ...f, [key]: e.target.value }))}
                            placeholder={placeholder}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                          />
                        </div>
                      ))}

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">Responsibilities (one per line)</label>
                        <textarea
                          rows={6}
                          value={offerForm.responsibilitiesText}
                          onChange={(e) => setOfferForm((f) => ({ ...f, responsibilitiesText: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>

                      <div>
                        <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">KYC Documents Required (one per line)</label>
                        <textarea
                          rows={5}
                          value={offerForm.kycDocumentsText}
                          onChange={(e) => setOfferForm((f) => ({ ...f, kycDocumentsText: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right: Info + Generate */}
                  <div className="flex flex-col gap-4">
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/20">
                      <h4 className="mb-3 font-semibold text-indigo-800 dark:text-indigo-200">Before Generating</h4>
                      <ul className="space-y-2 text-sm text-indigo-700 dark:text-indigo-300">
                        <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0" /> Click <strong>Sync Templates</strong> once to load the professional NR Agrawal &amp; Co letterhead template</li>
                        <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0" /> Fill in the salary details — probation and post-probation figures</li>
                        <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0" /> A new browser tab will open with the formatted letter — use <strong>Print → Save as PDF</strong></li>
                        <li className="flex gap-2"><CheckCircle2 size={15} className="mt-0.5 shrink-0" /> The letter is saved to the system for your records</li>
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                      <h4 className="mb-3 font-semibold text-gray-900 dark:text-white">Auto-Filled from Firm Settings</h4>
                      <div className="space-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <p>Working days: Monday – Friday &amp; 1st/3rd/5th Saturday</p>
                        <p>Timings: 9:30 AM – 5:30 PM</p>
                        <p>Late grace: 3 arrivals until 9:45 AM</p>
                        <p>Paid leaves: 12/year · Festival holidays: 13</p>
                        <p>HR email: nischal@nragroup.in</p>
                        <p>Emergency WhatsApp: 9930007074</p>
                        <p>Security deposit: Refunded with 13th-month salary</p>
                        <p>Confidentiality, conflict of interest &amp; sandwich leave clauses included automatically</p>
                        <p>Holiday annexure for current year included</p>
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateOffer}
                      disabled={generatingOffer || !offerForm.positionTitle}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50"
                    >
                      {generatingOffer ? (
                        <><Loader2 size={20} className="animate-spin" /> Generating…</>
                      ) : (
                        <><Save size={20} /> Generate &amp; Preview Offer Letter</>
                      )}
                    </button>

                    <p className="text-center text-xs text-gray-400">
                      Opens in a new tab &bull; Use browser Print (Ctrl+P) to save as PDF
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
