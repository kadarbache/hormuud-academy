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
    // Students sign in with a password, and teachers can, with Google or
    // instead of it. Staff use Google. A teacher's own password is held to
    // more than this (src/lib/teacher-logins.ts).
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
        // Every account is made through the admin plugin's create-user: by
        // the admin on Staff accounts, by staff giving a student a login
        // (src/lib/student-logins.ts), or by the seed. Refuse any other way
        // Better Auth might create a user, such as a sign-up that a setting
        // failed to switch off.
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
    account: {
      create: {
        // A student signs in with their Student ID and password only. Their
        // login's email is a made-up address no Google account can have, but
        // a signed-in student could still ask Better Auth to link a Google
        // account to it, so that is refused here too.
        before: async (account) => {
          if (account.providerId === "credential") return;
          const user = await prisma.user.findUnique({
            where: { id: account.userId },
            select: { role: true },
          });
          if (user?.role === "student") {
            throw APIError.from("FORBIDDEN", {
              code: "student_google",
              message: "Students sign in with their Student ID.",
            });
          }
        },
      },
    },
    session: {
      create: {
        // A session is made only once the password is checked, so refusing
        // here never tells a guesser that a temporary password has expired.
        // It applies to a password sign-in only: a teacher whose temporary
        // password ran out can still come in with Google.
        before: async (session, context) => {
          if (context?.path !== "/sign-in/email") return;
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { mustChangePassword: true, temporaryPasswordExpires: true },
          });
          const expires = user?.mustChangePassword ? user.temporaryPasswordExpires : null;
          if (expires && expires <= new Date()) {
            throw APIError.from("FORBIDDEN", {
              code: "temporary_password_expired",
              message: "This temporary password has expired.",
            });
          }
        },
        // Every time a teacher gets in, kept with how and from where.
        after: async (session, context) => {
          const action =
            context?.path === "/sign-in/email"
              ? "SIGNED_IN_WITH_PASSWORD"
              : context?.path?.startsWith("/callback/")
                ? "SIGNED_IN_WITH_GOOGLE"
                : null;
          if (!action) return;
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { teacherId: true },
          });
          if (user?.teacherId) {
            await prisma.teacherLoginEvent.create({
              data: {
                teacherId: user.teacherId,
                action,
                byId: session.userId,
                ipAddress: session.ipAddress || null,
              },
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
      // Set by our own code only, never from a sign-in form.
      branchId: { type: "string", required: false, input: false },
      teacherId: { type: "string", required: false, input: false },
      studentId: { type: "string", required: false, input: false },
      mustChangePassword: { type: "boolean", required: false, defaultValue: false, input: false },
    },
  },
  plugins: [
    admin({
      // Admins manage staff accounts. Branch staff, teachers and students
      // get none of the admin plugin's permissions; what they may do is
      // checked in our own code (src/lib/session.ts and each feature's
      // actions).
      roles: { admin: adminAc, staff: userAc, teacher: userAc, student: userAc },
      defaultRole: "staff",
      adminRoles: ["admin"],
    }),
    // Must stay last so it can set cookies for every other plugin's responses.
    nextCookies(),
  ],
});
