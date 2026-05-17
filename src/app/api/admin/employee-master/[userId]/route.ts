import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionOrFail, errorResponse, successResponse } from "@/lib/api-utils";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "BRANCH_ADMIN") {
      return errorResponse("Forbidden", 403);
    }

    const record = await prisma.employeeMasterRecord.findUnique({
      where: { userId },
    });

    return successResponse(record);
  } catch (err) {
    console.error("[GET /api/admin/employee-master/:userId]", err);
    return errorResponse("Failed to fetch employee master record", 500);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const { userId } = await params;
    const { session, error } = await getSessionOrFail();
    if (error) return error;

    const role = session.user.role;
    if (role !== "ADMIN" && role !== "SUPER_ADMIN" && role !== "BRANCH_ADMIN") {
      return errorResponse("Forbidden", 403);
    }

    const body = await req.json();

    // Sanitize and extract only allowed fields
    const data = {
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      fatherName: body.fatherName || null,
      spouseName: body.spouseName || null,
      bloodGroup: body.bloodGroup || null,
      gender: body.gender || null,
      maritalStatus: body.maritalStatus || null,
      permanentAddress: body.permanentAddress || null,
      currentAddress: body.currentAddress || null,
      city: body.city || null,
      state: body.state || null,
      pincode: body.pincode || null,
      emergencyName: body.emergencyName || null,
      emergencyPhone: body.emergencyPhone || null,
      emergencyRelation: body.emergencyRelation || null,
      panNumber: body.panNumber || null,
      aadhaarNumber: body.aadhaarNumber || null,
      passportNumber: body.passportNumber || null,
      passportExpiry: body.passportExpiry ? new Date(body.passportExpiry) : null,
      bankName: body.bankName || null,
      bankAccount: body.bankAccount || null,
      ifscCode: body.ifscCode || null,
      bankBranch: body.bankBranch || null,
      previousEmployer: body.previousEmployer || null,
      previousDesignation: body.previousDesignation || null,
      totalExperienceYears: body.totalExperienceYears != null ? parseFloat(body.totalExperienceYears) : null,
      probationMonths: body.probationMonths != null ? parseInt(body.probationMonths) : 6,
      probationEndDate: body.probationEndDate ? new Date(body.probationEndDate) : null,
      confirmationDate: body.confirmationDate ? new Date(body.confirmationDate) : null,
      exitDate: body.exitDate ? new Date(body.exitDate) : null,
      exitType: body.exitType || null,
      exitReason: body.exitReason || null,
      noticePeriodDays: body.noticePeriodDays != null ? parseInt(body.noticePeriodDays) : 30,
      hrNotes: body.hrNotes || null,
    };

    const record = await prisma.employeeMasterRecord.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });

    return successResponse(record);
  } catch (err) {
    console.error("[PUT /api/admin/employee-master/:userId]", err);
    return errorResponse("Failed to save employee master record", 500);
  }
}
