import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { z } from "zod";
import { SlipStatus } from "@/generated/prisma/client";

// ── Validation ────────────────────────────────────────────────

const generateSlipSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Month must be in YYYY-MM format"),
});

// ── GET /api/salary/slips ─────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    let userId = searchParams.get("userId");
    const month = searchParams.get("month");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    const companyId = session!.user.companyId;
    const role = session!.user.role;

    // STAFF can only see their own slips
    if (role === "STAFF") {
      userId = session!.user.id;
    }

    const where: Record<string, unknown> = { companyId };

    if (userId) {
      where.userId = userId;
    }

    if (month) {
      where.month = month;
    }

    const total = await prisma.salarySlip.count({ where });

    const slips = await prisma.salarySlip.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
      orderBy: { month: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });

    const totalPages = Math.ceil(total / limit);

    return successResponse({ records: slips, total, page, limit, totalPages });
  } catch (err) {
    console.error("[GET /api/salary/slips]", err);
    return errorResponse("Failed to fetch salary slips", 500);
  }
}

// ── POST /api/salary/slips ────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session!.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Only admins can generate salary slips", 403);
    }

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = generateSlipSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { userId, month } = parsed.data;
    const companyId = session!.user.companyId;

    // Verify user belongs to the same company
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true },
    });

    if (!targetUser) {
      return errorResponse("User not found in your company", 404);
    }

    // Fetch salary structure
    const structure = await prisma.salaryStructure.findUnique({
      where: { userId },
    });

    if (!structure) {
      return errorResponse("No salary structure found for this user. Please set up salary structure first.", 404);
    }

    // Fetch bonus calculation for the period (if exists)
    const bonus = await prisma.bonusCalculation.findUnique({
      where: { userId_period: { userId, period: month } },
    });

    // Calculate salary components
    const bonusPercentage = bonus?.bonusPercentage ?? 0;
    const bonusAmount =
      bonus ? (structure.netSalary * bonusPercentage) / 100 : 0;

    const systemGross =
      structure.basic +
      structure.hra +
      structure.da +
      structure.ta +
      structure.specialAllow +
      bonusAmount;

    const systemDeductions =
      structure.pf + structure.esi + structure.tax + structure.otherDeduct;

    const systemNet = systemGross - systemDeductions;

    const systemBreakdown = {
      basic: structure.basic,
      hra: structure.hra,
      da: structure.da,
      ta: structure.ta,
      specialAllow: structure.specialAllow,
      bonusPercentage,
      bonusAmount,
      pf: structure.pf,
      esi: structure.esi,
      tax: structure.tax,
      otherDeduct: structure.otherDeduct,
      gross: systemGross,
      deductions: systemDeductions,
      net: systemNet,
    };

    const slip = await prisma.salarySlip.upsert({
      where: { userId_month: { userId, month } },
      update: {
        systemGross,
        systemDeductions,
        systemNet,
        systemBreakdown,
        bonusPercentage: bonusPercentage || null,
        bonusAmount: bonusAmount || null,
        status: SlipStatus.GENERATED,
        generatedAt: new Date(),
      },
      create: {
        userId,
        companyId,
        month,
        systemGross,
        systemDeductions,
        systemNet,
        systemBreakdown,
        bonusPercentage: bonusPercentage || null,
        bonusAmount: bonusAmount || null,
        status: SlipStatus.GENERATED,
        generatedAt: new Date(),
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

    return successResponse(slip, "Salary slip generated successfully");
  } catch (err) {
    console.error("[POST /api/salary/slips]", err);
    return errorResponse("Failed to generate salary slip", 500);
  }
}
