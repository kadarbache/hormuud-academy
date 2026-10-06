"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { formObject } from "@/lib/validation";
import { parseStudentNumber } from "@/lib/format";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { studentLoginEmail } from "@/lib/student-logins";

// Per account, to stop guessing one person's password from many machines.
// Per IP, to stop one machine trying many accounts. A whole class signing in
// on the branch Wi-Fi shares one IP, so that limit leaves room for a few
// typos each; the per-account limit is what stops a guesser.
const ACCOUNT_LIMIT = { window: 60, max: 5 };
const IP_LIMIT = { window: 60, max: 60 };
const GOOGLE_IP_LIMIT = { window: 60, max: 20 };

const signInSchema = z.object({
  login: z.string().trim().min(1, "Enter your email or Student ID."),
  password: z.string().min(1, "Enter your password."),
});

/**
 * Staff sign in with an email, a student with their Student ID. The ID
 * stands for the made-up email on the student's login.
 */
function loginEmail(login: string) {
  if (login.includes("@")) {
    const email = z.email().safeParse(login.toLowerCase());
    return email.success ? { email: email.data, student: false } : null;
  }
  const number = parseStudentNumber(login);
  return number === null ? null : { email: studentLoginEmail(number), student: true };
}

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const who = loginEmail(parsed.data.login);
  if (!who) {
    return failure("Check the highlighted fields.", {
      login: ["Enter your email, or a Student ID like STU-00042."],
    });
  }

  const requestHeaders = await headers();
  const byAccount = await consumeRateLimit(`sign-in:email:${who.email}`, ACCOUNT_LIMIT);
  const byIp = await consumeRateLimit(`sign-in:ip:${clientIp(requestHeaders)}`, IP_LIMIT);
  if (!byAccount.allowed || !byIp.allowed) {
    const seconds = Math.max(
      byAccount.allowed ? 0 : byAccount.retryAfter,
      byIp.allowed ? 0 : byIp.retryAfter,
    );
    return failure(`Too many login attempts. Wait ${seconds} seconds and try again.`);
  }

  try {
    // nextCookies() in the auth config sets the session cookie on this response.
    await auth.api.signInEmail({
      body: { email: who.email, password: parsed.data.password },
      headers: requestHeaders,
    });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.body?.code === "BANNED_USER") {
        return failure(
          who.student
            ? "Your login has been turned off. Ask at your branch."
            : "This account has been deactivated. Ask the admin to turn it back on.",
        );
      }
      return failure(who.student ? "Wrong Student ID or password." : "Wrong email or password.");
    }
    throw error;
  }

  return success();
}

/**
 * Sends the browser to Google. Google sends it back to Better Auth's callback,
 * which logs the person in and goes on to the home page, or comes back to
 * /login with `?error=` when the Google account has no account here.
 */
export async function signInWithGoogle() {
  const requestHeaders = await headers();
  // Every click stores a sign-in attempt, so one machine can't pile them up.
  const byIp = await consumeRateLimit(`sign-in:google:ip:${clientIp(requestHeaders)}`, GOOGLE_IP_LIMIT);
  if (!byIp.allowed) redirect("/login?error=too_many_attempts");

  // nextCookies() sets the cookie Better Auth checks when Google sends the
  // person back, so nobody can finish a sign-in someone else started.
  const { url } = await auth.api.signInSocial({
    body: { provider: "google", callbackURL: "/", errorCallbackURL: "/login" },
    headers: requestHeaders,
  });
  if (!url) throw new Error("Better Auth returned no Google sign-in address.");
  redirect(url);
}
