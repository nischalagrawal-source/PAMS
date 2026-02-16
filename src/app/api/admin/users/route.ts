import { NextRequest } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  employeeCode: z.string().min(1, "Employee code is required"),
  role: z.enum(["STAFF", "REVIEWER", "ADMIN"]),
  phone: z.string().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  dateOfJoining: z.string().optional(),
  workMode: z.enum(["office", "client", "hybrid"]).optional(),
  companyId: z.string().optional(),
});

/**
 * Default feature permissions by role
 */
function getDefaultPermissions(role: string) {
  const staffPerms = [
    { feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "attendance", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "leaves", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "tasks", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "salary", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
  ];

  const reviewerPerms = [
    ...staffPerms,
    { feature: "tasks", canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { feature: "performance", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "reports", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "leaves", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: true },
  ];

  const allFeatures = [
    "dashboard", "attendance", "leaves", "tasks", "performance",
    "salary", "reports", "notifications", "admin_users", "admin_companies",
    "admin_geofences", "admin_parameters", "admin_rights", "admin_anomalies",
  ];

  const adminPerms = allFeatures.map((feature) => ({
    feature,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canApprove: true,
  }));

  switch (role) {
    case "ADMIN":
      return adminPerms;
    case "REVIEWER":
      return reviewerPerms;
    case "STAFF":
    default:
      return staffPerms;
  }
}

/**
 * GET /api/admin/users
 * List all users in the company
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_users", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const isSuperAdmin = session!.user.role === "SUPER_ADMIN";
    const queryCompanyId = req.nextUrl.searchParams.get("companyId");
    const companyId = isSuperAdmin && queryCompanyId
      ? queryCompanyId
      : session!.user.companyId;

    const users = await prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        employeeCode: true,
        role: true,
        designation: true,
        department: true,
        dateOfJoining: true,
        isActive: true,
        workMode: true,
        profilePhoto: true,
        createdAt: true,
        featurePermissions: {
          select: {
            feature: true,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canApprove: true,
          },
        },
      },
      orderBy: { firstName: "asc" },
    });

    return successResponse(users);
  } catch (err) {
    console.error("[GET /api/admin/users]", err);
    return errorResponse("Failed to fetch users", 500);
  }
}

/**
 * POST /api/admin/users
 * Create a new user
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_users", "canCreate")) {
      return errorResponse("Forbidden", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const {
      email,
      password,
      firstName,
      lastName,
      employeeCode,
      role,
      phone,
      designation,
      department,
      dateOfJoining,
      workMode,
      companyId: bodyCompanyId,
    } = parsed.data;

    const isSuperAdmin = session!.user.role === "SUPER_ADMIN";
    const companyId = isSuperAdmin && bodyCompanyId
      ? bodyCompanyId
      : session!.user.companyId;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return errorResponse("A user with this email already exists", 409);
    }

    const existingCode = await prisma.user.findUnique({
      where: { companyId_employeeCode: { companyId, employeeCode } },
    });
    if (existingCode) {
      return errorResponse("Employee code already exists in this company", 409);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const defaultPerms = getDefaultPermissions(role);

    const user = await prisma.user.create({
      data: {
        companyId,
        email,
        password: hashedPassword,
        firstName,
        lastName,
        employeeCode,
        role,
        phone,
        designation,
        department,
        dateOfJoining: dateOfJoining ? new Date(dateOfJoining) : undefined,
        workMode: workMode ?? "office",
        featurePermissions: {
          create: defaultPerms,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        employeeCode: true,
        role: true,
        designation: true,
        department: true,
        dateOfJoining: true,
        isActive: true,
        workMode: true,
        profilePhoto: true,
        createdAt: true,
        featurePermissions: {
          select: {
            feature: true,
            canView: true,
            canCreate: true,
            canEdit: true,
            canDelete: true,
            canApprove: true,
          },
        },
      },
    });

    return successResponse(user, "User created successfully");
  } catch (err) {
    console.error("[POST /api/admin/users]", err);
    return errorResponse("Failed to create user", 500);
  }
}
