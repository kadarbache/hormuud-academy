import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordForm } from "@/components/password-form";
import { requireStudent } from "@/lib/session";
import { changePassword } from "./actions";

export const metadata: Metadata = { title: "Password" };

export default async function PortalPasswordPage() {
  const user = await requireStudent({ onTemporaryPassword: true });
  const first = user.mustChangePassword;

  return (
    <>
      {!first && (
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/portal/details">
            <ChevronLeft />
            My details
          </Link>
        </Button>
      )}
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{first ? "Choose your password" : "Change password"}</CardTitle>
          <CardDescription>
            {first
              ? "The password from your branch was only for signing in this once. Choose one of your own that nobody else knows."
              : "You'll be logged out on any other phone you're signed in on."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm action={changePassword} askCurrent={!first} minLength={8} home="/portal" />
        </CardContent>
      </Card>
    </>
  );
}
