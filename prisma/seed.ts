// Creates what a fresh database needs before anyone can log in: the first
// admin account and the two starting skill categories. Safe to run again.
//
//   pnpm db:seed
import "dotenv/config";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

const STARTING_CATEGORIES = ["Technology Skills", "Hand Skills"];

async function main() {
  const name = process.env.SEED_ADMIN_NAME || "College Admin";
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env first.");
  }

  for (const categoryName of STARTING_CATEGORIES) {
    await prisma.category.upsert({
      where: { name: categoryName },
      update: {},
      create: { name: categoryName },
    });
  }
  console.log(`Categories ready: ${STARTING_CATEGORIES.join(", ")}.`);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin ${email} already exists. Left as it is.`);
    return;
  }

  // Called on the server with no request, so Better Auth skips the admin check.
  await auth.api.createUser({ body: { name, email, password, role: "admin" } });
  console.log(`Admin ${email} created. Log in with the password from .env, then change it.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
