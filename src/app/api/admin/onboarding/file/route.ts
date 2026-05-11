import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { getSessionOrFail, errorResponse } from "@/lib/api-utils";

export const runtime = "nodejs";

const MIME_MAP: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
};

/**
 * GET /api/admin/onboarding/file?path=kyc/{userId}/PAN-1234.pdf
 * Serve an uploaded onboarding document (authenticated, admin only).
 * Prevents path traversal attacks.
 */
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return errorResponse("Forbidden — admin only", 403);
    }

    const filePath = req.nextUrl.searchParams.get("path");
    if (!filePath) return errorResponse("path query param is required");

    // Security: prevent path traversal
    const uploadsRoot = path.resolve(process.cwd(), "uploads");
    const resolved = path.resolve(uploadsRoot, filePath.replace(/\//g, path.sep));
    if (!resolved.startsWith(uploadsRoot + path.sep)) {
      return errorResponse("Invalid path", 400);
    }

    const ext = path.extname(resolved).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    const data = await readFile(resolved);
    return new NextResponse(data, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${path.basename(resolved)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return errorResponse("File not found", 404);
    console.error("[GET /api/admin/onboarding/file]", err);
    return errorResponse("Failed to serve file", 500);
  }
}
