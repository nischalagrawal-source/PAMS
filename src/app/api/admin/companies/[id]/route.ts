import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  code: z.string().min(2).max(10).optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  isActive: z.boolean().optional(),
});

/**
 * PUT /api/admin/companies/[id]
 * Update a company (SUPER_ADMIN only)
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (session!.user.role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden — SUPER_ADMIN only", 403);
    }

    const existing = await prisma.company.findUnique({
      where: { id },
    });

    if (!existing) {
      return errorResponse("Company not found", 404);
    }

    const body = await parseBody<unknown>(req);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = updateCompanySchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const { code, ...rest } = parsed.data;

    if (code && code.toUpperCase() !== existing.code) {
      const codeExists = await prisma.company.findUnique({
        where: { code: code.toUpperCase() },
      });
      if (codeExists) {
        return errorResponse("A company with this code already exists", 409);
      }
    }

    const company = await prisma.company.update({
      where: { id },
      data: {
        ...rest,
        ...(code ? { code: code.toUpperCase() } : {}),
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    return successResponse(company, "Company updated successfully");
  } catch (err) {
    console.error("[PUT /api/admin/companies/[id]]", err);
    return errorResponse("Failed to update company", 500);
  }
}
