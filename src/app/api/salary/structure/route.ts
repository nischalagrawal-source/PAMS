import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { z } from "zod";

// ── Validation ────────────────────────────────────────────────

const salaryStructureSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  basic: z.number().min(0),
  hra: z.number().min(0).default(0),
  da: z.number().min(0).default(0),
  ta: z.number().min(0).default(0),
  specialAllow: z.number().min(0).default(0),
  pf: z.number().min(0).default(0),
  esi: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  otherDeduct: z.number().min(0).default(0),
  effectiveFrom: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: "Invalid ISO date string",
  }),
});

// ── GET /api/salary/structure ─────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { searchParams } = new URL(req.url);
    let userId = searchParams.get("userId");
    const companyId = session!.user.companyId;
    const role = session!.user.role;

    // STAFF can only view their own salary structure
    if (role === "STAFF") {
      userId = session!.user.id;
    }

    // Default to session user if no userId provided
    if (!userId) {
      userId = session!.user.id;
    }

    // Verify the user belongs to the same company
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true },
    });

    if (!targetUser) {
      return errorResponse("User not found in your company", 404);
    }

    const structure = await prisma.salaryStructure.findUnique({
      where: { userId },
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
    console.error("[GET /api/salary/structure]", err);
    return errorResponse("Failed to fetch salary structure", 500);
  }
}

// ── POST /api/salary/structure ────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session!.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Only admins can create/update salary structures", 403);
    }

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = salaryStructureSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const {
      userId,
      basic,
      hra,
      da,
      ta,
      specialAllow,
      pf,
      esi,
      tax,
      otherDeduct,
      effectiveFrom,
    } = parsed.data;

    const companyId = session!.user.companyId;

    // Verify user belongs to the same company
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, companyId },
      select: { id: true },
    });

    if (!targetUser) {
      return errorResponse("User not found in your company", 404);
    }

    // Calculate net salary
    const netSalary =
      basic + hra + da + ta + specialAllow - pf - esi - tax - otherDeduct;

    const structure = await prisma.salaryStructure.upsert({
      where: { userId },
      update: {
        basic,
        hra,
        da,
        ta,
        specialAllow,
        pf,
        esi,
        tax,
        otherDeduct,
        netSalary,
        effectiveFrom: new Date(effectiveFrom),
      },
      create: {
        userId,
        basic,
        hra,
        da,
        ta,
        specialAllow,
        pf,
        esi,
        tax,
        otherDeduct,
        netSalary,
        effectiveFrom: new Date(effectiveFrom),
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

    return successResponse(structure, "Salary structure saved successfully");
  } catch (err) {
    console.error("[POST /api/salary/structure]", err);
    return errorResponse("Failed to save salary structure", 500);
  }
}
