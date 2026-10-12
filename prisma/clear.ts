// Remove all demo data before going live. Keeps the admin seat so you can
// still log in with ADMIN_CODE.   npm run db:clear

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.report.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.bookedCall.deleteMany();
  await prisma.application.deleteMany();
  const { count } = await prisma.member.deleteMany({ where: { role: { not: "admin" } } });
  console.log(`Cleared all applications, calls, payments and reports, and ${count} non-admin members.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
