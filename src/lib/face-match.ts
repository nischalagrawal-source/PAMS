import { prisma } from "./db";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

/** Minimum face match score to auto-verify (0-100) */
export const FACE_MATCH_AUTO_VERIFY_THRESHOLD = 70;

/** Below this score, flag for admin review */
export const FACE_MATCH_REVIEW_THRESHOLD = 40;

/**
 * Save a base64 selfie image to disk and return the relative path.
 */
export function saveSelfieImage(base64Data: string, userId: string): string {
  // Strip the data URL prefix (data:image/jpeg;base64,...)
  const matches = base64Data.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid image data");

  const ext = matches[1];
  const buffer = Buffer.from(matches[2], "base64");

  // Limit size to 500KB
  if (buffer.length > 500 * 1024) {
    throw new Error("Selfie image too large (max 500KB)");
  }

  const dateStr = new Date().toISOString().split("T")[0];
  const hash = crypto.randomBytes(4).toString("hex");
  const filename = `${userId}_${dateStr}_${hash}.${ext}`;

  const dir = path.join(process.cwd(), "uploads", "selfies");
  fs.mkdirSync(dir, { recursive: true });

  const filePath = path.join(dir, filename);
  fs.writeFileSync(filePath, buffer);

  return `selfies/${filename}`;
}

/**
 * Determine selfie verification status using the client-provided face match score.
 *
 * The face comparison is done client-side using face-api.js (WebGL, 128-dim descriptors).
 * The score is a 0-100 similarity value computed as (1 - euclidean_distance) * 100.
 *
 * The server uses this score to auto-approve or flag for manual review.
 * The selfie image is always stored on-disk for admin audit regardless of score.
 *
 * NOTE: A sophisticated attacker could spoof the client-side score, but:
 *  - The selfie is always stored for admin review
 *  - Device fingerprinting catches most proxy attendance
 *  - Anomaly detection flags device sharing
 *  - Admin can spot-check any AUTO_VERIFIED entries
 */
export async function compareFaces(
  selfieUrl: string,
  userId: string,
  clientFaceMatchScore: number | null
): Promise<{ status: "AUTO_VERIFIED" | "MANUAL_REVIEW" | "ADMIN_REJECTED"; score: number }> {
  // Check if the user has a profile photo
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { profilePhoto: true },
  });

  if (!user?.profilePhoto) {
    // No profile photo to compare against → needs admin review
    return { status: "MANUAL_REVIEW", score: 0 };
  }

  if (clientFaceMatchScore === null) {
    // Face detection failed on client (no face found, model load failure, etc.)
    return { status: "MANUAL_REVIEW", score: 0 };
  }

  // Clamp score to valid range
  const score = Math.max(0, Math.min(100, clientFaceMatchScore));

  if (score >= FACE_MATCH_AUTO_VERIFY_THRESHOLD) {
    return { status: "AUTO_VERIFIED", score };
  }

  // Below threshold → manual review (admin will see the selfie + profile photo side-by-side)
  return { status: "MANUAL_REVIEW", score };
}
