import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const createCompanySchema = z.object({
  name: z.string().min(1, "Company name is required"),
  code: z.string().min(2, "Code must be at least 2 characters").max(10, "Code must be at most 10 characters"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  inTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format").optional(),
  outTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:mm format").optional(),
  graceMinutes: z.number().min(0).max(60).optional(),
  lateThreshold: z.number().min(1).max(30).optional(),
});

/**
 * GET /api/admin/companies
 * List all companies (SUPER_ADMIN only)
 */
export async function GET() {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (session!.user.role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden — SUPER_ADMIN only", 403);
    }

    const companies = await prisma.company.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return successResponse(companies);
  } catch (err) {
    console.error("[GET /api/admin/companies]", err);
    return errorResponse("Failed to fetch companies", 500);
  }
}

/**
 * POST /api/admin/companies
 * Create a new company (SUPER_ADMIN only)
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (session!.user.role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden — SUPER_ADMIN only", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = createCompanySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const { name, code, address, phone, email, inTime, outTime, graceMinutes, lateThreshold } = parsed.data;

    const existingCompany = await prisma.company.findUnique({
      where: { code },
    });
    if (existingCompany) {
      return errorResponse("A company with this code already exists", 409);
    }

    const company = await prisma.company.create({
      data: {
        name,
        code: code.toUpperCase(),
        address,
        phone,
        email,
        ...(inTime && { inTime }),
        ...(outTime && { outTime }),
        ...(graceMinutes !== undefined && { graceMinutes }),
        ...(lateThreshold !== undefined && { lateThreshold }),
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return successResponse(company, "Company created successfully");
  } catch (err) {
    console.error("[POST /api/admin/companies]", err);
    return errorResponse("Failed to create company", 500);
  }
}
