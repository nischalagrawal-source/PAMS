import { PrismaClient } from './src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function test() {
  console.log("Testing leaveRequest.findMany...");
  try {
    const leaves = await prisma.leaveRequest.findMany({
      where: { user: { isActive: true } },
      take: 1,
      orderBy: { appliedOn: "desc" },
    });
    console.log("✅ leaveRequest OK, count:", leaves.length);
  } catch (e) {
    console.error("❌ leaveRequest ERROR:", e.message);
  }

  console.log("\nTesting attendance.findMany...");
  try {
    const att = await prisma.attendance.findMany({
      where: { user: { isActive: true } },
      take: 1,
      orderBy: [{ date: "desc" }, { user: { firstName: "asc" } }],
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    console.log("✅ attendance OK, count:", att.length);
  } catch (e) {
    console.error("❌ attendance ERROR:", e.message);
  }

  console.log("\nTesting attendance.findMany (no relation orderBy)...");
  try {
    const att2 = await prisma.attendance.findMany({
      where: { user: { isActive: true } },
      take: 1,
      orderBy: { date: "desc" },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    console.log("✅ attendance (simple orderBy) OK, count:", att2.length);
  } catch (e) {
    console.error("❌ attendance (simple orderBy) ERROR:", e.message);
  }

  await prisma.$disconnect();
}

test();
