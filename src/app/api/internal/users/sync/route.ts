import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { validateInternalKey } from "@/lib/internal-auth";

/**
 * Role mapping: CA Website roles → PAMS roles
 */
function mapRole(nracoRole: string): "SUPER_ADMIN" | "ADMIN" | "STAFF" {
  switch (nracoRole) {
    case "superadmin":
      return "SUPER_ADMIN";
    case "admin":
    case "partner":
      return "ADMIN";
    default:
      return "STAFF";
  }
}

/**
 * Default feature permissions by role (mirrors admin users API)
 */
function getDefaultPermissions(role: string) {
  const staffPerms = [
    { feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "attendance", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "leaves", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "tasks", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "salary", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
  ];

  const allFeatures = [
    "dashboard", "attendance", "leaves", "tasks", "performance",
    "salary", "reports", "notifications", "admin_users", "admin_companies",
    "admin_geofences", "admin_parameters", "admin_rights", "admin_anomalies",
  ];

  const adminPerms = allFeatures.map((feature) => ({
    feature, canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true,
  }));

  switch (role) {
    case "SUPER_ADMIN":
    case "ADMIN":
      return adminPerms;
    default:
      return staffPerms;
  }
}

/**
 * POST /api/internal/users/sync
 *
 * Upserts a user from the CA Website (nraco.in) admin panel.
 * - If user with the given email exists → update their details & role
 * - If not → create a new PAMS user with default permissions
 *
 * Also supports deactivation when is_active is false.
 */
export async function POST(req: NextRequest) {
  const authError = validateInternalKey(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { email, full_name, role, designation, phone, branch, is_active } = body;

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    // Resolve company
    const companyId = process.env.NRACO_COMPANY_ID || undefined;
    const company = companyId
      ? await prisma.company.findUnique({ where: { id: companyId } })
      : await prisma.company.findFirst();
    if (!company) {
      return NextResponse.json({ error: "No company found in PAMS" }, { status: 500 });
    }

    const pmsRole = mapRole(role || "staff");
    const parts = (full_name || email.split("@")[0]).trim().split(" ");
    const firstName = parts[0];
    const lastName = parts.slice(1).join(" ") || "-";

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // ── UPDATE existing user ──
      const updateData: Record<string, unknown> = {
        firstName,
        lastName,
        designation: designation || existing.designation,
        phone: phone || existing.phone,
      };

      if (is_active !== undefined) {
        updateData.isActive = Boolean(is_active);
      }

      // If role changed, update role and re-create permissions
      if (existing.role !== pmsRole) {
        updateData.role = pmsRole;
        await prisma.featurePermission.deleteMany({ where: { userId: existing.id } });
        const perms = getDefaultPermissions(pmsRole);
        await prisma.featurePermission.createMany({
          data: perms.map((p) => ({ ...p, userId: existing.id })),
        });
      }

      const user = await prisma.user.update({
        where: { id: existing.id },
        data: updateData,
        select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
      });

      return NextResponse.json({ success: true, action: "updated", user });
    }

    // ── CREATE new user ──
    const count = await prisma.user.count({ where: { companyId: company.id } });
    const employeeCode = `EMP${String(count + 1).padStart(3, "0")}`;
    const hashedPw = await bcrypt.hash(`Staff@1234`, 12);

    const defaultPerms = getDefaultPermissions(pmsRole);

    const user = await prisma.user.create({
      data: {
        companyId: company.id,
        email,
        password: hashedPw,
        firstName,
        lastName,
        employeeCode,
        role: pmsRole,
        designation: designation || "",
        phone: phone || undefined,
        workMode: "office",
        featurePermissions: {
          create: defaultPerms,
        },
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true },
    });

    return NextResponse.json({ success: true, action: "created", user });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/internal/users/sync]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
