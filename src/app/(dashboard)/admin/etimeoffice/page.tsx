"use client";

import { useState, useRef, useCallback } from "react";
import {
  FileSpreadsheet,
  Upload,
  Printer,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Info,
  ThumbsUp,
  ThumbsDown,
  ArrowRight,
  RotateCcw,
  Eye,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AttendanceRow {
  _id: string;
  employeeName: string;
  employeeCode: string;
  designation: string;
  department: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  halfDays: number;
  otHours: number;
  basicSalary: number;
  hra: number;
  da: number;
  ta: number;
  specialAllow: number;
  otAmount: number;
  otherEarnings: number;
  grossSalary: number;
  pf: number;
  esi: number;
  tds: number;
  advance: number;
  otherDeductions: number;
  totalDeductions: number;
  netSalary: number;
}

type FieldKey = keyof Omit<AttendanceRow, "_id">;

interface FieldChange {
  field: FieldKey;
  label: string;
  original: number | string;
  edited: number | string;
  /** null = pending admin decision */
  approved: boolean | null;
}

interface DiffRow {
  _id: string;
  employeeName: string;
  employeeCode: string;
  originalRow: AttendanceRow;
  editedRow: AttendanceRow;
  changes: FieldChange[];
  /** "changed" | "added" | "removed" | "unchanged" */
  status: "changed" | "added" | "removed" | "unchanged";
}

type Step = "upload" | "review" | "generate";

// ─── Column map ───────────────────────────────────────────────────────────────

const COLUMN_MAP: Record<string, FieldKey> = {
  "employee name": "employeeName", "emp name": "employeeName", name: "employeeName",
  "employee code": "employeeCode", "emp code": "employeeCode", code: "employeeCode", empcode: "employeeCode",
  designation: "designation",
  department: "department", dept: "department",
  "working days": "workingDays", "total working days": "workingDays",
  "present days": "presentDays", present: "presentDays",
  "absent days": "absentDays", absent: "absentDays",
  "late days": "lateDays", late: "lateDays",
  "half days": "halfDays", halfday: "halfDays",
  "ot hours": "otHours", "overtime hours": "otHours",
  "basic salary": "basicSalary", basic: "basicSalary",
  hra: "hra", "house rent allowance": "hra",
  da: "da", "dearness allowance": "da",
  ta: "ta", "travel allowance": "ta", conveyance: "ta",
  "special allowance": "specialAllow", "special allow": "specialAllow",
  "other earnings": "otherEarnings",
  "ot amount": "otAmount", "overtime amount": "otAmount",
  "gross salary": "grossSalary", gross: "grossSalary", "gross earnings": "grossSalary",
  pf: "pf", "provident fund": "pf",
  esi: "esi",
  tds: "tds", "income tax": "tds",
  advance: "advance",
  "other deductions": "otherDeductions",
  "total deductions": "totalDeductions", deductions: "totalDeductions",
  "net salary": "netSalary", net: "netSalary", "net pay": "netSalary",
};

const FIELD_LABELS: Record<FieldKey, string> = {
  employeeName: "Employee Name", employeeCode: "Employee Code",
  designation: "Designation", department: "Department",
  workingDays: "Working Days", presentDays: "Present Days",
  absentDays: "Absent Days", lateDays: "Late Days",
  halfDays: "Half Days", otHours: "OT Hours",
  basicSalary: "Basic Salary", hra: "HRA", da: "DA", ta: "TA",
  specialAllow: "Special Allowance", otAmount: "OT Amount",
  otherEarnings: "Other Earnings", grossSalary: "Gross Salary",
  pf: "PF", esi: "ESI", tds: "TDS", advance: "Advance",
  otherDeductions: "Other Deductions", totalDeductions: "Total Deductions",
  netSalary: "Net Salary",
};

const NUMERIC_FIELDS = new Set<FieldKey>([
  "workingDays", "presentDays", "absentDays", "lateDays", "halfDays", "otHours",
  "basicSalary", "hra", "da", "ta", "specialAllow", "otAmount", "otherEarnings",
  "grossSalary", "pf", "esi", "tds", "advance", "otherDeductions", "totalDeductions", "netSalary",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function num(v: unknown): number {
  const n = parseFloat(String(v ?? "0").replace(/[₹,\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function calcTotals(row: AttendanceRow): Partial<AttendanceRow> {
  const grossSalary = row.basicSalary + row.hra + row.da + row.ta + row.specialAllow + row.otAmount + row.otherEarnings;
  const totalDeductions = row.pf + row.esi + row.tds + row.advance + row.otherDeductions;
  return { grossSalary, totalDeductions, netSalary: grossSalary - totalDeductions };
}

function normalizeKey(s: string) {
  return s.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");
}

async function parseExcel(file: File): Promise<AttendanceRow[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: 0 });

  return raw.map((r, i) => {
    const norm: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      const mapped = COLUMN_MAP[k.toLowerCase().trim()];
      if (mapped) norm[mapped] = v;
    }
    const base: AttendanceRow = {
      _id: `row-${i}`,
      employeeName: String(norm.employeeName ?? `Employee ${i + 1}`),
      employeeCode: String(norm.employeeCode ?? ""),
      designation: String(norm.designation ?? ""),
      department: String(norm.department ?? ""),
      workingDays: num(norm.workingDays), presentDays: num(norm.presentDays),
      absentDays: num(norm.absentDays), lateDays: num(norm.lateDays),
      halfDays: num(norm.halfDays), otHours: num(norm.otHours),
      basicSalary: num(norm.basicSalary), hra: num(norm.hra),
      da: num(norm.da), ta: num(norm.ta),
      specialAllow: num(norm.specialAllow), otAmount: num(norm.otAmount),
      otherEarnings: num(norm.otherEarnings), grossSalary: num(norm.grossSalary),
      pf: num(norm.pf), esi: num(norm.esi), tds: num(norm.tds),
      advance: num(norm.advance), otherDeductions: num(norm.otherDeductions),
      totalDeductions: num(norm.totalDeductions), netSalary: num(norm.netSalary),
    };
    if (base.grossSalary === 0) return { ...base, ...calcTotals(base) };
    return base;
  });
}

function buildDiff(originals: AttendanceRow[], edited: AttendanceRow[]): DiffRow[] {
  const diffs: DiffRow[] = [];
  const editedMap = new Map<string, AttendanceRow>();
  const usedEditedIds = new Set<string>();

  for (const e of edited) {
    const key = e.employeeCode
      ? normalizeKey(e.employeeCode)
      : normalizeKey(e.employeeName);
    editedMap.set(key, e);
  }

  for (const orig of originals) {
    const key = orig.employeeCode
      ? normalizeKey(orig.employeeCode)
      : normalizeKey(orig.employeeName);
    const editedRow = editedMap.get(key);

    if (!editedRow) {
      diffs.push({ _id: orig._id, employeeName: orig.employeeName, employeeCode: orig.employeeCode, originalRow: orig, editedRow: orig, changes: [], status: "removed" });
      continue;
    }

    usedEditedIds.add(editedRow._id);
    const fields = Object.keys(FIELD_LABELS) as FieldKey[];
    const changes: FieldChange[] = [];

    for (const field of fields) {
      const ov = orig[field];
      const ev = editedRow[field];
      if (String(ov) !== String(ev)) {
        changes.push({ field, label: FIELD_LABELS[field], original: ov as number | string, edited: ev as number | string, approved: null });
      }
    }

    diffs.push({
      _id: orig._id,
      employeeName: orig.employeeName,
      employeeCode: orig.employeeCode,
      originalRow: orig,
      editedRow,
      changes,
      status: changes.length > 0 ? "changed" : "unchanged",
    });
  }

  // Rows present only in edited = added
  for (const e of edited) {
    if (!usedEditedIds.has(e._id)) {
      diffs.push({ _id: e._id, employeeName: e.employeeName, employeeCode: e.employeeCode, originalRow: e, editedRow: e, changes: [], status: "added" });
    }
  }

  return diffs;
}

function resolveRow(diff: DiffRow): AttendanceRow {
  if (diff.status === "unchanged" || diff.status === "removed" || diff.status === "added") {
    return diff.status === "added" ? diff.editedRow : diff.originalRow;
  }
  const result = { ...diff.originalRow };
  for (const change of diff.changes) {
    if (change.approved === true) {
      (result as Record<string, unknown>)[change.field] = change.edited;
    }
  }
  return result;
}

function generateSalarySlipHTML(row: AttendanceRow, companyName: string, month: string): string {
  const monthLabel = new Date(month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  return `
<div style="font-family: Arial, sans-serif; font-size: 11pt; max-width: 700px; margin: 0 auto; border: 1px solid #ccc; padding: 0;">
  <div style="background: #1a237e; color: #fff; padding: 14px 20px; text-align: center;">
    <h2 style="margin: 0; font-size: 14pt;">${companyName}</h2>
    <p style="margin: 4px 0 0; font-size: 10pt;">Salary Slip \u2014 ${monthLabel}</p>
  </div>
  <div style="padding: 14px 20px; border-bottom: 1px solid #e0e0e0;">
    <table style="width: 100%; font-size: 10pt;">
      <tr>
        <td><strong>Employee Name:</strong> ${row.employeeName}</td>
        <td><strong>Code:</strong> ${row.employeeCode || "\u2014"}</td>
      </tr>
      ${row.designation ? `<tr><td><strong>Designation:</strong> ${row.designation}</td><td><strong>Department:</strong> ${row.department || "\u2014"}</td></tr>` : ""}
    </table>
  </div>
  <div style="padding: 14px 20px; border-bottom: 1px solid #e0e0e0; background: #f5f5f5;">
    <table style="width: 100%; font-size: 10pt;">
      <tr>
        <td><strong>Working Days:</strong> ${row.workingDays}</td>
        <td><strong>Present Days:</strong> ${row.presentDays}</td>
        <td><strong>Absent Days:</strong> ${row.absentDays}</td>
        <td><strong>Late Days:</strong> ${row.lateDays}</td>
        ${row.otHours > 0 ? `<td><strong>OT Hours:</strong> ${row.otHours}</td>` : ""}
      </tr>
    </table>
  </div>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0;">
    <div style="padding: 14px 20px; border-right: 1px solid #e0e0e0;">
      <h4 style="margin: 0 0 10px; color: #1a237e; font-size: 10pt; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px;">EARNINGS</h4>
      <table style="width: 100%; font-size: 10pt;">
        ${row.basicSalary > 0 ? `<tr><td>Basic Salary</td><td style="text-align:right">\u20b9 ${row.basicSalary.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.hra > 0 ? `<tr><td>HRA</td><td style="text-align:right">\u20b9 ${row.hra.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.da > 0 ? `<tr><td>DA</td><td style="text-align:right">\u20b9 ${row.da.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.ta > 0 ? `<tr><td>TA / Conveyance</td><td style="text-align:right">\u20b9 ${row.ta.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.specialAllow > 0 ? `<tr><td>Special Allowance</td><td style="text-align:right">\u20b9 ${row.specialAllow.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.otAmount > 0 ? `<tr><td>Overtime Pay</td><td style="text-align:right">\u20b9 ${row.otAmount.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.otherEarnings > 0 ? `<tr><td>Other Earnings</td><td style="text-align:right">\u20b9 ${row.otherEarnings.toLocaleString("en-IN")}</td></tr>` : ""}
        <tr style="border-top: 1px solid #ccc; font-weight: bold;">
          <td style="padding-top: 6px;">Gross Salary</td>
          <td style="text-align:right; padding-top: 6px;">\u20b9 ${row.grossSalary.toLocaleString("en-IN")}</td>
        </tr>
      </table>
    </div>
    <div style="padding: 14px 20px;">
      <h4 style="margin: 0 0 10px; color: #b71c1c; font-size: 10pt; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px;">DEDUCTIONS</h4>
      <table style="width: 100%; font-size: 10pt;">
        ${row.pf > 0 ? `<tr><td>PF</td><td style="text-align:right">\u20b9 ${row.pf.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.esi > 0 ? `<tr><td>ESI</td><td style="text-align:right">\u20b9 ${row.esi.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.tds > 0 ? `<tr><td>TDS</td><td style="text-align:right">\u20b9 ${row.tds.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.advance > 0 ? `<tr><td>Advance</td><td style="text-align:right">\u20b9 ${row.advance.toLocaleString("en-IN")}</td></tr>` : ""}
        ${row.otherDeductions > 0 ? `<tr><td>Other Deductions</td><td style="text-align:right">\u20b9 ${row.otherDeductions.toLocaleString("en-IN")}</td></tr>` : ""}
        <tr style="border-top: 1px solid #ccc; font-weight: bold;">
          <td style="padding-top: 6px;">Total Deductions</td>
          <td style="text-align:right; padding-top: 6px;">\u20b9 ${row.totalDeductions.toLocaleString("en-IN")}</td>
        </tr>
      </table>
    </div>
  </div>
  <div style="background: #1a237e; color: #fff; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center;">
    <span style="font-size: 12pt; font-weight: bold;">Net Pay</span>
    <span style="font-size: 14pt; font-weight: bold;">\u20b9 ${row.netSalary.toLocaleString("en-IN")}</span>
  </div>
  <div style="padding: 10px 20px; font-size: 9pt; color: #666; border-top: 1px solid #e0e0e0;">
    This is a computer-generated salary slip.
  </div>
</div>`;
}

// ─── DropZone component ───────────────────────────────────────────────────────

function DropZone({
  label, sublabel, file, onFile, color,
}: {
  label: string;
  sublabel: string;
  file: File | null;
  onFile: (f: File) => void;
  color: "blue" | "amber";
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const cls = {
    blue: { border: "border-blue-300 dark:border-blue-700", bg: "bg-blue-50 dark:bg-blue-950/30", icon: "text-blue-400", badge: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
    amber: { border: "border-amber-300 dark:border-amber-700", bg: "bg-amber-50 dark:bg-amber-950/30", icon: "text-amber-400", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" },
  }[color];

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) onFile(f);
  }, [onFile]);

  return (
    <div
      className={cn("flex min-h-[160px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 transition-all", cls.border, cls.bg, dragging && "scale-[1.01] opacity-90")}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { if (e.target.files?.[0]) onFile(e.target.files[0]); }} />
      {file ? (
        <>
          <CheckCircle2 size={28} className="text-green-500" />
          <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{file.name}</p>
          <span className={cn("mt-1.5 rounded-full px-3 py-0.5 text-xs font-medium", cls.badge)}>{label}</span>
          <p className="mt-2 text-xs text-gray-400">Click to replace</p>
        </>
      ) : (
        <>
          <FileSpreadsheet size={28} className={cls.icon} />
          <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">{label}</p>
          <p className="mt-1 text-xs text-gray-400">{sublabel}</p>
          <p className="mt-3 text-xs text-gray-400">Drag &amp; drop or click to browse</p>
        </>
      )}
    </div>
  );
}

// ─── DiffCard — per-employee change review ────────────────────────────────────

function DiffCard({ diff, onUpdate }: { diff: DiffRow; onUpdate: (d: DiffRow) => void }) {
  const [open, setOpen] = useState(true);
  const pending = diff.changes.filter((c) => c.approved === null).length;
  const approved = diff.changes.filter((c) => c.approved === true).length;
  const rejected = diff.changes.filter((c) => c.approved === false).length;

  const allDecided = pending === 0;

  function approveAll() { onUpdate({ ...diff, changes: diff.changes.map((c) => ({ ...c, approved: true })) }); }
  function rejectAll() { onUpdate({ ...diff, changes: diff.changes.map((c) => ({ ...c, approved: false })) }); }
  function toggleChange(idx: number, val: boolean) {
    const changes = diff.changes.map((c, i) => (i === idx ? { ...c, approved: val } : c));
    onUpdate({ ...diff, changes });
  }

  return (
    <div className={cn("rounded-xl border bg-white shadow-sm dark:bg-gray-950", allDecided ? "border-gray-200 dark:border-gray-800" : "border-amber-300 dark:border-amber-700")}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={() => setOpen((p) => !p)} className="text-gray-400 hover:text-gray-600">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex-1">
          <p className="font-semibold text-gray-900 dark:text-white">{diff.employeeName}</p>
          {diff.employeeCode && <p className="text-xs text-gray-400">{diff.employeeCode}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {pending > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">{pending} pending</span>}
          {approved > 0 && <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">{approved} accepted</span>}
          {rejected > 0 && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-600 dark:bg-red-900/40 dark:text-red-400">{rejected} rejected</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={approveAll} className="flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-3 py-1 text-xs font-medium text-green-700 hover:bg-green-100 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400">
            <ThumbsUp size={11} /> Accept All
          </button>
          <button onClick={rejectAll} className="flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
            <ThumbsDown size={11} /> Reject All
          </button>
        </div>
      </div>

      {/* Changes table */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900/50">
                <th className="px-5 py-2 text-left text-xs font-medium text-gray-500 w-36">Field</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Original (eTimeOffice)</th>
                <th className="px-3 py-2 text-center text-xs text-gray-300 w-6"></th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Staff Edit</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 w-28">Change</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 w-40">Admin Decision</th>
              </tr>
            </thead>
            <tbody>
              {diff.changes.map((change, idx) => {
                const isNum = NUMERIC_FIELDS.has(change.field);
                const delta = isNum ? (change.edited as number) - (change.original as number) : null;
                const isCurrency = isNum && !["workingDays", "presentDays", "absentDays", "lateDays", "halfDays", "otHours"].includes(change.field);
                const fmtNum = (v: number | string) => isCurrency ? `\u20b9\u00a0${Number(v).toLocaleString("en-IN")}` : String(Number(v));

                return (
                  <tr key={change.field} className={cn(
                    "border-t border-gray-50 dark:border-gray-800/50",
                    change.approved === true && "bg-green-50/60 dark:bg-green-900/10",
                    change.approved === false && "bg-red-50/40 dark:bg-red-900/10",
                    change.approved === null && "bg-amber-50/40 dark:bg-amber-900/5",
                  )}>
                    <td className="px-5 py-2.5 text-xs font-medium text-gray-700 dark:text-gray-300">{change.label}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 line-through">
                      {isNum ? fmtNum(change.original) : String(change.original)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <ArrowRight size={11} className="text-gray-300" />
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold text-gray-900 dark:text-white">
                      {isNum ? fmtNum(change.edited) : String(change.edited)}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {delta !== null && delta !== 0 && (
                        <span className={cn("font-medium tabular-nums", delta > 0 ? "text-green-600" : "text-red-500")}>
                          {delta > 0 ? "+" : ""}{isCurrency ? `\u20b9\u00a0${Math.abs(delta).toLocaleString("en-IN")}` : delta}
                          {delta < 0 && isCurrency && ` (\u20b9\u00a0${Math.abs(delta).toLocaleString("en-IN")} less)`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => toggleChange(idx, true)}
                          className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                            change.approved === true
                              ? "bg-green-600 text-white shadow-sm"
                              : "border border-green-300 text-green-600 hover:bg-green-50 dark:border-green-700 dark:hover:bg-green-900/20"
                          )}
                        >
                          <Check size={11} /> Accept
                        </button>
                        <button
                          onClick={() => toggleChange(idx, false)}
                          className={cn("flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
                            change.approved === false
                              ? "bg-red-500 text-white shadow-sm"
                              : "border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                          )}
                        >
                          <X size={11} /> Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload Files" },
    { id: "review", label: "Review Changes" },
    { id: "generate", label: "Generate Slips" },
  ];
  const order: Step[] = ["upload", "review", "generate"];
  const current = order.indexOf(step);

  return (
    <div className="flex items-center">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={s.id} className="flex items-center">
            <div className="flex items-center gap-2">
              <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                done ? "bg-green-500 text-white" : active ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-400 dark:bg-gray-800"
              )}>
                {done ? <Check size={13} /> : i + 1}
              </span>
              <span className={cn("text-sm font-medium",
                active ? "text-gray-900 dark:text-white" : done ? "text-green-600" : "text-gray-400"
              )}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("mx-5 h-px w-12", i < current ? "bg-green-400" : "bg-gray-200 dark:bg-gray-800")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ETimeOfficePage() {
  const [step, setStep] = useState<Step>("upload");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [editedFile, setEditedFile] = useState<File | null>(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [companyName, setCompanyName] = useState("Your Company");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffs, setDiffs] = useState<DiffRow[]>([]);
  const [finalRows, setFinalRows] = useState<AttendanceRow[]>([]);
  const [showUnchanged, setShowUnchanged] = useState(false);

  // Step 1 → Step 2
  async function handleProcess() {
    if (!originalFile) { setError("Please upload the original eTimeOffice Excel."); return; }
    setProcessing(true);
    setError(null);
    try {
      const originals = await parseExcel(originalFile);
      const edited = editedFile ? await parseExcel(editedFile) : originals;
      setDiffs(buildDiff(originals, edited));
      // If no edited file, skip straight to generate
      if (!editedFile) {
        setFinalRows(originals);
        setStep("generate");
      } else {
        setStep("review");
      }
    } catch (e) {
      console.error(e);
      setError("Failed to parse Excel file(s). Ensure they are valid .xlsx/.xls files.");
    } finally {
      setProcessing(false);
    }
  }

  // Step 2 → Step 3
  function handleFinalize() {
    const stillPending = diffs.filter((d) => d.status === "changed" && d.changes.some((c) => c.approved === null));
    if (stillPending.length > 0) {
      const names = stillPending.slice(0, 3).map((d) => d.employeeName).join(", ");
      setError(`Please resolve all pending changes first. Unreviewed: ${names}${stillPending.length > 3 ? ` +${stillPending.length - 3} more` : ""}`);
      return;
    }
    setError(null);
    setFinalRows(diffs.filter((d) => d.status !== "removed").map(resolveRow));
    setStep("generate");
  }

  function resetAll() {
    setStep("upload"); setDiffs([]); setFinalRows([]);
    setOriginalFile(null); setEditedFile(null); setError(null);
  }

  function approveAllDiffs() { setDiffs((p) => p.map((d) => ({ ...d, changes: d.changes.map((c) => ({ ...c, approved: true as const })) }))); }
  function rejectAllDiffs() { setDiffs((p) => p.map((d) => ({ ...d, changes: d.changes.map((c) => ({ ...c, approved: false as const })) }))); }

  function printAll(rows: AttendanceRow[]) {
    const html = rows.map((r) => `<div style="page-break-after:always">${generateSalarySlipHTML(r, companyName, month)}</div>`).join("");
    const win = window.open("", "_blank");
    if (!win) { alert("Allow popups to print."); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Salary Slips</title>
<style>@media print{@page{size:A4 portrait;margin:15mm}.np{display:none!important}}body{margin:0}.np{position:fixed;top:12px;right:12px;padding:10px 20px;background:#1a237e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px}</style>
</head><body><button class="np" onclick="window.print()">\uD83D\uDDB6 Print All</button>${html}</body></html>`);
    win.document.close();
  }

  function printOne(row: AttendanceRow) {
    const html = generateSalarySlipHTML(row, companyName, month);
    const win = window.open("", "_blank");
    if (!win) { alert("Allow popups to print."); return; }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Slip \u2014 ${row.employeeName}</title>
<style>@media print{@page{size:A4 portrait;margin:15mm}.np{display:none!important}}body{margin:20px}.np{position:fixed;top:12px;right:12px;padding:10px 20px;background:#1a237e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px}</style>
</head><body><button class="np" onclick="window.print()">\uD83D\uDDB6 Print / Save PDF</button>${html}</body></html>`);
    win.document.close();
  }

  // Derived
  const changedDiffs = diffs.filter((d) => d.status === "changed");
  const unchangedDiffs = diffs.filter((d) => d.status === "unchanged");
  const addedDiffs = diffs.filter((d) => d.status === "added");
  const removedDiffs = diffs.filter((d) => d.status === "removed");
  const pendingCount = changedDiffs.filter((d) => d.changes.some((c) => c.approved === null)).length;
  const totalChanges = changedDiffs.reduce((s, d) => s + d.changes.length, 0);
  const totalNet = finalRows.reduce((s, r) => s + r.netSalary, 0);
  const totalGross = finalRows.reduce((s, r) => s + r.grossSalary, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">eTimeOffice Integration</h1>
          <p className="text-sm text-gray-500">Upload eTimeOffice export + staff-edited file. System detects changes for admin approval before generating salary slips.</p>
        </div>
        {step !== "upload" && (
          <button onClick={resetAll} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-900">
            <RotateCcw size={14} /> Start Over
          </button>
        )}
      </div>

      {/* Step indicator */}
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <StepIndicator step={step} />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
          <button onClick={() => setError(null)} className="ml-auto shrink-0 text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* ── STEP 1: UPLOAD ───────────────────────────────────────────────────── */}
      {step === "upload" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Company Name (for salary slips)</label>
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your Company Pvt. Ltd."
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500">Salary Month</label>
              <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white" />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <DropZone label="Original eTimeOffice Export" sublabel="Unmodified Excel exported directly from eTimeOffice"
                file={originalFile} onFile={setOriginalFile} color="blue" />
              <p className="text-xs text-center text-gray-400">Required</p>
            </div>
            <div className="space-y-1.5">
              <DropZone label="Staff-Edited Version" sublabel="Excel with manual corrections made by staff (same format)"
                file={editedFile} onFile={setEditedFile} color="amber" />
              <p className="text-xs text-center text-gray-400">Optional — upload only if staff made corrections</p>
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
            <div className="flex gap-3">
              <Info size={15} className="mt-0.5 shrink-0 text-blue-500" />
              <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <p><strong>How it works:</strong> Upload both Excels \u2192 system auto-detects every changed field per employee \u2192 admin accepts or rejects each change \u2192 salary slips are generated only from verified data.</p>
                <p>Rows are matched by Employee Code (or Employee Name if code is absent). If only the original Excel is uploaded, slips are generated directly.</p>
              </div>
            </div>
          </div>

          <button onClick={handleProcess} disabled={!originalFile || processing}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
            {processing ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            {processing ? "Processing\u2026" : editedFile ? "Compare & Review Changes" : "Process & Generate Slips"}
          </button>
        </div>
      )}

      {/* ── STEP 2: REVIEW ───────────────────────────────────────────────────── */}
      {step === "review" && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Employees", value: diffs.filter((d) => d.status !== "removed").length, hl: "" },
              { label: "Employees with Changes", value: changedDiffs.length, hl: changedDiffs.length > 0 ? "amber" : "" },
              { label: "Pending Your Review", value: pendingCount, hl: pendingCount > 0 ? "red" : "green" },
              { label: "Total Fields Changed", value: totalChanges, hl: "" },
            ].map(({ label, value, hl }) => (
              <div key={label} className={cn("rounded-xl border p-4 shadow-sm",
                hl === "amber" ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20" :
                hl === "red" ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20" :
                hl === "green" ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20" :
                "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
              )}>
                <p className="text-xs font-medium uppercase text-gray-400">{label}</p>
                <p className={cn("mt-1 text-2xl font-bold",
                  hl === "amber" ? "text-amber-700 dark:text-amber-300" :
                  hl === "red" ? "text-red-600 dark:text-red-400" :
                  hl === "green" ? "text-green-600 dark:text-green-400" :
                  "text-gray-900 dark:text-white"
                )}>{value}</p>
              </div>
            ))}
          </div>

          {/* Bulk actions */}
          {changedDiffs.length > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Bulk action — applies to all {totalChanges} field changes across all employees:
              </p>
              <div className="flex gap-3">
                <button onClick={approveAllDiffs} className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
                  <ThumbsUp size={13} /> Accept All Changes
                </button>
                <button onClick={rejectAllDiffs} className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">
                  <ThumbsDown size={13} /> Reject All Changes
                </button>
              </div>
            </div>
          )}

          {/* Added employees notice */}
          {addedDiffs.length > 0 && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950/20">
              <p className="font-semibold text-sm text-green-700 dark:text-green-400">
                {addedDiffs.length} employee(s) appear only in the staff-edited file — will be included automatically
              </p>
              <p className="text-xs text-green-600 mt-1">{addedDiffs.map((d) => d.employeeName).join(", ")}</p>
            </div>
          )}

          {/* Removed employees notice */}
          {removedDiffs.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/20">
              <p className="font-semibold text-sm text-red-600 dark:text-red-400">
                {removedDiffs.length} employee(s) from the original are missing in the edited file — will be excluded from slips
              </p>
              <p className="text-xs text-red-500 mt-1">{removedDiffs.map((d) => d.employeeName).join(", ")}</p>
            </div>
          )}

          {/* No diff case */}
          {changedDiffs.length === 0 && addedDiffs.length === 0 && removedDiffs.length === 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-800 dark:bg-green-950/20">
              <CheckCircle2 size={20} className="text-green-500" />
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">No differences found</p>
                <p className="text-sm text-green-600 mt-0.5">Both files are identical. Proceed to generate salary slips.</p>
              </div>
            </div>
          )}

          {/* Changed employee cards */}
          {changedDiffs.length > 0 && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                <AlertTriangle size={14} className="text-amber-500" />
                {changedDiffs.length} employee(s) with staff corrections — review each field change
              </h3>
              {changedDiffs.map((diff) => (
                <DiffCard key={diff._id} diff={diff}
                  onUpdate={(updated) => setDiffs((prev) => prev.map((d) => (d._id === updated._id ? updated : d)))} />
              ))}
            </div>
          )}

          {/* Unchanged employees (collapsible) */}
          {unchangedDiffs.length > 0 && (
            <div>
              <button onClick={() => setShowUnchanged((p) => !p)}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                {showUnchanged ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Eye size={13} />
                {unchangedDiffs.length} unchanged employee(s) — no action needed
              </button>
              {showUnchanged && (
                <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50">
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Employee</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Present / Working</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Net Pay</th>
                        <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unchangedDiffs.map((d) => (
                        <tr key={d._id} className="border-t border-gray-50 dark:border-gray-800/50">
                          <td className="px-4 py-2.5">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">{d.employeeName}</p>
                            {d.employeeCode && <p className="text-xs text-gray-400">{d.employeeCode}</p>}
                          </td>
                          <td className="px-4 py-2.5 text-center text-xs text-gray-500">{d.originalRow.presentDays} / {d.originalRow.workingDays}</td>
                          <td className="px-4 py-2.5 text-right text-sm font-semibold text-green-600">\u20b9{d.originalRow.netSalary.toLocaleString("en-IN")}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              <CheckCircle2 size={10} /> No change
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Finalize bar */}
          <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <div>
              {pendingCount > 0 ? (
                <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> {pendingCount} employee(s) still have unreviewed changes.
                </p>
              ) : (
                <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> All changes reviewed. Ready to finalize and generate salary slips.
                </p>
              )}
            </div>
            <button onClick={handleFinalize} disabled={pendingCount > 0}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
              <ArrowRight size={14} /> Finalize &amp; Generate Slips
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: GENERATE ─────────────────────────────────────────────────── */}
      {step === "generate" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Employees", value: finalRows.length },
              { label: "Total Gross", value: `\u20b9${totalGross.toLocaleString("en-IN")}` },
              { label: "Total Net Pay", value: `\u20b9${totalNet.toLocaleString("en-IN")}` },
              { label: "Approved Edits", value: diffs.filter((d) => d.status === "changed" && d.changes.some((c) => c.approved === true)).length },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                <p className="text-xs font-medium uppercase text-gray-400">{label}</p>
                <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-800 dark:bg-green-950/20">
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">Admin-verified data ready</p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
                Accepted edits applied. Rejected edits use original eTimeOffice values.
              </p>
            </div>
            <button onClick={() => printAll(finalRows)}
              className="flex items-center gap-2 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
              <Printer size={14} /> Print All Slips ({finalRows.length})
            </button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Employee</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Present / Working</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-500">Late</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Gross</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Deductions</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Net Pay</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Slip</th>
                </tr>
              </thead>
              <tbody>
                {finalRows.map((row) => {
                  const matchKey = row.employeeCode ? normalizeKey(row.employeeCode) : normalizeKey(row.employeeName);
                  const diffEntry = diffs.find((d) => {
                    const dk = d.employeeCode ? normalizeKey(d.employeeCode) : normalizeKey(d.employeeName);
                    return dk === matchKey;
                  });
                  const hasApprovedEdit = diffEntry?.status === "changed" && diffEntry.changes.some((c) => c.approved === true);

                  return (
                    <tr key={row._id} className={cn("border-b border-gray-50 hover:bg-gray-50/50 dark:border-gray-800/50 dark:hover:bg-gray-900/30",
                      hasApprovedEdit && "bg-blue-50/30 dark:bg-blue-900/10"
                    )}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{row.employeeName}</p>
                            {row.employeeCode && <p className="text-xs text-gray-400">{row.employeeCode}{row.designation ? ` \u00b7 ${row.designation}` : ""}</p>}
                          </div>
                          {hasApprovedEdit && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                              Edited
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 dark:text-gray-300">{row.presentDays} / {row.workingDays}</td>
                      <td className="px-4 py-3 text-center">
                        {row.lateDays > 0 ? <span className="font-medium text-amber-600">{row.lateDays}</span> : <span className="text-gray-300">\u2014</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">\u20b9{row.grossSalary.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right text-red-500">\u20b9{row.totalDeductions.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">\u20b9{row.netSalary.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => printOne(row)} title="Print Slip"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800">
                          <Printer size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900">
                  <td className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300" colSpan={3}>
                    Total ({finalRows.length} employees)
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">\u20b9{totalGross.toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-500">\u20b9{finalRows.reduce((s, r) => s + r.totalDeductions, 0).toLocaleString("en-IN")}</td>
                  <td className="px-4 py-3 text-right font-bold text-green-600">\u20b9{totalNet.toLocaleString("en-IN")}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
