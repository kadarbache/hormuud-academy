import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { FullPageMessage } from "@/components/full-page-message";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Not found" };

// For an address that matches no page at all. A record that doesn't exist
// gets (app)/not-found.tsx instead, which keeps the sidebar.
export default function NotFound() {
  return (
    <FullPageMessage
      icon={SearchX}
      title="Page not found"
      action={
        <Button className="w-full" asChild>
          <Link href="/students">Go to Students</Link>
        </Button>
      }
    >
      There&apos;s no page at this address. Check the link you followed, or start again from the
      students list.
    </FullPageMessage>
  );
}
