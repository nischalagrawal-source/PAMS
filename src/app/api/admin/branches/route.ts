import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const createBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required"),
  code: z.string().min(1, "Branch code is required").max(10, "Code too long"),
  companyId: z.string().optional(), // SUPER_ADMIN can specify; ADMIN uses their own
});

const updateBranchSchema = z.object({
  name: z.string().min(1, "Branch name is required").optional(),
  code: z.string().min(1).max(10).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/admin/branches
 * List branches — ADMIN sees their company's, SUPER_ADMIN can query any
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return errorResponse("Forbidden", 403);
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const queryCompanyId = req.nextUrl.searchParams.get("companyId");
    const companyId = isSuperAdmin && queryCompanyId
      ? queryCompanyId
      : session.user.companyId;

    const branches = await prisma.branch.findMany({
      where: isSuperAdmin && !queryCompanyId ? {} : { companyId: companyId! },
      include: {
        _count: { select: { users: true } },
        company: { select: { name: true, code: true } },
      },
      orderBy: { name: "asc" },
    });

    return successResponse(branches);
  } catch (err) {
    console.error("[GET /api/admin/branches]", err);
    return errorResponse("Failed to fetch branches", 500);
  }
}

/**
 * POST /api/admin/branches
 * Create a new branch
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role)) {
      return errorResponse("Forbidden", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) return errorResponse("Invalid JSON body");

    const parsed = createBranchSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    const companyId = isSuperAdmin && parsed.data.companyId
      ? parsed.data.companyId
      : session.user.companyId!;

    // Check code uniqueness within company
    const existing = await prisma.branch.findUnique({
      where: { companyId_code: { companyId, code: parsed.data.code } },
    });
    if (existing) {
      return errorResponse("A branch with this code already exists in the company", 409);
    }

    const branch = await prisma.branch.create({
      data: {
        companyId,
        name: parsed.data.name,
        code: parsed.data.code.toUpperCase(),
      },
      include: {
        _count: { select: { users: true } },
        company: { select: { name: true, code: true } },
      },
    });

    return successResponse(branch, "Branch created successfully");
  } catch (err) {
    console.error("[POST /api/admin/branches]", err);
    return errorResponse("Failed to create branch", 500);
  }
}
