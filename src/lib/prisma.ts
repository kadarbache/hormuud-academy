import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

function createClient() {
  // The pg adapter works against Neon in production and the local `prisma dev`
  // database alike. The local one takes a single connection at a time, so
  // .env sets DATABASE_POOL_MAX=1 there; production keeps pg's default pool.
  const max = process.env.DATABASE_POOL_MAX
    ? Number(process.env.DATABASE_POOL_MAX)
    : undefined;
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max });
  return new PrismaClient({ adapter });
}

// Cached on globalThis so dev-mode HMR reuses one client and one pool.
export const prisma = globalThis.prismaGlobal ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}
