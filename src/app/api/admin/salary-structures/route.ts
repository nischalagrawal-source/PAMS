import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  checkPermission,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const updateSalaryStructureSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  basic: z.number().min(0, "Basic salary must be >= 0"),
  hra: z.number().min(0).default(0),
  da: z.number().min(0).default(0),
  ta: z.number().min(0).default(0),
  specialAllow: z.number().min(0).default(0),
  pf: z.number().min(0).default(0),
  esi: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  otherDeduct: z.number().min(0).default(0),
  securityDeposit: z.number().min(0).default(0),
  securityDepositStart: z.string().nullable().optional(),
  effectiveFrom: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid date string",
  }),
});

/**
 * GET /api/admin/salary-structures
 * List all salary structures for the company
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_salary", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, parseInt(searchParams.get("limit") || "25"));
    const skip = (page - 1) * limit;

    // Get employees in the company
    const [structures, total] = await Promise.all([
      prisma.salaryStructure.findMany({
        where: {
          user: { companyId },
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              employeeCode: true,
              email: true,
              role: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { user: { firstName: "asc" } },
      }),
      prisma.salaryStructure.count({
        where: { user: { companyId } },
      }),
    ]);

    return successResponse({
      records: structures,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[GET /api/admin/salary-structures]", err);
    return errorResponse("Failed to fetch salary structures", 500);
  }
}

/**
 * POST /api/admin/salary-structures
 * Create or update salary structure for an employee
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session, "admin_salary", "canEdit")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session.user.companyId;
    const body = await parseBody(req);
    if (!body) {
      return errorResponse("Invalid request body");
    }

    const parsed = updateSalaryStructureSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { userId, ...salaryData } = parsed.data;

    // Verify user belongs to this company
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
    });

    if (!user) {
      return errorResponse("Employee not found in your company", 404);
    }

    // Calculate net salary
    const gross = salaryData.basic + salaryData.hra + salaryData.da + salaryData.ta + salaryData.specialAllow;
    const totalDeductions = salaryData.pf + salaryData.esi + salaryData.tax + salaryData.otherDeduct;
    const netSalary = gross - totalDeductions;

    // Upsert salary structure
    const structure = await prisma.salaryStructure.upsert({
      where: { userId },
      create: {
        userId,
        ...salaryData,
        netSalary,
        currency: "INR",
      },
      update: {
        ...salaryData,
        netSalary,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    return successResponse(structure);
  } catch (err) {
    console.error("[POST /api/admin/salary-structures]", err);
    return errorResponse("Failed to save salary structure", 500);
  }
}
