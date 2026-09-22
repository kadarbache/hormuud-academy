import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Nobody signs up. The admin creates every staff account.
    disableSignUp: true,
    minPasswordLength: 8,
  },
  // Only covers requests to /api/auth. The login form signs in through a
  // server action, which checks its own limits (src/lib/rate-limit.ts). Kept
  // in the database because Vercel's function instances don't share memory.
  rateLimit: {
    storage: "database",
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
    },
  },
  user: {
    additionalFields: {
      // Set by the admin only, never from a sign-in form.
      branchId: { type: "string", required: false, input: false },
    },
  },
  plugins: [
    admin({
      // Admins manage staff accounts. Branch staff get none of the admin
      // plugin's permissions; what they may do with students is checked in
      // our own code (src/lib/session.ts and each feature's actions).
      roles: { admin: adminAc, staff: userAc },
      defaultRole: "staff",
      adminRoles: ["admin"],
    }),
    // Must stay last so it can set cookies for every other plugin's responses.
    nextCookies(),
  ],
});
