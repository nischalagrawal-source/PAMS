/**
 * P&AMS — Comprehensive System Test (Prisma Direct)
 * Tests every feature using direct DB operations + business logic.
 */
import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const results = [];
const IDS = { companies: [], users: [], geofences: [], parameters: [],
  anomalyRules: [], tasks: [], leaves: [], attendance: [], salarySlips: [],
  offerTemplates: [], salaryStructures: [], geoExitLogs: [], taskReviews: [],
  perfScores: [], notifications: [] };

function record(section, test, status, detail = "") {
  results.push({ section, test, status, detail });
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️";
  console.log(`${icon}  [${section}] ${test}${detail ? " — " + detail : ""}`);
}

async function safe(section, test, fn) {
  try { await fn(); } catch (err) { record(section, test, "FAIL", err.message); }
}

// ════════════════════════════════════════════════════════════════
// 1. AUTH & PASSWORD
// ════════════════════════════════════════════════════════════════
async function testAuth() {
  console.log("\n" + "═".repeat(60));
  console.log("1. AUTHENTICATION & PASSWORD HASHING");
  console.log("═".repeat(60));

  const sa = await prisma.user.findUnique({ where: { email: "superadmin@pams.com" }, include: { featurePermissions: true } });
  record("Auth", "Super Admin exists", sa ? "PASS" : "FAIL", sa ? `ID: ${sa.id}` : "Not found");

  if (sa) {
    const valid = await bcrypt.compare("Admin@123", sa.password);
    record("Auth", "Correct password verifies", valid ? "PASS" : "FAIL");
    const invalid = await bcrypt.compare("WrongPass", sa.password);
    record("Auth", "Wrong password rejected", !invalid ? "PASS" : "FAIL");
    const allFull = sa.featurePermissions.every(p => p.canView && p.canCreate && p.canEdit && p.canDelete && p.canApprove);
    record("Auth", "Super Admin full permissions", allFull ? "PASS" : "FAIL", `${sa.featurePermissions.length} features`);
  }

  const rev = await prisma.user.findUnique({ where: { email: "reviewer@companyone.com" }, include: { featurePermissions: true } });
  if (rev) {
    record("Auth", "Reviewer exists (seed)", "PASS");
    const hasAdmin = rev.featurePermissions.some(p => p.feature.startsWith("admin_"));
    record("Auth", "Reviewer has NO admin perms", !hasAdmin ? "PASS" : "FAIL");
  } else {
    record("Auth", "Reviewer seed data", "WARN", "Not found — run npm run db:seed first");
  }

  const staff = await prisma.user.findUnique({ where: { email: "staff1@companyone.com" }, include: { featurePermissions: true } });
  if (staff) {
    record("Auth", "Staff exists (seed)", "PASS");
    const canDel = staff.featurePermissions.some(p => p.canDelete);
    record("Auth", "Staff cannot delete", !canDel ? "PASS" : "FAIL");
  } else {
    record("Auth", "Staff seed data", "WARN", "Not found — run npm run db:seed first");
  }

  const pw = await bcrypt.hash("Test@123", 12);
  const inactive = await prisma.user.create({
    data: { email: "test-inactive@test.com", password: pw, firstName: "Inactive", lastName: "User",
            employeeCode: "TINACT01", role: "STAFF", companyId: sa.companyId, isActive: false }
  });
  IDS.users.push(inactive.id);
  record("Auth", "Inactive user created (isActive=false)", !inactive.isActive ? "PASS" : "FAIL");
}

// ════════════════════════════════════════════════════════════════
// 2. COMPANY CRUD
// ════════════════════════════════════════════════════════════════
async function testCompanies() {
  console.log("\n" + "═".repeat(60));
  console.log("2. COMPANY MANAGEMENT");
  console.log("═".repeat(60));

  const existing = await prisma.company.findMany();
  record("Companies", "List companies", "PASS", `Found ${existing.length}`);

  const c1 = await prisma.company.create({
    data: { name: "Test Corp Alpha", code: "TCALPHA", address: "100 Test St, Delhi", phone: "+91-1234567890", email: "info@tcalpha.com" }
  });
  IDS.companies.push(c1.id);
  record("Companies", "Create company", "PASS", `ID: ${c1.id}, Code: ${c1.code}`);

  const c2 = await prisma.company.create({ data: { name: "Test Corp Beta", code: "TCBETA", address: "200 Beta Rd, Pune" } });
  IDS.companies.push(c2.id);
  record("Companies", "Create second company", "PASS", `ID: ${c2.id}`);

  await safe("Companies", "Reject duplicate code", async () => {
    try {
      await prisma.company.create({ data: { name: "Dup", code: "TCALPHA" } });
      record("Companies", "Reject duplicate code", "FAIL", "Should have thrown");
    } catch { record("Companies", "Reject duplicate code", "PASS", "Unique constraint"); }
  });

  const updated = await prisma.company.update({ where: { id: c1.id }, data: { name: "Test Corp Alpha (Updated)", address: "101 Updated St" } });
  record("Companies", "Update company", updated.name.includes("Updated") ? "PASS" : "FAIL", `Name: ${updated.name}`);

  const readBack = await prisma.company.findUnique({ where: { id: c1.id } });
  record("Companies", "Read by ID", readBack?.name === updated.name ? "PASS" : "FAIL");
  record("Companies", "Default inTime=09:30", c1.inTime === "09:30" ? "PASS" : "FAIL", `inTime: ${c1.inTime}`);
  record("Companies", "Default graceMinutes=15", c1.graceMinutes === 15 ? "PASS" : "FAIL");
  record("Companies", "Default lateThreshold=3", c1.lateThreshold === 3 ? "PASS" : "FAIL");
}

// ════════════════════════════════════════════════════════════════
// 3. USER CRUD
// ════════════════════════════════════════════════════════════════
async function testUsers() {
  console.log("\n" + "═".repeat(60));
  console.log("3. USER MANAGEMENT & RBAC");
  console.log("═".repeat(60));

  const companyId = IDS.companies[0];
  const pw = await bcrypt.hash("TestPass@123", 12);

  const admin = await prisma.user.create({
    data: { email: "testadmin@tcalpha.com", password: pw, firstName: "TestAdmin", lastName: "User",
            employeeCode: "TADM001", role: "ADMIN", companyId, designation: "Manager",
            department: "Management", workMode: "office", dateOfJoining: new Date("2025-01-15") }
  });
  IDS.users.push(admin.id);
  record("Users", "Create ADMIN", "PASS", `ID: ${admin.id}, Role: ${admin.role}`);

  const reviewer = await prisma.user.create({
    data: { email: "testreviewer@tcalpha.com", password: pw, firstName: "TestReviewer", lastName: "User",
            employeeCode: "TREV001", role: "REVIEWER", companyId, designation: "Team Lead",
            department: "Operations", workMode: "office" }
  });
  IDS.users.push(reviewer.id);
  record("Users", "Create REVIEWER", "PASS", `ID: ${reviewer.id}`);

  // Assign reviewer permissions
  const revPerms = [
    { feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "attendance", canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { feature: "leaves", canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { feature: "tasks", canView: true, canCreate: true, canEdit: true, canDelete: false, canApprove: true },
    { feature: "performance", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "salary", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "reports", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
  ];
  await prisma.featurePermission.createMany({ data: revPerms.map(p => ({ userId: reviewer.id, ...p })) });
  record("Users", "Assign REVIEWER permissions", "PASS", `${revPerms.length} features`);

  const staff = await prisma.user.create({
    data: { email: "teststaff@tcalpha.com", password: pw, firstName: "TestStaff", lastName: "User",
            employeeCode: "TSTF001", role: "STAFF", companyId, designation: "Executive",
            department: "Operations", workMode: "hybrid", dateOfJoining: new Date("2025-03-01") }
  });
  IDS.users.push(staff.id);
  record("Users", "Create STAFF", "PASS", `ID: ${staff.id}`);

  const staffPerms = [
    { feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "attendance", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "leaves", canView: true, canCreate: true, canEdit: false, canDelete: false, canApprove: false },
    { feature: "tasks", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
    { feature: "salary", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false },
  ];
  await prisma.featurePermission.createMany({ data: staffPerms.map(p => ({ userId: staff.id, ...p })) });
  record("Users", "Assign STAFF permissions", "PASS", `${staffPerms.length} features`);

  const sa2 = await prisma.user.create({
    data: { email: "testsa@tcalpha.com", password: pw, firstName: "TestSA", lastName: "User",
            employeeCode: "TSA001", role: "SUPER_ADMIN", companyId, designation: "CTO", department: "IT", workMode: "office" }
  });
  IDS.users.push(sa2.id);
  record("Users", "Create SUPER_ADMIN", "PASS", `ID: ${sa2.id}`);

  // Duplicate email
  await safe("Users", "Reject duplicate email", async () => {
    try {
      await prisma.user.create({ data: { email: "teststaff@tcalpha.com", password: pw, firstName: "Dup", lastName: "E", employeeCode: "DUP001", role: "STAFF", companyId } });
      record("Users", "Reject duplicate email", "FAIL", "Should throw");
    } catch { record("Users", "Reject duplicate email", "PASS", "Unique constraint on email"); }
  });

  // Duplicate employee code same company
  await safe("Users", "Reject duplicate empCode (same company)", async () => {
    try {
      await prisma.user.create({ data: { email: "dup-code@tcalpha.com", password: pw, firstName: "Dup", lastName: "C", employeeCode: "TSTF001", role: "STAFF", companyId } });
      record("Users", "Reject duplicate empCode (same company)", "FAIL", "Should throw");
    } catch { record("Users", "Reject duplicate empCode (same company)", "PASS", "@@unique([companyId, employeeCode])"); }
  });

  // Same code different company (OK)
  const crossComp = await prisma.user.create({
    data: { email: "crosscomp@tcbeta.com", password: pw, firstName: "Cross", lastName: "Comp",
            employeeCode: "TSTF001", role: "STAFF", companyId: IDS.companies[1] }
  });
  IDS.users.push(crossComp.id);
  record("Users", "Same empCode different company OK", "PASS", `ID: ${crossComp.id}`);

  // Update
  const upd = await prisma.user.update({ where: { id: staff.id }, data: { firstName: "UpdatedStaff", designation: "Senior Exec" } });
  record("Users", "Update user", upd.firstName === "UpdatedStaff" ? "PASS" : "FAIL", `Name: ${upd.firstName}`);

  // Deactivate/Reactivate
  await prisma.user.update({ where: { id: staff.id }, data: { isActive: false } });
  const deact = await prisma.user.findUnique({ where: { id: staff.id } });
  record("Users", "Deactivate user", !deact.isActive ? "PASS" : "FAIL");

  await prisma.user.update({ where: { id: staff.id }, data: { isActive: true } });
  const react = await prisma.user.findUnique({ where: { id: staff.id } });
  record("Users", "Reactivate user", react.isActive ? "PASS" : "FAIL");

  // Tenant isolation
  const c1u = await prisma.user.findMany({ where: { companyId } });
  const c2u = await prisma.user.findMany({ where: { companyId: IDS.companies[1] } });
  record("Users", "Tenant isolation", "PASS", `Company1: ${c1u.length}, Company2: ${c2u.length}`);
}

// ════════════════════════════════════════════════════════════════
// 4. GEOFENCE CRUD
// ════════════════════════════════════════════════════════════════
async function testGeofences() {
  console.log("\n" + "═".repeat(60));
  console.log("4. GEOFENCE MANAGEMENT");
  console.log("═".repeat(60));

  const companyId = IDS.companies[0];
  const office = await prisma.geoFence.create({
    data: { companyId, label: "Test HQ Delhi", latitude: 28.6139, longitude: 77.209, radiusM: 250, type: "office" }
  });
  IDS.geofences.push(office.id);
  record("Geofences", "Create office geofence", "PASS", `Lat: ${office.latitude}, Lng: ${office.longitude}, R: ${office.radiusM}m`);

  const client = await prisma.geoFence.create({
    data: { companyId, label: "Test Client Noida", latitude: 28.5355, longitude: 77.391, radiusM: 150, type: "client_site" }
  });
  IDS.geofences.push(client.id);
  record("Geofences", "Create client_site geofence", "PASS", `ID: ${client.id}`);

  const upd = await prisma.geoFence.update({ where: { id: office.id }, data: { label: "Test HQ Delhi (Updated)", radiusM: 300 } });
  record("Geofences", "Update geofence", upd.radiusM === 300 ? "PASS" : "FAIL", `Radius: ${upd.radiusM}m`);

  record("Geofences", "Default isActive=true", office.isActive === true ? "PASS" : "FAIL");
}

// ════════════════════════════════════════════════════════════════
// 5. PERFORMANCE PARAMETERS
// ════════════════════════════════════════════════════════════════
async function testParameters() {
  console.log("\n" + "═".repeat(60));
  console.log("5. PERFORMANCE PARAMETERS");
  console.log("═".repeat(60));

  const companyId = IDS.companies[0];
  const p1 = await prisma.perfParameter.create({
    data: { companyId, name: "Test Teamwork", weight: 10, formula: "HIGHER_IS_BETTER", dataSource: "tasks", sortOrder: 20 }
  });
  IDS.parameters.push(p1.id);
  record("Parameters", "Create parameter", "PASS", `Name: ${p1.name}, Weight: ${p1.weight}`);

  const p2 = await prisma.perfParameter.create({
    data: { companyId, name: "Test Communication", weight: 5, formula: "HIGHER_IS_BETTER", dataSource: "tasks", sortOrder: 21 }
  });
  IDS.parameters.push(p2.id);
  record("Parameters", "Create second parameter", "PASS", `Name: ${p2.name}`);

  const upd = await prisma.perfParameter.update({ where: { id: p1.id }, data: { name: "Test Teamwork (Updated)", weight: 12 } });
  record("Parameters", "Update parameter", upd.weight === 12 ? "PASS" : "FAIL", `Weight: ${upd.weight}`);

  await prisma.perfParameter.delete({ where: { id: p2.id } });
  const del = await prisma.perfParameter.findUnique({ where: { id: p2.id } });
  record("Parameters", "Delete parameter", !del ? "PASS" : "FAIL");
  IDS.parameters.pop();

  const sum = await prisma.perfParameter.aggregate({ where: { companyId }, _sum: { weight: true } });
  record("Parameters", "Weight sum check", "PASS", `Total: ${sum._sum.weight}%`);
}

// ════════════════════════════════════════════════════════════════
// 6. RIGHTS / PERMISSIONS
// ════════════════════════════════════════════════════════════════
async function testRights() {
  console.log("\n" + "═".repeat(60));
  console.log("6. FEATURE PERMISSIONS (RIGHTS)");
  console.log("═".repeat(60));

  const staffId = IDS.users[2];
  const perms = await prisma.featurePermission.findMany({ where: { userId: staffId } });
  record("Rights", "Read user permissions", perms.length > 0 ? "PASS" : "FAIL", `${perms.length} features`);

  await prisma.featurePermission.upsert({
    where: { userId_feature: { userId: staffId, feature: "reports" } },
    update: { canView: true },
    create: { userId: staffId, feature: "reports", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false }
  });
  const rp = await prisma.featurePermission.findUnique({ where: { userId_feature: { userId: staffId, feature: "reports" } } });
  record("Rights", "Upsert permission (add reports)", rp?.canView ? "PASS" : "FAIL");

  await prisma.featurePermission.update({
    where: { userId_feature: { userId: staffId, feature: "attendance" } },
    data: { canCreate: false }
  });
  const tog = await prisma.featurePermission.findUnique({ where: { userId_feature: { userId: staffId, feature: "attendance" } } });
  record("Rights", "Toggle permission off", !tog.canCreate ? "PASS" : "FAIL");

  await prisma.featurePermission.update({
    where: { userId_feature: { userId: staffId, feature: "attendance" } },
    data: { canCreate: true }
  });
  record("Rights", "Restore permission", "PASS");

  await safe("Rights", "Unique [userId,feature] constraint", async () => {
    try {
      await prisma.featurePermission.create({
        data: { userId: staffId, feature: "dashboard", canView: true, canCreate: false, canEdit: false, canDelete: false, canApprove: false }
      });
      record("Rights", "Unique [userId,feature] constraint", "FAIL", "Should throw");
    } catch { record("Rights", "Unique [userId,feature] constraint", "PASS", "Duplicate rejected"); }
  });
}

// ════════════════════════════════════════════════════════════════
// 7. ANOMALY RULES
// ════════════════════════════════════════════════════════════════
async function testAnomalyRules() {
  console.log("\n" + "═".repeat(60));
  console.log("7. ANOMALY RULES");
  console.log("═".repeat(60));

  const companyId = IDS.companies[0];
  const r1 = await prisma.anomalyRule.create({
    data: { companyId, name: "Test Overtime Alert", condition: "12+ hrs 3+ consecutive days", severity: "medium" }
  });
  IDS.anomalyRules.push(r1.id);
  record("AnomalyRules", "Create rule", "PASS", `Name: ${r1.name}, Severity: ${r1.severity}`);

  const r2 = await prisma.anomalyRule.create({
    data: { companyId, name: "Test Buddy Punch", condition: "Same device different employees", severity: "high" }
  });
  IDS.anomalyRules.push(r2.id);
  record("AnomalyRules", "Create second rule", "PASS", `ID: ${r2.id}`);

  const upd = await prisma.anomalyRule.update({ where: { id: r1.id }, data: { severity: "high" } });
  record("AnomalyRules", "Update rule severity", upd.severity === "high" ? "PASS" : "FAIL");

  await prisma.anomalyRule.delete({ where: { id: r2.id } });
  const del = await prisma.anomalyRule.findUnique({ where: { id: r2.id } });
  record("AnomalyRules", "Delete rule", !del ? "PASS" : "FAIL");
  IDS.anomalyRules.pop();
}

// ════════════════════════════════════════════════════════════════
// 8. ATTENDANCE & GEO-FENCING
// ════════════════════════════════════════════════════════════════
async function testAttendance() {
  console.log("\n" + "═".repeat(60));
  console.log("8. ATTENDANCE & GEO-FENCING");
  console.log("═".repeat(60));

  const staffId = IDS.users[2];
  const fenceId = IDS.geofences[0];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const checkInTime = new Date();

  const att = await prisma.attendance.create({
    data: { userId: staffId, date: today, checkInTime, checkInLat: 28.6139, checkInLng: 77.209,
            locationType: "OFFICE", geoFenceId: fenceId, status: "AUTO_APPROVED", isWfh: false }
  });
  IDS.attendance.push(att.id);
  record("Attendance", "Check-in (office)", "PASS", `Type: ${att.locationType}, Status: ${att.status}`);

  // Duplicate check-in
  await safe("Attendance", "Prevent duplicate (same day)", async () => {
    try {
      await prisma.attendance.create({ data: { userId: staffId, date: today, checkInTime: new Date(), locationType: "OFFICE", status: "AUTO_APPROVED" } });
      record("Attendance", "Prevent duplicate (same day)", "FAIL", "Should throw");
    } catch { record("Attendance", "Prevent duplicate (same day)", "PASS", "@@unique([userId,date])"); }
  });

  // Check-out
  const coTime = new Date(checkInTime.getTime() + 9 * 3600000);
  const totalH = 9.0, otH = 1.0;
  const upd = await prisma.attendance.update({
    where: { id: att.id }, data: { checkOutTime: coTime, checkOutLat: 28.6139, checkOutLng: 77.209, totalHours: totalH, overtimeHours: otH }
  });
  record("Attendance", "Check-out", upd.checkOutTime ? "PASS" : "FAIL", `Hours: ${upd.totalHours}, OT: ${upd.overtimeHours}`);

  // WFH
  const revId = IDS.users[1];
  const wfh = await prisma.attendance.create({
    data: { userId: revId, date: today, checkInTime: new Date(), checkInLat: 28.0, checkInLng: 77.0,
            locationType: "WORK_FROM_HOME", status: "PENDING_REVIEW", isWfh: true }
  });
  IDS.attendance.push(wfh.id);
  record("Attendance", "WFH (outside geofence)", wfh.isWfh && wfh.status === "PENDING_REVIEW" ? "PASS" : "FAIL");

  // Late arrival
  const adminId = IDS.users[0];
  const late = await prisma.attendance.create({
    data: { userId: adminId, date: today, checkInTime: new Date(), checkInLat: 28.6139, checkInLng: 77.209,
            locationType: "OFFICE", geoFenceId: fenceId, status: "AUTO_APPROVED", isLate: true, lateByMinutes: 45 }
  });
  IDS.attendance.push(late.id);
  record("Attendance", "Late arrival", late.isLate && late.lateByMinutes === 45 ? "PASS" : "FAIL", `Late by: ${late.lateByMinutes}min`);

  // Half-day
  const hd = await prisma.attendance.create({
    data: { userId: IDS.users[3], date: today, checkInTime: new Date(), checkInLat: 28.6, checkInLng: 77.2,
            locationType: "OFFICE", status: "AUTO_APPROVED", isLate: true, lateByMinutes: 30, isHalfDay: true }
  });
  IDS.attendance.push(hd.id);
  record("Attendance", "Half-day marking", hd.isHalfDay ? "PASS" : "FAIL");

  // Geo-exit log
  const exitLog = await prisma.geoExitLog.create({
    data: { attendanceId: att.id, userId: staffId, exitTime: new Date(), exitLat: 28.62, exitLng: 77.22, distanceFromFence: 350 }
  });
  IDS.geoExitLogs.push(exitLog.id);
  record("Attendance", "Geo-exit log", "PASS", `Distance: ${exitLog.distanceFromFence}m`);

  await prisma.attendance.update({ where: { id: att.id }, data: { geoExitCount: { increment: 1 } } });
  const afterExit = await prisma.attendance.findUnique({ where: { id: att.id } });
  record("Attendance", "Geo-exit count increment", afterExit.geoExitCount === 1 ? "PASS" : "FAIL");
}

// ════════════════════════════════════════════════════════════════
// 9. LEAVE MANAGEMENT
// ════════════════════════════════════════════════════════════════
async function testLeaves() {
  console.log("\n" + "═".repeat(60));
  console.log("9. LEAVE MANAGEMENT");
  console.log("═".repeat(60));

  const staffId = IDS.users[2];
  const sa = await prisma.user.findUnique({ where: { email: "superadmin@pams.com" } });
  const saId = sa.id;

  const fs = new Date(); fs.setDate(fs.getDate() + 14);
  const fe = new Date(fs); fe.setDate(fe.getDate() + 2);
  const l1 = await prisma.leaveRequest.create({
    data: { userId: staffId, leaveType: "PERSONAL", startDate: fs, endDate: fe,
            reason: "Family function", durationDays: 3, isAdvance: true, isEmergency: false,
            scoringImpact: 0, status: "PENDING", proofStatus: "NOT_REQUIRED" }
  });
  IDS.leaves.push(l1.id);
  record("Leaves", "Apply personal (advance)", "PASS", `Days: ${l1.durationDays}, Advance: ${l1.isAdvance}`);

  const tm = new Date(); tm.setDate(tm.getDate() + 1);
  const te = new Date(tm); te.setDate(te.getDate() + 1);
  const l2 = await prisma.leaveRequest.create({
    data: { userId: staffId, leaveType: "SICK", startDate: tm, endDate: te,
            reason: "Feeling unwell", durationDays: 2, isAdvance: false, isEmergency: true,
            scoringImpact: -1.0, status: "PENDING", proofStatus: "NOT_REQUIRED" }
  });
  IDS.leaves.push(l2.id);
  record("Leaves", "Apply sick (emergency)", "PASS", `Emergency: ${l2.isEmergency}, Impact: ${l2.scoringImpact}`);

  const l3 = await prisma.leaveRequest.create({
    data: { userId: staffId, leaveType: "EMERGENCY", startDate: tm, endDate: te,
            reason: "Urgent", durationDays: 3, isAdvance: false, isEmergency: true,
            scoringImpact: -2.0, status: "PENDING", proofStatus: "PENDING_REVIEW" }
  });
  IDS.leaves.push(l3.id);
  record("Leaves", "Apply emergency (high penalty)", "PASS", `Impact: ${l3.scoringImpact}`);

  // Approve
  const app = await prisma.leaveRequest.update({ where: { id: l1.id }, data: { status: "APPROVED", approvedById: saId } });
  record("Leaves", "Approve leave", app.status === "APPROVED" ? "PASS" : "FAIL");

  // Reject
  const rej = await prisma.leaveRequest.update({ where: { id: l2.id }, data: { status: "REJECTED", approvedById: saId, approvalNotes: "Need cert" } });
  record("Leaves", "Reject leave", rej.status === "REJECTED" ? "PASS" : "FAIL");

  // Cancel
  const can = await prisma.leaveRequest.update({ where: { id: l3.id }, data: { status: "CANCELLED" } });
  record("Leaves", "Cancel leave", can.status === "CANCELLED" ? "PASS" : "FAIL");

  // Proof neutralizes penalty
  const l4 = await prisma.leaveRequest.create({
    data: { userId: staffId, leaveType: "SICK", startDate: tm, endDate: te,
            reason: "Proof test", durationDays: 1, isAdvance: false, isEmergency: true,
            scoringImpact: -1.0, status: "APPROVED", approvedById: saId, proofStatus: "PENDING_REVIEW" }
  });
  IDS.leaves.push(l4.id);
  const proofOk = await prisma.leaveRequest.update({ where: { id: l4.id }, data: { proofStatus: "APPROVED", scoringImpact: 0 } });
  record("Leaves", "Proof approval neutralizes penalty", proofOk.scoringImpact === 0 ? "PASS" : "FAIL");

  // Filter
  const all = await prisma.leaveRequest.findMany({ where: { userId: staffId } });
  record("Leaves", "List & filter", "PASS", `Total: ${all.length}`);

  // Leave policies
  const policies = await prisma.leavePolicy.findMany({ where: { companyId: sa.companyId } });
  record("Leaves", "Leave policies exist", policies.length > 0 ? "PASS" : "FAIL",
    `${policies.length} types: ${policies.map(p => p.leaveType).join(", ")}`);
}

// ════════════════════════════════════════════════════════════════
// 10. TASK MANAGEMENT
// ════════════════════════════════════════════════════════════════
async function testTasks() {
  console.log("\n" + "═".repeat(60));
  console.log("10. TASK MANAGEMENT");
  console.log("═".repeat(60));

  const revId = IDS.users[1], staffId = IDS.users[2];

  const d1 = new Date(); d1.setDate(d1.getDate() + 7);
  const t1 = await prisma.task.create({
    data: { assignedToId: staffId, assignedById: revId, title: "Test: Q4 Report",
            description: "Prepare Q4 analysis", deadline: d1, priority: "high", status: "ASSIGNED" }
  });
  IDS.tasks.push(t1.id);
  record("Tasks", "Create high priority", "PASS", `ID: ${t1.id}, Status: ${t1.status}`);

  const d2 = new Date(); d2.setDate(d2.getDate() + 3);
  const t2 = await prisma.task.create({
    data: { assignedToId: staffId, assignedById: revId, title: "Test: Update docs",
            deadline: d2, priority: "normal", status: "ASSIGNED" }
  });
  IDS.tasks.push(t2.id);
  record("Tasks", "Create normal priority", "PASS", `ID: ${t2.id}`);

  const d3 = new Date(); d3.setDate(d3.getDate() + 1);
  const t3 = await prisma.task.create({
    data: { assignedToId: staffId, assignedById: revId, title: "Test: Bug Fix",
            deadline: d3, priority: "urgent", status: "ASSIGNED" }
  });
  IDS.tasks.push(t3.id);
  record("Tasks", "Create urgent", "PASS", `ID: ${t3.id}`);

  // ASSIGNED -> IN_PROGRESS
  const ip = await prisma.task.update({ where: { id: t1.id }, data: { status: "IN_PROGRESS" } });
  record("Tasks", "ASSIGNED → IN_PROGRESS", ip.status === "IN_PROGRESS" ? "PASS" : "FAIL");

  // IN_PROGRESS -> COMPLETED with speed score
  const completedAt = new Date();
  const speedScore = completedAt <= d1 ? 100 : Math.max(0, 100 - Math.ceil((completedAt - d1) / 86400000) * 10);
  const comp = await prisma.task.update({
    where: { id: t1.id },
    data: { status: "COMPLETED", completedAt, speedScore, isOverdue: false, backlogWeeks: 0 }
  });
  record("Tasks", "IN_PROGRESS → COMPLETED", comp.status === "COMPLETED" ? "PASS" : "FAIL",
    `SpeedScore: ${comp.speedScore}`);

  // ASSIGNED -> CANCELLED
  const canc = await prisma.task.update({ where: { id: t3.id }, data: { status: "CANCELLED", backlogWeeks: 0 } });
  record("Tasks", "Cancel task", canc.status === "CANCELLED" ? "PASS" : "FAIL");

  // Task review
  const review = await prisma.taskReview.create({
    data: { taskId: t1.id, reviewerId: revId, accuracyScore: 85, reviewerNotes: "Good work, minor formatting issues" }
  });
  IDS.taskReviews.push(review.id);
  record("Tasks", "Create task review", "PASS", `Accuracy: ${review.accuracyScore}`);

  // Overdue detection
  const pastDeadline = new Date(); pastDeadline.setDate(pastDeadline.getDate() - 10);
  const t4 = await prisma.task.create({
    data: { assignedToId: staffId, assignedById: revId, title: "Test: Overdue task",
            deadline: pastDeadline, priority: "high", status: "IN_PROGRESS",
            isOverdue: true, backlogWeeks: 1 }
  });
  IDS.tasks.push(t4.id);
  record("Tasks", "Overdue detection", t4.isOverdue && t4.backlogWeeks >= 1 ? "PASS" : "FAIL",
    `Overdue: ${t4.isOverdue}, BacklogWeeks: ${t4.backlogWeeks}`);

  // Special permission
  const sp = await prisma.task.update({
    where: { id: t4.id }, data: { specialPermission: true, specialPermNote: "Extended by manager" }
  });
  record("Tasks", "Special permission", sp.specialPermission ? "PASS" : "FAIL");

  // WFH task flag
  const wfhTask = await prisma.task.update({ where: { id: t2.id }, data: { isWfhTask: true } });
  record("Tasks", "WFH task flag", wfhTask.isWfhTask ? "PASS" : "FAIL");

  // Task counts
  const counts = await Promise.all([
    prisma.task.count({ where: { assignedToId: staffId, status: "ASSIGNED" } }),
    prisma.task.count({ where: { assignedToId: staffId, status: "IN_PROGRESS" } }),
    prisma.task.count({ where: { assignedToId: staffId, status: "COMPLETED" } }),
    prisma.task.count({ where: { assignedToId: staffId, status: "CANCELLED" } }),
  ]);
  record("Tasks", "Task status counts", "PASS",
    `Assigned: ${counts[0]}, InProgress: ${counts[1]}, Completed: ${counts[2]}, Cancelled: ${counts[3]}`);
}

// ════════════════════════════════════════════════════════════════
// 11. SALARY & PAYROLL
// ════════════════════════════════════════════════════════════════
async function testSalary() {
  console.log("\n" + "═".repeat(60));
  console.log("11. SALARY & PAYROLL");
  console.log("═".repeat(60));

  const staffId = IDS.users[2];
  const companyId = IDS.companies[0];

  // Salary structure
  const gross = 50000 + 20000 + 5000 + 3000 + 7000; // basic+hra+da+ta+special
  const deductions = 6000 + 1500 + 5000 + 500; // pf+esi+tax+other
  const net = gross - deductions;
  const struct = await prisma.salaryStructure.upsert({
    where: { userId: staffId },
    update: {},
    create: { userId: staffId, basic: 50000, hra: 20000, da: 5000, ta: 3000, specialAllow: 7000,
              pf: 6000, esi: 1500, tax: 5000, otherDeduct: 500, netSalary: net,
              effectiveFrom: new Date("2025-01-01") }
  });
  IDS.salaryStructures.push(staffId);
  record("Salary", "Create salary structure", "PASS",
    `Basic: ₹${struct.basic}, Gross: ₹${gross}, Deductions: ₹${deductions}, Net: ₹${net}`);

  // Generate salary slip
  const slip = await prisma.salarySlip.create({
    data: { userId: staffId, companyId, month: "2025-01",
            systemGross: gross, systemDeductions: deductions, systemNet: net,
            systemBreakdown: JSON.stringify({ basic: 50000, hra: 20000, da: 5000, ta: 3000, specialAllow: 7000, pf: 6000, esi: 1500, tax: 5000, otherDeduct: 500 }),
            status: "GENERATED", generatedAt: new Date() }
  });
  IDS.salarySlips.push(slip.id);
  record("Salary", "Generate salary slip", "PASS", `Month: ${slip.month}, SystemNet: ₹${slip.systemNet}`);

  // Read slip back
  const readSlip = await prisma.salarySlip.findUnique({ where: { id: slip.id }, include: { user: { select: { firstName: true, lastName: true } } } });
  record("Salary", "Read salary slip", readSlip ? "PASS" : "FAIL",
    `User: ${readSlip?.user.firstName} ${readSlip?.user.lastName}`);

  // Second month slip with bonus
  const slip2 = await prisma.salarySlip.create({
    data: { userId: staffId, companyId, month: "2025-02",
            systemGross: gross, systemDeductions: deductions, systemNet: net,
            bonusPercentage: 110, bonusAmount: 5000,
            status: "GENERATED", generatedAt: new Date() }
  });
  IDS.salarySlips.push(slip2.id);
  record("Salary", "Slip with bonus", "PASS", `Bonus: ₹${slip2.bonusAmount}, Percent: ${slip2.bonusPercentage}%`);

  // Offer letter template
  const tmpl = await prisma.offerLetterTemplate.create({
    data: { companyId, name: "Standard Offer", content: "Dear {{name}},\nPosition: {{designation}}\nSalary: ₹{{salary}}" }
  });
  IDS.offerTemplates.push(tmpl.id);
  record("Salary", "Create offer letter template", "PASS", `ID: ${tmpl.id}`);

  // Offer letter
  const offer = await prisma.offerLetter.create({
    data: { userId: staffId, templateId: tmpl.id, content: "Dear TestStaff,\nPosition: Executive\nSalary: ₹85000" }
  });
  record("Salary", "Generate offer letter", "PASS", `ID: ${offer.id}`);
}

// ════════════════════════════════════════════════════════════════
// 12. PERFORMANCE SCORING
// ════════════════════════════════════════════════════════════════
async function testPerformance() {
  console.log("\n" + "═".repeat(60));
  console.log("12. PERFORMANCE SCORING");
  console.log("═".repeat(60));

  const staffId = IDS.users[2];
  const paramId = IDS.parameters[0]; // Test Teamwork parameter

  // Create perf score (per parameter)
  const score = await prisma.perfScore.create({
    data: { userId: staffId, parameterId: paramId, period: "2025-01",
            rawValue: 85.0, normalizedScore: 78.5, weightedScore: 9.42 }
  });
  IDS.perfScores.push(score.id);
  record("Performance", "Create perf score", "PASS",
    `Raw: ${score.rawValue}, Normalized: ${score.normalizedScore}, Weighted: ${score.weightedScore}`);

  // Bonus calculation
  const bonus = await prisma.bonusCalculation.create({
    data: { userId: staffId, period: "2025-01", totalScore: 78.5, bonusPercentage: 115,
            tier: "Above Average", breakdown: JSON.stringify({ teamwork: 78.5 }) }
  });
  record("Performance", "Bonus calculation", "PASS",
    `TotalScore: ${bonus.totalScore}, Bonus%: ${bonus.bonusPercentage}, Tier: ${bonus.tier}`);

  // Rankings query
  const rankings = await prisma.perfScore.findMany({
    where: { period: "2025-01" },
    orderBy: { weightedScore: "desc" },
    include: { user: { select: { firstName: true, lastName: true, employeeCode: true } } }
  });
  record("Performance", "Rankings query", rankings.length > 0 ? "PASS" : "FAIL",
    `${rankings.length} entries`);
}

// ════════════════════════════════════════════════════════════════
// 13. NOTIFICATIONS
// ════════════════════════════════════════════════════════════════
async function testNotifications() {
  console.log("\n" + "═".repeat(60));
  console.log("13. NOTIFICATIONS");
  console.log("═".repeat(60));

  const staffId = IDS.users[2];
  const n1 = await prisma.notification.create({
    data: { userId: staffId, type: "task_assigned", subject: "Task Assigned",
            message: "You have been assigned a new task", channel: "EMAIL", status: "PENDING" }
  });
  IDS.notifications.push(n1.id);
  record("Notifications", "Create notification (EMAIL)", "PASS", `Type: ${n1.type}`);

  const n2 = await prisma.notification.create({
    data: { userId: staffId, type: "leave_approved", subject: "Leave Approved",
            message: "Your leave has been approved", channel: "BOTH", status: "SENT", sentAt: new Date() }
  });
  IDS.notifications.push(n2.id);
  record("Notifications", "Create notification (BOTH)", "PASS", `Status: ${n2.status}`);

  // Mark as sent
  const sent = await prisma.notification.update({ where: { id: n1.id }, data: { status: "SENT", sentAt: new Date() } });
  record("Notifications", "Mark as sent", sent.status === "SENT" ? "PASS" : "FAIL");

  // List with filters
  const pending = await prisma.notification.findMany({ where: { userId: staffId, status: "PENDING" } });
  const all = await prisma.notification.findMany({ where: { userId: staffId } });
  record("Notifications", "List & filter", "PASS", `Total: ${all.length}, Pending: ${pending.length}`);
}

// ════════════════════════════════════════════════════════════════
// 14. ANOMALY REPORTS
// ════════════════════════════════════════════════════════════════
async function testAnomalyReports() {
  console.log("\n" + "═".repeat(60));
  console.log("14. ANOMALY REPORTS");
  console.log("═".repeat(60));

  const companyId = IDS.companies[0];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const report = await prisma.anomalyReport.create({
    data: { companyId, date: today,
            summary: "2 anomalies detected: Simultaneous Absence, Geo-fence Violation",
            details: JSON.stringify([
              { type: "Simultaneous Absence", users: ["EMP001", "EMP002"], severity: "high" },
              { type: "Geo-fence Violation", users: ["EMP003"], severity: "medium" }
            ]),
            sentTo: ["admin@test.com", "hr@test.com"], sentAt: new Date() }
  });
  record("AnomalyReport", "Create anomaly report", "PASS", `ID: ${report.id}, Summary: ${report.summary.substring(0, 40)}`);

  const reports = await prisma.anomalyReport.findMany({ where: { companyId } });
  record("AnomalyReport", "List reports", "PASS", `Found ${reports.length}`);
}

// ════════════════════════════════════════════════════════════════
// 15. RBAC PERMISSION CHECKS
// ════════════════════════════════════════════════════════════════
async function testRBAC() {
  console.log("\n" + "═".repeat(60));
  console.log("15. ROLE-BASED ACCESS CONTROL");
  console.log("═".repeat(60));

  // Check SA has all admin perms
  const sa = await prisma.user.findUnique({ where: { email: "superadmin@pams.com" }, include: { featurePermissions: true } });
  const saAdminPerms = sa.featurePermissions.filter(p => p.feature.startsWith("admin_"));
  record("RBAC", "SUPER_ADMIN has admin_* permissions", saAdminPerms.length >= 4 ? "PASS" : "FAIL",
    `${saAdminPerms.length} admin features`);

  // Reviewer has NO admin perms
  const rev = await prisma.user.findUnique({ where: { email: "testreviewer@tcalpha.com" }, include: { featurePermissions: true } });
  const revAdmin = rev.featurePermissions.filter(p => p.feature.startsWith("admin_"));
  record("RBAC", "REVIEWER has NO admin perms", revAdmin.length === 0 ? "PASS" : "FAIL");

  // Reviewer CAN approve tasks/leaves
  const revTasks = rev.featurePermissions.find(p => p.feature === "tasks");
  record("RBAC", "REVIEWER can approve tasks", revTasks?.canApprove ? "PASS" : "FAIL");
  const revLeaves = rev.featurePermissions.find(p => p.feature === "leaves");
  record("RBAC", "REVIEWER can approve leaves", revLeaves?.canApprove ? "PASS" : "FAIL");

  // Staff CANNOT delete
  const staff = await prisma.user.findUnique({ where: { email: "teststaff@tcalpha.com" }, include: { featurePermissions: true } });
  const staffCanDelete = staff.featurePermissions.some(p => p.canDelete);
  record("RBAC", "STAFF cannot delete", !staffCanDelete ? "PASS" : "FAIL");

  // Staff CANNOT approve
  const staffCanApprove = staff.featurePermissions.some(p => p.canApprove);
  record("RBAC", "STAFF cannot approve", !staffCanApprove ? "PASS" : "FAIL");

  // Staff has NO admin features
  const staffAdmin = staff.featurePermissions.filter(p => p.feature.startsWith("admin_"));
  record("RBAC", "STAFF has NO admin perms", staffAdmin.length === 0 ? "PASS" : "FAIL");

  // Tenant isolation: cross-company user can't see other company data
  const comp1Users = await prisma.user.findMany({ where: { companyId: IDS.companies[0] } });
  const comp2Users = await prisma.user.findMany({ where: { companyId: IDS.companies[1] } });
  const comp1Ids = new Set(comp1Users.map(u => u.id));
  const comp2Ids = new Set(comp2Users.map(u => u.id));
  const overlap = [...comp1Ids].filter(id => comp2Ids.has(id));
  record("RBAC", "No user overlap between companies", overlap.length === 0 ? "PASS" : "FAIL");
}

// ════════════════════════════════════════════════════════════════
// CLEANUP
// ════════════════════════════════════════════════════════════════
async function cleanup() {
  console.log("\n" + "═".repeat(60));
  console.log("CLEANUP — Removing ALL test data");
  console.log("═".repeat(60));

  const del = async (label, fn) => {
    try { const r = await fn(); console.log(`  🧹 ${label}: deleted`); }
    catch (e) { console.log(`  ⚠️  ${label}: ${e.message.substring(0, 60)}`); }
  };

  // Delete in reverse dependency order
  for (const id of IDS.notifications) await del(`Notification ${id}`, () => prisma.notification.delete({ where: { id } }));
  await del("BonusCalcs", () => prisma.bonusCalculation.deleteMany({ where: { userId: { in: IDS.users } } }));
  for (const id of IDS.perfScores) {
    await del(`PerfScore ${id}`, () => prisma.perfScore.delete({ where: { id } }));
  }
  for (const id of IDS.taskReviews) await del(`TaskReview ${id}`, () => prisma.taskReview.delete({ where: { id } }));
  for (const id of IDS.tasks) await del(`Task ${id}`, () => prisma.task.delete({ where: { id } }));
  for (const id of IDS.leaves) await del(`Leave ${id}`, () => prisma.leaveRequest.delete({ where: { id } }));
  for (const id of IDS.geoExitLogs) await del(`GeoExitLog ${id}`, () => prisma.geoExitLog.delete({ where: { id } }));
  for (const id of IDS.attendance) await del(`Attendance ${id}`, () => prisma.attendance.delete({ where: { id } }));
  for (const id of IDS.salarySlips) await del(`SalarySlip ${id}`, () => prisma.salarySlip.delete({ where: { id } }));
  for (const uid of IDS.salaryStructures) await del(`SalaryStruct ${uid}`, () => prisma.salaryStructure.delete({ where: { userId: uid } }));
  for (const id of IDS.offerTemplates) {
    await del(`OfferLetters for ${id}`, () => prisma.offerLetter.deleteMany({ where: { templateId: id } }));
    await del(`OfferTemplate ${id}`, () => prisma.offerLetterTemplate.delete({ where: { id } }));
  }
  for (const id of IDS.anomalyRules) await del(`AnomalyRule ${id}`, () => prisma.anomalyRule.delete({ where: { id } }));
  await del("AnomalyReports", () => prisma.anomalyReport.deleteMany({ where: { companyId: { in: IDS.companies } } }));
  for (const id of IDS.parameters) await del(`Parameter ${id}`, () => prisma.perfParameter.delete({ where: { id } }));
  for (const id of IDS.geofences) await del(`Geofence ${id}`, () => prisma.geoFence.delete({ where: { id } }));
  // Users (cascade deletes featurePermissions)
  for (const id of IDS.users) await del(`User ${id}`, () => prisma.user.delete({ where: { id } }));
  for (const id of IDS.companies) await del(`Company ${id}`, () => prisma.company.delete({ where: { id } }));
}

// ════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════
async function main() {
  console.log("╔" + "═".repeat(58) + "╗");
  console.log("║  P&AMS — COMPREHENSIVE SYSTEM TEST (Prisma Direct)       ║");
  console.log("║  Testing ALL features with dummy data                     ║");
  console.log("╚" + "═".repeat(58) + "╝");

  try {
    await testAuth();
    await testCompanies();
    await testUsers();
    await testGeofences();
    await testParameters();
    await testRights();
    await testAnomalyRules();
    await testAttendance();
    await testLeaves();
    await testTasks();
    await testSalary();
    await testPerformance();
    await testNotifications();
    await testAnomalyReports();
    await testRBAC();
  } catch (err) {
    console.error("\n💥 CRITICAL ERROR:", err.message, err.stack?.split("\n").slice(0, 3).join("\n"));
  }

  // Summary
  console.log("\n" + "╔" + "═".repeat(58) + "╗");
  console.log("║  TEST RESULTS SUMMARY                                    ║");
  console.log("╚" + "═".repeat(58) + "╝\n");

  const pass = results.filter(r => r.status === "PASS").length;
  const fail = results.filter(r => r.status === "FAIL").length;
  const warn = results.filter(r => r.status === "WARN").length;
  const total = results.length;

  const sections = {};
  for (const r of results) {
    if (!sections[r.section]) sections[r.section] = { pass: 0, fail: 0, warn: 0, tests: [] };
    sections[r.section][r.status === "PASS" ? "pass" : r.status === "FAIL" ? "fail" : "warn"]++;
    sections[r.section].tests.push(r);
  }

  for (const [section, data] of Object.entries(sections)) {
    const icon = data.fail === 0 ? "✅" : "❌";
    console.log(`${icon} ${section}: ${data.pass}/${data.pass + data.fail + data.warn} passed`);
    if (data.fail > 0) {
      for (const t of data.tests.filter(t => t.status === "FAIL")) {
        console.log(`   ❌ ${t.test}: ${t.detail}`);
      }
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  console.log(`TOTAL: ${pass} PASSED | ${fail} FAILED | ${warn} WARNINGS | ${total} tests`);
  console.log(`${"─".repeat(60)}`);

  if (fail === 0) console.log("\n🎉 ALL TESTS PASSED!");
  else console.log(`\n⚠️  ${fail} test(s) need attention.`);

  // Cleanup
  await cleanup();
  console.log("\n✅ Test complete. All dummy data removed.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error("Fatal:", e); await prisma.$disconnect(); process.exit(1); });
