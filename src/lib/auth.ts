import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { prisma } from "@/lib/prisma";

const googleClient =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET }
    : null;

/** The Google button is hidden until both Google keys are in .env. */
export const googleSignInEnabled = googleClient !== null;

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
  socialProviders: googleClient
    ? {
        google: {
          ...googleClient,
          // A Google account gets in only if the admin made an account with
          // its email. Better Auth links the two on the first sign-in, and
          // only when the account's email is marked verified, which every
          // account the admin creates is.
          disableSignUp: true,
          // Turns off signing in by posting a Google ID token straight to
          // /api/auth/sign-in/social. The app never uses it, and Better Auth
          // 1.7.5 ignores disableSignUp there, so anyone with a Google
          // account could otherwise create themselves a staff account.
          disableIdTokenSignIn: true,
          // Always show Google's account picker, so on a shared branch
          // computer nobody walks in as whoever signed in last.
          prompt: "select_account",
        },
      }
    : {},
  databaseHooks: {
    user: {
      create: {
        // Every account is made by an admin (or the seed) through the admin
        // plugin's create-user. Refuse any other way Better Auth might create
        // a user, such as a sign-up that a setting failed to switch off.
        // The code makes a refused Google sign-in land on /login with the
        // "no account for that Google address" message.
        before: async (_user, context) => {
          if (context?.path !== "/admin/create-user") {
            throw APIError.from("FORBIDDEN", {
              code: "signup_disabled",
              message: "Accounts are created by the admin.",
            });
          }
        },
      },
    },
  },
  account: {
    // Better Auth keeps the tokens Google hands back. The app never uses
    // them, so they only need to be unreadable if the database leaks.
    encryptOAuthTokens: true,
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
