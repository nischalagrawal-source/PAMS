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

const createTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  content: z.string().min(1, "Template content is required"),
});

// ── GET /api/salary/offer-letters ─────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session!.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Only admins can view offer letter templates", 403);
    }

    const companyId = session!.user.companyId;

    const templates = await prisma.offerLetterTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(templates);
  } catch (err) {
    console.error("[GET /api/salary/offer-letters]", err);
    return errorResponse("Failed to fetch offer letter templates", 500);
  }
}

// ── POST /api/salary/offer-letters ────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session!.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Only admins can create offer letter templates", 403);
    }

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { name, content } = parsed.data;
    const companyId = session!.user.companyId;

    const template = await prisma.offerLetterTemplate.create({
      data: {
        companyId,
        name,
        content,
      },
    });

    return successResponse(template, "Offer letter template created successfully");
  } catch (err) {
    console.error("[POST /api/salary/offer-letters]", err);
    return errorResponse("Failed to create offer letter template", 500);
  }
}
