import Link from "next/link";
import { SearchX } from "lucide-react";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";

// A skill that isn't the student's, or an address made up.
export default function PortalNotFound() {
  return (
    <PageMessage
      icon={SearchX}
      title="Not found"
      action={
        <Button variant="outline" asChild>
          <Link href="/portal">Go to My skills</Link>
        </Button>
      }
    >
      There&apos;s nothing of yours at this address.
    </PageMessage>
  );
}
