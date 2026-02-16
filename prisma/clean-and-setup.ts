import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  P&AMS — CLEAN DATA & SETUP              ║");
  console.log("╚══════════════════════════════════════════╝\n");

  // ═══ STEP 1: Delete ALL existing data (in correct order for FK constraints) ═══
  console.log("Step 1: Clearing all existing data...");
  await prisma.notification.deleteMany({});
  await prisma.anomalyReport.deleteMany({});
  await prisma.geoExitLog.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.taskReview.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.leaveRequest.deleteMany({});
  await prisma.perfScore.deleteMany({});
  await prisma.bonusCalculation.deleteMany({});
  await prisma.salarySlip.deleteMany({});
  await prisma.salaryStructure.deleteMany({});
  await prisma.offerLetter.deleteMany({});
  await prisma.offerLetterTemplate.deleteMany({});
  await prisma.featurePermission.deleteMany({});
  // Clear anomaly rule relations first
  const rules = await prisma.anomalyRule.findMany({ include: { recipients: true } });
  for (const rule of rules) {
    await prisma.anomalyRule.update({ where: { id: rule.id }, data: { recipients: { set: [] } } });
  }
  await prisma.anomalyRule.deleteMany({});
  await prisma.perfParameter.deleteMany({});
  await prisma.leavePolicy.deleteMany({});
  await prisma.geoFence.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});
  console.log("   All data cleared.\n");

  // ═══ STEP 2: Create Companies (PLACEHOLDER — user will provide real names) ═══
  console.log("Step 2: Creating 2 companies...");
  const comp1 = await prisma.company.create({
    data: {
      name: "Company One",   // ← User: replace with real company name
      code: "COMP1",         // ← User: replace with real short code
      address: "",           // ← User: provide address
      phone: "",
      email: "",
      inTime: "09:30",       // ← User: adjust if different
      outTime: "18:30",
      graceMinutes: 15,
      lateThreshold: 3,
    },
  });

  const comp2 = await prisma.company.create({
    data: {
      name: "Company Two",   // ← User: replace with real company name
      code: "COMP2",         // ← User: replace with real short code
      address: "",
      phone: "",
      email: "",
      inTime: "09:30",
      outTime: "18:30",
      graceMinutes: 15,
      lateThreshold: 3,
    },
  });
  console.log(`   Created: ${comp1.name} (${comp1.code}), ${comp2.name} (${comp2.code})\n`);

  // ═══ STEP 3: Create Super Admin ═══
  console.log("Step 3: Creating Super Admin...");
  const saPassword = await bcrypt.hash("Admin@123", 12);
  const superAdmin = await prisma.user.create({
    data: {
      companyId: comp1.id,
      email: "superadmin@pams.com",
      password: saPassword,
      firstName: "Super",
      lastName: "Admin",
      employeeCode: "SA001",
      role: "SUPER_ADMIN",
      designation: "System Administrator",
      department: "IT",
      dateOfJoining: new Date("2024-01-01"),
      workMode: "office",
    },
  });

  // Super Admin gets all permissions
  const allFeatures = [
    "dashboard", "attendance", "leaves", "tasks", "performance", "salary",
    "reports", "notifications", "admin_users", "admin_companies",
    "admin_geofences", "admin_parameters", "admin_rights", "admin_anomalies",
  ];
  for (const feature of allFeatures) {
    await prisma.featurePermission.create({
      data: { userId: superAdmin.id, feature, canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
    });
  }
  console.log(`   Super Admin: ${superAdmin.email} / Admin@123\n`);

  // ═══ STEP 4: Default Performance Parameters ═══
  console.log("Step 4: Creating performance parameters...");
  const defaultParams = [
    { name: "Task Completion Speed", weight: 15, formula: "HIGHER_IS_BETTER", dataSource: "tasks", sortOrder: 1 },
    { name: "Attendance Consistency", weight: 10, formula: "HIGHER_IS_BETTER", dataSource: "attendance", sortOrder: 2 },
    { name: "Health/Sickness Frequency", weight: 10, formula: "LOWER_IS_BETTER", dataSource: "leaves", sortOrder: 3 },
    { name: "Simultaneous Absence", weight: 5, formula: "LOWER_IS_BETTER", dataSource: "attendance", sortOrder: 4 },
    { name: "Overtime & Extra Effort", weight: 10, formula: "HIGHER_IS_BETTER", dataSource: "attendance", sortOrder: 5 },
    { name: "Work Accuracy", weight: 20, formula: "HIGHER_IS_BETTER", dataSource: "tasks", sortOrder: 6 },
    { name: "Backlog Management", weight: 10, formula: "LOWER_IS_BETTER", dataSource: "tasks", sortOrder: 7 },
    { name: "Leave Discipline", weight: 10, formula: "HIGHER_IS_BETTER", dataSource: "leaves", sortOrder: 8 },
    { name: "WFH Productivity", weight: 5, formula: "HIGHER_IS_BETTER", dataSource: "tasks", sortOrder: 9 },
    { name: "Punctuality", weight: 5, formula: "HIGHER_IS_BETTER", dataSource: "attendance", sortOrder: 10, description: "Late arrivals and half-day tracking" },
  ];
  for (const comp of [comp1, comp2]) {
    for (const param of defaultParams) {
      await prisma.perfParameter.create({ data: { companyId: comp.id, ...param } });
    }
  }
  console.log(`   Created ${defaultParams.length} parameters for each company (total weight: 100%)\n`);

  // ═══ STEP 5: Default Leave Policies ═══
  console.log("Step 5: Creating leave policies...");
  const leavePolicies = [
    { leaveType: "SICK" as const, maxDaysPerYear: 12, advanceNoticeDays: 7, emergencyPenaltyWeight: 1.0, longEmergencyDays: 2, longEmergencyPenaltyWeight: 2.0 },
    { leaveType: "PERSONAL" as const, maxDaysPerYear: 15, advanceNoticeDays: 7, emergencyPenaltyWeight: 1.0, longEmergencyDays: 3, longEmergencyPenaltyWeight: 1.5 },
    { leaveType: "EMERGENCY" as const, maxDaysPerYear: 5, advanceNoticeDays: 0, emergencyPenaltyWeight: 1.5, longEmergencyDays: 2, longEmergencyPenaltyWeight: 3.0 },
  ];
  for (const comp of [comp1, comp2]) {
    for (const policy of leavePolicies) {
      await prisma.leavePolicy.create({ data: { companyId: comp.id, ...policy } });
    }
  }
  console.log(`   Created ${leavePolicies.length} leave policies for each company\n`);

  // ═══ STEP 6: Default Anomaly Rules ═══
  console.log("Step 6: Creating anomaly rules...");
  const anomalyRules = [
    { name: "Simultaneous Absence", condition: "2+ staff absent on same day more than 3 times in 3 months", severity: "high" },
    { name: "Excessive Backlog", condition: "Task overdue for more than 1 week without special permission", severity: "medium" },
    { name: "Geo-fence Violations", condition: "Staff left geo-fence more than 3 times in a day", severity: "medium" },
    { name: "Frequent Emergency Leaves", condition: "More than 2 emergency leaves in a month", severity: "high" },
    { name: "Low Attendance", condition: "Less than 80% attendance in a month", severity: "high" },
    { name: "Frequent Late Arrivals", condition: "4+ late arrivals in a month (approaching half-day threshold)", severity: "high" },
  ];
  for (const comp of [comp1, comp2]) {
    for (const rule of anomalyRules) {
      await prisma.anomalyRule.create({ data: { companyId: comp.id, ...rule } });
    }
  }
  console.log(`   Created ${anomalyRules.length} anomaly rules for each company\n`);

  // ═══ STEP 7: Default Offer Letter Template ═══
  console.log("Step 7: Creating offer letter template...");
  for (const comp of [comp1, comp2]) {
    await prisma.offerLetterTemplate.create({
      data: {
        companyId: comp.id,
        name: "Standard Offer Letter",
        content: `<div style="font-family: Arial, sans-serif; padding: 40px; max-width: 700px; margin: auto;">
  <h1 style="color: #1e40af;">Offer of Employment</h1>
  <p>Date: {{date}}</p>
  <p>Dear <strong>{{firstName}} {{lastName}}</strong>,</p>
  <p>We are pleased to offer you the position of <strong>{{designation}}</strong> in the <strong>{{department}}</strong> department at <strong>{{companyName}}</strong>.</p>
  <p>Your date of joining will be <strong>{{dateOfJoining}}</strong>.</p>
  <p>We look forward to having you on our team.</p>
  <br/>
  <p>Regards,<br/><strong>HR Department</strong><br/>{{companyName}}</p>
</div>`,
      },
    });
  }
  console.log("   Created standard offer letter template for each company\n");

  console.log("╔══════════════════════════════════════════╗");
  console.log("║  SETUP COMPLETE                           ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("\nSuper Admin login: superadmin@pams.com / Admin@123");
  console.log("\nNEXT STEPS:");
  console.log("1. Login as Super Admin");
  console.log("2. Go to Admin > Companies — update names, addresses, work timings");
  console.log("3. Go to Admin > Geo-fences — add office/client GPS coordinates");
  console.log("4. Go to Admin > Users — click 'Download Template' to get the Excel file");
  console.log("5. Fill in staff data and click 'Bulk Upload'");
  console.log("6. Default password for uploaded staff: FirstName@123\n");
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error("ERROR:", e); prisma.$disconnect(); process.exit(1); });
