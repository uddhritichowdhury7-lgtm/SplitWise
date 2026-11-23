// Seeds a small demo dataset so /login and /profile can be tested
// immediately, without registering users by hand first.
//
// Run with:  node prisma/seed.js
// Safe to run more than once (uses upsert, not create).

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const DEMO_PASSWORD = "password123";

const DEMO_USERS = [
  { name: "Aarav Sharma", email: "aarav@example.com" },
  { name: "Priya Nair", email: "priya@example.com" },
  { name: "Rohan Gupta", email: "rohan@example.com" }
];

async function main() {
  console.log("Seeding demo users...\n");

  for (const demo of DEMO_USERS) {
    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

    const user = await prisma.user.upsert({
      where: { email: demo.email },
      update: {
        name: demo.name,
        password: hashedPassword
      },
      create: {
        name: demo.name,
        email: demo.email,
        password: hashedPassword
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    console.log(`  [id ${user.id}] ${user.name} <${user.email}>`);
  }


  const users = await prisma.user.findMany({ where: { email: { in: DEMO_USERS.map(u => u.email) } } });
  let group = await prisma.group.findFirst({ where: { name: 'College Flatmates' } });
  if (!group) {
    group = await prisma.group.create({ data: { name: 'College Flatmates', creatorId: users[0].id } });
  }
  for (const user of users) {
    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: user.id } },
      update: {}, create: { groupId: group.id, userId: user.id }
    });
  }
  const existingExpense = await prisma.expense.count({ where: { groupId: group.id } });
  if (!existingExpense) {
    const totalPaise = 60000;
    const base = Math.floor(totalPaise / users.length);
    await prisma.expense.create({
      data: {
        groupId: group.id, payerId: users[0].id, description: 'Welcome dinner',
        amountPaise: totalPaise,
        splits: { create: users.map((u, i) => ({ userId: u.id, sharePaise: base + (i < totalPaise % users.length ? 1 : 0) })) }
      }
    });
  }
  console.log('Demo group and a sample expense are ready.');

  const total = await prisma.user.count();

  console.log(`\nDone. Total users in database: ${total}`);
  console.log(`Password for every demo user: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("\nSeeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
