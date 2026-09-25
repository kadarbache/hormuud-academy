// Creates what a fresh database needs before anyone can log in: the first
// admin account and the two starting skill categories. Safe to run again.
// Run with a new email, it adds another admin, which is also the way back in
// if the only admin loses their Google account.
//
//   pnpm db:seed
import "dotenv/config";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

const STARTING_CATEGORIES = ["Technology Skills", "Hand Skills"];

async function main() {
  const name = process.env.SEED_ADMIN_NAME || "College Admin";
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error("Set SEED_ADMIN_EMAIL in .env to the admin's Gmail address first.");
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
  // No password, like every staff account: the admin signs in with Google.
  await auth.api.createUser({
    body: { name, email, role: "admin", data: { emailVerified: true } },
  });
  console.log(`Admin ${email} created. Open the app and sign in with Google as ${email}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
