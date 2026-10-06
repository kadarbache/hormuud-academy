import Link from "next/link";
import { SearchX } from "lucide-react";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";

// Pages call notFound() for a record that doesn't exist and for one at a
// branch the staff member can't see, so the text covers both.
export default function AppNotFound() {
  return (
    <PageMessage
      icon={SearchX}
      title="Not found"
      action={
        <Button variant="outline" asChild>
          <Link href="/students">Go to Students</Link>
        </Button>
      }
    >
      It may have been deleted, or it belongs to another branch.
    </PageMessage>
  );
}
