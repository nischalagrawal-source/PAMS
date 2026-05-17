/**
 * POST /api/internal/company-sync
 *
 * Server-to-server endpoint called by a company portal (e.g. nraco.in)
 * whenever a user is created or updated there.
 *
 * Auth: x-pams-key header (PAMS_INTERNAL_KEY env var)
 *
 * Body:
 * {
 *   companyCode: string,          // P&AMS company code, e.g. "NRACO"
 *   source: string,               // e.g. "nraco.in"
 *   users: [{
 *     email: string,
 *     firstName: string,
 *     lastName: string,
 *     employeeCode: string,       // must be unique within the company
 *     phone?: string,
 *     designation?: string,
 *     department?: string,
 *     branchName?: string,        // matched against Branch.name (case-insensitive)
 *   }]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { validateInternalKey } from "@/lib/internal-auth";

function generateTempPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + "!";
}

export async function POST(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  let body: {
    companyCode: string;
    source: string;
    users: {
      email: string;
      firstName: string;
      lastName: string;
      employeeCode: string;
      phone?: string;
      designation?: string;
      department?: string;
      branchName?: string;
    }[];
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { companyCode, source, users } = body;
  if (!companyCode || !source || !Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ error: "companyCode, source, and users[] are required" }, { status: 400 });
  }

  const company = await prisma.company.findUnique({ where: { code: companyCode } });
  if (!company) {
    return NextResponse.json({ error: `Company with code "${companyCode}" not found` }, { status: 404 });
  }

  // Load all branches for this company once
  const branches = await prisma.branch.findMany({ where: { companyId: company.id } });
  const branchByName = (name?: string) =>
    name ? branches.find((b) => b.name.toLowerCase() === name.toLowerCase()) : undefined;

  const results: { email: string; action: "created" | "updated" | "skipped"; error?: string }[] = [];

  for (const u of users) {
    if (!u.email || !u.firstName || !u.lastName || !u.employeeCode) {
      results.push({ email: u.email ?? "?", action: "skipped", error: "Missing required fields" });
      continue;
    }

    try {
      const existing = await prisma.user.findFirst({
        where: { companyId: company.id, email: u.email },
      });

      const branch = branchByName(u.branchName);

      if (existing) {
        // Update non-P&AMS-managed fields only
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            firstName: u.firstName,
            lastName: u.lastName,
            phone: u.phone ?? existing.phone,
            designation: u.designation ?? existing.designation,
            department: u.department ?? existing.department,
            branchId: branch?.id ?? existing.branchId,
            portalSynced: true,
            portalSource: source,
          },
        });
        results.push({ email: u.email, action: "updated" });
      } else {
        // Check for employeeCode collision and make it unique
        let empCode = u.employeeCode;
        const codeConflict = await prisma.user.findFirst({
          where: { companyId: company.id, employeeCode: empCode },
        });
        if (codeConflict) {
          empCode = `${empCode}-${Date.now().toString(36)}`;
        }

        const tempPwd = generateTempPassword();
        const hashed = await bcrypt.hash(tempPwd, 10);

        await prisma.user.create({
          data: {
            companyId: company.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            employeeCode: empCode,
            password: hashed,
            phone: u.phone,
            designation: u.designation,
            department: u.department,
            branchId: branch?.id,
            role: "STAFF",
            portalSynced: true,
            portalSource: source,
            featurePermissions: {
              create: [
                { feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
                { feature: "attendance", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
                { feature: "leaves", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
                { feature: "tasks", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
                { feature: "salary", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
              ],
            },
          },
        });
        results.push({ email: u.email, action: "created" });
      }
    } catch (err) {
      console.error("[company-sync] user error", u.email, err);
      results.push({ email: u.email, action: "skipped", error: (err as Error).message });
    }
  }

  const created = results.filter((r) => r.action === "created").length;
  const updated = results.filter((r) => r.action === "updated").length;
  const skipped = results.filter((r) => r.action === "skipped").length;

  return NextResponse.json({ success: true, created, updated, skipped, results });
}
