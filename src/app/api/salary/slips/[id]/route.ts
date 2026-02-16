import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  getSessionOrFail,
  errorResponse,
  successResponse,
  parseBody,
} from "@/lib/api-utils";
import { z } from "zod";
import { SlipStatus } from "@/generated/prisma/client";

// ── Validation ────────────────────────────────────────────────

const updateSlipSchema = z.object({
  employeeGross: z.number().min(0).optional(),
  employeeDeductions: z.number().min(0).optional(),
  employeeNet: z.number().optional(),
  employeeBreakdown: z.record(z.string(), z.unknown()).optional(),
  status: z
    .enum([
      SlipStatus.DRAFT,
      SlipStatus.GENERATED,
      SlipStatus.COMPARED,
      SlipStatus.FINALIZED,
    ])
    .optional(),
});

// ── GET /api/salary/slips/[id] ────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;
    const companyId = session!.user.companyId;
    const role = session!.user.role;

    const slip = await prisma.salarySlip.findFirst({
      where: { id, companyId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
            designation: true,
            department: true,
          },
        },
      },
    });

    if (!slip) {
      return errorResponse("Salary slip not found", 404);
    }

    // STAFF can only view their own slip
    if (role === "STAFF" && slip.userId !== session!.user.id) {
      return errorResponse("You can only view your own salary slips", 403);
    }

    return successResponse(slip);
  } catch (err) {
    console.error("[GET /api/salary/slips/[id]]", err);
    return errorResponse("Failed to fetch salary slip", 500);
  }
}

// ── PUT /api/salary/slips/[id] ────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const { id } = await params;
    const companyId = session!.user.companyId;
    const role = session!.user.role;

    // Find existing slip
    const existing = await prisma.salarySlip.findFirst({
      where: { id, companyId },
    });

    if (!existing) {
      return errorResponse("Salary slip not found", 404);
    }

    // STAFF can only update their own slip (to submit employee calculation)
    if (role === "STAFF" && existing.userId !== session!.user.id) {
      return errorResponse("You can only update your own salary slips", 403);
    }

    // Only admins can finalize
    if (role === "STAFF") {
      // STAFF cannot set status to FINALIZED
      const body = await parseBody(req);
      if (!body) return errorResponse("Invalid request body");
      const parsed = updateSlipSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(parsed.error.issues[0].message);
      }
      if (parsed.data.status === SlipStatus.FINALIZED) {
        return errorResponse("Only admins can finalize salary slips", 403);
      }
    }

    const body = await parseBody(req);
    if (!body) return errorResponse("Invalid request body");

    const parsed = updateSlipSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0].message);
    }

    const {
      employeeGross,
      employeeDeductions,
      employeeNet,
      employeeBreakdown,
      status,
    } = parsed.data;

    const updateData: Record<string, unknown> = {};

    // Employee submitting their calculation
    if (employeeGross !== undefined) updateData.employeeGross = employeeGross;
    if (employeeDeductions !== undefined)
      updateData.employeeDeductions = employeeDeductions;
    if (employeeNet !== undefined) updateData.employeeNet = employeeNet;
    if (employeeBreakdown !== undefined)
      updateData.employeeBreakdown = employeeBreakdown;

    // Auto-calculate discrepancy when both system and employee net exist
    const finalEmployeeNet = employeeNet ?? existing.employeeNet;
    const finalSystemNet = existing.systemNet;

    if (finalEmployeeNet !== null && finalSystemNet !== null) {
      updateData.discrepancy = Math.abs(finalSystemNet - finalEmployeeNet);
    }

    // Determine status
    if (status) {
      updateData.status = status;
    } else if (
      employeeNet !== undefined &&
      finalSystemNet !== null
    ) {
      // Auto-set to COMPARED when employee submits their calculation
      updateData.status = SlipStatus.COMPARED;
    }

    const updatedSlip = await prisma.salarySlip.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            employeeCode: true,
          },
        },
      },
    });

    return successResponse(updatedSlip, "Salary slip updated successfully");
  } catch (err) {
    console.error("[PUT /api/salary/slips/[id]]", err);
    return errorResponse("Failed to update salary slip", 500);
  }
}
