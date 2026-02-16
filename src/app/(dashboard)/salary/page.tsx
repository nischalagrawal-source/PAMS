"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  FileText,
  Calculator,
  Download,
  Plus,
  X,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  Receipt,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useSalaryStructure,
  useSalarySlips,
  useGenerateSlip,
  useUpdateSlip,
  useOfferTemplates,
  useGenerateOfferLetter,
  type SalarySlip,
} from "@/hooks/use-salary";

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

function getSlipStatus(status: string) {
  const map: Record<string, { color: string; label: string }> = {
    DRAFT: { color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", label: "Draft" },
    GENERATED: { color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", label: "Generated" },
    COMPARED: { color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", label: "Compared" },
    FINALIZED: { color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", label: "Finalized" },
  };
  const s = map[status] || map.DRAFT;
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", s.color)}>{s.label}</span>;
}

interface SimpleUser { id: string; firstName: string; lastName: string; employeeCode: string; role: string }

export default function SalaryPage() {
  const { data: session } = useSession();
  const isAdmin = ["ADMIN", "SUPER_ADMIN"].includes(session?.user?.role || "");
  const isStaff = session?.user?.role === "STAFF";

  const [page, setPage] = useState(1);
  const [selectedSlip, setSelectedSlip] = useState<SalarySlip | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [genUserId, setGenUserId] = useState("");
  const [genMonth, setGenMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`);
  const [empCalc, setEmpCalc] = useState({ gross: "", deductions: "", net: "" });
  const [showOfferGen, setShowOfferGen] = useState(false);
  const [offerUserId, setOfferUserId] = useState("");
  const [offerTemplateId, setOfferTemplateId] = useState("");

  const structureQuery = useSalaryStructure(isStaff ? undefined : undefined);
  const slipsQuery = useSalarySlips({ page, limit: 10 });
  const generateMutation = useGenerateSlip();
  const updateSlipMutation = useUpdateSlip();
  const templatesQuery = useOfferTemplates();
  const offerMutation = useGenerateOfferLetter();

  const usersQuery = useQuery({
    queryKey: ["users", "all"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      const json = await res.json();
      return json.data as SimpleUser[];
    },
    enabled: isAdmin,
  });

  function handleGenerate() {
    if (!genUserId || !genMonth) return;
    generateMutation.mutate({ userId: genUserId, month: genMonth }, {
      onSuccess: () => { setShowGenerate(false); setGenUserId(""); },
    });
  }

  function handleEmployeeSubmit() {
    if (!selectedSlip || !empCalc.gross || !empCalc.net) return;
    updateSlipMutation.mutate({
      id: selectedSlip.id,
      employeeGross: parseFloat(empCalc.gross),
      employeeDeductions: parseFloat(empCalc.deductions || "0"),
      employeeNet: parseFloat(empCalc.net),
      employeeBreakdown: {},
    }, { onSuccess: (data) => { setSelectedSlip(data); setEmpCalc({ gross: "", deductions: "", net: "" }); } });
  }

  function handleGenerateOffer() {
    if (!offerUserId || !offerTemplateId) return;
    offerMutation.mutate({ userId: offerUserId, templateId: offerTemplateId }, {
      onSuccess: () => { setShowOfferGen(false); setOfferUserId(""); setOfferTemplateId(""); },
    });
  }

  const structure = structureQuery.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 shadow-lg shadow-cyan-500/25">
            <Wallet size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Salary & Payroll</h1>
            <p className="text-gray-500">Salary structures, slips, and offer letters</p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => setShowGenerate(true)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 hover:from-cyan-500 hover:to-teal-500">
              <Calculator size={16} /> Generate Slip
            </button>
            <button onClick={() => setShowOfferGen(true)} className="flex items-center gap-2 rounded-xl border border-cyan-300 px-4 py-2.5 text-sm font-semibold text-cyan-700 hover:bg-cyan-50 dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-950">
              <UserPlus size={16} /> Offer Letter
            </button>
          </div>
        )}
      </div>

      {/* My Salary Structure (for staff or when viewing own) */}
      {structure && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-950">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">My Salary Structure</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Basic", value: structure.basic, color: "text-gray-900" },
              { label: "HRA", value: structure.hra, color: "text-gray-700" },
              { label: "DA", value: structure.da, color: "text-gray-700" },
              { label: "TA", value: structure.ta, color: "text-gray-700" },
              { label: "Special Allowance", value: structure.specialAllow, color: "text-gray-700" },
              { label: "PF (Deduction)", value: -structure.pf, color: "text-red-600" },
              { label: "ESI (Deduction)", value: -structure.esi, color: "text-red-600" },
              { label: "Tax (Deduction)", value: -structure.tax, color: "text-red-600" },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className={cn("text-lg font-semibold", item.color, "dark:text-white")}>{formatCurrency(Math.abs(item.value))}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg bg-cyan-50 p-4 dark:bg-cyan-950/30">
            <span className="text-sm font-medium text-cyan-800 dark:text-cyan-300">Net Salary</span>
            <span className="text-2xl font-bold text-cyan-700 dark:text-cyan-400">{formatCurrency(structure.netSalary)}</span>
          </div>
        </div>
      )}

      {/* Generate Slip Modal */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Generate Salary Slip</h3>
              <button onClick={() => setShowGenerate(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Employee</label>
                <select value={genUserId} onChange={(e) => setGenUserId(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <option value="">Select employee...</option>
                  {usersQuery.data?.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.employeeCode})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Month</label>
                <input type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowGenerate(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                <button onClick={handleGenerate} disabled={!genUserId || generateMutation.isPending} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
                  {generateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Calculator size={16} />} Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Offer Letter Modal */}
      {showOfferGen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Generate Offer Letter</h3>
              <button onClick={() => setShowOfferGen(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Employee</label>
                <select value={offerUserId} onChange={(e) => setOfferUserId(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <option value="">Select employee...</option>
                  {usersQuery.data?.map((u) => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.employeeCode})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Template</label>
                <select value={offerTemplateId} onChange={(e) => setOfferTemplateId(e.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <option value="">Select template...</option>
                  {templatesQuery.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowOfferGen(false)} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300">Cancel</button>
                <button onClick={handleGenerateOffer} disabled={!offerUserId || !offerTemplateId || offerMutation.isPending} className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50">
                  {offerMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Generate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Slip Detail Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Salary Slip — {selectedSlip.month}
              </h3>
              <div className="flex items-center gap-2">
                {getSlipStatus(selectedSlip.status)}
                <button onClick={() => setSelectedSlip(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"><X size={20} /></button>
              </div>
            </div>

            {/* Comparison view */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* System calculation */}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-800 dark:text-blue-300">
                  <Calculator size={16} /> System Generated
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-blue-600">Gross</span><span className="font-semibold text-blue-900 dark:text-blue-100">{formatCurrency(selectedSlip.systemGross)}</span></div>
                  <div className="flex justify-between"><span className="text-blue-600">Deductions</span><span className="font-semibold text-red-600">{formatCurrency(selectedSlip.systemDeductions)}</span></div>
                  {selectedSlip.bonusAmount && <div className="flex justify-between"><span className="text-blue-600">Bonus ({selectedSlip.bonusPercentage}%)</span><span className="font-semibold text-green-600">{formatCurrency(selectedSlip.bonusAmount)}</span></div>}
                  <div className="border-t border-blue-200 pt-2 dark:border-blue-800"><div className="flex justify-between"><span className="font-semibold text-blue-800 dark:text-blue-200">Net Pay</span><span className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatCurrency(selectedSlip.systemNet)}</span></div></div>
                </div>
              </div>

              {/* Employee calculation */}
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900 dark:bg-purple-950/30">
                <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-800 dark:text-purple-300">
                  <Receipt size={16} /> Employee Calculation
                </h4>
                {selectedSlip.employeeNet !== null ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-purple-600">Gross</span><span className="font-semibold text-purple-900 dark:text-purple-100">{formatCurrency(selectedSlip.employeeGross)}</span></div>
                    <div className="flex justify-between"><span className="text-purple-600">Deductions</span><span className="font-semibold text-red-600">{formatCurrency(selectedSlip.employeeDeductions)}</span></div>
                    <div className="border-t border-purple-200 pt-2 dark:border-purple-800"><div className="flex justify-between"><span className="font-semibold text-purple-800 dark:text-purple-200">Net Pay</span><span className="text-lg font-bold text-purple-900 dark:text-purple-100">{formatCurrency(selectedSlip.employeeNet)}</span></div></div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-purple-600">Enter your own calculation to compare</p>
                    <input type="number" placeholder="Gross Salary" value={empCalc.gross} onChange={(e) => setEmpCalc(p => ({ ...p, gross: e.target.value }))} className="w-full rounded-lg border border-purple-300 px-3 py-2 text-sm dark:border-purple-700 dark:bg-gray-800 dark:text-white" />
                    <input type="number" placeholder="Deductions" value={empCalc.deductions} onChange={(e) => setEmpCalc(p => ({ ...p, deductions: e.target.value }))} className="w-full rounded-lg border border-purple-300 px-3 py-2 text-sm dark:border-purple-700 dark:bg-gray-800 dark:text-white" />
                    <input type="number" placeholder="Net Pay" value={empCalc.net} onChange={(e) => setEmpCalc(p => ({ ...p, net: e.target.value }))} className="w-full rounded-lg border border-purple-300 px-3 py-2 text-sm dark:border-purple-700 dark:bg-gray-800 dark:text-white" />
                    <button onClick={handleEmployeeSubmit} disabled={updateSlipMutation.isPending} className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50">
                      {updateSlipMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Submit My Calculation
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Discrepancy */}
            {selectedSlip.discrepancy !== null && selectedSlip.discrepancy !== undefined && (
              <div className={cn("mt-4 flex items-center justify-between rounded-xl p-4", selectedSlip.discrepancy === 0 ? "border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" : "border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30")}>
                <div className="flex items-center gap-2">
                  {selectedSlip.discrepancy === 0 ? <CheckCircle2 size={18} className="text-green-600" /> : <AlertTriangle size={18} className="text-red-600" />}
                  <span className={cn("text-sm font-medium", selectedSlip.discrepancy === 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400")}>
                    {selectedSlip.discrepancy === 0 ? "No discrepancy — calculations match!" : "Discrepancy found"}
                  </span>
                </div>
                {selectedSlip.discrepancy > 0 && (
                  <span className="text-lg font-bold text-red-600">{formatCurrency(selectedSlip.discrepancy)}</span>
                )}
              </div>
            )}

            {/* Admin finalize */}
            {isAdmin && selectedSlip.status === "COMPARED" && (
              <button onClick={() => updateSlipMutation.mutate({ id: selectedSlip.id, status: "FINALIZED" }, { onSuccess: (d) => setSelectedSlip(d) })} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white hover:bg-green-500">
                <CheckCircle2 size={16} /> Finalize Salary Slip
              </button>
            )}
          </div>
        </div>
      )}

      {/* Salary Slips Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-200 p-6 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Salary Slips</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Month</th>
                {!isStaff && <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Employee</th>}
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">System Net</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Employee Net</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Discrepancy</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Bonus</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
              {slipsQuery.isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><Loader2 size={24} className="mx-auto animate-spin text-gray-400" /></td></tr>
              ) : !slipsQuery.data?.records.length ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center"><Receipt size={32} className="mx-auto text-gray-300" /><p className="mt-2 text-sm text-gray-500">No salary slips found</p></td></tr>
              ) : (
                slipsQuery.data.records.map((slip) => (
                  <tr key={slip.id} onClick={() => setSelectedSlip(slip)} className="cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{slip.month}</td>
                    {!isStaff && <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-600 dark:text-gray-400">{slip.user ? `${slip.user.firstName} ${slip.user.lastName}` : "-"}</td>}
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(slip.systemNet)}</td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-600 dark:text-gray-400">{formatCurrency(slip.employeeNet)}</td>
                    <td className="whitespace-nowrap px-6 py-3.5">
                      {slip.discrepancy !== null ? (
                        <span className={cn("text-sm font-medium", slip.discrepancy === 0 ? "text-green-600" : "text-red-600")}>
                          {slip.discrepancy === 0 ? "Match" : formatCurrency(slip.discrepancy)}
                        </span>
                      ) : <span className="text-sm text-gray-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5 text-sm text-gray-600 dark:text-gray-400">
                      {slip.bonusPercentage ? `${slip.bonusPercentage}%` : "—"}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3.5">{getSlipStatus(slip.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {slipsQuery.data && slipsQuery.data.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-800">
            <p className="text-sm text-gray-500">Page {slipsQuery.data.page} of {slipsQuery.data.totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 p-2 disabled:opacity-50 dark:border-gray-700"><ChevronLeft size={16} /></button>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= (slipsQuery.data?.totalPages ?? 1)} className="rounded-lg border border-gray-300 p-2 disabled:opacity-50 dark:border-gray-700"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
