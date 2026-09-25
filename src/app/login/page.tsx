import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GraduationCap } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldSeparator } from "@/components/ui/field";
import { FormError } from "@/components/form-fields";
import { ThemeToggle } from "@/components/theme-toggle";
import { googleSignInEnabled } from "@/lib/auth";
import { one } from "@/lib/search-params";
import { getCurrentUser } from "@/lib/session";
import { GoogleSignIn } from "./google-sign-in";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

// A failed Google sign-in comes back here as ?error=, with Better Auth's code
// or our own. Anything not listed gets the general message.
const googleErrors: Record<string, string> = {
  signup_disabled:
    "There's no account for that Google address. Pick the Google account the admin added, or ask the admin to add this one.",
  BANNED_USER: "This account has been deactivated. Ask the admin to turn it back on.",
  account_not_linked:
    "Your account isn't ready for Google yet. Ask the admin to open it under Staff accounts, check the email and save.",
  access_denied: "Google sign-in was cancelled.",
  too_many_attempts: "Too many login attempts. Wait a minute and try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/students");
  const error = one(await searchParams, "error");
  const googleError = error ? (googleErrors[error] ?? "Google sign-in didn't work. Try again.") : null;

  return (
    <main className="relative flex flex-1 items-center justify-center bg-muted/40 p-4">
      <ThemeToggle className="absolute top-4 right-4" />
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </div>
          <CardTitle className="text-xl">Hormuud Academy</CardTitle>
          <CardDescription>
            Log in with the account the admin gave you.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <FormError message={googleError} />
          {googleSignInEnabled && (
            <>
              <GoogleSignIn />
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                or use your password
              </FieldSeparator>
            </>
          )}
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
