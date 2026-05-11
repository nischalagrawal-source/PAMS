import { NextRequest } from "next/server";
import { unlink } from "fs/promises";
import path from "path";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse, parseBody } from "@/lib/api-utils";

export const runtime = "nodejs";

const updateSchema = z.object({
  status: z.enum(["PENDING", "VERIFIED", "REJECTED"]),
  notes: z.string().optional(),
});

/**
 * PUT /api/admin/onboarding/documents/[docId]
 * Update verification status / notes for a document.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden — admin only", 403);
    }

    const doc = await prisma.onboardingDocument.findUnique({
      where: { id: docId },
      include: { user: { select: { companyId: true } } },
    });
    if (!doc) return errorResponse("Document not found", 404);
    if (role === "ADMIN" && doc.user.companyId !== session.user.companyId) {
      return errorResponse("Forbidden", 403);
    }

    const body = await parseBody<unknown>(req);
    if (!body) return errorResponse("Invalid JSON body");

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues.map((e) => e.message).join("; "));
    }

    const updated = await prisma.onboardingDocument.update({
      where: { id: docId },
      data: {
        status: parsed.data.status,
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
      },
    });

    return successResponse(updated, "Document status updated");
  } catch (err) {
    console.error("[PUT /api/admin/onboarding/documents/[docId]]", err);
    return errorResponse("Failed to update document", 500);
  }
}

/**
 * DELETE /api/admin/onboarding/documents/[docId]
 * Delete a document record and its file from disk.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ docId: string }> }
) {
  try {
    const { docId } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden — admin only", 403);
    }

    const doc = await prisma.onboardingDocument.findUnique({
      where: { id: docId },
      include: { user: { select: { companyId: true } } },
    });
    if (!doc) return errorResponse("Document not found", 404);
    if (role === "ADMIN" && doc.user.companyId !== session.user.companyId) {
      return errorResponse("Forbidden", 403);
    }

    // Remove file from disk (best-effort, don't fail if already gone)
    try {
      const filePath = path.join(process.cwd(), "uploads", doc.fileUrl.replace(/\//g, path.sep));
      await unlink(filePath);
    } catch {
      // File may already be missing — continue
    }

    await prisma.onboardingDocument.delete({ where: { id: docId } });
    return successResponse(null, "Document deleted");
  } catch (err) {
    console.error("[DELETE /api/admin/onboarding/documents/[docId]]", err);
    return errorResponse("Failed to delete document", 500);
  }
}
