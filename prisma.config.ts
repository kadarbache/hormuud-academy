import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The CLI (migrate, studio) needs a direct connection. Neon's pooled URL
    // is for the running app only. Neon's Vercel integration names the direct
    // one DATABASE_URL_UNPOOLED, so that works too.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL_UNPOOLED"],
    // Only needed for `prisma migrate dev` against the local `prisma dev`
    // server, which keeps its shadow database on a separate port.
    shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"] || undefined,
  },
});
