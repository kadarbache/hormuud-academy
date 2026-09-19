"use server";

import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { failure, invalid, success, type ActionResult } from "@/lib/action-result";
import { formObject } from "@/lib/validation";

const signInSchema = z.object({
  email: z.email("Enter your email address."),
  password: z.string().min(1, "Enter your password."),
});

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);

  try {
    // nextCookies() in the auth config sets the session cookie on this response.
    await auth.api.signInEmail({ body: parsed.data, headers: await headers() });
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
