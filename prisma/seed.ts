import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding P&AMS database...\n");

  // ============================================================
  // 1. Create Companies
  // ============================================================
  const company1 = await prisma.company.upsert({
    where: { code: "COMP1" },
    update: {},
    create: {
      name: "Company One Pvt Ltd",
      code: "COMP1",
      address: "123 Business Park, Mumbai",
      email: "admin@companyone.com",
      phone: "+91-9876543210",
    },
  });

  const company2 = await prisma.company.upsert({
    where: { code: "COMP2" },
    update: {},
    create: {
      name: "Company Two Solutions",
      code: "COMP2",
      address: "456 Tech Hub, Pune",
      email: "admin@companytwo.com",
      phone: "+91-9876543211",
    },
  });

  console.log(`Created companies: ${company1.name}, ${company2.name}`);

  // ============================================================
  // 2. Create Super Admin
  // ============================================================
  const hashedPassword = await bcrypt.hash("Admin@123", 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: "superadmin@pams.com" },
    update: {},
    create: {
      email: "superadmin@pams.com",
      password: hashedPassword,
      firstName: "Super",
      lastName: "Admin",
      employeeCode: "SA001",
      role: "SUPER_ADMIN",
      companyId: company1.id,
      designation: "System Administrator",
      department: "IT",
      dateOfJoining: new Date("2024-01-01"),
      workMode: "office",
    },
  });

  console.log(`Created super admin: ${superAdmin.email}`);

  // Create all feature permissions for super admin
  const features = [
    "dashboard", "attendance", "leaves", "tasks", "performance",
    "salary", "reports", "notifications", "admin_users", "admin_companies",
    "admin_geofences", "admin_parameters", "admin_rights", "admin_anomalies",
  ];

  for (const feature of features) {
    await prisma.featurePermission.upsert({
      where: { userId_feature: { userId: superAdmin.id, feature } },
      update: {},
      create: {
        userId: superAdmin.id,
        feature,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
      },
    });
  }

  // ============================================================
  // 3. Create sample Reviewer and Staff for Company 1
  // ============================================================
  const reviewerPassword = await bcrypt.hash("Reviewer@123", 12);
  const staffPassword = await bcrypt.hash("Staff@123", 12);

  const reviewer = await prisma.user.upsert({
    where: { email: "reviewer@companyone.com" },
    update: {},
    create: {
      email: "reviewer@companyone.com",
      password: reviewerPassword,
      firstName: "Rajesh",
      lastName: "Kumar",
      employeeCode: "EMP001",
      role: "REVIEWER",
      companyId: company1.id,
      designation: "Team Lead",
      department: "Operations",
      dateOfJoining: new Date("2024-03-15"),
      workMode: "office",
    },
  });

  // Reviewer permissions
  const reviewerFeatures = ["dashboard", "attendance", "leaves", "tasks", "performance", "reports"];
  for (const feature of reviewerFeatures) {
    await prisma.featurePermission.upsert({
      where: { userId_feature: { userId: reviewer.id, feature } },
      update: {},
      create: {
        userId: reviewer.id,
        feature,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: true,
      },
    });
  }

  const staff1 = await prisma.user.upsert({
    where: { email: "staff1@companyone.com" },
    update: {},
    create: {
      email: "staff1@companyone.com",
      password: staffPassword,
      firstName: "Priya",
      lastName: "Patel",
      employeeCode: "EMP002",
      role: "STAFF",
      companyId: company1.id,
      designation: "Executive",
      department: "Operations",
      dateOfJoining: new Date("2024-06-01"),
      workMode: "hybrid",
    },
  });

  // Staff permissions (limited)
  const staffFeatures = ["dashboard", "attendance", "leaves", "tasks", "salary"];
  for (const feature of staffFeatures) {
    await prisma.featurePermission.upsert({
      where: { userId_feature: { userId: staff1.id, feature } },
      update: {},
      create: {
        userId: staff1.id,
        feature,
        canView: true,
        canCreate: feature === "attendance" || feature === "leaves",
        canEdit: false,
        canDelete: false,
        canApprove: false,
      },
    });
  }

  console.log(`Created users: ${reviewer.email}, ${staff1.email}`);

  // ============================================================
  // 4. Create Geo-fences for Company 1
  // ============================================================
  await prisma.geoFence.upsert({
    where: { id: "geofence-main-office" },
    update: {},
    create: {
      id: "geofence-main-office",
      companyId: company1.id,
      label: "Main Office - Mumbai",
      latitude: 19.076,
      longitude: 72.8777,
      radiusM: 200,
      type: "office",
    },
  });

  await prisma.geoFence.upsert({
    where: { id: "geofence-client-site" },
    update: {},
    create: {
      id: "geofence-client-site",
      companyId: company1.id,
      label: "Client Site - ABC Corp",
      latitude: 19.1136,
      longitude: 72.8697,
      radiusM: 150,
      type: "client_site",
    },
  });

  console.log("Created geo-fences");

  // ============================================================
  // 5. Create Default Performance Parameters for Company 1
  // ============================================================
  const defaultParams = [
    { name: "Task Completion Speed", weight: 15, formula: "HIGHER_IS_BETTER", dataSource: "tasks", sortOrder: 1 },
    { name: "Attendance Consistency", weight: 10, formula: "HIGHER_IS_BETTER", dataSource: "attendance", sortOrder: 2 },
    { name: "Health/Sickness Frequency", weight: 10, formula: "LOWER_IS_BETTER", dataSource: "leaves", sortOrder: 3 },
    { name: "Simultaneous Absence", weight: 5, formula: "LOWER_IS_BETTER", dataSource: "attendance", sortOrder: 4 },
    { name: "Overtime & Extra Effort", weight: 15, formula: "HIGHER_IS_BETTER", dataSource: "attendance", sortOrder: 5 },
    { name: "Work Accuracy", weight: 20, formula: "HIGHER_IS_BETTER", dataSource: "tasks", sortOrder: 6 },
    { name: "Backlog Management", weight: 10, formula: "LOWER_IS_BETTER", dataSource: "tasks", sortOrder: 7 },
    { name: "Leave Discipline", weight: 10, formula: "HIGHER_IS_BETTER", dataSource: "leaves", sortOrder: 8 },
    { name: "WFH Productivity", weight: 5, formula: "HIGHER_IS_BETTER", dataSource: "tasks", sortOrder: 9 },
  ];

  for (const param of defaultParams) {
    const existing = await prisma.perfParameter.findFirst({
      where: { companyId: company1.id, name: param.name },
    });
    if (!existing) {
      await prisma.perfParameter.create({
        data: {
          companyId: company1.id,
          ...param,
        },
      });
    }
  }

  console.log("Created default performance parameters");

  // ============================================================
  // 6. Create Default Leave Policies for Company 1
  // ============================================================
  const leavePolicies = [
    { leaveType: "SICK" as const, maxDaysPerYear: 12, advanceNoticeDays: 7, emergencyPenaltyWeight: 1.0, longEmergencyDays: 2, longEmergencyPenaltyWeight: 2.0 },
    { leaveType: "PERSONAL" as const, maxDaysPerYear: 15, advanceNoticeDays: 7, emergencyPenaltyWeight: 1.0, longEmergencyDays: 3, longEmergencyPenaltyWeight: 1.5 },
    { leaveType: "EMERGENCY" as const, maxDaysPerYear: 5, advanceNoticeDays: 0, emergencyPenaltyWeight: 1.5, longEmergencyDays: 2, longEmergencyPenaltyWeight: 3.0 },
  ];

  for (const policy of leavePolicies) {
    await prisma.leavePolicy.upsert({
      where: {
        companyId_leaveType: {
          companyId: company1.id,
          leaveType: policy.leaveType,
        },
      },
      update: {},
      create: {
        companyId: company1.id,
        ...policy,
      },
    });
  }

  console.log("Created leave policies");

  // ============================================================
  // 7. Create Default Anomaly Rules for Company 1
  // ============================================================
  const anomalyRules = [
    { name: "Simultaneous Absence", condition: "2+ staff absent on same day more than 3 times in 3 months", severity: "high" },
    { name: "Excessive Backlog", condition: "Task overdue for more than 1 week without special permission", severity: "medium" },
    { name: "Geo-fence Violations", condition: "Staff left geo-fence more than 3 times in a day", severity: "medium" },
    { name: "Frequent Emergency Leaves", condition: "More than 2 emergency leaves in a month", severity: "high" },
    { name: "Low Attendance", condition: "Less than 80% attendance in a month", severity: "high" },
  ];

  for (const rule of anomalyRules) {
    const existing = await prisma.anomalyRule.findFirst({
      where: { companyId: company1.id, name: rule.name },
    });
    if (!existing) {
      await prisma.anomalyRule.create({
        data: {
          companyId: company1.id,
          ...rule,
        },
      });
    }
  }

  console.log("Created anomaly rules");

  console.log("\n============================================================");
  console.log("Seed complete!");
  console.log("============================================================");
  console.log("\nTest credentials:");
  console.log("  Super Admin:  superadmin@pams.com / Admin@123");
  console.log("  Reviewer:     reviewer@companyone.com / Reviewer@123");
  console.log("  Staff:        staff1@companyone.com / Staff@123");
  console.log("============================================================\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
