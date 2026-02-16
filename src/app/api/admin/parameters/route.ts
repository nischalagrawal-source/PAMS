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

const createParameterSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  weight: z.number().min(0).max(100),
  formula: z.enum(["HIGHER_IS_BETTER", "LOWER_IS_BETTER", "CUSTOM"]),
  dataSource: z.string().optional(),
  sortOrder: z.number().int().optional(),
});

/**
 * GET /api/admin/parameters
 * List all performance parameters for the user's company.
 */
export async function GET() {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_parameters", "canView")) {
      return errorResponse("Forbidden", 403);
    }

    const companyId = session!.user.companyId;

    const parameters = await prisma.perfParameter.findMany({
      where: { companyId },
      orderBy: { sortOrder: "asc" },
    });

    return successResponse(parameters);
  } catch (err) {
    console.error("[GET /api/admin/parameters]", err);
    return errorResponse("Failed to fetch parameters", 500);
  }
}

/**
 * POST /api/admin/parameters
 * Create a new performance parameter.
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    if (!checkPermission(session!, "admin_parameters", "canCreate")) {
      return errorResponse("Forbidden", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) {
      return errorResponse("Invalid JSON body");
    }

    const parsed = createParameterSchema.safeParse(body);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((e) => e.message).join("; ");
      return errorResponse(msg || "Validation failed");
    }

    const { name, description, weight, formula, dataSource, sortOrder } =
      parsed.data;
    const companyId = session!.user.companyId;

    const parameter = await prisma.perfParameter.create({
      data: {
        companyId,
        name,
        description,
        weight,
        formula,
        dataSource,
        sortOrder: sortOrder ?? 0,
      },
    });

    return successResponse(parameter);
  } catch (err) {
    console.error("[POST /api/admin/parameters]", err);
    return errorResponse("Failed to create parameter", 500);
  }
}
