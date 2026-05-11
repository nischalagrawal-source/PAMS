import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse } from "@/lib/api-utils";

export const runtime = "nodejs";

const VALID_DOC_TYPES = [
  "AADHAAR",
  "PAN",
  "PASSPORT_PHOTO",
  "BANK_DETAILS",
  "EDUCATION_CERT",
  "EXPERIENCE_CERT",
  "PREV_SALARY_SLIP",
];

const ALLOWED_MIMES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
];

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * POST /api/admin/onboarding/upload
 * Upload a KYC / onboarding document for an employee.
 * Accepts multipart/form-data with fields: file, userId, docType
 */
export async function POST(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden — admin only", 403);
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = (formData.get("userId") as string | null)?.trim();
    const docType = (formData.get("docType") as string | null)?.trim().toUpperCase();

    if (!file || !userId || !docType) {
      return errorResponse("file, userId, and docType are required");
    }

    if (!VALID_DOC_TYPES.includes(docType)) {
      return errorResponse(`Invalid docType. Must be one of: ${VALID_DOC_TYPES.join(", ")}`);
    }

    if (!ALLOWED_MIMES.includes(file.type)) {
      return errorResponse("Only JPEG, PNG, and PDF files are allowed");
    }

    if (file.size > MAX_SIZE_BYTES) {
      return errorResponse("File size must be under 10 MB");
    }

    // Verify user exists (and belongs to same company for ADMIN)
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { companyId: true },
    });
    if (!targetUser) return errorResponse("User not found", 404);
    if (role === "ADMIN" && targetUser.companyId !== session.user.companyId) {
      return errorResponse("Forbidden", 403);
    }

    // Determine safe file extension
    const originalExt = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
    const safeFilename = `${docType}-${Date.now()}.${originalExt}`;
    const subDir = path.join("kyc", userId);
    const uploadDir = path.join(process.cwd(), "uploads", subDir);

    await mkdir(uploadDir, { recursive: true });

    const bytes = await file.arrayBuffer();
    await writeFile(path.join(uploadDir, safeFilename), Buffer.from(bytes));

    const fileUrl = `${subDir.replace(/\\/g, "/")}/${safeFilename}`;

    const doc = await prisma.onboardingDocument.create({
      data: {
        userId,
        type: docType as never,
        fileUrl,
        fileName: file.name,
        fileSizeKb: Math.ceil(file.size / 1024),
        mimeType: file.type,
      },
    });

    return successResponse(doc, "Document uploaded successfully");
  } catch (err) {
    console.error("[POST /api/admin/onboarding/upload]", err);
    return errorResponse("Upload failed", 500);
  }
}
