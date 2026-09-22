"use server";

import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { formObject } from "@/lib/validation";
import { clientIp, consumeRateLimit } from "@/lib/rate-limit";

// Per email, to stop guessing one person's password from many machines. Per
// IP, to stop one machine trying many emails.
const EMAIL_LIMIT = { window: 60, max: 5 };
const IP_LIMIT = { window: 60, max: 20 };

const signInSchema = z.object({
  email: z.email("Enter your email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  const requestHeaders = await headers();
  const email = parsed.data.email.trim().toLowerCase();
  const byEmail = await consumeRateLimit(`sign-in:email:${email}`, EMAIL_LIMIT);
  const byIp = await consumeRateLimit(`sign-in:ip:${clientIp(requestHeaders)}`, IP_LIMIT);
  if (!byEmail.allowed || !byIp.allowed) {
    const seconds = Math.max(
      byEmail.allowed ? 0 : byEmail.retryAfter,
      byIp.allowed ? 0 : byIp.retryAfter,
    );
    return failure(`Too many login attempts. Wait ${seconds} seconds and try again.`);
  }

  try {
    // nextCookies() in the auth config sets the session cookie on this response.
    await auth.api.signInEmail({ body: parsed.data, headers: requestHeaders });
  } catch (error) {
    if (error instanceof APIError) {
      if (error.body?.code === "BANNED_USER") {
        return failure("This account has been deactivated. Ask the admin to turn it back on.");
      }
      return failure("Wrong email or password.");
    }
    throw error;
  }

  return success();
}
