import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import {
  getSessionOrFail,
  errorResponse,
  checkPermission,
} from "@/lib/api-utils";

/**
 * GET /api/attendance/selfie/[...path]
 * Serve selfie images with authentication.
 * Only admins with attendance approval permission can view selfies.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { path: pathSegments } = await params;

    // Staff can only view their own selfies (matched by filename containing their userId)
    // Admins can view all selfies in their company
    const isAdmin = checkPermission(session, "attendance", "canApprove");
    const filename = pathSegments.join("/");

    if (!isAdmin && !filename.includes(session.user.id)) {
      return errorResponse("Not authorized to view this selfie", 403);
    }

    // Sanitize path to prevent directory traversal
    const safeName = path.basename(filename);
    if (safeName !== filename || filename.includes("..")) {
      return errorResponse("Invalid file path", 400);
    }

    const filePath = path.join(process.cwd(), "uploads", "selfies", safeName);

    if (!fs.existsSync(filePath)) {
      return errorResponse("Selfie not found", 404);
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(safeName).toLowerCase();
    const mimeType = ext === ".png" ? "image/png" : "image/jpeg";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[SELFIE-SERVE]", err);
    return errorResponse("Failed to serve selfie", 500);
  }
}
