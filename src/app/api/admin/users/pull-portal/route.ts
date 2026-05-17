/**
 * POST /api/admin/users/pull-portal
 *
 * Admin-triggered pull sync: P&AMS calls the company's configured portal API
 * to fetch users and upsert them. Expects the portal to respond with:
 *
 * { users: [{ email, firstName, lastName, employeeCode, phone?, designation?,
 *             department?, branchName? }] }
 *
 * Configured per-company in Company Settings:
 *   portalSyncUrl  — e.g. https://nraco.in/api/pams-export/users
 *   portalSyncKey  — Bearer token set by the company portal admin
 */

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse } from "@/lib/api-utils";

function generateTempPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase() + "!";
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrFail();
  if (error) return error;

  const role = session.user.role;
  if (role !== "ADMIN" && role !== "SUPER_ADMIN") return errorResponse("Forbidden", 403);

  // Determine which company to sync
  let companyId = session.user.companyId;
  const body = await req.json().catch(() => ({})) as { companyId?: string };
  if (role === "SUPER_ADMIN" && body.companyId) {
    companyId = body.companyId;
  }
  if (!companyId) return errorResponse("Company not found", 400);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return errorResponse("Company not found", 404);

  if (!company.portalSyncUrl || !company.portalSyncKey) {
    return errorResponse(
      "Portal sync not configured. Set Portal Sync URL and Key in Company Settings.",
      422
    );
  }

  // Call the company portal
  let portalUsers: {
    email: string;
    firstName: string;
    lastName: string;
    employeeCode: string;
    phone?: string;
    designation?: string;
    department?: string;
    branchName?: string;
  }[];

  try {
    const resp = await fetch(company.portalSyncUrl, {
      headers: { Authorization: `Bearer ${company.portalSyncKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!resp.ok) throw new Error(`Portal returned HTTP ${resp.status}`);
    const json = await resp.json();
    portalUsers = json.users ?? json.data ?? json;
    if (!Array.isArray(portalUsers)) throw new Error("Portal response is not a user array");
  } catch (err) {
    return errorResponse(`Failed to fetch from portal: ${(err as Error).message}`, 502);
  }

  const source = new URL(company.portalSyncUrl).hostname;
  const branches = await prisma.branch.findMany({ where: { companyId } });
  const branchByName = (name?: string) =>
    name ? branches.find((b) => b.name.toLowerCase() === name.toLowerCase()) : undefined;

  const results: { email: string; action: "created" | "updated" | "skipped"; error?: string }[] = [];

  for (const u of portalUsers) {
    if (!u.email || !u.firstName || !u.lastName || !u.employeeCode) {
      results.push({ email: u.email ?? "?", action: "skipped", error: "Missing required fields" });
      continue;
    }

    try {
      const existing = await prisma.user.findFirst({ where: { companyId, email: u.email } });
      const branch = branchByName(u.branchName);

      if (existing) {
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
        let empCode = u.employeeCode;
        const conflict = await prisma.user.findFirst({ where: { companyId, employeeCode: empCode } });
        if (conflict) empCode = `${empCode}-${Date.now().toString(36)}`;

        const hashed = await bcrypt.hash(generateTempPassword(), 10);
        await prisma.user.create({
          data: {
            companyId,
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
      results.push({ email: u.email, action: "skipped", error: (err as Error).message });
    }
  }

  return successResponse({
    created: results.filter((r) => r.action === "created").length,
    updated: results.filter((r) => r.action === "updated").length,
    skipped: results.filter((r) => r.action === "skipped").length,
    results,
  });
}
