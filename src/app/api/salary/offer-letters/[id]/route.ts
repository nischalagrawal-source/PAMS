import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";

const updateOfferLetterSchema = z.object({
  content: z.string().min(1, "Offer letter content is required"),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Only admins can update offer letters", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = updateOfferLetterSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const companyId = session.user.companyId;
    const existing = await prisma.offerLetter.findFirst({
      where: role === "SUPER_ADMIN"
        ? { id }
        : { id, user: { companyId: companyId! } },
      include: { user: { select: { companyId: true } } },
    });

    if (!existing) {
      return errorResponse("Offer letter not found", 404);
    }

    const updated = await prisma.offerLetter.update({
      where: { id },
      data: { content: parsed.data.content },
    });

    return successResponse(updated, "Offer letter updated successfully");
  } catch (err) {
    console.error("[PUT /api/salary/offer-letters/[id]]", err);
    return errorResponse("Failed to update offer letter", 500);
  }
}
