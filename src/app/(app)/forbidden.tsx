import Link from "next/link";
import { Lock } from "lucide-react";
import { PageMessage } from "@/components/page-message";
import { Button } from "@/components/ui/button";

// requireAdmin() shows this when branch staff open an admin page, such as
// Finance or Settings, from an old link or by typing the address.
export default function AppForbidden() {
  return (
    <PageMessage
      icon={Lock}
      title="Admins only"
      action={
        <Button variant="outline" asChild>
          <Link href="/students">Go to Students</Link>
        </Button>
      }
    >
      Only the admin can open this page. If you need something from it, ask the admin.
    </PageMessage>
  );
}
