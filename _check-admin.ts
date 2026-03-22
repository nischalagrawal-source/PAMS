import { PrismaClient } from "./src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: "superadmin@pams.com" },
    select: { id: true, email: true, role: true, isActive: true, firstName: true, lastName: true },
  });
  console.log("Super Admin:", JSON.stringify(u, null, 2));

  const count = await prisma.user.count();
  console.log("Total users in DB:", count);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
