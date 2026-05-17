"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  FileText,
  Settings,
  Plus,
  Trash2,
  Eye,
  Download,
  CheckCircle2,
  Clock,
  Search,
  Loader2,
  Save,
  ChevronRight,
  Users,
  Briefcase,
  X,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────

interface InductionPointer {
  key: string;          // e.g. "CTC", "DESIGNATION"
  label: string;        // Display name
  type: "text" | "number" | "date" | "select";
  options?: string[];   // For select type
  required: boolean;
  defaultValue?: string;
  section: "personal" | "employment" | "compensation" | "policies";
}

interface OfferLetterTemplate {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeCode: string;
  designation: string | null;
  department: string | null;
  dateOfJoining: string | null;
}

interface OfferLetter {
  id: string;
  generatedAt: string;
  content: string;
  user: { firstName: string; lastName: string; designation: string | null };
  template: { name: string };
}

// ─── Default Pointers Config ────────────────────────────────────

const DEFAULT_POINTERS: InductionPointer[] = [
  // Personal
  { key: "CANDIDATE_NAME", label: "Candidate Full Name", type: "text", required: true, section: "personal" },
  { key: "CANDIDATE_ADDRESS", label: "Candidate Address", type: "text", required: false, section: "personal" },
  { key: "FATHER_NAME", label: "Father's Name", type: "text", required: false, section: "personal" },
  // Employment
  { key: "DESIGNATION", label: "Designation / Position", type: "text", required: true, section: "employment" },
  { key: "DEPARTMENT", label: "Department", type: "text", required: false, section: "employment" },
  { key: "JOINING_DATE", label: "Date of Joining", type: "date", required: true, section: "employment" },
  { key: "REPORTING_TO", label: "Reporting To", type: "text", required: false, section: "employment" },
  { key: "WORK_LOCATION", label: "Work Location / Branch", type: "text", required: false, section: "employment" },
  { key: "PROBATION_MONTHS", label: "Probation Period (months)", type: "number", required: true, defaultValue: "6", section: "employment" },
  { key: "NOTICE_PERIOD_MONTHS", label: "Notice Period (months)", type: "number", required: true, defaultValue: "1", section: "employment" },
  { key: "EMPLOYMENT_TYPE", label: "Employment Type", type: "select", options: ["Full-Time", "Part-Time", "Contract", "Internship"], required: true, defaultValue: "Full-Time", section: "employment" },
  // Compensation
  { key: "MONTHLY_GROSS", label: "Monthly Gross CTC (₹)", type: "number", required: true, section: "compensation" },
  { key: "ANNUAL_CTC", label: "Annual CTC (₹)", type: "number", required: true, section: "compensation" },
  { key: "BASIC_SALARY", label: "Basic Salary (₹/month)", type: "number", required: false, section: "compensation" },
  { key: "HRA", label: "HRA (₹/month)", type: "number", required: false, section: "compensation" },
  { key: "SECURITY_DEPOSIT", label: "Security Deposit (₹/month)", type: "number", required: false, defaultValue: "1000", section: "compensation" },
  // Policies
  { key: "WORKING_HOURS", label: "Working Hours", type: "text", required: true, defaultValue: "9:30 AM to 6:30 PM", section: "policies" },
  { key: "WORKING_DAYS", label: "Working Days", type: "text", required: true, defaultValue: "Monday to Friday + alternate Saturdays", section: "policies" },
  { key: "LEAVE_ENTITLEMENT", label: "Annual Leave Entitlement (days)", type: "number", required: false, defaultValue: "12", section: "policies" },
  { key: "ISSUE_DATE", label: "Letter Issue Date", type: "date", required: true, section: "policies" },
  { key: "SIGNATORY_NAME", label: "Signatory Name", type: "text", required: true, section: "policies" },
  { key: "SIGNATORY_TITLE", label: "Signatory Title", type: "text", required: true, defaultValue: "Authorised Signatory", section: "policies" },
];

const SECTION_LABELS = {
  personal: "Personal Details",
  employment: "Employment Terms",
  compensation: "Compensation & Benefits",
  policies: "Policies & Signatories",
};

// ─── Default Legal Clause texts ─────────────────────────────────

export const DEFAULT_CLAUSES = {
  conflictOfInterest: `During the tenure of your employment and for a period of 12 (twelve) months thereafter, you shall not directly or indirectly engage in, assist, or hold any financial interest in any business activity that competes with or conflicts with the interests of the Company. You are required to immediately disclose to the management any existing or potential conflict of interest upon becoming aware of it. Failure to disclose or any breach of this obligation may result in disciplinary action, including termination of employment.`,

  confidentiality: `You acknowledge that during the course of your employment, you will have access to and will become acquainted with confidential and proprietary information of the Company including, but not limited to, trade secrets, client data, business strategies, financial records, product or service information, and employee details (collectively, "Confidential Information"). You agree to hold all such Confidential Information in strict confidence, not to disclose it to any third party without the prior written consent of the Company, and to use it solely for the purposes of your employment. This obligation of confidentiality shall survive the termination of your employment indefinitely. Breach of this clause may result in immediate termination and legal action.`,

  legalRecourse: `This offer of employment and any dispute or claim arising out of or in connection with it, or the employment relationship between you and the Company, shall be governed by and construed in accordance with the laws of India. Any disputes that cannot be resolved amicably between the parties shall be subject to the exclusive jurisdiction of the competent courts of the city in which the Company's registered office is situated. The Company reserves the right to seek interim, injunctive, or other equitable relief in any court of competent jurisdiction to prevent any actual or threatened breach of this agreement.`,
};

const CLAUSE_META = [
  { key: "conflictOfInterest" as const, label: "Conflict of Interest", description: "Prevents employees from working for or having interest in competing businesses" },
  { key: "confidentiality" as const, label: "Confidentiality & Non-Disclosure", description: "Covers trade secrets, client data, and all proprietary information" },
  { key: "legalRecourse" as const, label: "Legal Recourse & Governing Law", description: "Jurisdiction and dispute resolution mechanism" },
];

// ─── Generate offer letter content from pointers ─────────────────

function generateOfferLetterContent(
  values: Record<string, string>,
  companyName: string,
  companyAddress: string,
  clauses: typeof DEFAULT_CLAUSES,
  templateContent?: string
): string {
  const fmt = (k: string, fallback = `[${k}]`) => values[k] || fallback;
  const annualCTC = parseFloat(values.ANNUAL_CTC || "0");
  const monthlyGross = parseFloat(values.MONTHLY_GROSS || "0");

  if (templateContent) {
    let content = templateContent;
    for (const [k, v] of Object.entries(values)) {
      content = content.replaceAll(`{{${k}}}`, v);
    }
    return content;
  }

  // Auto-generate professional offer letter
  return `
<div style="font-family: 'Times New Roman', serif; font-size: 12pt; color: #1a1a1a; line-height: 1.7; max-width: 720px; margin: 0 auto; padding: 0 24px;">

  <div style="text-align: center; margin-bottom: 28px; padding-bottom: 18px; border-bottom: 2px solid #1a237e;">
    <p style="font-size: 18pt; font-weight: bold; color: #1a237e; margin: 0;">${companyName}</p>
    <p style="font-size: 9pt; color: #555; margin: 4px 0 0;">${companyAddress || ""}</p>
  </div>

  <p style="text-align: right; font-size: 10pt; color: #444;">Date: ${fmt("ISSUE_DATE", new Date().toLocaleDateString("en-IN"))}</p>

  <p style="margin-top: 20px;"><strong>To,</strong></p>
  <p style="margin: 4px 0;">${fmt("CANDIDATE_NAME")}</p>
  ${values.CANDIDATE_ADDRESS ? `<p style="margin: 2px 0; font-size: 10pt; color: #444;">${values.CANDIDATE_ADDRESS}</p>` : ""}

  <p style="margin-top: 20px;"><strong>Subject: Offer of Employment — ${fmt("DESIGNATION")}</strong></p>

  <p style="margin-top: 14px;">Dear ${fmt("CANDIDATE_NAME")},</p>

  <p>We are pleased to offer you the position of <strong>${fmt("DESIGNATION")}</strong>${values.DEPARTMENT ? ` in the <strong>${values.DEPARTMENT}</strong> department` : ""} at <strong>${companyName}</strong>. This letter sets out the terms and conditions of your employment.</p>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10.5pt;">
    <tr style="background: #e8eaf6;">
      <td colspan="2" style="padding: 8px 12px; font-weight: bold; color: #1a237e; font-size: 11pt;">Employment Details</td>
    </tr>
    <tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0; width: 42%;"><strong>Date of Joining</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">${fmt("JOINING_DATE")}</td></tr>
    <tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>Designation</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">${fmt("DESIGNATION")}</td></tr>
    ${values.DEPARTMENT ? `<tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>Department</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">${values.DEPARTMENT}</td></tr>` : ""}
    ${values.REPORTING_TO ? `<tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>Reporting To</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">${values.REPORTING_TO}</td></tr>` : ""}
    ${values.WORK_LOCATION ? `<tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>Work Location</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">${values.WORK_LOCATION}</td></tr>` : ""}
    <tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>Employment Type</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">${fmt("EMPLOYMENT_TYPE", "Full-Time")}</td></tr>
    <tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>Probation Period</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">${fmt("PROBATION_MONTHS", "6")} months from date of joining</td></tr>
    <tr><td style="padding: 7px 12px;"><strong>Notice Period</strong></td><td style="padding: 7px 12px;">${fmt("NOTICE_PERIOD_MONTHS", "1")} month (post-confirmation)</td></tr>
  </table>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10.5pt;">
    <tr style="background: #e8eaf6;">
      <td colspan="2" style="padding: 8px 12px; font-weight: bold; color: #1a237e; font-size: 11pt;">Compensation & Benefits</td>
    </tr>
    ${monthlyGross > 0 ? `<tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0; width: 42%;"><strong>Monthly Gross</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">₹ ${monthlyGross.toLocaleString("en-IN")} per month</td></tr>` : ""}
    ${annualCTC > 0 ? `<tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>Annual CTC</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">₹ ${annualCTC.toLocaleString("en-IN")} per annum</td></tr>` : ""}
    ${values.BASIC_SALARY ? `<tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>Basic Salary</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">₹ ${parseFloat(values.BASIC_SALARY).toLocaleString("en-IN")} per month</td></tr>` : ""}
    ${values.HRA ? `<tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>HRA</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">₹ ${parseFloat(values.HRA).toLocaleString("en-IN")} per month</td></tr>` : ""}
    ${values.SECURITY_DEPOSIT && values.SECURITY_DEPOSIT !== "0" ? `<tr><td style="padding: 7px 12px;"><strong>Security Deposit</strong></td><td style="padding: 7px 12px;">₹ ${parseFloat(values.SECURITY_DEPOSIT).toLocaleString("en-IN")} / month (deducted for 12 months, refundable on completion of service)</td></tr>` : ""}
  </table>

  <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 10.5pt;">
    <tr style="background: #e8eaf6;">
      <td colspan="2" style="padding: 8px 12px; font-weight: bold; color: #1a237e; font-size: 11pt;">Work Policy</td>
    </tr>
    <tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0; width: 42%;"><strong>Working Hours</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">${fmt("WORKING_HOURS")}</td></tr>
    <tr><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;"><strong>Working Days</strong></td><td style="padding: 7px 12px; border-bottom: 1px solid #e0e0e0;">${fmt("WORKING_DAYS")}</td></tr>
    ${values.LEAVE_ENTITLEMENT ? `<tr><td style="padding: 7px 12px;"><strong>Leave Entitlement</strong></td><td style="padding: 7px 12px;">${values.LEAVE_ENTITLEMENT} days per annum</td></tr>` : ""}
  </table>

  <p style="margin-top: 20px;">This offer is subject to your background verification and submission of required KYC documents. Kindly sign and return a copy of this letter as your acceptance by the joining date mentioned above.</p>

  ${clauses.conflictOfInterest ? `
  <div style="margin-top: 24px; padding: 14px 18px; background: #fafafa; border-left: 3px solid #1a237e; font-size: 10pt;">
    <p style="font-weight: bold; color: #1a237e; margin: 0 0 6px;">Conflict of Interest</p>
    <p style="margin: 0; color: #333; line-height: 1.6;">${clauses.conflictOfInterest.replace(/\n/g, "<br/>")}</p>
  </div>` : ""}

  ${clauses.confidentiality ? `
  <div style="margin-top: 14px; padding: 14px 18px; background: #fafafa; border-left: 3px solid #1a237e; font-size: 10pt;">
    <p style="font-weight: bold; color: #1a237e; margin: 0 0 6px;">Confidentiality &amp; Non-Disclosure</p>
    <p style="margin: 0; color: #333; line-height: 1.6;">${clauses.confidentiality.replace(/\n/g, "<br/>")}</p>
  </div>` : ""}

  ${clauses.legalRecourse ? `
  <div style="margin-top: 14px; padding: 14px 18px; background: #fafafa; border-left: 3px solid #1a237e; font-size: 10pt;">
    <p style="font-weight: bold; color: #1a237e; margin: 0 0 6px;">Legal Recourse &amp; Governing Law</p>
    <p style="margin: 0; color: #333; line-height: 1.6;">${clauses.legalRecourse.replace(/\n/g, "<br/>")}</p>
  </div>` : ""}

  <p style="margin-top: 28px;">We look forward to having you as a valuable member of our team.</p>

  <div style="margin-top: 40px;">
    <p>Yours sincerely,</p>
    <p style="margin-top: 50px; font-weight: bold;">${fmt("SIGNATORY_NAME")}</p>
    <p style="margin: 2px 0; color: #555;">${fmt("SIGNATORY_TITLE", "Authorised Signatory")}</p>
    <p style="margin: 2px 0; color: #555;">${companyName}</p>
  </div>

  <div style="margin-top: 48px; padding-top: 16px; border-top: 1px solid #bbb;">
    <p style="font-size: 10pt;"><strong>Acceptance:</strong></p>
    <p style="font-size: 10pt;">I, ${fmt("CANDIDATE_NAME")}, accept the above terms and conditions of employment.</p>
    <table style="width: 100%; margin-top: 28px;">
      <tr>
        <td style="width: 45%;"><p style="border-top: 1px solid #555; padding-top: 4px; font-size: 10pt;">Signature of Candidate</p></td>
        <td style="width: 10%;"></td>
        <td style="width: 45%;"><p style="border-top: 1px solid #555; padding-top: 4px; font-size: 10pt;">Date</p></td>
      </tr>
    </table>
  </div>
</div>
  `.trim();
}

function printOfferLetter(content: string, name: string) {
  const win = window.open("", "_blank");
  if (!win) { alert("Allow popups to preview the letter."); return; }
  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>Offer Letter — ${name}</title>
<style>
  @media print { @page { size: A4 portrait; margin: 20mm 22mm; } .no-print { display: none !important; } }
  body { max-width: 820px; margin: 0 auto; padding: 20px; }
  .no-print { position: fixed; top: 16px; right: 16px; padding: 10px 22px; background: #1a237e; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; }
</style></head><body>
<button class="no-print" onclick="window.print()">🖨 Print / Save as PDF</button>
${content}
</body></html>`);
  win.document.close();
}

// ─── Main Page ──────────────────────────────────────────────────

export default function EmployeeInductionPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"generate" | "templates" | "history">("generate");
  const [search, setSearch] = useState("");
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [pointerValues, setPointerValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [clauseValues, setClauseValues] = useState<typeof DEFAULT_CLAUSES>({ ...DEFAULT_CLAUSES });

  // Init pointer defaults
  useEffect(() => {
    const defaults: Record<string, string> = {};
    DEFAULT_POINTERS.forEach((p) => { if (p.defaultValue) defaults[p.key] = p.defaultValue; });
    defaults.ISSUE_DATE = new Date().toISOString().slice(0, 10);
    setPointerValues(defaults);
  }, []);

  // When employee is selected, prefill pointers
  useEffect(() => {
    if (!selectedEmp) return;
    setPointerValues((prev) => ({
      ...prev,
      CANDIDATE_NAME: `${selectedEmp.firstName} ${selectedEmp.lastName}`,
      DESIGNATION: selectedEmp.designation ?? prev.DESIGNATION ?? "",
      DEPARTMENT: selectedEmp.department ?? prev.DEPARTMENT ?? "",
      JOINING_DATE: selectedEmp.dateOfJoining
        ? new Date(selectedEmp.dateOfJoining).toISOString().slice(0, 10)
        : prev.JOINING_DATE ?? "",
    }));
  }, [selectedEmp]);

  const { data: employees = [], isLoading: loadingEmps } = useQuery<Employee[]>({
    queryKey: ["induction", "employees"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?active=true&limit=500");
      const json = await res.json();
      if (!json.success) return [];
      return json.data.users ?? json.data ?? [];
    },
  });

  const { data: templates = [] } = useQuery<OfferLetterTemplate[]>({
    queryKey: ["offer-letter-templates"],
    queryFn: async () => {
      const res = await fetch("/api/salary/offer-letters");
      const json = await res.json();
      if (!json.success) return [];
      return json.data;
    },
  });

  const { data: history = [] } = useQuery<OfferLetter[]>({
    queryKey: ["offer-letters-history"],
    queryFn: async () => {
      const res = await fetch("/api/salary/offer-letters/list-all");
      const json = await res.json();
      if (!json.success) return [];
      return json.data;
    },
  });

  const companyQuery = useQuery({
    queryKey: ["company-info"],
    queryFn: async () => {
      const res = await fetch("/api/admin/companies/mine");
      const json = await res.json();
      return json.success ? json.data : null;
    },
  });

  const filteredEmps = employees.filter(
    (e) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(search.toLowerCase())
  );

  function handleGenerate() {
    const companyName = companyQuery.data?.name ?? "";
    const companyAddress = companyQuery.data?.address ?? "";
    const content = generateOfferLetterContent(pointerValues, companyName, companyAddress, clauseValues);
    const name = pointerValues.CANDIDATE_NAME || (selectedEmp ? `${selectedEmp.firstName} ${selectedEmp.lastName}` : "Candidate");
    printOfferLetter(content, name);
  }

  const grouped = (["personal", "employment", "compensation", "policies"] as const).map((section) => ({
    section,
    label: SECTION_LABELS[section],
    pointers: DEFAULT_POINTERS.filter((p) => p.section === section),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employee Induction</h1>
          <p className="text-sm text-gray-500">Generate offer letters based on structured pointers. Select an employee or enter details for a new joiner.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-800">
        <nav className="-mb-px flex gap-6">
          {([
            { id: "generate", label: "Generate Offer Letter", icon: FileText },
            { id: "history", label: "Letter History", icon: Clock },
          ] as const).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors", activeTab === tab.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700")}>
              <tab.icon size={15} /> {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Generate Tab */}
      {activeTab === "generate" && (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Left: Employee picker */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
            <div className="border-b border-gray-200 p-4 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Select Employee</h3>
              <p className="mt-0.5 text-xs text-gray-400">Or fill details manually below</p>
            </div>
            <div className="p-3">
              <div className="relative mb-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
              </div>
              <div className="max-h-72 overflow-y-auto space-y-1">
                {loadingEmps ? (
                  <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-gray-400" /></div>
                ) : filteredEmps.length === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-400">No employees found</p>
                ) : filteredEmps.map((emp) => (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedEmp(emp)}
                    className={cn("w-full rounded-lg px-3 py-2.5 text-left text-sm transition-colors", selectedEmp?.id === emp.id ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "hover:bg-gray-50 dark:hover:bg-gray-900")}
                  >
                    <p className="font-medium text-gray-900 dark:text-white">{emp.firstName} {emp.lastName}</p>
                    <p className="text-xs text-gray-400">{emp.employeeCode}{emp.designation ? ` · ${emp.designation}` : ""}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Pointer form */}
          <div className="space-y-5">
            {grouped.map(({ section, label, pointers }) => (
              <div key={section} className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
                <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-800">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">{label}</h3>
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  {pointers.map((pointer) => (
                    <div key={pointer.key}>
                      <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-400">
                        {pointer.label} {pointer.required && <span className="text-red-500">*</span>}
                      </label>
                      {pointer.type === "select" ? (
                        <select
                          value={pointerValues[pointer.key] ?? ""}
                          onChange={(e) => setPointerValues((p) => ({ ...p, [pointer.key]: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                        >
                          <option value="">Select…</option>
                          {pointer.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type={pointer.type}
                          value={pointerValues[pointer.key] ?? ""}
                          onChange={(e) => setPointerValues((p) => ({ ...p, [pointer.key]: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                          placeholder={pointer.defaultValue ?? ""}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {/* Legal Clauses Section */}
            <div className="rounded-xl border border-indigo-200 bg-white dark:border-indigo-900 dark:bg-gray-950">
              <div className="flex items-center justify-between border-b border-indigo-100 px-5 py-3 dark:border-indigo-900">
                <div>
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">Legal Clauses</h3>
                  <p className="mt-0.5 text-xs text-gray-400">Auto-generated. Edit as needed before printing.</p>
                </div>
              </div>
              <div className="space-y-5 p-5">
                {CLAUSE_META.map((clause) => (
                  <div key={clause.key}>
                    <div className="mb-1.5 flex items-start justify-between gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-indigo-700 dark:text-indigo-400">{clause.label}</label>
                        <p className="text-xs text-gray-400">{clause.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setClauseValues((p) => ({ ...p, [clause.key]: DEFAULT_CLAUSES[clause.key] }))}
                        className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                      >
                        Reset to default
                      </button>
                    </div>
                    <textarea
                      rows={5}
                      value={clauseValues[clause.key]}
                      onChange={(e) => setClauseValues((p) => ({ ...p, [clause.key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs leading-relaxed text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    />
                  </div>
                ))}
              </div>
            </div>
            {/* Generate button */}
            <div className="flex justify-end">
              <button
                onClick={handleGenerate}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                <FileText size={16} /> Generate & Preview Offer Letter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <FileText size={36} className="text-gray-300" />
              <p className="mt-3 text-sm text-gray-400">No offer letters generated yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800">
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Employee</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Template Used</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Generated</th>
                    <th className="px-5 py-3 text-right font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((letter) => (
                    <tr key={letter.id} className="border-b border-gray-50 dark:border-gray-800/50">
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {letter.user.firstName} {letter.user.lastName}
                        {letter.user.designation && <span className="ml-2 text-xs text-gray-400">{letter.user.designation}</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-500">{letter.template.name}</td>
                      <td className="px-5 py-3 text-gray-400">{new Date(letter.generatedAt).toLocaleDateString("en-IN")}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => printOfferLetter(letter.content, `${letter.user.firstName} ${letter.user.lastName}`)} className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900">
                          <Eye size={13} /> Preview
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
