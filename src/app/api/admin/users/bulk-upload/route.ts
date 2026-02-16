import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrFail, checkPermission, errorResponse, successResponse } from "@/lib/api-utils";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";

interface StaffRow {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  employeeCode: string;
  role: string;
  designation?: string;
  department?: string;
  dateOfJoining?: string;
  workMode?: string;
  basicSalary?: number;
  company?: string;
}

const DEFAULT_PERMISSIONS: Record<string, Array<{ feature: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean }>> = {
  STAFF: [
    { feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "attendance", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "leaves", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "tasks", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "salary", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
  ],
  REVIEWER: [
    { feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "attendance", canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { feature: "leaves", canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { feature: "tasks", canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { feature: "performance", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "reports", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "salary", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
  ],
  ADMIN: [
    ...["dashboard", "attendance", "leaves", "tasks", "performance", "salary", "reports", "notifications",
      "admin_users", "admin_companies", "admin_geofences", "admin_parameters", "admin_rights", "admin_anomalies"
    ].map((f) => ({ feature: f, canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true })),
  ],
};

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_users" as never, "canCreate")) {
      return errorResponse("No permission to create users", 403);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) return errorResponse("No file uploaded");

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<StaffRow>(sheet);

    if (rows.length === 0) return errorResponse("Excel file is empty");

    // Validate all rows first
    const errors: string[] = [];
    const validRows: StaffRow[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row (1-indexed + header)

      if (!row.firstName?.toString().trim()) errors.push(`Row ${rowNum}: firstName is required`);
      if (!row.lastName?.toString().trim()) errors.push(`Row ${rowNum}: lastName is required`);
      if (!row.email?.toString().trim()) errors.push(`Row ${rowNum}: email is required`);
      if (!row.employeeCode?.toString().trim()) errors.push(`Row ${rowNum}: employeeCode is required`);

      const role = (row.role || "STAFF").toString().toUpperCase().trim();
      if (!["STAFF", "REVIEWER", "ADMIN"].includes(role)) {
        errors.push(`Row ${rowNum}: role must be STAFF, REVIEWER, or ADMIN`);
      }

      const workMode = (row.workMode || "office").toString().toLowerCase().trim();
      if (!["office", "client", "hybrid"].includes(workMode)) {
        errors.push(`Row ${rowNum}: workMode must be office, client, or hybrid`);
      }

      // Check email uniqueness
      const existingEmail = await prisma.user.findUnique({ where: { email: row.email?.toString().trim() } });
      if (existingEmail) errors.push(`Row ${rowNum}: email ${row.email} already exists`);

      if (errors.length === 0) {
        validRows.push({ ...row, role, workMode } as StaffRow);
      }
    }

    if (errors.length > 0) {
      return errorResponse(`Validation failed:\n${errors.slice(0, 10).join("\n")}${errors.length > 10 ? `\n...and ${errors.length - 10} more errors` : ""}`, 400);
    }

    // Determine company: use company code from Excel or default to session user's company
    const companyMap = new Map<string, string>();

    let created = 0;
    const results: Array<{ email: string; status: string }> = [];

    for (const row of validRows) {
      try {
        // Resolve company ID
        let companyId = session!.user.companyId;
        if (row.company) {
          const code = row.company.toString().toUpperCase().trim();
          if (!companyMap.has(code)) {
            const comp = await prisma.company.findUnique({ where: { code } });
            if (comp) companyMap.set(code, comp.id);
          }
          if (companyMap.has(code)) {
            companyId = companyMap.get(code)!;
          }
        }

        // Generate default password: FirstName@123 (first letter uppercase)
        const defaultPassword = `${row.firstName.toString().trim().charAt(0).toUpperCase()}${row.firstName.toString().trim().slice(1).toLowerCase()}@123`;
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        const role = row.role as "STAFF" | "REVIEWER" | "ADMIN";

        // Create user
        const user = await prisma.user.create({
          data: {
            companyId,
            email: row.email.toString().trim().toLowerCase(),
            password: hashedPassword,
            firstName: row.firstName.toString().trim(),
            lastName: row.lastName.toString().trim(),
            employeeCode: row.employeeCode.toString().trim(),
            role,
            phone: row.phone?.toString().trim() || null,
            designation: row.designation?.toString().trim() || null,
            department: row.department?.toString().trim() || null,
            dateOfJoining: row.dateOfJoining ? new Date(row.dateOfJoining.toString()) : null,
            workMode: row.workMode || "office",
          },
        });

        // Create default permissions
        const perms = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.STAFF;
        for (const perm of perms) {
          await prisma.featurePermission.create({
            data: { userId: user.id, ...perm },
          });
        }

        // Create salary structure if basicSalary provided
        if (row.basicSalary && Number(row.basicSalary) > 0) {
          const basic = Number(row.basicSalary);
          const hra = Math.round(basic * 0.4);
          const da = Math.round(basic * 0.1);
          const ta = Math.round(basic * 0.06);
          const pf = Math.round(basic * 0.12);
          const esi = Math.round((basic + hra + da) * 0.0075);
          const tax = Math.round(basic * 0.1);
          const netSalary = basic + hra + da + ta - pf - esi - tax;

          await prisma.salaryStructure.create({
            data: {
              userId: user.id,
              basic, hra, da, ta, specialAllow: 0, pf, esi, tax, otherDeduct: 0,
              netSalary,
              effectiveFrom: new Date(),
            },
          });
        }

        created++;
        results.push({ email: user.email, status: "created" });
      } catch (err) {
        results.push({ email: row.email?.toString() || "unknown", status: `failed: ${(err as Error).message}` });
      }
    }

    return successResponse(
      { created, total: rows.length, results },
      `${created} of ${rows.length} users created successfully. Default password format: FirstName@123`
    );
  } catch (err) {
    console.error("[BULK UPLOAD]", err);
    return errorResponse("Failed to process upload", 500);
  }
}
