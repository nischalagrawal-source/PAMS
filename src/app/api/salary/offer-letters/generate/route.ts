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

const generateOfferSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  templateId: z.string().min(1, "templateId is required"),
});

// ── POST /api/salary/offer-letters/generate ───────────────────

export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session!.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Only admins can generate offer letters", 403);
    }

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = generateOfferSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const { userId, templateId } = parsed.data;
    const companyId = session!.user.companyId;

    // Fetch template (must belong to same company)
    const template = await prisma.offerLetterTemplate.findFirst({
      where: { id: templateId, companyId },
    });

    if (!template) {
      return errorResponse("Offer letter template not found", 404);
    }

    // Fetch user details
    const user = await prisma.user.findFirst({
      where: { id: userId, companyId },
      include: {
        company: { select: { name: true } },
      },
    });

    if (!user) {
      return errorResponse("User not found in your company", 404);
    }

    // Replace placeholders in template content
    const now = new Date();
    let renderedContent = template.content;
    renderedContent = renderedContent.replace(/\{\{firstName\}\}/g, user.firstName);
    renderedContent = renderedContent.replace(/\{\{lastName\}\}/g, user.lastName);
    renderedContent = renderedContent.replace(
      /\{\{designation\}\}/g,
      user.designation || "N/A"
    );
    renderedContent = renderedContent.replace(
      /\{\{department\}\}/g,
      user.department || "N/A"
    );
    renderedContent = renderedContent.replace(
      /\{\{dateOfJoining\}\}/g,
      user.dateOfJoining
        ? user.dateOfJoining.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "N/A"
    );
    renderedContent = renderedContent.replace(
      /\{\{companyName\}\}/g,
      user.company.name
    );
    renderedContent = renderedContent.replace(
      /\{\{date\}\}/g,
      now.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    );

    // Create offer letter record
    const offerLetter = await prisma.offerLetter.create({
      data: {
        userId,
        templateId,
        content: renderedContent,
        generatedAt: now,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
          },
        },
        template: {
          select: {
            name: true,
          },
        },
      },
    });

    return successResponse(offerLetter, "Offer letter generated successfully");
  } catch (err) {
    console.error("[POST /api/salary/offer-letters/generate]", err);
    return errorResponse("Failed to generate offer letter", 500);
  }
}
