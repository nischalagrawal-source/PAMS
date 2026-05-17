"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookUser,
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  CreditCard,
  Landmark,
  AlertCircle,
  ChevronRight,
  Edit2,
  Save,
  X,
  Loader2,
  Clock,
  CheckCircle2,
  UserX,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  employeeCode: string;
  designation: string | null;
  department: string | null;
  dateOfJoining: string | null;
  isActive: boolean;
  role: string;
  branchId: string | null;
}

interface MasterRecord {
  // Personal
  dateOfBirth: string | null;
  fatherName: string | null;
  spouseName: string | null;
  bloodGroup: string | null;
  gender: string | null;
  maritalStatus: string | null;
  permanentAddress: string | null;
  currentAddress: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  // Emergency
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  // Documents
  panNumber: string | null;
  aadhaarNumber: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  // Bank
  bankName: string | null;
  bankAccount: string | null;
  ifscCode: string | null;
  bankBranch: string | null;
  // Employment
  previousEmployer: string | null;
  previousDesignation: string | null;
  totalExperienceYears: number | null;
  probationMonths: number;
  probationEndDate: string | null;
  confirmationDate: string | null;
  exitDate: string | null;
  exitType: string | null;
  exitReason: string | null;
  noticePeriodDays: number;
  hrNotes: string | null;
}

const EMPTY_MASTER: MasterRecord = {
  dateOfBirth: null, fatherName: null, spouseName: null, bloodGroup: null, gender: null, maritalStatus: null,
  permanentAddress: null, currentAddress: null, city: null, state: null, pincode: null,
  emergencyName: null, emergencyPhone: null, emergencyRelation: null,
  panNumber: null, aadhaarNumber: null, passportNumber: null, passportExpiry: null,
  bankName: null, bankAccount: null, ifscCode: null, bankBranch: null,
  previousEmployer: null, previousDesignation: null, totalExperienceYears: null,
  probationMonths: 6, probationEndDate: null, confirmationDate: null,
  exitDate: null, exitType: null, exitReason: null, noticePeriodDays: 30, hrNotes: null,
};

type Section = "personal" | "contact" | "emergency" | "documents" | "bank" | "employment" | "hr";

const SECTIONS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "personal", label: "Personal Details", icon: User },
  { id: "contact", label: "Address & Contact", icon: MapPin },
  { id: "emergency", label: "Emergency Contact", icon: AlertCircle },
  { id: "documents", label: "Identity Documents", icon: CreditCard },
  { id: "bank", label: "Bank Details", icon: Landmark },
  { id: "employment", label: "Employment History", icon: Briefcase },
  { id: "hr", label: "HR Notes", icon: Clock },
];

// ─── Field Component ──────────────────────────────────────────────

function Field({
  label, value, editing, type = "text", options, onChange,
}: {
  label: string;
  value: string | number | null;
  editing: boolean;
  type?: "text" | "date" | "number" | "select" | "textarea";
  options?: string[];
  onChange?: (v: string) => void;
}) {
  if (!editing) {
    return (
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className={cn("mt-1 text-sm", value ? "text-gray-900 dark:text-white" : "text-gray-300")}>
          {value != null ? String(value) : "—"}
        </p>
      </div>
    );
  }

  const base = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

  if (type === "select") {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
        <select value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} className={base}>
          <option value="">— Select —</option>
          {options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      </div>
    );
  }

  if (type === "textarea") {
    return (
      <div className="col-span-2">
        <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
        <textarea rows={3} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} className={cn(base, "resize-none")} />
      </div>
    );
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-500">{label}</label>
      <input type={type} value={value ?? ""} onChange={(e) => onChange?.(e.target.value)} className={base} />
    </div>
  );
}

// ─── Probation Status Badge ────────────────────────────────────────

function ProbationBadge({ emp, master }: { emp: Employee; master: MasterRecord }) {
  if (!emp.isActive) return <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400"><UserX size={12} /> Inactive</span>;
  if (master.confirmationDate) return <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 size={12} /> Confirmed</span>;

  const probEnd = master.probationEndDate ? new Date(master.probationEndDate) : emp.dateOfJoining ? new Date(new Date(emp.dateOfJoining).setMonth(new Date(emp.dateOfJoining).getMonth() + master.probationMonths)) : null;
  if (!probEnd) return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"><Clock size={12} /> On Probation</span>;

  const today = new Date();
  if (probEnd < today) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"><AlertCircle size={12} /> Probation Review Due</span>;

  const daysLeft = Math.ceil((probEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"><Clock size={12} /> Probation · {daysLeft}d left</span>;
}

// ─── Main Page ──────────────────────────────────────────────────

export default function EmployeeMasterPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("personal");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MasterRecord>(EMPTY_MASTER);

  const { data: employees = [], isLoading: loadingEmps } = useQuery<Employee[]>({
    queryKey: ["employee-master", "list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?limit=500");
      const json = await res.json();
      if (!json.success) return [];
      return json.data.users ?? json.data ?? [];
    },
  });

  const { data: masterRecord, isLoading: loadingMaster } = useQuery<MasterRecord | null>({
    queryKey: ["employee-master", "record", selected?.id],
    enabled: !!selected,
    queryFn: async () => {
      const res = await fetch(`/api/admin/employee-master/${selected!.id}`);
      const json = await res.json();
      if (!json.success) return null;
      return json.data;
    },
  });

  // Sync draft when masterRecord loads or employee changes
  useEffect(() => {
    if (!editing) setDraft(masterRecord ?? EMPTY_MASTER);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterRecord, selected?.id]);

  const saveMutation = useMutation({
    mutationFn: async (data: MasterRecord) => {
      const res = await fetch(`/api/admin/employee-master/${selected!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-master", "record", selected?.id] });
      setEditing(false);
    },
  });
  const record: MasterRecord = masterRecord ?? EMPTY_MASTER;
  const displayRecord = editing ? draft : record;
  const upd = (field: keyof MasterRecord, value: string) => setDraft((p) => ({ ...p, [field]: value || null }));

  const filteredEmps = employees.filter(
    (e) =>
      `${e.firstName} ${e.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      e.employeeCode.toLowerCase().includes(search.toLowerCase()) ||
      (e.designation ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Employee Master</h1>
        <p className="text-sm text-gray-500">Comprehensive HR records — personal details, documents, bank info, probation status, and exit details.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Employee list */}
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
          <div className="border-b border-gray-200 p-4 dark:border-gray-800">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search employees..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 py-2 pl-8 pr-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
            </div>
          </div>
          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {loadingEmps ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
            ) : filteredEmps.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400">No employees found</p>
            ) : filteredEmps.map((emp) => (
              <button
                key={emp.id}
                onClick={() => { setSelected(emp); setEditing(false); setActiveSection("personal"); }}
                className={cn("w-full rounded-lg px-3 py-2.5 text-left transition-colors", selected?.id === emp.id ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-900")}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={cn("text-sm font-medium", selected?.id === emp.id ? "text-blue-700 dark:text-blue-300" : "text-gray-900 dark:text-white")}>
                      {emp.firstName} {emp.lastName}
                    </p>
                    <p className="text-xs text-gray-400">{emp.employeeCode}{emp.designation ? ` · ${emp.designation}` : ""}</p>
                  </div>
                  {!emp.isActive && <span className="text-xs text-gray-400">Inactive</span>}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Detail pane */}
        {!selected ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white py-24 dark:border-gray-700 dark:bg-gray-950">
            <BookUser size={40} className="text-gray-300" />
            <p className="mt-3 text-sm text-gray-400">Select an employee to view their master record</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Employee card header */}
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-950">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
                    {selected.firstName[0]}{selected.lastName[0]}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selected.firstName} {selected.lastName}</h2>
                    <p className="text-sm text-gray-400">{selected.employeeCode}{selected.designation ? ` · ${selected.designation}` : ""}{selected.department ? ` · ${selected.department}` : ""}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  {selected.email && <span className="flex items-center gap-1"><Mail size={12} />{selected.email}</span>}
                  {selected.phone && <span className="flex items-center gap-1"><Phone size={12} />{selected.phone}</span>}
                  {selected.dateOfJoining && <span className="flex items-center gap-1"><Calendar size={12} />Joined {new Date(selected.dateOfJoining).toLocaleDateString("en-IN")}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <ProbationBadge emp={selected} master={record} />
                {editing ? (
                  <>
                    <button onClick={() => { setEditing(false); setDraft(record); }} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                      <X size={14} /> Cancel
                    </button>
                    <button onClick={() => saveMutation.mutate(draft)} disabled={saveMutation.isPending} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-70">
                      {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                    </button>
                  </>
                ) : (
                  <button onClick={() => { setEditing(true); setDraft(record); }} className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800">
                    <Edit2 size={14} /> Edit Record
                  </button>
                )}
              </div>
            </div>

            {saveMutation.isError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                {(saveMutation.error as Error).message}
              </div>
            )}

            {/* Section tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {SECTIONS.map((sec) => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                    activeSection === sec.id ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                  )}
                >
                  <sec.icon size={13} /> {sec.label}
                </button>
              ))}
            </div>

            {/* Section content */}
            {loadingMaster ? (
              <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
                {activeSection === "personal" && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Date of Birth" value={displayRecord.dateOfBirth} editing={editing} type="date" onChange={(v) => upd("dateOfBirth", v)} />
                    <Field label="Gender" value={displayRecord.gender} editing={editing} type="select" options={["Male", "Female", "Other"]} onChange={(v) => upd("gender", v)} />
                    <Field label="Marital Status" value={displayRecord.maritalStatus} editing={editing} type="select" options={["Single", "Married", "Divorced", "Widowed"]} onChange={(v) => upd("maritalStatus", v)} />
                    <Field label="Blood Group" value={displayRecord.bloodGroup} editing={editing} type="select" options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} onChange={(v) => upd("bloodGroup", v)} />
                    <Field label="Father's Name" value={displayRecord.fatherName} editing={editing} onChange={(v) => upd("fatherName", v)} />
                    <Field label="Spouse's Name" value={displayRecord.spouseName} editing={editing} onChange={(v) => upd("spouseName", v)} />
                  </div>
                )}

                {activeSection === "contact" && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Current Address" value={displayRecord.currentAddress} editing={editing} type="textarea" onChange={(v) => upd("currentAddress", v)} />
                    <Field label="Permanent Address" value={displayRecord.permanentAddress} editing={editing} type="textarea" onChange={(v) => upd("permanentAddress", v)} />
                    <Field label="City" value={displayRecord.city} editing={editing} onChange={(v) => upd("city", v)} />
                    <Field label="State" value={displayRecord.state} editing={editing} onChange={(v) => upd("state", v)} />
                    <Field label="Pincode" value={displayRecord.pincode} editing={editing} onChange={(v) => upd("pincode", v)} />
                  </div>
                )}

                {activeSection === "emergency" && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Emergency Contact Name" value={displayRecord.emergencyName} editing={editing} onChange={(v) => upd("emergencyName", v)} />
                    <Field label="Emergency Contact Phone" value={displayRecord.emergencyPhone} editing={editing} onChange={(v) => upd("emergencyPhone", v)} />
                    <Field label="Relationship" value={displayRecord.emergencyRelation} editing={editing} type="select" options={["Spouse", "Parent", "Sibling", "Child", "Friend", "Other"]} onChange={(v) => upd("emergencyRelation", v)} />
                  </div>
                )}

                {activeSection === "documents" && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="PAN Number" value={displayRecord.panNumber} editing={editing} onChange={(v) => upd("panNumber", v)} />
                    <Field label="Aadhaar Number" value={displayRecord.aadhaarNumber} editing={editing} onChange={(v) => upd("aadhaarNumber", v)} />
                    <Field label="Passport Number" value={displayRecord.passportNumber} editing={editing} onChange={(v) => upd("passportNumber", v)} />
                    <Field label="Passport Expiry" value={displayRecord.passportExpiry} editing={editing} type="date" onChange={(v) => upd("passportExpiry", v)} />
                  </div>
                )}

                {activeSection === "bank" && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Bank Name" value={displayRecord.bankName} editing={editing} onChange={(v) => upd("bankName", v)} />
                    <Field label="Account Number" value={displayRecord.bankAccount} editing={editing} onChange={(v) => upd("bankAccount", v)} />
                    <Field label="IFSC Code" value={displayRecord.ifscCode} editing={editing} onChange={(v) => upd("ifscCode", v)} />
                    <Field label="Bank Branch" value={displayRecord.bankBranch} editing={editing} onChange={(v) => upd("bankBranch", v)} />
                  </div>
                )}

                {activeSection === "employment" && (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Previous Employer" value={displayRecord.previousEmployer} editing={editing} onChange={(v) => upd("previousEmployer", v)} />
                    <Field label="Previous Designation" value={displayRecord.previousDesignation} editing={editing} onChange={(v) => upd("previousDesignation", v)} />
                    <Field label="Total Experience (years)" value={displayRecord.totalExperienceYears} editing={editing} type="number" onChange={(v) => upd("totalExperienceYears", v)} />
                    <Field label="Probation Period (months)" value={displayRecord.probationMonths} editing={editing} type="number" onChange={(v) => upd("probationMonths", v)} />
                    <Field label="Probation End Date" value={displayRecord.probationEndDate} editing={editing} type="date" onChange={(v) => upd("probationEndDate", v)} />
                    <Field label="Confirmation Date" value={displayRecord.confirmationDate} editing={editing} type="date" onChange={(v) => upd("confirmationDate", v)} />
                    <Field label="Notice Period (days)" value={displayRecord.noticePeriodDays} editing={editing} type="number" onChange={(v) => upd("noticePeriodDays", v)} />
                    <Field label="Exit Date" value={displayRecord.exitDate} editing={editing} type="date" onChange={(v) => upd("exitDate", v)} />
                    <Field label="Exit Type" value={displayRecord.exitType} editing={editing} type="select" options={["Resigned", "Terminated", "Retired", "Absconded"]} onChange={(v) => upd("exitType", v)} />
                    <Field label="Exit Reason" value={displayRecord.exitReason} editing={editing} type="textarea" onChange={(v) => upd("exitReason", v)} />
                  </div>
                )}

                {activeSection === "hr" && (
                  <div className="grid gap-5">
                    <Field label="HR Notes (internal)" value={displayRecord.hrNotes} editing={editing} type="textarea" onChange={(v) => upd("hrNotes", v)} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
